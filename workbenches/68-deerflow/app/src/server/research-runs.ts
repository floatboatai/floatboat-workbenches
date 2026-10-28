import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isRecord } from "../contracts/project.ts";
import {
  runInput,
  runPayload,
  remoteRun,
  type ResearchRun,
} from "../contracts/run.ts";
import { nativeValue } from "../contracts/research.ts";
import { StoreError } from "./store.ts";
import { gateway, configuredOrigin, GatewayError } from "./research-gateway.ts";
import { fetchNative } from "./deerflow.ts";
type Gateway = typeof gateway;
const uncertain = [
  "creating_thread",
  "submitting",
  "unknown",
  "pending",
  "running",
];
export function createResearchRuns(
  db: DatabaseSync,
  http: Gateway = gateway,
  origin: () => string = configuredOrigin,
  native: (id: string) => Promise<string> = fetchNative,
) {
  const flights = new Map<string, Promise<unknown>>();
  const read = (id: string): ResearchRun => {
    const r = db
      .prepare("SELECT * FROM deerflow_research_runs WHERE id=?")
      .get(id);
    if (!r) throw new StoreError(404, "研究记录不存在。");
    return {
      id: String(r.id),
      projectId: String(r.project_id),
      threadId: String(r.thread_id),
      prompt: String(r.prompt),
      model: String(r.model),
      origin: String(r.origin),
      phase: String(r.phase),
      runId: String(r.run_id),
      runStatus: String(r.run_status),
      error: String(r.error),
      native: String(r.native),
      hasResult: Boolean(r.native),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  };
  const update = (id: string, phase: string, error = "") =>
    db
      .prepare(
        "UPDATE deerflow_research_runs SET phase=?,error=?,updated_at=? WHERE id=?",
      )
      .run(phase, error.slice(0, 500), new Date().toISOString(), id);
  db.prepare(
    "UPDATE deerflow_research_runs SET phase='unknown',error='服务重启，提交回执待核对；不会自动重新发送。' WHERE phase IN ('creating_thread','submitting')",
  ).run();
  async function accept(id: string, value: unknown) {
    const r = read(id),
      receipt = remoteRun(value, r.threadId, id);
    if (r.runId && r.runId !== receipt.id)
      throw new Error("上游运行编号发生变化，拒绝替换原研究记录。");
    db.prepare(
      "UPDATE deerflow_research_runs SET run_id=?,run_status=?,phase=?,error='',updated_at=? WHERE id=?",
    ).run(
      receipt.id,
      receipt.status,
      receipt.status,
      new Date().toISOString(),
      id,
    );
    if (receipt.status === "success" && !r.native) {
      try {
        if (origin() !== r.origin)
          throw new Error("请恢复原上游地址再读取研究结果。");
        const text = await native(r.threadId);
        nativeValue(text);
        db.prepare(
          "UPDATE deerflow_research_runs SET native=?,updated_at=? WHERE id=?",
        ).run(text, new Date().toISOString(), id);
      } catch (e) {
        update(
          id,
          "success",
          e instanceof Error ? e.message : "结果读取失败，可刷新状态重试读取。",
        );
      }
    }
  }
  async function submit(id: string) {
    let r = read(id);
    try {
      const thread = await http(
        "/api/threads",
        "POST",
        { thread_id: r.threadId, metadata: { floatboat_operation_id: id } },
        undefined,
        r.origin,
      );
      if (
        !isRecord(thread) ||
        thread.thread_id !== r.threadId ||
        !isRecord(thread.metadata) ||
        thread.metadata.floatboat_operation_id !== id
      )
        throw new Error("上游线程回执不匹配，未继续提交研究。");
      update(id, "submitting");
      r = read(id);
      const value = await http(
        `/api/threads/${r.threadId}/runs`,
        "POST",
        runPayload(id, r.prompt, r.model),
        id,
        r.origin,
      );
      await accept(id, value);
    } catch (e) {
      const rejected =
        e instanceof GatewayError &&
        [400, 401, 403, 404, 422].includes(e.status);
      update(
        id,
        rejected ? "rejected" : "unknown",
        e instanceof Error ? e.message : "回执不明，等待只读核对。",
      );
    }
  }
  return {
    read,
    list(projectId: string) {
      return db
        .prepare(
          "SELECT id FROM deerflow_research_runs WHERE project_id=? ORDER BY created_at DESC LIMIT 30",
        )
        .all(projectId)
        .map((x) => {
          const r = read(String(x.id));
          return { ...r, prompt: r.prompt.slice(0, 180), native: "" };
        });
    },
    start(projectId: string, id: string, prompt: unknown, model: unknown) {
      const input = runInput(prompt, model);
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("研究命令编号无效。");
      const old = db
        .prepare("SELECT id FROM deerflow_research_runs WHERE id=?")
        .get(id);
      if (old) {
        const r = read(id);
        if (
          r.projectId !== projectId ||
          r.prompt !== input.prompt ||
          r.model !== input.model
        )
          throw new StoreError(409, "同一研究命令不能改变输入。");
        return r;
      }
      const source = origin();
      if (!db.prepare("SELECT id FROM projects WHERE id=?").get(projectId))
        throw new StoreError(404, "请先保存研究项目。");
      if (
        db
          .prepare(
            "SELECT id FROM deerflow_research_runs WHERE project_id=? AND phase IN ('creating_thread','submitting','unknown','pending','running')",
          )
          .get(projectId)
      )
        throw new StoreError(
          409,
          "这个项目已有运行或待核对的研究；请先刷新并核对，避免重复任务。",
        );
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO deerflow_research_runs(id,project_id,thread_id,prompt,model,origin,phase,created_at,updated_at) VALUES(?,?,?,?,?,?,'creating_thread',?,?)",
      ).run(
        id,
        projectId,
        randomUUID(),
        input.prompt,
        input.model,
        source,
        now,
        now,
      );
      const task = submit(id);
      flights.set(id, task);
      void task.finally(() => flights.delete(id));
      return read(id);
    },
    async refresh(id: string) {
      if (flights.has(id)) return read(id);
      const job = (async () => {
        const r = read(id);
        try {
          if (origin() !== r.origin)
            throw new Error("上游地址已改变，恢复原地址后再核对。");
          if (r.runId) {
            await accept(
              id,
              await http(
                `/api/threads/${r.threadId}/runs/${r.runId}`,
                "GET",
                undefined,
                undefined,
                r.origin,
              ),
            );
          } else if (uncertain.includes(r.phase)) {
            const values = await http(
              `/api/threads/${r.threadId}/runs`,
              "GET",
              undefined,
              undefined,
              r.origin,
            );
            if (!Array.isArray(values) || values.length > 100)
              throw new Error("上游运行列表无效，不能确认提交状态。");
            const matches = values.filter(
              (v) =>
                isRecord(v) &&
                isRecord(v.metadata) &&
                v.metadata.floatboat_operation_id === id,
            );
            if (matches.length === 1) await accept(id, matches[0]);
            else if (matches.length > 1)
              throw new Error("上游存在多个相同命令记录，请人工核对。");
            else
              update(
                id,
                "unknown",
                "尚未找到匹配的运行，不代表未执行。不会自动重发；请继续只读刷新或到上游核对。",
              );
          }
        } catch (e) {
          update(
            id,
            r.runId ? r.phase : "unknown",
            e instanceof Error ? e.message : "状态查询失败，原记录保留。",
          );
        }
        return read(id);
      })();
      flights.set(id, job);
      try {
        return await job;
      } finally {
        flights.delete(id);
      }
    },
  };
}
