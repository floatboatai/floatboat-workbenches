import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { CHUNK, createSourceStore } from "../src/server/sources.ts";
import { upgradeLegacyRows } from "../src/server/legacy.ts";
import { createStore, StoreError } from "../src/server/store.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { newProject, validateScore, type ScoreProject } from "../src/contracts/domain.ts";
import { SAMPLES, sampleProject, sampleSource, seedProject, morningXml } from "../src/contracts/samples.ts";
import { largeScore, memoryDb, mxl, utf8 } from "./helpers.ts";

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function upload(sources: ReturnType<typeof createSourceStore>, bytes: Uint8Array, fileName: string) {
  const id = sha(bytes);
  for (let i = 0; i * CHUNK < bytes.length; i++) sources.part(id, i, Buffer.from(bytes.subarray(i * CHUNK, (i + 1) * CHUNK)).toString("base64"));
  return sources.finish(id, { fileName, size: bytes.length });
}

test("原件库：多块上传后解析入库，按内容去重；MXL 提供解压后的 MusicXML", async () => {
  const db = memoryDb();
  try {
    const sources = createSourceStore(db);
    const xml = largeScore(12, 400);
    const bytes = utf8(xml);
    assert.ok(bytes.length > CHUNK * 3);
    const stored = await upload(sources, bytes, "large.musicxml");
    assert.equal(stored.kind, "xml");
    assert.equal(stored.index.parts.length, 12);
    assert.equal(sources.musicxml(stored.id), xml);
    assert.deepEqual(new Uint8Array(sources.original(stored.id).data), bytes);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM score_source_parts").get()!.n, 0);
    assert.deepEqual(await upload(sources, bytes, "again.musicxml"), stored);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM score_sources").get()!.n, 1);
    const packed = await mxl(xml);
    const compressed = await upload(sources, packed, "large.mxl");
    assert.equal(compressed.kind, "mxl");
    assert.equal(sources.musicxml(compressed.id), xml);
    assert.deepEqual(new Uint8Array(sources.original(compressed.id).data), packed);
  } finally {
    db.close();
  }
});

test("原件库：拒绝缺块、篡改、错误编码、超限与无效乐谱（422），不留下记录", async () => {
  const db = memoryDb();
  try {
    const sources = createSourceStore(db);
    const bytes = utf8(largeScore(8, 300));
    assert.ok(bytes.length > CHUNK);
    const id = sha(bytes);
    sources.part(id, 0, Buffer.from(bytes.subarray(0, CHUNK)).toString("base64"));
    await assert.rejects(() => sources.finish(id, { fileName: "x.musicxml", size: bytes.length }), (e: unknown) => e instanceof StoreError && e.status === 409);
    sources.part(id, 1, Buffer.from(bytes.subarray(CHUNK, CHUNK * 2)).toString("base64"));
    await assert.rejects(() => sources.finish(id, { fileName: "x.musicxml", size: bytes.length - 1 }));
    assert.throws(() => sources.part(id, 0, "@@@"), /编码无效/);
    assert.throws(() => sources.part(id, 999, "AAAA"), /序号/);
    assert.throws(() => sources.part("../x", 0, "AAAA"), /标识无效/);
    await assert.rejects(() => sources.finish(id, { fileName: "x.musicxml", size: 64 * 1024 * 1024 }), (e: unknown) => e instanceof StoreError && e.status === 413);
    const broken = utf8("<score-partwise><part-list></score-partwise>");
    await assert.rejects(() => upload(sources, broken, "broken.musicxml"), (e: unknown) => e instanceof StoreError && e.status === 422);
    assert.equal(sources.status(sha(broken)).stored, false);
    assert.throws(() => sources.musicxml(sha(utf8("missing"))), (e: unknown) => e instanceof StoreError && e.status === 404);
  } finally {
    db.close();
  }
});

test("原件库：内置示例在启动时可用；保存前核对原件存在且索引一致", async () => {
  const db = memoryDb();
  try {
    const sources = createSourceStore(db);
    sources.ensureSamples();
    sources.ensureSamples();
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM score_sources").get()!.n, SAMPLES.length);
    const seed = seedProject();
    sources.verify(seed);
    assert.equal(sources.musicxml(seed.source.id), SAMPLES[0].xml);
    const tampered = structuredClone(seed);
    tampered.index.title = "Changed";
    assert.throws(() => sources.verify(tampered), /索引与原文件不一致/);
    const missing = structuredClone(seed);
    missing.source.id = sha(utf8("other"));
    assert.throws(() => sources.verify(missing), /不在本工作台/);
  } finally {
    db.close();
  }
});

test("0.3 旧项目与草稿在启动时迁入原件库，单声部筛选变为隐藏其他声部，批注保留", async () => {
  const db = memoryDb();
  try {
    const sources = createSourceStore(db);
    const bytes = utf8(morningXml);
    const legacy = {
      source: { fileName: "morning-lines.musicxml", kind: "xml", originalBase64: Buffer.from(bytes).toString("base64"), xml: morningXml },
      partId: "P2",
      layout: "continuous",
      zoom: 1.15,
      annotations: [{ id: "old", partId: "P2", measureIndex: 7, text: "核对结束线", resolved: true }],
      focus: { partId: "P2", measureIndex: 7 },
    };
    db.prepare("INSERT INTO projects(id,title,payload,revision,updated_at) VALUES('p1','旧审校',?,3,'2026-10-27T08:00:00.000Z')").run(JSON.stringify(legacy));
    const receipt = { phase: "saved", message: "已自动保存", draftRevision: 2, project: { id: "p1", title: "旧审校", revision: 3, updatedAt: "x", data: legacy }, savedAt: "x" };
    db.prepare("INSERT INTO autosave_drafts(id,project_id,project_revision,revision,mutation_id,snapshot,receipt,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(
      "d1", "p1", 3, 2, "m1", JSON.stringify({ title: "旧审校", data: legacy, extra: {} }), JSON.stringify(receipt), "2026-10-27T08:00:00.000Z",
    );
    assert.deepEqual(await upgradeLegacyRows(db, sources), { projects: 1, drafts: 1 });
    assert.deepEqual(await upgradeLegacyRows(db, sources), { projects: 0, drafts: 0 });
    const project = createStore(db, validateScore).get("p1");
    assert.equal(project.revision, 4);
    assert.equal(project.data.source.id, sha(bytes));
    assert.deepEqual(project.data.view.hiddenParts, ["P1"]);
    assert.equal(project.data.view.layout, "endless");
    assert.equal(project.data.view.zoom, 1.15);
    assert.deepEqual(project.data.annotations.map((note) => [note.id, note.measureIndex, note.text, note.resolved, note.beat]), [["old", 7, "核对结束线", true, null]]);
    const draft = db.prepare("SELECT snapshot,receipt,project_revision FROM autosave_drafts WHERE id='d1'").get()!;
    assert.equal(Number(draft.project_revision), 4);
    assert.equal(JSON.parse(String(draft.snapshot)).data.source.id, sha(bytes));
    assert.equal(JSON.parse(String(draft.receipt)).project.revision, 4);
    sources.verify(project.data);
  } finally {
    db.close();
  }
});

function drafts(db: ReturnType<typeof memoryDb>) {
  const sources = createSourceStore(db);
  sources.ensureSamples();
  return createAutosaveStore(db, validateScore, undefined, { verify: async (data: ScoreProject) => sources.verify(data) });
}

test("自动保存：幂等重试、未完成批注存为草稿且不覆盖正式内容、补全后保存", async () => {
  const db = memoryDb();
  try {
    const store = drafts(db);
    const seed = seedProject();
    const command = { documentId: crypto.randomUUID(), mutationId: crypto.randomUUID(), draftRevision: 0, projectId: null, projectRevision: null, snapshot: { title: "小步舞曲 审校", data: seed, extra: {} } };
    const first = await store.commit(command);
    assert.equal(first.phase, "saved");
    assert.deepEqual(await store.commit(command), first, "回包丢失后的同一请求不产生第二个项目");
    const projects = createStore(db, validateScore);
    assert.equal(projects.list().length, 1);
    const unfinished = structuredClone(seed);
    unfinished.annotations.push({ id: "pending", partId: "P1", measureIndex: 3, beat: [1, 4], kind: "pitch", text: "", resolved: false, createdAt: "2026-10-29T11:00:00.000Z" });
    const request = { ...command, mutationId: crypto.randomUUID(), draftRevision: 1, projectId: first.project!.id, projectRevision: first.project!.revision, snapshot: { ...command.snapshot, data: unfinished } };
    const pending = await store.commit(request);
    assert.equal(pending.phase, "draft");
    assert.deepEqual(store.get(command.documentId)!.snapshot.data, unfinished);
    assert.deepEqual(projects.get(first.project!.id).data, seed);
    unfinished.annotations[2].text = "升号位置";
    const complete = await store.commit({ ...request, mutationId: crypto.randomUUID(), draftRevision: 2, snapshot: { ...command.snapshot, data: unfinished } });
    assert.equal(complete.phase, "saved");
    assert.equal(projects.get(first.project!.id).data.annotations.length, 3);
    // 旧窗口用过期版本写入 → 冲突，不覆盖。
    const stale = await store.commit({ ...request, documentId: crypto.randomUUID(), mutationId: crypto.randomUUID(), draftRevision: 0, projectRevision: 1, snapshot: { ...command.snapshot, data: seed } });
    assert.equal(stale.phase, "conflict");
    assert.equal(projects.get(first.project!.id).data.annotations.length, 3);
  } finally {
    db.close();
  }
});

test("自动保存：引用不在库中的原件只存草稿；导入为新文档时另建项目", async () => {
  const db = memoryDb();
  try {
    const store = drafts(db);
    const projects = createStore(db, validateScore);
    const original = await store.commit({ documentId: crypto.randomUUID(), mutationId: crypto.randomUUID(), draftRevision: 0, projectId: null, projectRevision: null, snapshot: { title: "原审校", data: seedProject(), extra: {} } });
    const ghost = newProject({ id: createHash("sha256").update("not uploaded").digest("hex"), fileName: "ghost.musicxml", kind: "xml", size: 10 }, sampleSource(SAMPLES[2]).index);
    const orphan = await store.commit({ documentId: crypto.randomUUID(), mutationId: crypto.randomUUID(), draftRevision: 0, projectId: null, projectRevision: null, snapshot: { title: "无原件", data: ghost, extra: {} } });
    assert.equal(orphan.phase, "draft");
    assert.match(orphan.message, /原件不在本工作台/);
    const imported = await store.commit({ documentId: crypto.randomUUID(), mutationId: crypto.randomUUID(), draftRevision: 0, projectId: null, projectRevision: null, snapshot: { title: "欢乐颂 审校", data: sampleProject(SAMPLES[1]), extra: {} } });
    assert.equal(imported.phase, "saved");
    assert.notEqual(imported.project!.id, original.project!.id);
    assert.equal(projects.list().length, 2);
    assert.equal(projects.get(original.project!.id).data.source.id, seedProject().source.id);
  } finally {
    db.close();
  }
});
