import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createBoardAdapter } from "../src/server/board-autosave.ts";
import { boardStore } from "../src/server/board-store.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import {
  seedScene,
  validateSceneDocument,
  restoreSceneDraft,
} from "../src/contracts/scene-document.ts";
test("自动保存沿用原画布表、稳定ID，重复提交只生成一次并保留版本冲突", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of ["0002_boards.sql", "0003_autosave.sql"])
      db.exec(
        readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
      );
    const store = createAutosaveStore(
      db,
      validateSceneDocument,
      createBoardAdapter(db),
    );
    const req = {
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "原生画布",
        data: seedScene,
        extra: { prompt: "待完善流程" },
      },
    };
    const saved = await store.commit(req);
    assert.equal(saved.phase, "saved");
    assert.equal(saved.project?.id, req.documentId);
    assert.deepEqual(await store.commit(req), saved);
    assert.equal(boardStore(db).list().length, 1);
    assert.equal(boardStore(db).get(req.documentId).scene, seedScene.scene);
    boardStore(db).update(req.documentId, "其他窗口", seedScene.scene, 1);
    const conflict = await store.commit({
      ...req,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: req.documentId,
      projectRevision: 1,
      snapshot: { ...req.snapshot, title: "本机新标题" },
    });
    assert.equal(conflict.phase, "conflict");
    assert.equal(store.get(req.documentId)?.snapshot.title, "本机新标题");
    assert.equal(boardStore(db).get(req.documentId).title, "其他窗口");
  } finally {
    db.close();
  }
});
test("画布恢复不执行脚本且要求可解码的场景结构", () => {
  assert.deepEqual(restoreSceneDraft(seedScene), seedScene);
  assert.throws(() => restoreSceneDraft({ scene: "<script>" }));
  assert.throws(() =>
    restoreSceneDraft({ scene: JSON.stringify({ elements: [{}] }) }),
  );
});
