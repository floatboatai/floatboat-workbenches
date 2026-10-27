import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  emptyScene,
  sceneValue,
  titleValue,
  type Board,
  type BoardSummary,
} from "../contracts/boards.ts";
export class BoardError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function boardStore(db: DatabaseSync) {
  function get(id: string): Board {
    const row = db
      .prepare(
        "SELECT id,title,scene,revision,updated_at AS updatedAt FROM boards WHERE id=?",
      )
      .get(id);
    if (!row) throw new BoardError(404, "画布已不存在，请刷新列表。");
    return row as unknown as Board;
  }
  return {
    list(): BoardSummary[] {
      return db
        .prepare(
          "SELECT id,title,revision,updated_at AS updatedAt FROM boards ORDER BY updated_at DESC,id",
        )
        .all() as unknown as BoardSummary[];
    },
    get,
    create(
      title: unknown,
      scene: unknown = emptyScene,
      id: string = randomUUID(),
    ): Board {
      const safeTitle = titleValue(title),
        safeScene = sceneValue(scene);
      db.prepare(
        "INSERT INTO boards(id,title,scene,revision,updated_at) VALUES (?,?,?,1,?)",
      ).run(id, safeTitle, safeScene, new Date().toISOString());
      return get(id);
    },
    update(
      id: string,
      title: unknown,
      scene: unknown,
      revision: unknown,
    ): Board {
      const safeTitle = titleValue(title),
        safeScene = sceneValue(scene);
      if (
        !Number.isInteger(revision) ||
        typeof revision !== "number" ||
        revision < 1
      )
        throw new BoardError(400, "缺少画布版本。");
      get(id);
      const result = db
        .prepare(
          "UPDATE boards SET title=?,scene=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
        )
        .run(safeTitle, safeScene, new Date().toISOString(), id, revision);
      if (!result.changes)
        throw new BoardError(
          409,
          "另一窗口已保存了此画布。请先导出当前修改，再重新打开画布。",
        );
      return get(id);
    },
    remove(id: string, revision: unknown): void {
      if (
        typeof revision !== "number" ||
        !Number.isInteger(revision) ||
        revision < 1
      )
        throw new BoardError(400, "缺少画布版本。");
      get(id);
      if (
        !db
          .prepare("DELETE FROM boards WHERE id=? AND revision=?")
          .run(id, revision).changes
      )
        throw new BoardError(409, "画布已在另一窗口更新，请刷新后重试。");
    },
  };
}
