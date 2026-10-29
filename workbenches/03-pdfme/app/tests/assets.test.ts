// ABOUTME: 资源分块上传、内容校验、读取与项目保存前的引用核对。
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createAssetStore } from "../src/server/assets.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { CHUNK, ASSET_PREFIX, isBlobValue, PDF_MIMES } from "../src/contracts/assets.ts";
import { assetRefs, validatePdf, withPdfBase } from "../src/contracts/domain.ts";
import { quotationSample } from "../src/contracts/samples.ts";

function database() {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0002_projects.sql", "0003_autosave.sql", "0004_assets.sql"])
    db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return db;
}
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
/** A 2.5 MB PDF-looking payload spans three chunks, like a scanned form. */
function bigPdf() {
  const bytes = Buffer.alloc(CHUNK * 2 + 512 * 1024, 7);
  bytes.write("%PDF-1.7\n", 0, "latin1");
  return bytes;
}

test("分块上传后按 SHA-256 与文件头校验入库，可原样读取", () => {
  const db = database();
  try {
    const assets = createAssetStore(db);
    const bytes = bigPdf(),
      id = sha(bytes);
    assert.deepEqual(assets.status(id), { stored: false });
    for (let i = 0; i * CHUNK < bytes.length; i++) assets.part(id, i, bytes.subarray(i * CHUNK, (i + 1) * CHUNK).toString("base64"));
    assert.deepEqual(assets.finish(id, { mime: "application/pdf", size: bytes.length }), { id, mime: "application/pdf", size: bytes.length });
    assert.equal(assets.status(id).stored, true);
    assert.equal(sha(assets.read(id).data), id);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM asset_parts").get()!.n, 0);
    assert.deepEqual(assets.finish(id, { mime: "application/pdf", size: bytes.length }).id, id, "重复完成是幂等的");
  } finally {
    db.close();
  }
});

test("缺块、哈希不符、伪装类型、超限与非法编码都会被拒绝", () => {
  const db = database();
  try {
    const assets = createAssetStore(db);
    const bytes = bigPdf(),
      id = sha(bytes);
    assets.part(id, 0, bytes.subarray(0, CHUNK).toString("base64"));
    assert.throws(() => assets.finish(id, { mime: "application/pdf", size: bytes.length }), /完整上传/);
    const png = Buffer.from("not a png at all"),
      pngId = sha(png);
    assets.part(pngId, 0, png.toString("base64"));
    assert.throws(() => assets.finish(pngId, { mime: "image/png", size: png.length }), /类型不符/);
    const wrong = sha(Buffer.from("other"));
    assets.part(wrong, 0, png.toString("base64"));
    assert.throws(() => assets.finish(wrong, { mime: "text/csv", size: png.length }), /校验失败/);
    assert.throws(() => assets.finish(id, { mime: "application/pdf", size: 41 * 1024 * 1024 }), /超过/);
    assert.throws(() => assets.finish(id, { mime: "application/x-msdownload", size: 10 }), /无效/);
    assert.throws(() => assets.part(id, 0, "@@@"), /编码/);
    assert.throws(() => assets.part("../etc", 0, "AA=="), /标识/);
    assert.throws(() => assets.read(sha(Buffer.from("missing"))), /不存在/);
  } finally {
    db.close();
  }
});

test("PDF 底图以引用保存：引用缺失时只存草稿，补齐后正式保存", async () => {
  const db = database();
  try {
    const assets = createAssetStore(db);
    const bytes = bigPdf(),
      id = sha(bytes);
    const { project, dropped } = withPdfBase(validatePdf(quotationSample), ASSET_PREFIX + id, 3);
    assert.equal(dropped, 0);
    assert.equal(project.template.schemas.length, 3);
    assert.deepEqual(await assetRefs(project), [ASSET_PREFIX + id]);
    const drafts = createAutosaveStore(db, validatePdf, undefined, { verify: (data) => assets.verify(data) });
    const command = { documentId: crypto.randomUUID(), mutationId: crypto.randomUUID(), draftRevision: 0, projectId: null, projectRevision: null, snapshot: { title: "带底图", data: project, extra: {} } };
    const missing = await drafts.commit(command);
    assert.equal(missing.phase, "draft");
    assert.match(missing.message, /缺失/);
    for (let i = 0; i * CHUNK < bytes.length; i++) assets.part(id, i, bytes.subarray(i * CHUNK, (i + 1) * CHUNK).toString("base64"));
    assets.finish(id, { mime: "application/pdf", size: bytes.length });
    const saved = await drafts.commit({ ...command, mutationId: crypto.randomUUID(), draftRevision: 1 });
    assert.equal(saved.phase, "saved");
    assert.equal(saved.project?.data.template.basePdf, ASSET_PREFIX + id);
  } finally {
    db.close();
  }
});

test("内联数据只接受短小的已知类型，大文件必须走资源引用", () => {
  assert.equal(isBlobValue("data:application/pdf;base64,JVBERi0=", PDF_MIMES), true);
  assert.equal(isBlobValue("data:application/pdf;base64," + "A".repeat(200_000), PDF_MIMES), false);
  assert.equal(isBlobValue("data:text/html;base64,PGgxPg==", PDF_MIMES), false);
  assert.equal(isBlobValue("https://external.test/a.pdf", PDF_MIMES), false);
  assert.equal(isBlobValue(ASSET_PREFIX + "0".repeat(64), PDF_MIMES), true);
  assert.equal(isBlobValue(ASSET_PREFIX + "../../x", PDF_MIMES), false);
});
