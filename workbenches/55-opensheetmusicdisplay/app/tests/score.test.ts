import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { seed, seedXml } from "../src/contracts/seed.ts";
import { inspectScore } from "../src/contracts/musicxml.ts";
import {
  validateScore,
  originalBytes,
  bytesToBase64,
} from "../src/contracts/domain.ts";
import {
  importScore,
  extractMxl,
  inspectZip,
  verifySource,
} from "../src/contracts/archive.ts";
import { createStore, StoreError } from "../src/server/store.ts";
const utf8 = (text: string) => new TextEncoder().encode(text);
const container =
  '<container><rootfiles><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
async function archive(xml = seedXml) {
  const zip = new JSZip();
  zip.file("META-INF/container.xml", container);
  zip.file("score.musicxml", xml);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
test("原创谱的声部/小节解析及 UTF-8 原文件往返", async () => {
  const source = await importScore(utf8(seedXml), "原创.musicxml");
  assert.deepEqual(originalBytes(source), utf8(seedXml));
  const info = inspectScore(source.xml);
  assert.equal(info.parts.length, 2);
  assert.equal(info.measureCount, 8);
  assert.equal(info.noteCount, 40);
  assert.equal(info.title, "Morning Lines");
  assert.deepEqual(validateScore(seed), seed);
});
test("XML 拒绝实体、外部资源、无效结构与超限", () => {
  for (const xml of [
    '<!DOCTYPE score-partwise SYSTEM "https://example.test/score.dtd">' +
      seedXml,
    seedXml.replace(
      "<work>",
      '<work><image source="https://example.test/pic"/>',
    ),
    seedXml.replace(
      "<work>",
      '<work><link xlink:href="https://example.test/"/>',
    ),
    seedXml.replace("Morning Lines", "&unknown;"),
    seedXml.slice(0, -20),
    "<score-timewise/>",
    seedXml.replace('id="P2"', 'id="P1"'),
    "<score-partwise>" +
      "<x>".repeat(50) +
      "</x>".repeat(50) +
      "</score-partwise>",
  ])
    assert.throws(() => inspectScore(xml));
  assert.throws(() => inspectScore(seedXml + " ".repeat(180000)));
});
test("批注锚点必须存在，编号不以展示的小节名代替", () => {
  const data = {
    ...structuredClone(seed),
    annotations: [
      {
        id: "review",
        partId: "P2",
        measureIndex: 7,
        text: "核对结束线",
        resolved: false,
      },
    ],
  };
  assert.equal(validateScore(data).annotations[0].measureIndex, 7);
  assert.throws(() =>
    validateScore({
      ...data,
      annotations: [{ ...data.annotations[0], measureIndex: 8 }],
    }),
  );
  assert.throws(() =>
    validateScore({
      ...data,
      annotations: [{ ...data.annotations[0], text: " " }],
    }),
  );
  assert.throws(() => validateScore({ ...data, partId: "absent" }));
  assert.throws(() =>
    validateScore({
      ...data,
      source: {
        ...data.source,
        xml: data.source.xml.replace("Morning Lines", "Changed"),
      },
    }),
  );
});
test("MXL 解压并保持原始压缩字节，服务端检查内容对应关系", async () => {
  const bytes = await archive(),
    source = await importScore(bytes, "original.mxl");
  assert.equal(source.xml, seedXml);
  assert.deepEqual(originalBytes(source), bytes);
  assert.deepEqual(await verifySource({ ...seed, source }), {
    ...seed,
    source,
  });
  await assert.rejects(() =>
    verifySource({
      ...seed,
      source: { ...source, xml: seedXml.replace("Morning Lines", "Wrong") },
    }),
  );
});
test("MXL 拒绝路径穿越、缺容器、过多条目和声明的解压大文件", async () => {
  const missing = new JSZip();
  missing.file("score.musicxml", seedXml);
  await assert.rejects(async () =>
    extractMxl(await missing.generateAsync({ type: "uint8array" })),
  );
  const traversal = new JSZip();
  traversal.file("../score.xml", "x");
  assert.throws(() => inspectZip(new Uint8Array()));
  await assert.rejects(async () =>
    extractMxl(await traversal.generateAsync({ type: "uint8array" })),
  );
  const many = new JSZip();
  for (let i = 0; i < 33; i++) many.file(`file${i}`, String(i));
  await assert.rejects(async () =>
    extractMxl(await many.generateAsync({ type: "uint8array" })),
  );
  await assert.rejects(async () =>
    extractMxl(await archive(seedXml + " ".repeat(200000))),
  );
});
test("即使 ZIP 目录伪报长度，实际解压流仍被硬性限额拒绝", async () => {
  const bytes = await archive(seedXml + " ".repeat(220000));
  const view = new DataView(bytes.buffer);
  for (let offset = 0; offset < bytes.length - 46; offset++)
    if (view.getUint32(offset, true) === 0x02014b50)
      view.setUint32(offset + 24, 10, true);
  await assert.rejects(() => extractMxl(bytes));
});
test("XML 内容允许预定义实体，不能在原件校验时丢失 UTF-8 字节", () => {
  const xml = seedXml.replace("Morning Lines", "Wind &amp; Light");
  assert.equal(inspectScore(xml).title, "Wind & Light");
  assert.throws(() =>
    validateScore({
      ...seed,
      source: { ...seed.source, originalBase64: bytesToBase64(utf8("wrong")) },
    }),
  );
});
test("SQLite 保存原件、版式和小节批注，冲突不会覆盖新版本", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const store = createStore(db, validateScore);
    const data = {
      ...structuredClone(seed),
      partId: "P2",
      annotations: [
        {
          id: "note1",
          partId: "P2",
          measureIndex: 1,
          text: "核对力度",
          resolved: true,
        },
      ],
    };
    const saved = store.create("审校验收", data);
    assert.deepEqual(store.get(saved.id).data, data);
    const changed = store.update(saved.id, "新版本", data, 1);
    assert.equal(changed.revision, 2);
    assert.throws(
      () => store.update(saved.id, "旧窗口", seed, 1),
      (error: unknown) => error instanceof StoreError && error.status === 409,
    );
    assert.throws(() => store.remove(saved.id, 1));
    assert.equal(store.get(saved.id).title, "新版本");
    store.remove(saved.id, 2);
    assert.equal(store.list().length, 0);
  } finally {
    db.close();
  }
});

test("报告包含原件哈希与小节锚点，不把压缩包原文误当报告", async () => {
  const { reviewReport } = await import("../src/contracts/report.ts");
  const report = await reviewReport(
    {
      ...seed,
      annotations: [
        {
          id: "note",
          partId: "P1",
          measureIndex: 2,
          text: "留意连线",
          resolved: false,
        },
      ],
    },
    "报告验收",
  );
  assert.match(report.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(report.annotations[0].measureNumber, "3");
  assert.equal(report.annotations[0].partName, "Flute");
  assert.equal("originalBase64" in report.source, false);
});

test("恢复未完成的空白批注草稿，但不放宽XML安全或锚点", async () => {
  const { restoreScoreDraft } = await import("../src/contracts/domain.ts");
  const draft = {
    ...seed,
    annotations: [
      {
        id: "draft-note",
        partId: "P1",
        measureIndex: 0,
        text: "",
        resolved: false,
      },
    ],
  };
  assert.equal(restoreScoreDraft(draft).annotations[0].text, "");
  assert.throws(() => validateScore(draft));
  assert.throws(() =>
    restoreScoreDraft({
      ...draft,
      annotations: [{ ...draft.annotations[0], partId: "absent" }],
    }),
  );
  assert.throws(() =>
    restoreScoreDraft({
      ...draft,
      source: { ...draft.source, xml: "<!DOCTYPE evil><score-partwise/>" },
    }),
  );
});
