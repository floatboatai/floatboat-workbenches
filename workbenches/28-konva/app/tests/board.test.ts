import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  seed,
  validateBoard,
  restoreBoard,
  parseImport,
  sourceValue,
} from "../src/contracts/board.ts";
import { inspectImage, imageBytes } from "../src/server/images.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
function database() {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0001_initial", "0002_projects", "0003_autosave"])
    db.exec(
      readFileSync(
        new URL("../migrations/" + name + ".sql", import.meta.url),
        "utf8",
      ),
    );
  return db;
}
function req(data: unknown = seed) {
  return {
    documentId: randomUUID(),
    mutationId: randomUUID(),
    draftRevision: 0,
    projectId: null,
    projectRevision: null,
    snapshot: { title: "校样", data, extra: {} },
  };
}
test("editable annotations preserve order, text, geometry and rotation", () => {
  assert.deepEqual(validateBoard(seed), seed);
  assert.equal(seed.items[5].kind, "arrow");
  assert.equal(seed.items[5].rotation, 160);
  const b = structuredClone(seed);
  b.items.reverse();
  assert.deepEqual(validateBoard(b).items, b.items);
});
test("working decoder preserves original wire fields without fixing invalid values", () => {
  const b = { ...structuredClone(seed), width: 0, custom: "raw" };
  assert.equal(restoreBoard(b), b);
  assert.equal(restoreBoard(b).width, 0);
  assert.throws(() => validateBoard(b));
});
test("enum values and malformed references are not coerced", () => {
  const b = structuredClone(seed);
  assert.throws(() =>
    restoreBoard({ ...b, items: [{ ...b.items[0], kind: ["text"] }] }),
  );
  assert.throws(() =>
    sourceValue({
      id: "a".repeat(64),
      name: "x",
      mime: ["image/png"],
      width: 1,
      height: 1,
      bytes: 22,
    }),
  );
  assert.throws(() => restoreBoard({ ...b, items: [b.items[0], b.items[0]] }));
});
test("recovery cacheValue imports snapshot including unfinished fields as a new copy", () => {
  const raw = {
    documentId: randomUUID(),
    revision: 4,
    current: { id: "old" },
    snapshot: {
      title: "未完成",
      data: seed,
      extra: {
        json: "{",
        properties: { heading: { x: "-", text: "尚未应用" } },
      },
    },
  };
  const result = parseImport(raw);
  assert.equal(result.extra.json, "{");
  assert.deepEqual(result.extra, raw.snapshot.extra);
  assert.equal("documentId" in result, false);
});
test("portable project includes original bytes but rejects malformed envelope", () => {
  const result = parseImport({
    format: "konva-annotation/v1",
    title: "项目",
    data: seed,
    extra: { json: "{" },
    originals: [{ id: "source", base64: "abc" }],
  });
  assert.equal(result.originals.length, 1);
  assert.throws(() => parseImport({ title: [], data: seed }));
});
test("PNG bytes and allocation limits are inspected before resource write", () => {
  const raw =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=";
  const bytes = imageBytes(raw);
  assert.deepEqual(inspectImage(bytes), {
    width: 1,
    height: 1,
    mime: "image/png",
  });
  assert.throws(() => imageBytes("!!!!"));
  assert.throws(() => inspectImage(Buffer.from("<svg/>")));
  const huge = Buffer.from(bytes);
  huge.writeUInt32BE(10000, 16);
  assert.throws(() => inspectImage(huge));
});
test("lost receipt retries same mutation once and stale other window preserves its copy", async () => {
  const db = database(),
    s = createAutosaveStore(db, validateBoard),
    first = req();
  const a = await s.commit(first),
    b = await s.commit(first);
  assert.equal(a.project?.id, b.project?.id);
  assert.equal(db.prepare("select count(*) n from projects").get()?.n, 1);
  const current = {
    ...first,
    mutationId: randomUUID(),
    draftRevision: a.draftRevision,
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: { ...first.snapshot, title: "窗口A" },
  };
  await s.commit(current);
  const other = {
    ...req(),
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: { ...first.snapshot, title: "窗口B" },
  };
  assert.equal((await s.commit(other)).phase, "conflict");
  assert.equal(s.get(other.documentId)?.snapshot.title, "窗口B");
  assert.equal(db.prepare("select title from projects").get()?.title, "窗口A");
  db.close();
});
test("invalid model preserves full working snapshot while last valid model remains", async () => {
  const db = database(),
    s = createAutosaveStore(db, validateBoard),
    r = req(),
    a = await s.commit(r);
  const bad = {
    ...r,
    mutationId: randomUUID(),
    draftRevision: a.draftRevision,
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: {
      ...r.snapshot,
      data: { ...seed, width: 0 },
      extra: { json: "{", properties: { heading: { x: "-" } } },
    },
  };
  assert.equal((await s.commit(bad)).phase, "draft");
  assert.deepEqual(s.get(r.documentId)?.snapshot.extra, bad.snapshot.extra);
  assert.equal(
    JSON.parse(
      String(db.prepare("select payload from projects").get()?.payload),
    ).width,
    1000,
  );
  db.close();
});
test("missing original cannot be acknowledged as a saved model", async () => {
  const db = database(),
    s = createAutosaveStore(db, validateBoard, undefined, {
      verify: async () => {
        throw new Error("missing original");
      },
    });
  const r = req();
  assert.equal((await s.commit(r)).phase, "draft");
  assert.equal(s.get(r.documentId)?.snapshot.data instanceof Object, true);
  assert.equal(db.prepare("select count(*) n from projects").get()?.n, 0);
  db.close();
});
test("working capacity is larger than formal model capacity", () => {
  const b = { ...structuredClone(seed), metadata: "x".repeat(900000) };
  assert.equal(restoreBoard(b), b);
  assert.throws(() => validateBoard(b), /850/);
  assert.throws(() => restoreBoard({ ...b, metadata: "x".repeat(1900000) }));
});
