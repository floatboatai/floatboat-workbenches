import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const record = JSON.parse(readFileSync(new URL("notices/native-source.json", root), "utf8"));

test("原生引擎文件与记录的改动哈希一致", () => {
  for (const [name, expected] of Object.entries(record.adaptedFiles) as [string, { sha256: string; bytes: number }][]) {
    const bytes = readFileSync(new URL("src/vendor/oasis-editor/" + name, root));
    assert.equal(bytes.length, expected.bytes, name);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, name);
  }
});

test("工作台补丁入口均已导出", () => {
  const entry = readFileSync(new URL("src/vendor/oasis-editor/oasis-editor.js", root), "utf8");
  for (const name of ["setWorkbenchFonts", "registerWorkbenchLocale", "setWorkbenchRevisionAuthor"])
    assert.match(entry, new RegExp(`\\b${name}\\b`));
});

test("中文表覆盖全部原生英文键并保留占位符", () => {
  const index = readFileSync(new URL("src/vendor/oasis-editor/index-K-7FcXvb.js", root), "utf8");
  const block = index.slice(index.indexOf("const en = {"), index.indexOf("const ptBR = {"));
  const english = new Map([...block.matchAll(/^\s+"([^"]+)": "((?:[^"\\]|\\.)*)",?$/gm)].map((m) => [m[1], m[2]]));
  const zh = readFileSync(new URL("src/ui/locale-zh-CN.ts", root), "utf8");
  const chinese = new Map([...zh.matchAll(/"([^"]+)": "((?:[^"\\]|\\.)*)"/g)].map((m) => [m[1], m[2]]));
  assert.ok(english.size > 600, "parsed upstream keys");
  for (const [key, value] of english) {
    assert.ok(chinese.has(key), "missing " + key);
    for (const slot of value.match(/\{\d+\}/g) ?? []) assert.ok(chinese.get(key)!.includes(slot), key + " " + slot);
  }
  assert.equal(chinese.get("locale.id"), "zh-CN");
});
