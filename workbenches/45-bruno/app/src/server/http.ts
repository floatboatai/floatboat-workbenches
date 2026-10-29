import { createHash } from "node:crypto";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { restoreCollection, type Receipt } from "../contracts/bruno.ts";
import { runAssertions, evaluatePath, type ResponseView } from "../contracts/assert.ts";
import { prepare } from "./prepare.ts";

export const RESPONSE_LIMIT = 2 * 1024 * 1024;
const SAFE_TO_REPEAT = ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"];

/** Connection never established: the remote did not receive the request. */
const NOT_DELIVERED: Record<string, [string, string]> = {
  ECONNREFUSED: ["refused", "连接被拒绝：目标地址没有服务在监听"],
  ENOTFOUND: ["dns", "域名解析失败：找不到该主机"],
  EAI_AGAIN: ["dns", "域名解析暂时失败"],
  EAI_NONAME: ["dns", "域名解析失败"],
  ENETUNREACH: ["network", "网络不可达"],
  EHOSTUNREACH: ["network", "主机不可达"],
  EADDRNOTAVAIL: ["network", "地址不可用"],
  UND_ERR_CONNECT_TIMEOUT: ["timeout", "连接超时：未能建立连接"],
  CERT_HAS_EXPIRED: ["tls", "TLS 证书已过期"],
  DEPTH_ZERO_SELF_SIGNED_CERT: ["tls", "TLS 自签名证书不受信任"],
  SELF_SIGNED_CERT_IN_CHAIN: ["tls", "TLS 证书链包含自签名证书"],
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: ["tls", "无法验证 TLS 证书"],
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: ["tls", "无法验证 TLS 证书签发者"],
  ERR_TLS_CERT_ALTNAME_INVALID: ["tls", "TLS 证书与主机名不匹配"],
  ERR_SSL_WRONG_VERSION_NUMBER: ["tls", "TLS 握手失败（可能是对 HTTP 端口使用了 https://）"],
  EPROTO: ["tls", "TLS 握手失败"],
};

function errorCodes(e: unknown, depth = 0): string[] {
  if (!e || typeof e !== "object" || depth > 4) return [];
  const out: string[] = [];
  const x = e as { code?: unknown; cause?: unknown; errors?: unknown };
  if (typeof x.code === "string") out.push(x.code);
  out.push(...errorCodes(x.cause, depth + 1));
  if (Array.isArray(x.errors)) for (const inner of x.errors) out.push(...errorCodes(inner, depth + 1));
  return out;
}

export interface Classified {
  state: "failed" | "unknown";
  errorKind: string;
  message: string;
}
/**
 * Decides whether a failed exchange is a definite failure or a genuinely
 * ambiguous outcome. Only non-idempotent methods (POST/PATCH) with an
 * ambiguous error keep the unknown-receipt protection.
 */
export function classify(error: unknown, method: string, aborted: "timeout" | "cancel" | null): Classified {
  const codes = errorCodes(error);
  const cause = (error as { cause?: unknown })?.cause;
  if (!aborted && cause instanceof Error && /bad port/i.test(cause.message))
    return {
      state: "failed",
      errorKind: "invalid",
      message: "此端口被浏览器/fetch 安全规范禁止（例如 1、9、25 等保留端口），请求未发出。请改用其他端口。",
    };
  const definite = codes.map((c) => NOT_DELIVERED[c]).find(Boolean);
  if (definite && !aborted)
    return { state: "failed", errorKind: definite[0], message: `${definite[1]}（${codes[0]}）。请求未送达，可直接重试。` };
  const safe = SAFE_TO_REPEAT.includes(method.toUpperCase());
  const what =
    aborted === "timeout"
      ? "等待响应超时"
      : aborted === "cancel"
        ? "已取消"
        : codes.includes("ECONNRESET") || codes.includes("UND_ERR_SOCKET")
          ? "连接在响应前被关闭"
          : "网络中断，未收到响应";
  const kind = aborted === "timeout" ? "timeout" : aborted === "cancel" ? "cancelled" : "reset";
  if (safe)
    return {
      state: "failed",
      errorKind: kind,
      message: `${what}${codes[0] ? `（${codes[0]}）` : ""}。${method.toUpperCase()} 可安全重试。`,
    };
  return {
    state: "unknown",
    errorKind: kind,
    message: `${what}${codes[0] ? `（${codes[0]}）` : ""}。请求可能已到达服务器，${method.toUpperCase()} 是否执行未知；核对后再决定是否重发。`,
  };
}

export function redactor(secrets: string[]) {
  const base = [...new Set(secrets.filter((s) => s.length >= 3))];
  const all = [
    ...new Set(
      base.flatMap((s) => [s, encodeURIComponent(s), Buffer.from(s).toString("base64")]).filter((v) => v.length >= 3),
    ),
  ].sort((a, b) => b.length - a.length);
  return (text: string) => {
    let out = text;
    for (const s of all) out = out.split(s).join("•••");
    return out;
  };
}

function stringRecord(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) if (typeof x === "string" && k.length <= 200 && x.length <= 20000) out[k] = x;
  return out;
}

export function operations(
  db: WorkbenchServer["database"],
  fetcher: typeof fetch = fetch,
  dynamic: () => Promise<Record<string, string>> = async () => ({}),
) {
  const active = new Map<string, AbortController>();
  const get = (id: string): Receipt | null => {
    const row = db.prepare("SELECT payload FROM http_operations WHERE id=?").get(id);
    return row ? (JSON.parse(String(row.payload)) as Receipt) : null;
  };
  const put = (r: Receipt) =>
    db.prepare("UPDATE http_operations SET payload=? WHERE id=?").run(JSON.stringify(r), r.id);
  for (const row of db.prepare("SELECT payload FROM http_operations").all()) {
    const r = JSON.parse(String(row.payload)) as Receipt;
    if (r.state === "initiated") {
      const safe = SAFE_TO_REPEAT.includes(r.method.toUpperCase());
      put({
        ...r,
        state: safe ? "failed" : "unknown",
        errorKind: "service",
        message: safe
          ? "工作台服务在等待响应时重启；未收到响应，可直接重试。"
          : "工作台服务在等待响应时重启；远端是否执行未知，不会自动重发。",
      });
    }
  }
  return {
    get,
    cancel(id: string) {
      if (!/^[-a-zA-Z0-9]{1,100}$/.test(id)) throw new Error("操作标识无效。");
      db.prepare("INSERT OR IGNORE INTO http_cancellations(id) VALUES(?)").run(id);
      const r = get(id);
      const controller = active.get(id);
      if (controller) {
        (controller as AbortController & { reason2?: string }).reason2 = "cancel";
        controller.abort(new Error("用户取消"));
      }
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
      if (raw.environment !== undefined && typeof raw.environment !== "string") throw new Error("环境名称无效。");
      const data = restoreCollection(raw.data);
      const environment = typeof raw.environment === "string" && raw.environment ? raw.environment : undefined;
      const secrets = stringRecord(raw.secrets),
        runtime = stringRecord(raw.runtime);
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            documentId: raw.documentId,
            files: data.files,
            requestId: raw.requestId,
            environment: environment ?? null,
          }),
        )
        .digest("hex");
      const existing = db
        .prepare("SELECT request_fingerprint,payload FROM http_operations WHERE id=?")
        .get(raw.operationId);
      if (existing) {
        if (existing.request_fingerprint !== fingerprint) throw new Error("操作标识与请求内容不一致，禁止重发。");
        return JSON.parse(String(existing.payload)) as Receipt;
      }
      let spec: ReturnType<typeof prepare>;
      try {
        spec = prepare(data.files, raw.requestId, { environment, secrets, runtime, dynamic: await dynamic() });
      } catch (e) {
        // Rejected before dispatch: a definite, local failure. Nothing is written to the ledger.
        const file = data.files.find((f) => f.id === raw.requestId);
        const method = /^(get|post|put|patch|delete|head|options)\s*\{/im.exec(file?.source ?? "")?.[1] ?? "GET";
        const failed: Receipt = {
          id: raw.operationId,
          documentId: raw.documentId,
          requestId: raw.requestId,
          state: "failed",
          errorKind: "invalid",
          method: method.toUpperCase(),
          url: /^\s*url:\s*(.*)$/m.exec(file?.source ?? "")?.[1] ?? "",
          source: file?.source ?? "",
          startedAt: new Date().toISOString(),
          ...(environment ? { environment } : {}),
          message: e instanceof Error ? e.message : "请求无法构建，未发送。",
        };
        return failed;
      }
      const redact = redactor(spec.sensitive);
      let result: Receipt = {
        id: raw.operationId,
        documentId: raw.documentId,
        requestId: raw.requestId,
        state: "initiated",
        method: spec.method,
        url: redact(spec.url),
        source: spec.file.source,
        startedAt: new Date().toISOString(),
        ...(environment ? { environment } : {}),
        request: {
          ...spec.sent,
          url: redact(spec.sent.url),
          ...(spec.sent.body !== undefined ? { body: redact(spec.sent.body) } : {}),
        },
        ...(spec.warnings.length ? { warnings: spec.warnings } : {}),
      };
      db.prepare(
        "INSERT INTO http_operations(id,document_id,request_fingerprint,payload) VALUES(?,?,?,?)",
      ).run(result.id, result.documentId, fingerprint, JSON.stringify(result));
      if (db.prepare("SELECT id FROM http_cancellations WHERE id=?").get(result.id)) {
        result = { ...result, state: "failed", errorKind: "cancelled", message: "已取消；此操作尚未发出 HTTP。" };
        put(result);
        return result;
      }
      const controller = new AbortController() as AbortController & { reason2?: string };
      active.set(result.id, controller);
      const started = Date.now();
      const timer = setTimeout(() => {
        controller.reason2 = "timeout";
        controller.abort(new Error(`超过 ${spec.timeoutMs / 1000} 秒`));
      }, spec.timeoutMs);
      try {
        const response = await fetcher(spec.url, {
          method: spec.method,
          headers: spec.headers,
          body: spec.body,
          redirect: "manual",
          signal: controller.signal,
        });
        const chunks: Uint8Array[] = [];
        let bytes = 0,
          truncated = false,
          bodyError = "";
        const reader = response.body?.getReader();
        if (reader)
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              const remain = RESPONSE_LIMIT - bytes;
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
          } catch (e) {
            bodyError = controller.reason2 === "timeout" ? "读取正文超时" : e instanceof Error ? e.message : "正文读取中断";
            truncated = true;
          }
        const durationMs = Date.now() - started;
        const buffer = Buffer.concat(chunks),
          contentType = response.headers.get("content-type") ?? "";
        const isText = /text|json|xml|javascript|urlencoded|graphql|html|csv|yaml/i.test(contentType) || (!contentType && !buffer.includes(0));
        const bodyText = isText ? buffer.toString("utf8") : buffer.toString("base64");
        const headers: Record<string, string> = {};
        response.headers.forEach((v, k) => {
          headers[k] = redact(v);
        });
        let parsedBody: unknown = isText ? bodyText : undefined;
        if (isText && (/json/i.test(contentType) || /^\s*[[{]/.test(bodyText)))
          try {
            parsedBody = JSON.parse(bodyText);
          } catch {
            parsedBody = bodyText;
          }
        const view: ResponseView = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers),
          body: parsedBody,
          responseTime: durationMs,
        };
        const assertions = runAssertions(spec.model.assertions, view, spec.interpolate).map((a) => ({
          ...a,
          expected: redact(a.expected),
          actual: redact(a.actual),
        }));
        const captured: Record<string, string> = {};
        for (const v of spec.model.postVars)
          if (v.enabled && v.name)
            try {
              const value = evaluatePath(v.value, view);
              if (value !== undefined)
                captured[v.name] = typeof value === "string" ? value : JSON.stringify(value);
            } catch {
              /* reported through warnings below */
            }
        const passed = assertions.filter((a) => a.passed).length;
        result = {
          ...result,
          state: "complete",
          status: response.status,
          statusText: response.statusText,
          headers,
          body: isText ? redact(bodyText) : bodyText,
          encoding: isText ? "utf-8" : "base64",
          bytes,
          truncated,
          durationMs,
          ...(assertions.length ? { assertions } : {}),
          ...(Object.keys(captured).length ? { captured } : {}),
          message: bodyError
            ? `已收到 HTTP ${response.status}，但${bodyError}；正文不完整。`
            : truncated
              ? `响应超过 ${RESPONSE_LIMIT / 1024 / 1024} MiB，正文已截断。`
              : response.status >= 300 && response.status < 400
                ? "已接收重定向；不会自动跟随。"
                : assertions.length
                  ? `断言 ${passed}/${assertions.length} 通过。`
                  : "已接收响应。",
        };
      } catch (e) {
        const aborted = controller.signal.aborted ? (controller.reason2 === "cancel" ? "cancel" : "timeout") : null;
        const c = classify(e, spec.method, aborted);
        result = { ...result, ...c, durationMs: Date.now() - started };
      } finally {
        clearTimeout(timer);
        active.delete(result.id);
      }
      put(result);
      return result;
    },
  };
}

export function registerHttp(app: WorkbenchServer, dynamic: () => Promise<Record<string, string>>) {
  const ops = operations(app.database, fetch, dynamic);
  const fail = (e: unknown) =>
    Response.json({ error: { message: e instanceof Error ? e.message : "操作失败。" } }, { status: 400 });
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
