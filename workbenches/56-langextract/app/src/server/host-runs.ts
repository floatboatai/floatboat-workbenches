// Built-in channel: LangExtract-style few-shot extraction through the Floatboat Host model.
// Prompting, chunking, output parsing and source alignment run in Node (contracts/prompting.ts,
// contracts/align.ts); the Host only generates text. Runs are durable: the input snapshot is
// stored before the first call, the same ID never calls the model twice, and a run that was
// in flight when the server stopped is marked interrupted instead of being silently re-sent.
import { createHash } from "node:crypto";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord } from "../contracts/project.ts";
import { runInput, type RunInput } from "../contracts/evidence.ts";
import {
  buildPrompt,
  chunkDocument,
  parseModelOutput,
  resolveChunk,
  SYSTEM_PROMPT,
  type ResolvedExtraction,
} from "../contracts/prompting.ts";
import { UUID, validateHostRun, type HostRun, type HostRunStatus } from "../contracts/host-run.ts";
import { StoreError } from "./store.ts";

/** Deterministic v4-shaped request ID per chunk, so a Host-side replay of one chunk is recognisable. */
export function chunkRequestId(runId: string, doc: number, chunk: number): string {
  const h = createHash("sha256").update(`${runId}:${doc}:${chunk}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function hostMessage(e: unknown): string {
  if (e instanceof WorkbenchHostError) {
    const code = /^[A-Z0-9_]{1,80}$/.test(e.code) ? e.code : "HOST_ERROR";
    return code === "HOST_NOT_CONNECTED"
      ? "Floatboat 未连接：请启动并登录 Floatboat 客户端后点“重新检查”，再新建任务。资料与修订已保留。"
      : `模型请求未完成（${code}）。资料与修订已保留，请检查 Floatboat 模型设置后新建任务。`;
  }
  return e instanceof Error ? e.message.slice(0, 500) : "模型任务失败。";
}

export function createHostRuns(app: WorkbenchServer) {
  const db = app.database;
  db.prepare(
    "UPDATE langextract_host_runs SET status='interrupted',message='工作台服务曾中断，未完成的模型请求不会自动重发。可保留此记录并新建任务。' WHERE status='running'",
  ).run();
  function get(id: string): HostRun {
    if (!UUID.test(id)) throw new StoreError(400, "任务标识无效。");
    const row = db.prepare("SELECT * FROM langextract_host_runs WHERE id=?").get(id);
    if (!row) throw new StoreError(404, "任务尚未提交或不存在。");
    return validateHostRun({
      id: row.id,
      projectId: row.project_id,
      model: row.model,
      status: row.status,
      input: JSON.parse(String(row.input_json)),
      progress: { done: Number(row.done), total: Number(row.total) },
      warnings: JSON.parse(String(row.warnings_json)),
      result: row.result_json === null ? null : JSON.parse(String(row.result_json)),
      message: row.message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  function finish(id: string, status: HostRunStatus, message: string, result: unknown = null, warnings: string[] = []) {
    db.prepare(
      "UPDATE langextract_host_runs SET status=?,message=?,result_json=?,warnings_json=?,updated_at=? WHERE id=? AND status='running'",
    ).run(status, message, result === null ? null : JSON.stringify(result), JSON.stringify(warnings.slice(0, 200)), new Date().toISOString(), id);
  }
  async function execute(run: HostRun) {
    const warnings: string[] = [];
    const plan = run.input.documents.map((d) => chunkDocument(d.text));
    let done = 0;
    try {
      const result = [];
      for (const [di, doc] of run.input.documents.entries()) {
        const extractions: ResolvedExtraction[] = [];
        for (const chunk of plan[di]) {
          const r = await app.host.llm.generateText(
            {
              model: run.model,
              system: SYSTEM_PROMPT,
              prompt: buildPrompt({ ...run.input, text: chunk.text }),
              maxOutputTokens: 4096,
              temperature: 0,
            },
            { requestId: chunkRequestId(run.id, di, chunk.index), timeoutMs: 120000 },
          );
          try {
            if (r.finishReason && !/^(stop|end_turn|STOP)$/i.test(r.finishReason))
              warnings.push(`${doc.id} 第${chunk.index + 1}段：模型输出未正常结束（${String(r.finishReason).slice(0, 40)}），已尽量解析。`);
            const items = parseModelOutput(r.text);
            const resolved = resolveChunk(chunk, items, extractions.length + 1);
            const missing = resolved.filter((x) => !x.char_interval).length;
            if (missing)
              warnings.push(`${doc.id} 第${chunk.index + 1}段：${missing}条未能在原文中定位，已保留为未定位记录。`);
            extractions.push(...resolved);
          } catch (e) {
            warnings.push(`${doc.id} 第${chunk.index + 1}段：${e instanceof Error ? e.message : "输出无法解析"}，该段没有记录。`);
          }
          done++;
          db.prepare("UPDATE langextract_host_runs SET done=?,warnings_json=?,updated_at=? WHERE id=? AND status='running'").run(
            done,
            JSON.stringify(warnings.slice(0, 200)),
            new Date().toISOString(),
            run.id,
          );
        }
        result.push({ document_id: doc.id, text: doc.text, extractions });
      }
      const count = result.reduce((n, d) => n + d.extractions.length, 0);
      finish(run.id, "completed", `完成 ${result.length} 份资料，得到 ${count} 条记录，等待人工复核。`, result, warnings);
    } catch (e) {
      finish(run.id, "failed", hostMessage(e), null, warnings);
    }
  }
  return {
    get,
    list(): HostRun[] {
      return db
        .prepare("SELECT id FROM langextract_host_runs ORDER BY created_at DESC LIMIT 30")
        .all()
        .map((r) => get(String(r.id)));
    },
    start(body: unknown, projectExists: (id: string) => void): HostRun {
      if (!isRecord(body) || typeof body.id !== "string" || !UUID.test(body.id))
        throw new StoreError(400, "任务标识无效。");
      if (typeof body.projectId !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(body.projectId))
        throw new StoreError(400, "请先保存当前批次。");
      const model = typeof body.model === "string" ? body.model.trim() : "";
      if (!/^[A-Za-z0-9._:/@-]{1,120}$/.test(model)) throw new StoreError(400, "模型 ID 格式无效。");
      const input: RunInput = runInput(body.input);
      const serialized = JSON.stringify(input);
      const old = db.prepare("SELECT project_id,input_json,model FROM langextract_host_runs WHERE id=?").get(body.id);
      if (old) {
        if (old.input_json !== serialized || old.project_id !== body.projectId || old.model !== model)
          throw new StoreError(409, "任务标识已用于另一份输入，请新建任务。");
        return get(body.id);
      }
      projectExists(body.projectId);
      const total = input.documents.reduce((n, d) => n + chunkDocument(d.text).length, 0);
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO langextract_host_runs(id,project_id,model,input_json,status,done,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(body.id, body.projectId, model, serialized, "running", 0, total, now, now);
      const run = get(body.id);
      void app.trackTask(() => execute(run), "langextract-host-run");
      return run;
    },
  };
}
