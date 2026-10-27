import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { boardStore, BoardError } from "../src/server/board-store.ts";
import {
  emptyScene,
  sceneValue,
  diagramValue,
} from "../src/contracts/boards.ts";
test("画布持久化、版本冲突与删除", () => {
  const folder = mkdtempSync(join(tmpdir(), "boards-"));
  let db = new DatabaseSync(join(folder, "data.sqlite"));
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_boards.sql", import.meta.url),
        "utf8",
      ),
    );
    let store = boardStore(db);
    const board = store.create("项目 A");
    const saved = store.update(board.id, "项目 B", emptyScene, board.revision);
    assert.equal(saved.revision, 2);
    assert.throws(
      () => store.update(board.id, "覆盖", emptyScene, 1),
      (error) => error instanceof BoardError && error.status === 409,
    );
    assert.throws(
      () => store.remove(board.id, 1),
      (error) => error instanceof BoardError && error.status === 409,
    );
    db.close();
    db = new DatabaseSync(join(folder, "data.sqlite"));
    store = boardStore(db);
    assert.equal(store.get(board.id).title, "项目 B");
    assert.equal(store.list().length, 1);
    store.remove(board.id, 2);
    assert.equal(store.list().length, 0);
    assert.throws(
      () => store.get(board.id),
      (error) => error instanceof BoardError && error.status === 404,
    );
  } finally {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
test("拒绝无效与过大的画布，并保留中文及图片数据", () => {
  assert.throws(() => sceneValue("{invalid"));
  assert.throws(() => sceneValue(JSON.stringify({ elements: [{}] })));
  assert.throws(() => sceneValue("中".repeat(600000)));
  const scene = JSON.stringify({
    elements: [{ type: "text", text: "流程" }],
    files: { picture: { dataURL: "data:image/png;base64,AA==" } },
  });
  assert.equal(sceneValue(scene), scene);
});
test("生成图形拒绝重复节点与悬空连接", () => {
  const diagram = {
    title: "流程",
    nodes: [
      { id: "a", label: "开始" },
      { id: "b", label: "结束" },
    ],
    edges: [{ from: "a", to: "b", label: "" }],
  };
  assert.equal(diagramValue(diagram).nodes.length, 2);
  assert.throws(() =>
    diagramValue({ ...diagram, nodes: [diagram.nodes[0], diagram.nodes[0]] }),
  );
  assert.throws(() =>
    diagramValue({
      ...diagram,
      edges: [{ from: "a", to: "missing", label: "" }],
    }),
  );
});
