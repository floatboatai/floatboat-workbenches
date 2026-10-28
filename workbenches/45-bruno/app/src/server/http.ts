import { createHash } from "node:crypto";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { restoreCollection, type Receipt } from "../contracts/bruno.ts";
import { executable } from "./bru.ts";
export function operations(
  db: WorkbenchServer["database"],
  fetcher: typeof fetch = fetch,
) {
  const active = new Map<string, AbortController>();
  const get = (id: string): Receipt | null => {
    const row = db
      .prepare("SELECT payload FROM http_operations WHERE id=?")
      .get(id);
    return row ? (JSON.parse(String(row.payload)) as Receipt) : null;
  };
  const put = (r: Receipt) =>
    db
      .prepare("UPDATE http_operations SET payload=? WHERE id=?")
      .run(JSON.stringify(r), r.id);
  for (const row of db.prepare("SELECT payload FROM http_operations").all()) {
    const r = JSON.parse(String(row.payload)) as Receipt;
    if (r.state === "initiated")
      put({
        ...r,
        state: "unknown",
        message: "服务已重启；远端是否执行未知，不会自动重发。",
      });
  }
  return {
    get,
    cancel(id: string) {
      if (!/^[-a-zA-Z0-9]{1,100}$/.test(id)) throw new Error("操作标识无效。");
      db.prepare("INSERT OR IGNORE INTO http_cancellations(id) VALUES(?)").run(
        id,
      );
      const r = get(id);
      active.get(id)?.abort(new Error("用户取消"));
      return r ?? { cancelRequested: true };
    },
    async run(raw: unknown) {
      if (
        !isRecord(raw) ||
        typeof raw.operationId !== "string" ||
        !/^[-a-zA-Z0-9]{1,100}$/.test(raw.operationId) ||
        typeof raw.documentId !== "string" ||
        typeof raw.requestId !== "string"
      )
        throw new Error("执行标识无效。");
      const data = restoreCollection(raw.data),
        spec = executable(data.files, raw.requestId);
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            documentId: raw.documentId,
            files: data.files,
            requestId: raw.requestId,
          }),
        )
        .digest("hex");
      const existing = db
        .prepare(
          "SELECT request_fingerprint,payload FROM http_operations WHERE id=?",
        )
        .get(raw.operationId);
      if (existing) {
        if (existing.request_fingerprint !== fingerprint)
          throw new Error("操作标识与请求内容不一致，禁止重发。");
        return JSON.parse(String(existing.payload)) as Receipt;
      }
      let result: Receipt = {
        id: raw.operationId,
        documentId: raw.documentId,
        requestId: raw.requestId,
        state: "initiated",
        method: spec.method,
        url: spec.url,
        source: spec.file.source,
        startedAt: new Date().toISOString(),
      };
      db.prepare(
        "INSERT INTO http_operations(id,document_id,request_fingerprint,payload) VALUES(?,?,?,?)",
      ).run(result.id, result.documentId, fingerprint, JSON.stringify(result));
      if (
        db
          .prepare("SELECT id FROM http_cancellations WHERE id=?")
          .get(result.id)
      ) {
        result = {
          ...result,
          state: "unknown",
          message: "已取消；此操作尚未发出 HTTP。",
        };
        put(result);
        return result;
      }
      const controller = new AbortController();
      active.set(result.id, controller);
      const started = Date.now();
      const timer = setTimeout(
        () => controller.abort(new Error("超过 10 秒预算")),
        10000,
      );
      try {
        const response = await fetcher(spec.url, {
          method: spec.method,
          headers: spec.headers,
          body: spec.body,
          redirect: "manual",
          signal: controller.signal,
        });
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0,
          truncated = false;
        if (reader)
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            const remain = 65536 - bytes;
            if (part.value.length > remain) {
              chunks.push(part.value.slice(0, remain));
              bytes += remain;
              truncated = true;
              await reader.cancel();
              break;
            }
            chunks.push(part.value);
            bytes += part.value.length;
          }
        const buffer = Buffer.concat(chunks),
          contentType = response.headers.get("content-type") ?? "";
        const text =
          /text|json|xml|javascript|urlencoded/.test(contentType) ||
          !contentType;
        result = {
          ...result,
          state: "complete",
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers),
          body: text ? buffer.toString("utf8") : buffer.toString("base64"),
          encoding: text ? "utf-8" : "base64",
          bytes,
          truncated,
          durationMs: Date.now() - started,
          message: truncated
            ? "响应超过 64 KiB，正文已截断。"
            : response.status >= 300 && response.status < 400
              ? "已接收重定向；不会自动跟随。"
              : "已接收响应。",
        };
      } catch (e) {
        result = {
          ...result,
          state: "unknown",
          durationMs: Date.now() - started,
          message: `${controller.signal.aborted ? "已取消或超时" : "网络未返回完整回执"}；远端是否执行未知，不会自动重发。${e instanceof Error ? " " + e.message : ""}`,
        };
      } finally {
        clearTimeout(timer);
        active.delete(result.id);
      }
      put(result);
      return result;
    },
  };
}
export function registerHttp(app: WorkbenchServer) {
  const ops = operations(app.database);
  const fail = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "操作失败。" } },
      { status: 400 },
    );
  app.route("POST", "/api/http/run", async ({ body }) => {
    try {
      return await ops.run(body);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/http/:id", ({ params }) => ops.get(params.id));
  app.route("POST", "/api/http/:id/cancel", ({ params }) => {
    try {
      return ops.cancel(params.id);
    } catch (e) {
      return fail(e);
    }
  });
}
