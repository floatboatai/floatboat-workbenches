import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  seed,
  validate,
  restoreDraftData,
  parseCsv,
  fromCsv,
  toCsv,
  inputCell,
  decodeCellDraft,
} from "../src/contracts/workbook.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";

test("CSV handles quoted commas, newlines, escaped quotes and UTF-8 BOM", () => {
  assert.deepEqual(
    parseCsv(
      '\uFEFF名称,备注\r\n"材料,纸","第一行\n第二行"\r\n"他写""好""",25',
    ),
    [
      ["名称", "备注"],
      ["材料,纸", "第一行\n第二行"],
      ['他写"好"', "25"],
    ],
  );
  assert.throws(() => parseCsv('"missing'), /闭合/);
  assert.throws(() => parseCsv('"a"x'), /引号/);
});
test("CSV does not execute formula-looking text or coerce leading-zero identifiers", () => {
  const s = fromCsv("=SUM(A1:A2),00123,12.5,'literal,TRUE", "数据").workbook
    .sheets.sheet1.cellData!;
  assert.deepEqual(s[0][0], { v: "=SUM(A1:A2)", t: 1 });
  assert.deepEqual(s[0][1], { v: "00123", t: 1 });
  assert.deepEqual(s[0][2], { v: 12.5, t: 2 });
  assert.equal(s[0][3]?.v, "'literal");
  assert.deepEqual(inputCell("=SUM(A1:A2)"), { f: "=SUM(A1:A2)" });
  assert.deepEqual(inputCell("'=SUM(A1:A2)"), { v: "=SUM(A1:A2)", t: 1 });
});
test("CSV exports cached calculation values and guards formula text without leaking formula source", () => {
  const w = fromCsv("Text,Number", "数据").workbook;
  w.sheets.sheet1.cellData![1] = {
    0: { v: "=1+2", t: 1 },
    1: { f: "=6*7", v: 42, t: 2 },
  };
  const text = toCsv(w, "sheet1");
  assert.match(text, /"42"/);
  assert.match(text, /"'=1\+2"/);
  assert.doesNotMatch(text, /=6\*7/);
});
test("native validation preserves formulas, styles and sheet ordering; rejects malformed/remote/oversize data", () => {
  assert.deepEqual(validate(seed), seed);
  const w = structuredClone(seed);
  w.workbook.sheets.budget.cellData![10] = { 0: { v: "=literal", t: 1 } };
  assert.equal(
    validate(w).workbook.sheets.budget.cellData![10][0]?.v,
    "=literal",
  );
  for (const alter of [
    (x: typeof seed) => {
      x.workbook.sheetOrder.push("budget");
    },
    (x: typeof seed) => {
      x.workbook.sheets.budget.rowCount = 2001;
    },
    (x: typeof seed) => {
      x.workbook.sheets.budget.backgroundImage = {
        source: "https://example.com/image",
        imageSourceType: 0,
      };
    },
    (x: typeof seed) => {
      x.workbook.sheets.budget.cellData![1][3] = { f: "1+2" };
    },
  ]) {
    const invalid = structuredClone(seed);
    alter(invalid);
    assert.throws(() => validate(invalid));
  }
  assert.throws(() =>
    validate({ workbook: { ...seed.workbook, name: "x".repeat(900000) } }),
  );
});
test("unfinished native cell draft retains formula input without applying it", () => {
  const d = {
    sheetId: "budget",
    sheetName: "活动预算",
    row: 1,
    column: 3,
    text: "=SUM(",
  };
  assert.deepEqual(decodeCellDraft(d), d);
  assert.equal(decodeCellDraft({ ...d, row: -1 }), null);
});
function fixture() {
  const db = new DatabaseSync(":memory:");
  for (const file of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  return { db, store: createAutosaveStore(db, validate) };
}
test("durable autosave retains raw imports and active cell draft, idempotent retry creates one project", async () => {
  const { db, store } = fixture();
  try {
    const req = {
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "预算",
        data: seed,
        extra: {
          importSource: "{unfinished",
          cellDraft: {
            sheetId: "budget",
            sheetName: "活动预算",
            row: 1,
            column: 3,
            text: "=SUM(",
          },
        },
      },
    };
    const a = await store.commit(req),
      b = await store.commit(req);
    assert.deepEqual(a, b);
    assert.equal(a.phase, "saved");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM projects").get()?.n, 1);
    assert.equal(
      store.get(req.documentId)?.snapshot.extra.importSource,
      "{unfinished",
    );
    assert.equal(
      store.get(req.documentId)?.snapshot.extra.cellDraft &&
        (
          store.get(req.documentId)?.snapshot.extra.cellDraft as {
            text: string;
          }
        ).text,
      "=SUM(",
    );
  } finally {
    db.close();
  }
});
test("optimistic conflict preserves newer model and conflicting working copy", async () => {
  const { db, store } = fixture();
  try {
    const first = {
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "预算", data: seed, extra: {} },
    };
    const a = await store.commit(first);
    const second = await store.commit({
      ...first,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: a.project!.id,
      projectRevision: 1,
      snapshot: { ...first.snapshot, title: "其他窗口" },
    });
    const conflict = await store.commit({
      ...first,
      documentId: randomUUID(),
      mutationId: randomUUID(),
      projectId: a.project!.id,
      projectRevision: 1,
      snapshot: { ...first.snapshot, title: "本机草稿" },
    });
    assert.equal(second.phase, "saved");
    assert.equal(conflict.phase, "conflict");
    assert.equal(
      db.prepare("SELECT title FROM projects").get()?.title,
      "其他窗口",
    );
  } finally {
    db.close();
  }
});
test("invalid model persists as draft without replacing the applied project", async () => {
  const { db, store } = fixture();
  try {
    const req = {
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "预算",
        data: { workbook: {} },
        extra: { importSource: "bad" },
      },
    };
    const result = await store.commit(req);
    assert.equal(result.phase, "draft");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM projects").get()?.n, 0);
    assert.equal(store.get(req.documentId)?.snapshot.extra.importSource, "bad");
  } finally {
    db.close();
  }
});

test("over-limit native working copy remains recoverable without passing applied model validation", () => {
  const draft = structuredClone(seed);
  draft.workbook.sheets.budget.rowCount = 2100;
  assert.throws(() => validate(draft));
  assert.equal(restoreDraftData(draft).workbook.sheets.budget.rowCount, 2100);
});
