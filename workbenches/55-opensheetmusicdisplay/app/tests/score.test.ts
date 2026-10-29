import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { beatLabel, decodeXml, inspectScore, safeXml } from "../src/contracts/musicxml.ts";
import { extractMxl, inspectZip, readSource } from "../src/contracts/archive.ts";
import { buildScore } from "../src/contracts/score-builder.ts";
import { SAMPLES, sampleProject, sampleSource, seedProject, minuetXml } from "../src/contracts/samples.ts";
import { sha256Hex } from "../src/contracts/sha256.ts";
import { orderAnnotations, restoreScoreDraft, validateScore, type ScoreProject } from "../src/contracts/domain.ts";
import { reviewReport } from "../src/contracts/report.ts";
import { buildPdf, jpegSize } from "../src/contracts/pdf.ts";
import { largeScore, mxl, utf8 } from "./helpers.ts";

test("示例乐谱：时值自检通过，索引、作者与公有领域/授权说明齐全", () => {
  const expected: Record<string, [number, number, string]> = { minuet: [1, 32, "3/4"], ode: [4, 16, "4/4"], morning: [2, 8, "4/4"] };
  for (const sample of SAMPLES) {
    const { index, bytes, id } = sampleSource(sample);
    const [parts, measures, time] = expected[sample.key];
    assert.equal(index.parts.length, parts, sample.key);
    assert.equal(index.measures.length, measures, sample.key);
    assert.equal(index.measures[0].t, time);
    assert.match(index.rights, /public domain|CC0/i);
    assert.ok(index.composer);
    assert.equal(id, createHash("sha256").update(bytes).digest("hex"));
    assert.match(sample.xml, /<!DOCTYPE score-partwise PUBLIC/);
  }
  const minuet = sampleSource(SAMPLES[0]).index;
  assert.equal(minuet.parts[0].staves, 2);
  assert.equal(minuet.notes, 189);
  assert.match(minuetXml, /<repeat direction="backward"\/>/);
  assert.throws(() => buildScore({ title: "x", composer: "x", rights: "x", fifths: 0, beats: 3, beatType: 4, parts: [{ id: "P1", name: "x", abbreviation: "x", staves: [{ clef: "G", music: "C4:q D4" }] }] }), /应为 3 拍/);
  assert.deepEqual(validateScore(seedProject()), seedProject());
});

test("同步 SHA-256 与 Node 一致（含跨块边界长度）", () => {
  for (const length of [0, 1, 55, 56, 63, 64, 65, 1000, 70_000]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 31 + 7) & 255);
    assert.equal(sha256Hex(bytes), createHash("sha256").update(bytes).digest("hex"), String(length));
  }
});

test("解码：UTF-8 BOM、UTF-16LE/BE、声明的 ISO-8859-1；非法字节明确报错", () => {
  const xml = minuetXml.replace("Minuet in G major", "Menuett für Klavier");
  assert.equal(inspectScore(decodeXml(utf8("﻿" + xml))).title, "Menuett für Klavier");
  const le = new Uint8Array(2 + xml.length * 2);
  le.set([0xff, 0xfe]);
  for (let i = 0; i < xml.length; i++) new DataView(le.buffer).setUint16(2 + i * 2, xml.charCodeAt(i), true);
  assert.equal(inspectScore(decodeXml(le)).title, "Menuett für Klavier");
  const be = new Uint8Array(2 + xml.length * 2);
  be.set([0xfe, 0xff]);
  for (let i = 0; i < xml.length; i++) new DataView(be.buffer).setUint16(2 + i * 2, xml.charCodeAt(i), false);
  assert.equal(inspectScore(decodeXml(be)).title, "Menuett für Klavier");
  const latin = xml.replace('encoding="UTF-8"', 'encoding="ISO-8859-1"');
  const bytes = Uint8Array.from(latin, (c) => c.charCodeAt(0));
  assert.equal(inspectScore(decodeXml(bytes)).title, "Menuett für Klavier");
  assert.throws(() => decodeXml(Uint8Array.from([0x3c, 0x61, 0xc3, 0x28])), /编码无效/);
  assert.throws(() => decodeXml(utf8('<?xml version="1.0" encoding="Shift_JIS"?><a/>')), /不支持的文本编码/);
});

test("安全：接受标准 MusicXML DOCTYPE；拒绝内部子集、实体与样式表；外部图片/链接只警告", () => {
  assert.equal(inspectScore(minuetXml).warnings.length, 0);
  for (const bad of [
    minuetXml.replace('"http://www.musicxml.org/dtds/partwise.dtd">', '"x.dtd" [<!ENTITY a "b">]>'),
    minuetXml.replace("<score-partwise", '<!ENTITY a SYSTEM "file:///etc/passwd"><score-partwise'),
    minuetXml.replace("Minuet in G major", "&custom;"),
    minuetXml.replace("<score-partwise", '<?xml-stylesheet href="https://example.test/a.xsl"?><score-partwise'),
  ])
    assert.throws(() => inspectScore(bad));
  const withImage = minuetXml.replace("<part-list>", '<credit page="1"><credit-image source="https://example.test/logo.png" type="image/png"/></credit><part-list>');
  assert.deepEqual(inspectScore(withImage).warnings, ["已忽略 1 处外部图片引用"]);
  assert.throws(() => inspectScore(minuetXml.slice(0, 5000)), /XML 语法无效（第 \d+ 行/);
  assert.throws(() => inspectScore('<score-timewise version="4.0"><part-list/></score-timewise>'), /score-timewise/);
  assert.throws(() => inspectScore("<html><body/></html>"), /score-partwise/);
});

test("索引：弱起小节号、拍号延续、credit 标题兜底、多谱表；不再有 12 声部/200 小节上限", () => {
  let xml = minuetXml
    .replace('<measure number="1">', '<measure number="0" implicit="yes">')
    .replace(/<work>.*?<\/work>/, "")
    .replace(/<movement-title>.*?<\/movement-title>/, "")
    .replace("<part-list>", '<credit page="1"><credit-type>title</credit-type><credit-words>Menuet</credit-words></credit><part-list>');
  xml = xml.replace('<measure number="9">', '<measure number="9"><attributes><time><beats>2</beats><beat-type>4</beat-type></time></attributes>');
  const info = inspectScore(xml);
  assert.equal(info.title, "Menuet");
  assert.equal(info.measures[0].n, "0");
  assert.equal(info.measures[8].t, "2/4");
  assert.equal(info.measures[20].t, "2/4");
  assert.equal(info.measures[7].t, "3/4");
  const big = inspectScore(largeScore(40, 300));
  assert.equal(big.parts.length, 40);
  assert.equal(big.measures.length, 300);
  assert.equal(big.notes, 40 * 75 * (6 + 5 + 4 + 2));
  assert.throws(() => inspectScore(largeScore(65, 2)), /最多支持 64 个声部/);
});

test("真实规模：约 8 MB 的 MusicXML 与压缩 MXL 在限额内读取", async () => {
  const xml = largeScore(16, 1000);
  assert.ok(xml.length > 7_000_000, String(xml.length));
  const started = performance.now();
  const plain = await readSource(utf8(xml), "orchestra.musicxml");
  assert.equal(plain.kind, "xml");
  assert.equal(plain.index.measures.length, 1000);
  const packed = await mxl(xml);
  assert.ok(packed.length < 1_000_000);
  const compressed = await readSource(packed, "orchestra.mxl");
  assert.equal(compressed.kind, "mxl");
  assert.equal(compressed.xml, xml);
  assert.ok(performance.now() - started < 20_000);
});

test("MXL：按 container 选 MusicXML rootfile；缺容器时用唯一乐谱；拒绝穿越、伪装、加密与伪报长度", async () => {
  const container =
    '<container><rootfiles><rootfile full-path="preview.pdf" media-type="application/pdf"/><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
  assert.equal(await extractMxl(await mxl(minuetXml, { container, extra: { "preview.pdf": "%PDF" } })), minuetXml);
  assert.equal(await extractMxl(await mxl(minuetXml, { container: null })), minuetXml);
  await assert.rejects(async () => extractMxl(await mxl(minuetXml, { container: '<container><rootfiles><rootfile full-path="../x.xml"/></rootfiles></container>' })), /没有指向/);
  await assert.rejects(() => readSource(utf8(minuetXml), "score.mxl"), /不是 ZIP/);
  await assert.rejects(() => readSource(utf8(minuetXml), "score.pdf"), /请选择/);
  const traversal = new (await import("jszip")).default();
  traversal.file("../score.musicxml", minuetXml);
  const traversalBytes = await traversal.generateAsync({ type: "uint8array" });
  assert.throws(() => inspectZip(traversalBytes), /不安全/);
  const many = new (await import("jszip")).default();
  for (let i = 0; i < 257; i++) many.file(`f${i}.txt`, "x");
  const manyBytes = await many.generateAsync({ type: "uint8array" });
  assert.throws(() => inspectZip(manyBytes), /最多 256/);
  const encrypted = await mxl(minuetXml);
  const view = new DataView(encrypted.buffer);
  for (let offset = 0; offset < encrypted.length - 46; offset++) if (view.getUint32(offset, true) === 0x02014b50) view.setUint16(offset + 8, 1, true);
  assert.throws(() => inspectZip(encrypted), /加密/);
  // 中央目录伪报解压长度，实际解压流仍以真实字节计数。
  const bomb = await mxl(minuetXml + " ".repeat(70 * 1024 * 1024));
  await assert.rejects(() => extractMxl(bomb), /超过 64 MB/);
  const bombView = new DataView(bomb.buffer);
  for (let offset = 0; offset < bomb.length - 46; offset++) if (bombView.getUint32(offset, true) === 0x02014b50) bombView.setUint32(offset + 24, 10, true);
  await assert.rejects(() => extractMxl(bomb));
});

function project(): ScoreProject {
  const data = sampleProject(SAMPLES[1]);
  data.annotations = [
    { id: "b", partId: "P2", measureIndex: 3, beat: [1, 4], kind: "rhythm", text: "附点", resolved: false, createdAt: "2026-10-29T10:00:00.000Z" },
    { id: "a", partId: "P1", measureIndex: 3, beat: null, kind: "dynamics", text: "力度", resolved: true, createdAt: "2026-10-29T10:01:00.000Z" },
    { id: "c", partId: "P1", measureIndex: 0, beat: [3, 4], kind: "pitch", text: "音高", resolved: false, createdAt: "2026-10-29T10:02:00.000Z" },
  ];
  return data;
}

test("模型：显示设置、拍位与批注锚点逐项校验，草稿只放宽空白正文", () => {
  const data = project();
  assert.deepEqual(validateScore(data), data);
  const bad: [string, (value: ScoreProject) => void][] = [
    ["缩放", (v) => (v.view.zoom = 4)],
    ["移调", (v) => (v.view.transpose = 13)],
    ["隐藏全部", (v) => (v.view.hiddenParts = ["P1", "P2", "P3", "P4"])],
    ["未知声部", (v) => (v.view.hiddenParts = ["P9"])],
    ["版式", (v) => ((v.view as { layout: string }).layout = "toString")],
    ["类别", (v) => ((v.annotations[0] as { kind: string }).kind = "constructor")],
    ["小节越界", (v) => (v.annotations[0].measureIndex = 16)],
    ["拍位", (v) => (v.annotations[0].beat = [1, 0])],
    ["时间", (v) => (v.annotations[0].createdAt = "昨天")],
    ["重复", (v) => (v.annotations[1].id = "b")],
    ["原件标识", (v) => (v.source.id = "abc")],
    ["索引", (v) => (v.index.parts[0].measures = 99)],
    ["焦点", (v) => (v.focus.partId = "P9")],
  ];
  for (const [label, mutate] of bad) {
    const copy = structuredClone(data);
    mutate(copy);
    assert.throws(() => validateScore(copy), undefined, label);
  }
  const blank = structuredClone(data);
  blank.annotations[0].text = "  ";
  assert.throws(() => validateScore(blank), /批注不能为空/);
  assert.equal(restoreScoreDraft(blank).annotations[0].text, "  ");
  assert.deepEqual(
    orderAnnotations(data).map((note) => note.id),
    ["c", "a", "b"],
  );
  assert.equal(beatLabel([1, 4], "4/4"), "2");
  assert.equal(beatLabel([3, 8], "6/8"), "4");
  assert.equal(beatLabel([1, 8], "4/4"), "1.5");
  assert.equal(beatLabel(null, "4/4"), "");
});

test("批注 JSON：按乐谱顺序编号，带小节号、拍位、类别与原件 SHA-256；空白批注不能导出", () => {
  const data = project();
  const report = reviewReport(data, "四重奏审校", "2026-10-29T12:00:00.000Z");
  assert.equal(report.version, 2);
  assert.equal(report.source.sha256, data.source.id);
  assert.deepEqual(report.summary, { total: 3, open: 2, resolved: 1 });
  assert.deepEqual(
    report.annotations.map((note) => [note.number, note.partName, note.measureNumber, note.beat, note.kindLabel]),
    [
      [1, "Violin I", "1", "4", "音高"],
      [2, "Violin I", "4", null, "力度"],
      [3, "Violin II", "4", "2", "节奏"],
    ],
  );
  const blank = structuredClone(data);
  blank.annotations[0].text = "";
  assert.throws(() => reviewReport(blank, "x"));
});

test("PDF：页面、交叉引用偏移与 JPEG 尺寸正确", () => {
  // 1×1 像素基线 JPEG 的 SOF0 段。
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 2, 0, 3, 3, 1, 34, 0, 2, 17, 1, 3, 17, 1, 0xff, 0xd9]);
  assert.deepEqual(jpegSize(jpeg), { width: 3, height: 2 });
  const pdf = buildPdf(
    [
      { jpeg, width: 3, height: 2, pageWidth: 595.28, pageHeight: 396.85 },
      { jpeg, width: 3, height: 2, pageWidth: 595.28, pageHeight: 841.89 },
    ],
    { title: "小步舞曲 校样", subject: "2 条批注" },
  );
  const text = new TextDecoder("latin1").decode(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 2/);
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
  assert.ok(text.slice(xref).startsWith("xref"));
  const offsets = [...text.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  offsets.forEach((offset, i) => assert.ok(text.slice(offset).startsWith(`${i + 1} 0 obj`), `object ${i + 1}`));
  assert.throws(() => buildPdf([], { title: "x" }));
});
