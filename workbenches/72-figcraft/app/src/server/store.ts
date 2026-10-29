import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  titleValue,
  type Project,
  type ProjectSummary,
} from "../contracts/project.ts";
export class StoreError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function createStore<T>(
  db: DatabaseSync,
  validate: (value: unknown) => T,
) {
  const get = (id: string): Project<T> => {
    const row = db
      .prepare(
        "SELECT id,title,payload,revision,updated_at AS updatedAt FROM projects WHERE id=?",
      )
      .get(id);
    if (!row) throw new StoreError(404, "项目不存在，请刷新列表。");
    return {
      id: String(row.id),
      title: String(row.title),
      revision: Number(row.revision),
      updatedAt: String(row.updatedAt),
      data: validate(JSON.parse(String(row.payload))),
    };
  };
  const serialize = (value: unknown) => {
    const payload = JSON.stringify(validate(value));
    if (Buffer.byteLength(payload) > 1_950_000)
      throw new StoreError(413, "校样超过 1.95 MB 保存上限，请拆分设计后重试。");
    return payload;
  };
  return {
    list: () =>
      db
        .prepare(
          "SELECT id,title,revision,updated_at AS updatedAt FROM projects ORDER BY updated_at DESC,id",
        )
        .all() as unknown as ProjectSummary[],
    get,
    create(title: unknown, data: unknown) {
      const name = titleValue(title),
        payload = serialize(data),
        id = randomUUID();
      db.prepare(
        "INSERT INTO projects(id,title,payload,revision,updated_at) VALUES(?,?,?,1,?)",
      ).run(id, name, payload, new Date().toISOString());
      return get(id);
    },
    update(id: string, title: unknown, data: unknown, revision: unknown) {
      const name = titleValue(title),
        payload = serialize(data);
      if (
        typeof revision !== "number" ||
        !Number.isInteger(revision) ||
        revision < 1
      )
        throw new StoreError(400, "项目版本无效。");
      get(id);
      if (
        !db
          .prepare(
            "UPDATE projects SET title=?,payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
          )
          .run(name, payload, new Date().toISOString(), id, revision).changes
      )
        throw new StoreError(
          409,
          "另一窗口已更新项目。请先导出当前内容，再重新打开项目。",
        );
      return get(id);
    },
    remove(id: string, revision: unknown) {
      get(id);
      if (typeof revision !== "number" || !Number.isInteger(revision))
        throw new StoreError(400, "项目版本无效。");
      if (
        !db
          .prepare("DELETE FROM projects WHERE id=? AND revision=?")
          .run(id, revision).changes
      )
        throw new StoreError(409, "项目已更新，请重新打开后删除。");
      return { deleted: true };
    },
  };
}
