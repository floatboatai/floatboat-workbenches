// ABOUTME: 推演结果库：本地推演按输入寻址缓存、原生动作分片上传与幂等提交、结果读取。
import type { DatabaseSync } from "node:sqlite";
import { robustness, simulate, summarize, type SimResult } from "../contracts/engine.ts";
import { analyzeActions } from "../contracts/analyze.ts";
import { resultIdOf } from "../contracts/example.ts";
import { isRecord } from "../contracts/project.ts";
import { fingerprint } from "../contracts/random.ts";
import { simInputValue } from "../contracts/validate.ts";
import { parseNative, type Action } from "../contracts/simulation.ts";
import { StoreError } from "./store.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const UPLOAD = { maxChunks: 400, maxChunkChars: 1_000_000, maxTotalChars: 40 * 1024 * 1024 };

export function createResults(db: DatabaseSync) {
  const put = (id: string, kind: string, result: SimResult) => {
    db.prepare("INSERT INTO run_results(id,kind,payload,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").run(
      id,
      kind,
      JSON.stringify(result),
      new Date().toISOString(),
    );
  };
  const has = (id: string) => Boolean(db.prepare("SELECT 1 FROM run_results WHERE id=?").get(id));
  function raw(id: string) {
    if (!/^[A-Za-z0-9_:.-]{1,80}$/.test(id)) throw new StoreError(400, "结果编号无效");
    const row = db.prepare("SELECT payload FROM run_results WHERE id=?").get(id);
    if (!row) throw new StoreError(404, "此结果不在本机结果库中");
    return String(row.payload);
  }
  /** Imported or upstream actions: content-addressed so retrying the same file stores it once. */
  function storeActions(actions: Action[]) {
    const result = analyzeActions(actions);
    const id = "I" + result.fingerprint;
    if (!has(id)) put(id, "import", result);
    return { resultId: id, fingerprint: result.fingerprint, summary: summarize(result) };
  }
  return {
    raw,
    storeActions,
    simulate(body: unknown) {
      if (!isRecord(body)) throw new StoreError(400, "推演请求无效");
      const input = simInputValue(body.input);
      if (!input.agents.length) throw new StoreError(400, "至少需要一个智能体才能推演");
      const id = resultIdOf(input);
      let result: SimResult;
      if (has(id)) result = JSON.parse(raw(id)) as SimResult;
      else {
        result = simulate(input);
        put(id, "local", result);
      }
      return {
        resultId: id,
        fingerprint: result.fingerprint,
        summary: summarize(result),
        robustness: body.robustness === true ? robustness(input) : null,
      };
    },
    begin(body: unknown) {
      if (!isRecord(body) || typeof body.id !== "string" || !UUID.test(body.id)) throw new StoreError(400, "上传编号无效");
      const name = typeof body.name === "string" ? body.name.slice(0, 200) : "";
      const platform = ["", "twitter", "reddit"].includes(String(body.platform)) ? String(body.platform) : null;
      const chunks = body.chunks;
      if (platform === null || typeof chunks !== "number" || !Number.isInteger(chunks) || chunks < 1 || chunks > UPLOAD.maxChunks)
        throw new StoreError(400, `上传参数无效：最多${UPLOAD.maxChunks}个分片`);
      const row = db.prepare("SELECT name,platform,chunks FROM uploads WHERE id=?").get(body.id);
      if (row) {
        if (String(row.name) !== name || String(row.platform) !== platform || Number(row.chunks) !== chunks)
          throw new StoreError(409, "同一上传编号的内容不一致");
      } else
        db.prepare("INSERT INTO uploads(id,name,platform,chunks,result,created_at) VALUES(?,?,?,?,NULL,?)").run(body.id, name, platform, chunks, new Date().toISOString());
      return { id: body.id, received: (db.prepare("SELECT seq FROM upload_chunks WHERE upload_id=? ORDER BY seq").all(body.id) as Array<{ seq: number }>).map((r) => Number(r.seq)) };
    },
    chunk(id: string, seq: number, body: unknown) {
      if (!UUID.test(id)) throw new StoreError(400, "上传编号无效");
      const upload = db.prepare("SELECT chunks,result FROM uploads WHERE id=?").get(id);
      if (!upload) throw new StoreError(404, "上传不存在，请重新选择文件");
      if (upload.result) return { id, seq, done: true };
      if (!Number.isInteger(seq) || seq < 0 || seq >= Number(upload.chunks)) throw new StoreError(400, "分片序号无效");
      if (!isRecord(body) || typeof body.text !== "string" || body.text.length > UPLOAD.maxChunkChars) throw new StoreError(400, "分片内容无效");
      db.prepare("INSERT INTO upload_chunks(upload_id,seq,data) VALUES(?,?,?) ON CONFLICT(upload_id,seq) DO UPDATE SET data=excluded.data").run(id, seq, body.text);
      return { id, seq, done: false };
    },
    commit(id: string) {
      if (!UUID.test(id)) throw new StoreError(400, "上传编号无效");
      const upload = db.prepare("SELECT name,platform,chunks,result FROM uploads WHERE id=?").get(id);
      if (!upload) throw new StoreError(404, "上传不存在，请重新选择文件");
      if (upload.result) return JSON.parse(String(upload.result));
      const rows = db.prepare("SELECT seq,data FROM upload_chunks WHERE upload_id=? ORDER BY seq").all(id) as Array<{ seq: number; data: string }>;
      if (rows.length !== Number(upload.chunks) || rows.some((r, i) => Number(r.seq) !== i))
        throw new StoreError(409, `分片不完整：已收到${rows.length}/${upload.chunks}`);
      const text = rows.map((r) => String(r.data)).join("");
      if (text.length > UPLOAD.maxTotalChars) throw new StoreError(413, "结果超过40MB，请按轮次分段导出");
      const parsed = parseNative(text, String(upload.platform));
      if (!parsed.actions.length) throw new StoreError(400, "文件中没有可读取的动作记录");
      const stored = storeActions(parsed.actions);
      const response = {
        ...stored,
        simulationId: parsed.simulationId,
        ignoredEvents: parsed.ignoredEvents,
        sourceName: String(upload.name),
        sourceHash: fingerprint(text),
      };
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("UPDATE uploads SET result=? WHERE id=?").run(JSON.stringify(response), id);
        db.prepare("DELETE FROM upload_chunks WHERE upload_id=?").run(id);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return response;
    },
  };
}
