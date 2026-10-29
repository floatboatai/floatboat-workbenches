// ABOUTME: 无引擎路径：.figcraft 读取、画板目录、直接修改 document.json 与重新打包、交付说明、渲染换算。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import {
  applyEdits,
  base64ToBytes,
  bytesToBase64,
  editFile,
  outline,
  parseAction,
  readArchive,
  readFile,
  writeArchive,
  MAX_FILE_BYTES,
} from "../src/contracts/figdoc.ts";
import { handoffMarkdown } from "../src/contracts/handoff.ts";
import { cssAngle, cssBackground, ellipsePath, gradientOf, networkPath, rgba, textLook } from "../src/contracts/paint.ts";
import { engineStatus, callEngine, EngineUnavailable } from "../src/server/engine.ts";
import { verifyDesign } from "../src/server/design-routes.ts";

const seed = JSON.parse(readFileSync(new URL("../src/contracts/seed.json", import.meta.url), "utf8")) as { file: string };

test("示例 Calm Studio：224 个图层、4 个屏幕与组件页均可列出", () => {
  const { doc, entries } = readFile(seed.file);
  assert.equal(doc.name, "Calm Studio");
  assert.ok(entries["thumbnail.png"]);
  const o = outline(doc);
  assert.equal(o.nodeCount, 224);
  const screens = o.pages.find((p) => p.name === "Screens")!;
  assert.deepEqual(
    screens.frames.map((id) => o.frames.find((f) => f.id === id)!.name),
    ["Welcome", "Explore", "Trail", "Profile"],
  );
  assert.ok(o.frames.find((f) => f.name === "Tab bar"), "componentSet 也是可审阅画板");
  assert.ok(o.frames.every((f) => f.status === "none"));
  assert.ok(o.frames.find((f) => f.id === 50)!.texts >= 4);
});

test("内置写入与 FigCraft CLI 0.11.2 node.set 语义一致，且保留其它 zip 条目原始字节", () => {
  const before = readFile(seed.file);
  const result = editFile(seed.file, [
    parseAction({ kind: "status", id: 50, status: "readyForDev" }),
    parseAction({ kind: "status", id: 64, status: "completed" }),
    parseAction({ kind: "text", id: 58, text: "Find a quieter trail for this weekend" }),
    parseAction({ kind: "fill", id: 52, color: "#FF0000" }),
    parseAction({ kind: "text", id: 62, text: "Start exploring" }),
    parseAction({ kind: "rename", id: 57, name: "  Eyebrow  " }),
  ]);
  const after = readFile(result.file);
  const n = after.doc.nodes;
  // 与真实 CLI 输出（cli-probe：dev_status/dev_changed/overrides/styles）逐项对照
  assert.equal(n["50"].dev_status, "readyForDev");
  assert.equal(n["50"].dev_changed, true, "可交付后修改其中文字 → 已变更");
  assert.equal(n["64"].dev_status, "completed");
  assert.equal(n["64"].dev_changed, undefined);
  assert.equal(n["58"].characters, "Find a quieter trail for this weekend");
  assert.deepEqual(n["58"].overrides, ["characters"]);
  assert.equal(n["58"].name, "Find your next trail", "改文案不改图层名");
  assert.deepEqual(n["52"].fills, [
    { type: "solid", color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blend: "normal" },
  ]);
  assert.equal((n["52"].styles as Record<string, unknown> | undefined)?.fill ?? null, null);
  assert.deepEqual(n["62"].overrides, ["characters"]);
  assert.equal(n["61"].props && (n["61"].props as Record<string, string>).Label, "Get started");
  assert.equal(n["57"].name, "Eyebrow");
  assert.equal(n["57"].overrides, undefined);
  // 未触及的节点逐字节相同，其它条目保持
  assert.deepEqual(n["136"], before.doc.nodes["136"]);
  assert.deepEqual(after.entries["thumbnail.png"], before.entries["thumbnail.png"]);
  assert.deepEqual(after.doc.styles, before.doc.styles);
  // 重新标记可交付会清除“已变更”
  const again = editFile(result.file, [parseAction({ kind: "status", id: 50, status: "readyForDev" })]);
  assert.equal(readFile(again.file).doc.nodes["50"].dev_changed, undefined);
  const cleared = editFile(again.file, [parseAction({ kind: "status", id: 50, status: "none" })]);
  assert.equal(readFile(cleared.file).doc.nodes["50"].dev_status, undefined);
  // 同一输入得到同一输出（固定时间戳），避免自动保存抖动
  assert.equal(editFile(seed.file, [parseAction({ kind: "rename", id: 57, name: "Eyebrow" })]).file, editFile(seed.file, [parseAction({ kind: "rename", id: 57, name: "Eyebrow" })]).file);
});

test("画板顺序：只在同页顶层画板间交换，越界不变", () => {
  const { doc } = readFile(seed.file);
  const moved = applyEdits(doc, [parseAction({ kind: "move", id: 64, offset: -1 })]);
  assert.deepEqual(moved.nodes["1"].children, [64, 50, 136, 166]);
  const edge = applyEdits(doc, [parseAction({ kind: "move", id: 50, offset: -1 })]);
  assert.deepEqual(edge.nodes["1"].children, [50, 64, 136, 166]);
  assert.deepEqual(doc.nodes["1"].children, [50, 64, 136, 166], "原文档不被修改");
  assert.throws(() => applyEdits(doc, [parseAction({ kind: "move", id: 58, offset: 1 })]), /顶层画板/);
});

test("拒绝无效编辑：非文字改文案、非顶层设状态、错误颜色、过长名称、未知操作", () => {
  const { doc } = readFile(seed.file);
  assert.throws(() => applyEdits(doc, [parseAction({ kind: "text", id: 50, text: "x" })]), /文字图层/);
  assert.throws(() => applyEdits(doc, [parseAction({ kind: "status", id: 58, status: "readyForDev" })]), /顶层画板/);
  assert.throws(() => applyEdits(doc, [parseAction({ kind: "rename", id: 99999, name: "x" })]), /不存在/);
  assert.throws(() => parseAction({ kind: "fill", id: 52, color: "red" }), /RRGGBB/);
  assert.throws(() => parseAction({ kind: "rename", id: 52, name: "x".repeat(101) }), /名称/);
  assert.throws(() => parseAction({ kind: "status", id: 50, status: "shipped" }), /交付状态/);
  assert.throws(() => parseAction({ kind: "run", id: 50, command: "file.open" }), /不支持/);
  assert.throws(() => parseAction({ kind: "text", id: 1.5, text: "x" }), /无效/);
});

test("拒绝损坏或伪造的文件，并给出可读原因", () => {
  assert.throws(() => readArchive(new Uint8Array([1, 2, 3])), /不是 \.figcraft/);
  assert.throws(() => readArchive(zipSync({ "readme.txt": strToU8("hi") })), /缺少 document\.json/);
  assert.throws(() => readArchive(zipSync({ "document.json": strToU8("{bad") })), /不是有效 JSON/);
  assert.throws(() => readArchive(zipSync({ "document.json": strToU8(JSON.stringify({ format: "fig", version: 1 })) })), /不是 FigCraft v1/);
  const loop = { format: "figcraft", version: 1, name: "x", pages: [1], nodes: { "1": { id: 1, name: "p", type: "page", width: 0, height: 0, children: [2] }, "2": { id: 2, name: "f", type: "frame", width: 10, height: 10, children: [2] } } };
  const loopFile = bytesToBase64(zipSync({ "document.json": strToU8(JSON.stringify(loop)) }));
  assert.throws(() => outline(readFile(loopFile).doc), /循环/);
  assert.throws(() => readArchive(new Uint8Array(MAX_FILE_BYTES + 1)), /上限/);
  assert.throws(() => base64ToBytes("not base64!"), /编码/);
  const traversal = zipSync({ "document.json": base64ToBytes(seed.file).subarray(0, 0), "../evil": strToU8("x") });
  assert.throws(() => readArchive(traversal), /不安全路径|缺少/);
});

test("重新打包保留条目顺序，并在文档缺失 document.json 外的条目时仍可读", () => {
  const archive = readFile(seed.file);
  const out = unzipSync(writeArchive(archive, archive.doc));
  assert.deepEqual(Object.keys(out), Object.keys(archive.entries));
  assert.equal(JSON.parse(strFromU8(out["document.json"])).nodes["50"].name, "Welcome");
});

test("交付说明按页面顺序列出画板、状态、备注和文案", () => {
  const edited = editFile(seed.file, [parseAction({ kind: "status", id: 64, status: "readyForDev" })]);
  const md = handoffMarkdown(readFile(edited.file).doc, { "64": "搜索框占位文案待确认\n第二行" }, "Ridgeline 校样", new Date("2026-10-29T00:00:00Z"));
  assert.match(md, /^# Ridgeline 校样 · 交付说明/);
  assert.match(md, /### 02 Explore[\s\S]*状态：可交付[\s\S]*备注：搜索框占位文案待确认 \/ 第二行/);
  assert.match(md, /\| Find your next trail \| Find your next trail \|/);
  assert.ok(md.indexOf("01 Welcome") < md.indexOf("02 Explore"));
});

test("渲染换算：矢量网络闭合路径、渐变角度、颜色与字重", () => {
  const { doc } = readFile(seed.file);
  const ridge = networkPath(doc.nodes["53"]);
  assert.match(ridge.fill, /^M0 132L78 35\.2L148\.2 105\.6L226\.2 0L312 114\.4L390 61\.6L390 299\.2L0 299\.2L0 132Z$/);
  assert.equal(ridge.rule, "nonzero");
  const glyph = networkPath(doc.nodes["14"]);
  assert.equal(glyph.fill, "");
  assert.ok(glyph.stroke.startsWith("M"));
  const sky = doc.nodes["51"].fills![0];
  assert.equal(cssAngle(gradientOf(sky)!, 390, 440), 180);
  assert.match(cssBackground(doc.nodes["51"].fills, 390, 440)!, /^linear-gradient\(180deg,rgba\(191,227,214,1\) 0%/);
  assert.equal(rgba({ r: 1, g: 0.5, b: 0, a: 0.5 }, 0.5), "rgba(255,128,0,0.25)");
  assert.equal(textLook(doc.nodes["58"]).fontWeight, 700);
  assert.equal(textLook(doc.nodes["58"]).lineHeightPx, 38);
  assert.equal(ellipsePath(doc.nodes["52"]), null);
  assert.ok(ellipsePath({ ...doc.nodes["52"], sweep: Math.PI })!.endsWith("Z"));
});

test("引擎缺席时状态明确且不抛出原始 fetch 错误；自动保存校验拒绝损坏文件", async () => {
  const saved = process.env.FIGCRAFT_SERVICE_URL;
  process.env.FIGCRAFT_SERVICE_URL = "http://127.0.0.1:9";
  try {
    const status = await engineStatus();
    assert.equal(status.available, false);
    assert.equal(status.service, "127.0.0.1:9");
    assert.match(status.message, /未运行|超时/);
    await assert.rejects(callEngine("/render", { file: seed.file }), EngineUnavailable);
    process.env.FIGCRAFT_SERVICE_URL = "http://example.com:8796";
    await assert.rejects(callEngine("/health"), /HTTPS/);
  } finally {
    if (saved === undefined) delete process.env.FIGCRAFT_SERVICE_URL;
    else process.env.FIGCRAFT_SERVICE_URL = saved;
  }
  await verifyDesign({ file: seed.file });
  await assert.rejects(verifyDesign({ file: bytesToBase64(zipSync({ "x.txt": strToU8("x") })) }), /document\.json/);
});
