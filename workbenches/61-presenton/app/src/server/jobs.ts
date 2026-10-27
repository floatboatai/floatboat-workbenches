import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import {
  generationRequest,
  identifier,
  importDeck,
  type Task,
} from "../contracts/deck.ts";
import { isRecord, titleValue } from "../contracts/project.ts";
import { jobValue, type Job, type JobState } from "../contracts/jobs.ts";
import { artifactUrl, type Presenton } from "./presenton.ts";

type Resolve = (name: string, write?: boolean) => Promise<string>;
export function createJobs(
  db: DatabaseSync,
  service: () => Presenton | null,
  path: Resolve,
) {
  function row(id: string) {
    const r = db
      .prepare("SELECT * FROM presenton_jobs WHERE id=?")
      .get(identifier(id));
    if (!r) throw new Error("制作记录不存在。");
    return r;
  }
  function get(id: string): Job {
    const r = row(id);
    return jobValue({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      kind: r.kind,
      state: r.state,
      taskId: r.task_id,
      presentationId: r.presentation_id,
      path: r.path,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      message: r.message,
      artifact: r.artifact_json ? JSON.parse(String(r.artifact_json)) : null,
    });
  }
  function api(id?: string) {
    const client = service();
    if (!client) throw new Error("尚未连接 Presenton。请配置服务后再制作。");
    if (id && row(id).origin !== client.origin)
      throw new Error("此记录属于其他 Presenton 服务，请恢复原服务配置。");
    return client;
  }
  function patch(
    id: string,
    state: JobState,
    message: string,
    taskId?: string,
    data?: Record<string, unknown>,
  ) {
    const prev = get(id);
    const presentationId =
      typeof data?.presentation_id === "string"
        ? identifier(data.presentation_id)
        : prev.presentationId;
    const output = typeof data?.path === "string" ? data.path : prev.path;
    if (output) artifactUrl(output, String(row(id).origin));
    db.prepare(
      "UPDATE presenton_jobs SET state=?,message=?,task_id=?,presentation_id=?,path=?,result_json=?,updated_at=? WHERE id=?",
    ).run(
      state,
      message,
      taskId ?? prev.taskId,
      presentationId,
      output,
      JSON.stringify(data ?? JSON.parse(String(row(id).result_json))),
      new Date().toISOString(),
      id,
    );
    return get(id);
  }
  function task(id: string, value: Task) {
    const prior = get(id);
    if (["completed", "error"].includes(prior.state)) return prior;
    return patch(
      id,
      value.status === "error" ? "error" : value.status,
      value.status === "error"
        ? "Presenton 制作失败，请在服务中检查日志。"
        : value.status === "completed"
          ? "生成完成，可下载原件或读取页面复核。"
          : "Presenton 正在生成；可以继续编辑当前大纲。",
      value.id,
      value.data ?? undefined,
    );
  }
  // An interrupted submission is never replayed on boot.
  db.prepare(
    "UPDATE presenton_jobs SET state='unknown', message='连接已重启，提交结果待确认。请关联原任务 ID，避免重复制作。' WHERE state='submitting'",
  ).run();
  return {
    get,
    list: () =>
      db
        .prepare(
          "SELECT id FROM presenton_jobs ORDER BY created_at DESC LIMIT 100",
        )
        .all()
        .map((r) => get(String(r.id))),
    snapshot: (id: string) => JSON.parse(String(row(id).input_json)) as unknown,
    async submit(body: unknown) {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      const id = identifier(body.id),
        projectId = identifier(body.projectId),
        title = titleValue(body.title),
        kind = body.kind === "export" ? "export" : "generate";
      const snapshot =
        kind === "generate"
          ? generationRequest(body.deck)
          : {
              presentationId: identifier(body.presentationId),
              format: body.format === "pdf" ? "pdf" : "pptx",
            };
      const existing = db
        .prepare(
          "SELECT input_json,kind,project_id FROM presenton_jobs WHERE id=?",
        )
        .get(id);
      if (existing) {
        if (
          existing.input_json !== JSON.stringify(snapshot) ||
          existing.kind !== kind ||
          existing.project_id !== projectId
        )
          throw new Error("操作 ID 已用于不同输入。");
        return get(id);
      }
      const client = api();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO presenton_jobs(id,project_id,title,kind,state,origin,input_json,presentation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        projectId,
        title,
        kind,
        "submitting",
        client.origin,
        JSON.stringify(snapshot),
        kind === "export" ? identifier(body.presentationId) : "",
        now,
        now,
      );
      try {
        if (kind === "generate")
          return task(id, await client.generate(snapshot));
        const exported = await client.export(
          identifier(body.presentationId),
          body.format === "pdf" ? "pdf" : "pptx",
        );
        return patch(id, "completed", "原件导出完成。", undefined, exported);
      } catch {
        return patch(
          id,
          "unknown",
          "提交未得到完整确认。请从 Presenton 查找原任务并关联；不要直接重复提交。",
        );
      }
    },
    async refresh(id: string) {
      const j = get(id);
      if (!j.taskId) throw new Error("没有上游任务 ID，请先关联原任务。");
      const value = await api(id).status(j.taskId);
      if (j.state !== "stopped" && get(id).state === "stopped") return get(id);
      return task(id, value);
    },
    async adopt(id: string, taskId: unknown) {
      const upstream = await api(id).status(identifier(taskId));
      const prior = get(id);
      if (prior.taskId && prior.taskId !== upstream.id)
        throw new Error("已关联其他任务，不能替换。");
      return task(id, upstream);
    },
    stop(id: string) {
      return patch(
        id,
        "stopped",
        "已停止自动查询。Presenton 中的制作可能仍在继续，可随时查询原任务。",
      );
    },
    async presentation(id: string) {
      const j = get(id);
      if (!j.presentationId) throw new Error("尚无演示文稿 ID。");
      const value = await api(id).presentation(j.presentationId);
      const parsed = importDeck(JSON.stringify(value));
      if (parsed.deck.result?.presentationId !== j.presentationId)
        throw new Error("返回的演示文稿 ID 不符。");
      return value;
    },
    async fetchPresentation(id: unknown) {
      const value = await api().presentation(identifier(id));
      const parsed = importDeck(JSON.stringify(value));
      if (parsed.deck.result?.presentationId !== id)
        throw new Error("返回的演示文稿 ID 不符。");
      return value;
    },
    importResult(body: unknown) {
      if (!isRecord(body) || !isRecord(body.result))
        throw new Error("导入结果无效。");
      const client = api();
      const parsed = importDeck(JSON.stringify(body.result));
      const result = parsed.deck.result;
      if (!result) throw new Error("没有上游结果。");
      const id = identifier(body.id);
      if (db.prepare("SELECT id FROM presenton_jobs WHERE id=?").get(id))
        return get(id);
      if (result.path) artifactUrl(result.path, client.origin);
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO presenton_jobs(id,project_id,title,kind,state,origin,input_json,task_id,presentation_id,path,result_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        identifier(body.projectId),
        titleValue(body.title),
        "import",
        result.path ? "completed" : "pending",
        client.origin,
        "{}",
        result.taskId,
        result.presentationId,
        result.path,
        JSON.stringify(body.result),
        now,
        now,
      );
      return get(id);
    },
    async cacheArtifact(id: string) {
      const job = get(id);
      if (job.artifact) {
        await readFile(await path(`${job.artifact.id}.${job.artifact.format}`));
        return job.artifact;
      }
      if (job.state !== "completed" || !job.path)
        throw new Error("尚无生成文件。");
      const file = await api(id).artifact(job.path);
      const digest = createHash("sha256").update(file.bytes).digest("hex");
      const target = await path(`${digest}.${file.format}`, true),
        temporary = await path(`${digest}-${id}.tmp`, true);
      try {
        await writeFile(temporary, file.bytes);
        await rename(temporary, target);
      } finally {
        await unlink(temporary).catch(() => {});
      }
      const artifact = {
        id: digest,
        bytes: file.bytes.length,
        format: file.format,
      };
      db.prepare(
        "UPDATE presenton_jobs SET artifact_json=?,updated_at=? WHERE id=?",
      ).run(JSON.stringify(artifact), new Date().toISOString(), id);
      return artifact;
    },
    async chunk(id: string, index: number) {
      const a = get(id).artifact;
      if (
        !a ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= Math.ceil(a.bytes / 262144)
      )
        throw new Error("文件分块无效。");
      const bytes = await readFile(await path(`${a.id}.${a.format}`));
      return {
        base64: bytes
          .subarray(index * 262144, (index + 1) * 262144)
          .toString("base64"),
      };
    },
  };
}
