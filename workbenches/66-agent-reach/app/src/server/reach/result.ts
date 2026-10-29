// ABOUTME: Agent-Reach 1.6.0 统一结果信封与错误代码的 Node 移植（runtime/result.py）。

export const NOT_FOUND = "NOT_FOUND",
  BAD_INPUT = "BAD_INPUT",
  RATE_LIMITED = "RATE_LIMITED",
  TIMEOUT = "TIMEOUT",
  UPSTREAM_BROKEN = "UPSTREAM_BROKEN",
  PLATFORM_BLOCKED = "PLATFORM_BLOCKED",
  BLOCKED_ADDRESS = "BLOCKED_ADDRESS",
  TOO_LARGE = "TOO_LARGE",
  UNSUPPORTED_TYPE = "UNSUPPORTED_TYPE",
  NETWORK = "NETWORK";

const hints: Record<string, string> = {
  [NOT_FOUND]: "来源不存在，请检查链接或编号。",
  [BAD_INPUT]: "查询格式不符合该渠道要求。",
  [RATE_LIMITED]: "平台报告了访问限额，请稍后再试，不要连续重试。",
  [TIMEOUT]: "上游没有在时限内回应，查询已保留，可稍后重试。",
  [UPSTREAM_BROKEN]: "该平台暂时无法读取，消息为上游原文。",
  [PLATFORM_BLOCKED]: "平台返回了人工验证页，本次没有继续采集。",
  [BLOCKED_ADDRESS]: "只读取公网地址；本机、内网和链路本地地址已被拒绝。",
  [TOO_LARGE]: "来源超过读取上限，请选择更具体的页面。",
  [UNSUPPORTED_TYPE]: "该链接不是网页或纯文本，例如PDF、图片或下载文件。",
  [NETWORK]: "无法连接该站点，请检查网络或链接后重试。",
};

export class ReachError extends Error {
  code: string;
  hint: string;
  constructor(code: string, message: string, hint?: string) {
    super(message);
    this.code = code;
    this.hint = hint ?? hints[code] ?? "";
  }
}

export type ReachItem = {
  title: string | null;
  url: string | null;
  author: string | null;
  published_at: string | null;
  text: string | null;
  raw: unknown;
};

export function makeItem(v: {
  title?: unknown;
  url?: unknown;
  author?: unknown;
  published_at?: unknown;
  text?: unknown;
  raw?: unknown;
}): ReachItem {
  const s = (x: unknown) => (typeof x === "string" && x ? x : null);
  return {
    title: s(v.title),
    url: s(v.url),
    author: s(v.author),
    published_at: s(v.published_at),
    text: s(v.text),
    raw: v.raw ?? null,
  };
}

export function unixToIso(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Math.trunc(n) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

const clean = (text: string) =>
  text.replace(/\/\/[^/@\s]+:[^/@\s]+@/g, "//***@").trim().slice(0, 500);

/** Map any exception into a ReachError; never surface a bare "fetch failed". */
export function classify(error: unknown): ReachError {
  if (error instanceof ReachError) return error;
  const e = error as { name?: string; code?: string; message?: string };
  if (e?.name === "TimeoutError" || e?.name === "AbortError" || e?.code === "ETIMEDOUT")
    return new ReachError(TIMEOUT, "上游没有在时限内回应");
  const network: Record<string, string> = {
    ENOTFOUND: "域名无法解析",
    EAI_AGAIN: "域名解析暂时失败",
    ECONNREFUSED: "对方拒绝连接",
    ECONNRESET: "连接被对方重置",
    EHOSTUNREACH: "主机不可达",
    ENETUNREACH: "网络不可达",
    CERT_HAS_EXPIRED: "对方TLS证书已过期",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "无法验证对方TLS证书",
    DEPTH_ZERO_SELF_SIGNED_CERT: "对方使用自签名证书",
    ERR_TLS_CERT_ALTNAME_INVALID: "TLS证书与域名不符",
  };
  if (e?.code && network[e.code])
    return new ReachError(NETWORK, `网络错误：${network[e.code]}（${e.code}）`);
  if (error instanceof SyntaxError)
    return new ReachError(UPSTREAM_BROKEN, "上游返回的数据无法解析");
  return new ReachError(
    UPSTREAM_BROKEN,
    clean(`${e?.name ?? "Error"}: ${e?.message ?? String(error)}`),
  );
}

export type Attempt = { backend: string; ok: boolean; code?: string; message?: string };

export function envelope(v: {
  channel: string;
  action: string;
  backend?: string | null;
  items?: ReachItem[];
  elapsedMs: number;
  attempts?: Attempt[];
  error?: ReachError | null;
}) {
  const error = v.error ?? null;
  return {
    schema_version: 1 as const,
    ok: error === null,
    channel: v.channel,
    action: v.action,
    backend: error === null ? (v.backend ?? null) : null,
    items: error === null ? (v.items ?? []) : [],
    meta: { elapsed_ms: v.elapsedMs, attempts: v.attempts ?? [] },
    error:
      error === null
        ? null
        : { code: error.code, message: error.message, hint: error.hint },
  };
}
