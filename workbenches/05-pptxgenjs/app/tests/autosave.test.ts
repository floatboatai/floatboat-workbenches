import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { validateDeck, restoreDeckDraft, mediaIds, type ChartElement } from "../src/contracts/domain.ts";
import { seed } from "../src/contracts/seed.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createStore } from "../src/server/store.ts";
import { createMediaStore } from "../src/server/media.ts";

function database() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).sort()) db.exec(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
  return db;
}

test("自动保存保留未完成草稿，原项目不被无效输入覆盖，重复请求不创建副本", async () => {
  const db = database();
  try {
    const media = createMediaStore(db);
    media.seedDemo();
    const verify = async (deck: ReturnType<typeof validateDeck>) => {
      if (mediaIds(deck).some((id) => !media.has(id))) throw new Error("图片缺失");
    };
    const drafts = createAutosaveStore(db, validateDeck, undefined, { verify });
    const command = {
      documentId: crypto.randomUUID(),
      mutationId: crypto.randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "工作草稿", data: seed, extra: { prompt: "尚未提交的输入" } },
    };
    const first = await drafts.commit(command);
    assert.equal(first.phase, "saved");
    assert.ok(first.project);
    assert.deepEqual(await drafts.commit(command), first);
    const projects = createStore(db, validateDeck);
    assert.equal(projects.list().length, 1);

    const unfinished = structuredClone(seed);
    (unfinished.slides[2].elements.find((e) => e.type === "chart") as ChartElement).series[0].values[0] = "四百";
    const request = {
      ...command,
      mutationId: crypto.randomUUID(),
      draftRevision: 1,
      projectId: first.project.id,
      projectRevision: first.project.revision,
      snapshot: { ...command.snapshot, data: unfinished },
    };
    const pending = await drafts.commit(request);
    assert.equal(pending.phase, "draft");
    const raw = drafts.get(command.documentId);
    assert.ok(raw);
    assert.deepEqual(raw.snapshot.data, unfinished);
    assert.deepEqual(raw.snapshot.extra, command.snapshot.extra);
    assert.deepEqual(projects.get(first.project.id).data, seed);
    assert.deepEqual(restoreDeckDraft(raw.snapshot.data), unfinished);

    const missingImage = structuredClone(seed);
    const image = missingImage.slides[7].elements.find((e) => e.type === "image");
    if (image?.type === "image") image.mediaId = "f".repeat(64);
    const missing = await drafts.commit({ ...request, mutationId: crypto.randomUUID(), draftRevision: 2, snapshot: { ...command.snapshot, data: missingImage } });
    assert.equal(missing.phase, "draft");
    assert.match(missing.message, /图片缺失/);

    const complete = await drafts.commit({ ...request, mutationId: crypto.randomUUID(), draftRevision: 3, snapshot: { ...command.snapshot, data: seed } });
    assert.equal(complete.phase, "saved");
    assert.equal(projects.list().length, 1);
  } finally {
    db.close();
  }
});
