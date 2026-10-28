import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  seed,
  restoreInvoice,
  validateInvoice,
  importInvoice,
  minor,
  imageAsset,
  bytes,
} from "../src/contracts/document.ts";
import {
  financial,
  toNative,
  validateDocument,
  SOURCE_COMMIT,
} from "../src/contracts/native.ts";
import { renderInvoice } from "../src/server/pdf.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
function resource(id: string, relative: string) {
  const m = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
  );
  const asset = m.resources.find(
    (r: { id: string; path: string }) => r.id === id,
  );
  assert.ok(asset);
  return new URL("../" + asset.path + "/" + relative, import.meta.url);
}

test("native invoice money applies discount before invoice tax and preserves paid balance", () => {
  const d = structuredClone(seed);
  d.kind = "invoice";
  d.items = [
    {
      id: "a",
      description: "品牌设计",
      unit: "项",
      quantity: "2",
      price: "1250.00",
    },
  ];
  d.discount = "10";
  d.paid = "500";
  const n = financial(d);
  assert.equal(n.subTotalAmount, 2500);
  assert.equal(n.discountAmount, 250);
  assert.equal(n.totalTax, 135);
  assert.equal(n.totalAmount, 2385);
  assert.equal(n.balanceDue, 1885);
  assert.equal(n.totalAmountFormatted, "CNY 2,385.00");
});
test("minor units, inclusive tax and zero-decimal currency follow the native calculation", () => {
  assert.equal(minor("19.99", "CNY", "price"), 1999);
  assert.throws(() => minor("1.01", "JPY", "price"));
  const d = structuredClone(seed);
  d.items = [
    {
      id: "a",
      description: "物料",
      unit: "件",
      quantity: "1.5",
      price: "100.00",
    },
  ];
  d.taxMode = "inclusive";
  d.taxRate = "20";
  d.discountMode = "fixed";
  d.discount = "30";
  d.shipping = "10";
  const n = financial(d);
  assert.equal(n.totalAmount, 130);
  assert.equal(n.totalTax, 20);
  d.currency = "JPY";
  d.items[0].price = "100";
  assert.equal(financial(d).totalAmountFormatted, "JPY 130");
});
test("unfinished numeric fields and empty titles survive a working-copy import", () => {
  const d = structuredClone(seed);
  d.items[0].quantity = "-";
  d.due = "";
  assert.throws(() => validateDocument(d));
  assert.deepEqual(restoreInvoice(d), d);
  const extra = { rawImport: "{ still typing", section: "items" };
  const copy = importInvoice({ snapshot: { title: "", data: d, extra } });
  assert.equal(copy.title, "");
  assert.deepEqual(copy.data, d);
  assert.deepEqual(copy.extra, extra);
});
test("invalid quantities, discounts, dates and overpayments never become an exportable invoice", () => {
  for (const mutate of [
    (d: typeof seed) => (d.items[0].price = "-1"),
    (d: typeof seed) => (d.items[0].quantity = "0"),
    (d: typeof seed) => (d.taxRate = "101"),
    (d: typeof seed) => (d.due = "2026-02-31"),
    (d: typeof seed) => {
      d.discountMode = "fixed";
      d.discount = "999999";
    },
    (d: typeof seed) => {
      d.kind = "invoice";
      d.paid = "999999";
    },
  ]) {
    const d = structuredClone(seed);
    mutate(d);
    assert.throws(() => validateDocument(d));
  }
  assert.throws(() =>
    restoreInvoice({ ...seed, unexpected: "must not disappear" }),
  );
});
test("complete project retains literal user text and produces upstream native layout without external fetches", () => {
  const d = structuredClone(seed);
  d.customer.name = "<script>alert(1)</script>";
  d.layout = "letterhead";
  d.pageSize = "LETTER";
  const result = importInvoice(
    JSON.parse(
      JSON.stringify({
        format: "invoice-builder-workbench",
        title: "纸张校样",
        data: d,
        extra: { rawImport: "{}" },
      }),
    ),
  );
  assert.deepEqual(result.data, d);
  const native = toNative(d);
  assert.equal(
    native.invoiceForm.invoiceClientSnapshot.clientName,
    d.customer.name,
  );
  assert.equal(native.invoiceForm.invoiceCustomization.pageFormat, "LETTER");
  assert.equal(
    native.invoiceForm.invoiceLayoutSnapshot.layoutSchema.schemaVersion,
    1,
  );
  assert.equal(native.invoiceForm.invoiceItems.length, 2);
  assert.throws(() => importInvoice({ title: "x", data: seed }));
});
test("real SQLite keeps invalid drafts, lost-receipt retries and conflicts", async () => {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  try {
    const store = createAutosaveStore(db, validateDocument),
      documentId = randomUUID(),
      first = {
        documentId,
        mutationId: randomUUID(),
        draftRevision: 0,
        projectId: null,
        projectRevision: null,
        snapshot: { title: "单据", data: seed, extra: {} },
      };
    const receipt = await store.commit(first);
    assert.equal(receipt.phase, "saved");
    assert.deepEqual(await store.commit(first), receipt);
    const invalid = structuredClone(seed);
    invalid.items[0].quantity = "-";
    const second = {
      ...first,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: receipt.project!.id,
      projectRevision: receipt.project!.revision,
      snapshot: { title: "单据", data: invalid, extra: { notes: "保留输入" } },
    };
    const draft = await store.commit(second);
    assert.equal(draft.phase, "draft");
    assert.equal(store.get(documentId)!.snapshot.data.items[0].quantity, "-");
    await assert.rejects(
      store.commit({ ...first, mutationId: randomUUID() }),
      /另一窗口更新/,
    );
    assert.equal(store.get(documentId)!.snapshot.data.items[0].quantity, "-");
    assert.equal(db.prepare("SELECT count(*) AS n FROM projects").get()!.n, 1);
  } finally {
    db.close();
  }
});
test("a confirmed 1.9MB working copy imports within the same shared request budget", async () => {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  try {
    const snapshot = {
      title: "边界稿",
      data: seed,
      extra: { rawImport: "x".repeat(1900000) },
    };
    const request = {
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot,
    };
    assert.ok(bytes(request) < 1950000);
    const store = createAutosaveStore(db, validateDocument);
    assert.equal((await store.commit(request)).phase, "saved");
    const saved = store.get(request.documentId)!;
    const restored = importInvoice({
      snapshot: saved.snapshot,
      current: { data: seed },
      pending: null,
    });
    assert.deepEqual(restored.extra, snapshot.extra);
    assert.equal(restored.data.items[0].price, seed.items[0].price);
  } finally {
    db.close();
  }
});
test("declared original sources and generated native modules match their provenance", () => {
  const manifest = JSON.parse(
    readFileSync(resource("notices", "provenance.json"), "utf8"),
  );
  assert.equal(manifest.commit, SOURCE_COMMIT);
  assert.ok(manifest.sources.length > 20);
  for (const file of manifest.sources)
    assert.equal(
      hash(readFileSync(resource("notices", "upstream/" + file.path))),
      file.sha256,
      file.path,
    );
  for (const file of manifest.generated)
    assert.equal(
      hash(readFileSync(new URL("../" + file.path, import.meta.url))),
      file.sha256,
      file.path,
    );
});
test("upstream PDF document renders with static regular and bold bundled CJK fonts", async () => {
  const buffer = await renderInvoice(
    seed,
    async (name) => resource("fonts", name).pathname,
  );
  assert.ok(buffer.length > 10000);
  const text = buffer.toString("latin1");
  assert.ok(text.startsWith("%PDF-"));
  assert.match(text, /WorkbenchSansSC-Regular/);
  assert.match(text, /WorkbenchSansSC-Bold/);
  assert.doesNotMatch(text, /NotoSansSC-Thin/);
});
test("malformed and oversized logo originals are rejected before document replacement", () => {
  assert.throws(() =>
    imageAsset({
      name: "bad.png",
      mime: "image/png",
      base64: "AAAA",
      width: 1,
      height: 1,
    }),
  );
  assert.throws(() =>
    imageAsset({
      name: "big.png",
      mime: "image/png",
      base64: "A".repeat(208000),
      width: 1,
      height: 1,
    }),
  );
  assert.throws(() =>
    validateInvoice({
      ...seed,
      items: Array.from({ length: 81 }, (_, i) => ({
        ...seed.items[0],
        id: String(i),
      })),
    }),
  );
});
