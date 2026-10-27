import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractSequence,
  fasta,
  fromViewerSelection,
  importProject,
  normalizeSequence,
  parseSequence,
  rangeLength,
  reverseComplement,
  toViewerRange,
  validateDocument,
  validateRange,
  type SequenceDocument,
} from "../src/contracts/sequence.ts";
import { createStore, StoreError } from "../src/server/store.ts";
const sequence = "ACGTAACCGGTT";
const document: SequenceDocument = {
  sequence,
  topology: "circular",
  features: [
    {
      id: "wrap",
      name: "跨原点反向区间",
      start: 10,
      end: 3,
      strand: -1,
      color: "#4d9e9b",
    },
  ],
  reviews: [
    {
      id: "review",
      start: 10,
      end: 3,
      strand: -1,
      note: "待人工核对",
      done: false,
      createdAt: "2026-10-27T00:00:00.000Z",
    },
  ],
};
test("单条FASTA和纯DNA规范化，拒绝多记录、非法字母和超长输入", () => {
  assert.deepEqual(parseSequence(">fixture\nacgt aa\nccggtt\n"), {
    name: "fixture",
    sequence,
  });
  assert.equal(normalizeSequence("acgtryswkmbdhvn"), "ACGTRYSWKMBDHVN");
  assert.throws(() => parseSequence(">a\nACGT\n>b\nTGCA"));
  assert.throws(() => parseSequence("ACGT123"));
  assert.throws(() => parseSequence("ACGU"));
  assert.throws(() => normalizeSequence("A".repeat(10001)));
  assert.throws(() => normalizeSequence(""));
  assert.deepEqual(parseSequence(fasta("fixture", sequence)), {
    name: "fixture",
    sequence,
  });
});
test("1-based闭区间、跨原点和反向互补逐碱基一致", () => {
  const range = { start: 10, end: 3, strand: 1 as const };
  assert.equal(rangeLength(range, 12), 6);
  assert.equal(extractSequence(sequence, range, "circular"), "GTTACG");
  assert.equal(
    extractSequence(sequence, { ...range, strand: -1 }, "circular"),
    "CGTAAC",
  );
  assert.equal(
    extractSequence(sequence, { start: 1, end: 1, strand: -1 }, "linear"),
    "T",
  );
  assert.equal(
    extractSequence(sequence, { start: 1, end: 12, strand: 1 }, "linear"),
    sequence,
  );
  assert.throws(() => validateRange(range, 12, "linear"));
  assert.throws(() => validateRange({ ...range, start: 0 }, 12, "circular"));
  assert.equal(
    reverseComplement(reverseComplement("ACGTRYSWKMBDHVN")),
    "ACGTRYSWKMBDHVN",
  );
});
test("查看器0-based半开坐标往返，反向特征与完整环形不丢碱基", () => {
  assert.deepEqual(toViewerRange(document.features[0], 12), {
    start: 3,
    end: 9,
    clockwise: false,
  });
  assert.deepEqual(
    fromViewerSelection(
      { start: 9, end: 3, direction: -1, length: 6, clockwise: true },
      12,
      "circular",
    ),
    { start: 10, end: 3, strand: -1 },
  );
  assert.deepEqual(
    fromViewerSelection(
      { start: 3, end: 9, length: 6, clockwise: false },
      12,
      "circular",
    ),
    { start: 10, end: 3, strand: -1 },
  );
  assert.deepEqual(toViewerRange({ start: 10, end: 9, strand: 1 }, 12), {
    start: 0,
    end: 12,
    clockwise: true,
  });
  assert.deepEqual(
    fromViewerSelection({ start: 0, end: 0, length: 12 }, 12, "circular"),
    { start: 1, end: 12, strand: 1 },
  );
  assert.equal(
    fromViewerSelection({ start: 3, end: 3, length: 0 }, 12, "circular"),
    null,
  );
  assert.deepEqual(
    fromViewerSelection(
      { start: 3, end: 9, length: 6, clockwise: false, direction: -1 },
      12,
      "circular",
    ),
    { start: 10, end: 3, strand: -1 },
  );
});
test("项目/注释导入校验边界与唯一ID，坐标完整往返", () => {
  assert.deepEqual(
    importProject({
      schemaVersion: 1,
      coordinates: "1-based-inclusive",
      title: "fixture",
      data: document,
    }).data,
    document,
  );
  assert.throws(() => validateDocument({ ...document, topology: "linear" }));
  assert.throws(() =>
    validateDocument({
      ...document,
      features: [...document.features, ...document.features],
    }),
  );
  assert.throws(() =>
    validateDocument({
      ...document,
      reviews: [{ ...document.reviews[0], end: 13 }],
    }),
  );
  assert.throws(() =>
    importProject({
      schemaVersion: 1,
      coordinates: "zero-based",
      title: "fixture",
      data: document,
    }),
  );
});
test("真实磁盘重开保留序列/特征/意见，并拒绝旧版本覆盖", () => {
  const folder = mkdtempSync(join(tmpdir(), "sequence-"));
  let db = new DatabaseSync(join(folder, "data.sqlite"));
  try {
    db.exec(
      "CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT,payload TEXT,revision INTEGER,updated_at TEXT)",
    );
    let store = createStore(db, validateDocument);
    const saved = store.create("fixture", document);
    db.close();
    db = new DatabaseSync(join(folder, "data.sqlite"));
    store = createStore(db, validateDocument);
    assert.deepEqual(store.get(saved.id).data, document);
    store.update(saved.id, "reviewed", document, 1);
    assert.throws(
      () => store.update(saved.id, "stale", document, 1),
      (error) => error instanceof StoreError && error.status === 409,
    );
  } finally {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
