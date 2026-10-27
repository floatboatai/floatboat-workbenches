import type { DatabaseSync } from "node:sqlite";
import { createStore, StoreError } from "./store.ts";
import {
  validateForm,
  validateAnswers,
  responseValue,
  type ResponseRecord,
} from "../contracts/form.ts";
import { isRecord } from "../contracts/project.ts";
export function responseStore(db: DatabaseSync) {
  const projects = createStore(db, validateForm);
  function rowValue(row: Record<string, unknown>): ResponseRecord {
    return responseValue({
      id: row.id,
      createdAt: row.created_at,
      schema: JSON.parse(String(row.schema_json)),
      answers: JSON.parse(String(row.answers_json)),
    });
  }
  return {
    list(projectId: string) {
      projects.get(projectId);
      return db
        .prepare(
          "SELECT * FROM responses WHERE project_id=? ORDER BY created_at DESC,id",
        )
        .all(projectId)
        .map((row) => rowValue(row));
    },
    submit(projectId: string, body: unknown) {
      if (
        !isRecord(body) ||
        typeof body.id !== "string" ||
        !/^[a-zA-Z0-9-]{16,80}$/.test(body.id)
      )
        throw new StoreError(400, "提交标识无效。");
      const project = projects.get(projectId);
      const existing = db
        .prepare("SELECT * FROM responses WHERE id=?")
        .get(body.id);
      if (existing) {
        if (existing.project_id !== projectId)
          throw new StoreError(409, "提交标识已被使用。");
        const parsed = rowValue(existing);
        if (
          JSON.stringify(validateAnswers(parsed.schema, body.answers)) !==
          JSON.stringify(parsed.answers)
        )
          throw new StoreError(409, "此提交标识已保存其他答案。");
        return parsed;
      }
      if (body.revision !== project.revision)
        throw new StoreError(409, "问卷已修改，请重新打开填写页后提交。");
      const count = db
        .prepare("SELECT count(*) AS total FROM responses WHERE project_id=?")
        .get(projectId);
      if (Number(count?.total) >= 500)
        throw new StoreError(
          400,
          "当前问卷已达到 500 份答卷上限，请导出后新建收集项目。",
        );
      const schema = project.data.schema,
        answers = validateAnswers(schema, body.answers),
        createdAt = new Date().toISOString();
      db.prepare(
        "INSERT INTO responses(id,project_id,schema_json,answers_json,created_at) VALUES(?,?,?,?,?)",
      ).run(
        body.id,
        projectId,
        JSON.stringify(schema),
        JSON.stringify(answers),
        createdAt,
      );
      return { id: body.id, createdAt, schema, answers };
    },
  };
}
