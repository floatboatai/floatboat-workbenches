import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execute, unpack, commands } from "./index.mjs";
const seed = JSON.parse(
  await readFile(
    new URL("../app/src/contracts/seed.json", import.meta.url),
    "utf8",
  ),
);
test("reject malformed native archives and unsupported command paths", () => {
  assert.throws(() => unpack("invalid"), /格式|编码|zip|invalid/i);
  const doc = unpack(seed.file).doc;
  assert.throws(() =>
    commands({ kind: "run", command: "file.open", path: "/etc/passwd" }, doc),
  );
  assert.throws(() =>
    commands({ kind: "text", id: 50, text: "not text" }, doc),
  );
});
test("real FigCraft renders native template and edits text without mutating original", async () => {
  const before = await execute(seed);
  assert.ok(before.frames.length >= 4);
  assert.ok(before.image.length > 1000);
  const text = before.layers.find((x) => x.type === "text");
  const after = await execute({
    ...seed,
    action: { kind: "text", id: text.id, text: "CALM STUDIO" },
  });
  assert.equal(after.layers.find((x) => x.id === text.id).text, "CALM STUDIO");
  assert.notEqual(after.file, seed.file);
  assert.notEqual(after.image, before.image);
  assert.equal(
    (await execute(seed)).layers.find((x) => x.id === text.id).text,
    text.text,
  );
});
test("real FigCraft emits PNG, SVG and PDF for selected native frame", async () => {
  for (const format of ["png", "svg", "pdf"]) {
    const r = await execute({ ...seed, export: format });
    const bytes = Buffer.from(r.artifact.data, "base64");
    assert.ok(bytes.length > 100);
    if (format === "svg") assert.match(bytes.toString(), /<svg/);
    if (format === "pdf") assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    if (format === "png") assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  }
});
test("native rename and handoff status survive saved archive roundtrip", async () => {
  const a = await execute({
    ...seed,
    action: { kind: "rename", id: 50, name: "校样首页" },
  });
  assert.equal(a.frames.find((x) => x.id === 50).name, "校样首页");
  const b = await execute({
    file: a.file,
    action: { kind: "status", id: 50, status: "readyForDev" },
  });
  const doc = unpack(b.file).doc;
  assert.match(JSON.stringify(doc.nodes["50"]), /readyForDev|ready_for_dev/);
});
