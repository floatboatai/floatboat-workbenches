import {
  referralForHost,
  referralPlatformName,
} from "../vendor/geoinflow/contracts/sources.ts";
import { isRecord, boundedText } from "./project.ts";
import { classifyBot } from "../vendor/geoinflow/rules/bots.ts";
import { parseStrictDate } from "../vendor/geoinflow/strict-date.ts";
export type LogRow = {
  id: string;
  time: string;
  path: string;
  status: number;
  bytes: number;
  method: string;
  userAgent: string;
  referrer: string;
};
export type ContentPage = {
  path: string;
  title: string;
  priority: "high" | "normal";
};
export type PageNote = {
  path: string;
  owner: string;
  text: string;
  state: "todo" | "doing" | "done";
};
export type Filters = {
  from: string;
  to: string;
  vendor: string;
  purpose: string;
  http: "all" | "errors" | "success";
};
export type Observation = {
  domain: string;
  timezone: string;
  logs: LogRow[];
  pages: ContentPage[];
  notes: PageNote[];
  filters: Filters;
};
export type Candidate = {
  kind: "logs" | "pages";
  records: LogRow[] | ContentPage[];
  errors: { line: number; reason: string }[];
  rejected: number;
  accepted: number;
  source: string;
  inputHash: string;
};
export function hostname(value: string) {
  const u = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.port ||
    u.pathname !== "/" ||
    u.search ||
    u.hash ||
    !u.hostname
  )
    throw new Error("站点请填写域名，不含路径、端口或账号。");
  return u.hostname.toLowerCase();
}
export function canonicalPath(value: string, domain: string) {
  if (!value.trim()) throw new Error("缺少URL路径。");
  const host = hostname(domain),
    url = new URL(value, "https://" + host);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.hostname !== host ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname.length > 500
  )
    throw new Error("URL不属于当前站点或超过500字符。");
  return url.pathname || "/";
}
function natural(v: unknown, max: number) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > max)
    throw new Error("数字字段无效。");
  return v;
}
export function logValue(raw: unknown): LogRow {
  if (!isRecord(raw)) throw new Error("日志格式无效。");
  const id = boundedText(raw.id, 80),
    status = natural(raw.status, 599);
  if (!id || status < 100) throw new Error("日志编号或HTTP状态无效。");
  const method = boundedText(raw.method, 10);
  if (
    !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(
      method,
    )
  )
    throw new Error("HTTP方法无效。");
  const path = boundedText(raw.path, 500);
  if (!path.startsWith("/")) throw new Error("日志路径需以/开头。");
  return {
    id,
    time: parseStrictDate(raw.time).toISOString(),
    path,
    status,
    bytes: natural(raw.bytes, 1e12),
    method,
    userAgent: boundedText(raw.userAgent, 500),
    referrer: boundedText(raw.referrer ?? "", 1000),
  };
}
export function pageValue(raw: unknown): ContentPage {
  if (!isRecord(raw) || !["high", "normal"].includes(String(raw.priority)))
    throw new Error("内容清单格式无效。");
  const path = boundedText(raw.path, 500);
  if (!path.startsWith("/")) throw new Error("内容路径需以/开头。");
  return {
    path,
    title: boundedText(raw.title, 160),
    priority: raw.priority as ContentPage["priority"],
  };
}
function unique<T>(items: T[], key: (item: T) => string) {
  const ids = new Set<string>();
  for (const item of items) {
    const id = key(item);
    if (ids.has(id)) throw new Error("记录编号或页面路径重复。");
    ids.add(id);
  }
  return items;
}
function decode(raw: unknown, working = false): Observation {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.logs) ||
    raw.logs.length > 200 ||
    !Array.isArray(raw.pages) ||
    raw.pages.length > 200 ||
    !Array.isArray(raw.notes) ||
    raw.notes.length > 100 ||
    !isRecord(raw.filters)
  )
    throw new Error("最多200条日志、200个内容页面和100条处理记录。");
  const domain = boundedText(raw.domain, 253),
    timezone = boundedText(raw.timezone, 80),
    f = raw.filters;
  const filters = {
    from: boundedText(f.from, 10),
    to: boundedText(f.to, 10),
    vendor: boundedText(f.vendor, 100),
    purpose: boundedText(f.purpose, 30),
    http: f.http as Filters["http"],
  };
  if (
    !["all", "errors", "success"].includes(filters.http) ||
    !["all", "ai", "训练", "搜索", "用户触发", "传统搜索", "其他"].includes(
      filters.purpose,
    )
  )
    throw new Error("筛选条件无效。");
  if (!working) {
    hostname(domain);
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    for (const d of [filters.from, filters.to])
      if (
        d &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(d) ||
          parseStrictDate(d).toISOString().slice(0, 10) !== d)
      )
        throw new Error("日期请使用YYYY-MM-DD或留空。");
    if (filters.from && filters.to && filters.from > filters.to)
      throw new Error("开始日期不能晚于结束日期。");
  }
  const value = {
    domain,
    timezone,
    filters,
    logs: unique(raw.logs.map(logValue), (r) => r.id),
    pages: unique(raw.pages.map(pageValue), (r) => r.path),
    notes: unique(
      raw.notes.map((n) => {
        if (
          !isRecord(n) ||
          !["todo", "doing", "done"].includes(String(n.state))
        )
          throw new Error("处理记录无效。");
        return {
          path: boundedText(n.path, 500),
          owner: boundedText(n.owner, 80),
          text: boundedText(n.text, 1500),
          state: n.state as PageNote["state"],
        };
      }),
      (n) => n.path,
    ),
  };
  if (
    new TextEncoder().encode(JSON.stringify(value)).length >
    (working ? 1300000 : 650000)
  )
    throw new Error("项目超过650KB，请减少记录；当前输入按草稿保留。");
  return value;
}
export const observationValue = (v: unknown) => decode(v),
  restoreObservation = (v: unknown) => decode(v, true);
export const empty: Observation = {
  domain: "example.com",
  timezone: "America/New_York",
  logs: [],
  pages: [],
  notes: [],
  filters: { from: "", to: "", vendor: "all", purpose: "all", http: "all" },
};
const examples = [
  ["2026-10-27T12:10:00Z", "/", 200, "GPTBot/1.3", ""],
  ["2026-10-27T12:15:00Z", "/docs/start", 200, "OAI-SearchBot/1.0", ""],
  ["2026-10-27T13:00:00Z", "/docs/api", 403, "ClaudeBot/1.0", ""],
  ["2026-10-27T13:15:00Z", "/guides/faq", 200, "PerplexityBot/1.0", ""],
  ["2026-10-27T14:00:00Z", "/docs/start", 200, "ChatGPT-User/1.0", ""],
  ["2026-10-27T14:10:00Z", "/pricing", 404, "Claude-SearchBot/1.0", ""],
  [
    "2026-10-27T15:00:00Z",
    "/guides/faq",
    200,
    "Mozilla/5.0 Chrome/130.0",
    "https://chatgpt.com/",
  ],
  [
    "2026-10-27T15:10:00Z",
    "/docs/start",
    200,
    "Mozilla/5.0 Chrome/130.0",
    "https://www.perplexity.ai/",
  ],
  ["2026-10-26T16:00:00Z", "/docs/api", 200, "Googlebot/2.1", ""],
] as const;
export const seed: Observation = {
  ...empty,
  domain: "docs.harbor.example",
  logs: examples.map((r, i) => ({
    id: "demo-" + i,
    time: r[0],
    path: r[1],
    status: r[2],
    userAgent: r[3],
    referrer: r[4],
    method: "GET",
    bytes: r[2] === 200 ? 4200 + i * 120 : 300,
  })),
  pages: [
    ["/", "首页", "normal"],
    ["/docs/start", "开始使用", "high"],
    ["/docs/api", "API 参考", "high"],
    ["/guides/faq", "常见问题", "normal"],
    ["/pricing", "产品方案", "high"],
    ["/guides/migration", "版本迁移指南", "high"],
    ["/security", "安全说明", "high"],
    ["/changelog", "版本记录", "normal"],
  ].map(([path, title, priority]) => ({
    path,
    title,
    priority: priority as ContentPage["priority"],
  })),
  notes: [
    {
      path: "/docs/api",
      owner: "内容团队",
      state: "todo",
      text: "核对403的来源策略，确认是否阻止了预期的文档访问。",
    },
  ],
};
export function dayKey(time: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(time));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)?.value)
    .join("-");
}
export function aiReferrer(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase(),
      rule = referralForHost(host);
    return rule ? referralPlatformName(rule) : "";
  } catch {
    return "";
  }
}
export function analyze(input: Observation) {
  observationValue(input);
  const f = input.filters;
  const all = input.logs.map((r) => ({
    ...r,
    bot: classifyBot(r.userAgent),
    day: dayKey(r.time, input.timezone),
    referral: aiReferrer(r.referrer),
  }));
  const logs = all.filter(
    (r) =>
      (!f.from || r.day >= f.from) &&
      (!f.to || r.day <= f.to) &&
      (f.vendor === "all" || r.bot.vendor === f.vendor) &&
      (f.purpose === "all" ||
        (f.purpose === "ai" ? r.bot.aiEligible : r.bot.type === f.purpose)) &&
      (f.http === "all" ||
        (f.http === "errors" ? r.status >= 400 : r.status < 400)),
  );
  const ai = logs.filter((r) => r.bot.aiEligible === true);
  const pages = input.pages.map((p) => {
    const hits = ai.filter((r) => r.path === p.path),
      errors = hits.filter((r) => r.status >= 400).length;
    return {
      ...p,
      hits: hits.length,
      errors,
      last:
        hits
          .map((r) => r.time)
          .sort()
          .at(-1) ?? null,
      note: input.notes.find((n) => n.path === p.path),
    };
  });
  const daily = [...new Set(logs.map((r) => r.day))]
    .sort()
    .map((day) => ({
      day,
      count: logs.filter((r) => r.day === day).length,
      ai: ai.filter((r) => r.day === day).length,
    }));
  return {
    logs,
    ai,
    pages,
    daily,
    errors: logs.filter((r) => r.status >= 400).length,
    referrals: logs.filter((r) => !!r.referral),
    visited: pages.filter((p) => p.hits > 0).length,
    vendors: [...new Set(all.map((r) => r.bot.vendor).filter(Boolean))].sort(),
  };
}
export function csv(headers: string[], rows: unknown[][]) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")
  );
}

export function candidateValue(raw: unknown): Candidate {
  if (
    !isRecord(raw) ||
    !["logs", "pages"].includes(String(raw.kind)) ||
    !Array.isArray(raw.records) ||
    raw.records.length > 200 ||
    !Array.isArray(raw.errors) ||
    raw.errors.length > 200
  )
    throw new Error("解析候选无效。");
  const kind = raw.kind as Candidate["kind"];
  const records =
    kind === "logs" ? raw.records.map(logValue) : raw.records.map(pageValue);
  const accepted = natural(raw.accepted, 200),
    rejected = natural(raw.rejected, 200);
  if (accepted !== records.length || rejected !== raw.errors.length)
    throw new Error("解析计数不一致。");
  const inputHash = boundedText(raw.inputHash, 64);
  if (!/^[a-f0-9]{64}$/.test(inputHash)) throw new Error("输入校验标识无效。");
  return {
    kind,
    records,
    accepted,
    rejected,
    inputHash,
    source: boundedText(raw.source, 20),
    errors: raw.errors.map((e) => {
      if (!isRecord(e)) throw new Error("错误行信息无效。");
      return { line: natural(e.line, 200), reason: boundedText(e.reason, 500) };
    }),
  };
}
