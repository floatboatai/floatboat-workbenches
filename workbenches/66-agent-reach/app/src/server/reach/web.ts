// ABOUTME: 网页渠道（channels/web.py）：Jina阅读、直接读取+Readability正文提取、Exa免密钥网页搜索。

import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { isRecord } from "../../contracts/project.ts";
import {
  ReachError,
  BAD_INPUT,
  PLATFORM_BLOCKED,
  RATE_LIMITED,
  UPSTREAM_BROKEN,
  makeItem,
  classify,
  type Attempt,
  type ReachItem,
} from "./result.ts";
import { decodeText, expectOk, normalizePublicUrl } from "./net.ts";
import type { Get } from "./github.ts";

export const WEB_TEXT_MAX = 80_000;
const PAGE_TYPES = ["text/html", "application/xhtml+xml", "text/plain", "text/markdown", "text/x-markdown"];
const EXA = "https://mcp.exa.ai/mcp";

/** High-confidence Jina/Cloudflare challenge pages (web.py _is_antibot_page). */
export function isAntibotPage(body: string): boolean {
  const s = body.slice(0, 4096).toLowerCase();
  const jinaCaptcha = s.includes("warning:") && s.includes("requiring captcha");
  const challenge = ["title: just a moment...", "## performing security verification", "title: attention required! | cloudflare"].some((m) =>
    s.includes(m),
  );
  const cloudflare = s.includes("title: attention required! | cloudflare") && (s.includes("ray id") || s.includes("/cdn-cgi/challenge-platform/"));
  return (jinaCaptcha && challenge) || cloudflare;
}

function isChallengeHtml(html: string): boolean {
  const s = html.slice(0, 20000).toLowerCase();
  return (
    (s.includes("<title>just a moment...</title>") || s.includes("attention required! | cloudflare")) &&
    (s.includes("/cdn-cgi/challenge-platform/") || s.includes("cf-chl") || s.includes("ray id"))
  );
}

function capped(text: string) {
  return text.length > WEB_TEXT_MAX ? { text: text.slice(0, WEB_TEXT_MAX), truncated: true } : { text, truncated: false };
}

export function parseJina(url: string, body: string): ReachItem {
  const title = /^Title:\s*(.*)$/m.exec(body)?.[1]?.trim();
  const published = /^Published Time:\s*(.*)$/m.exec(body)?.[1]?.trim();
  const content = body.includes("Markdown Content:") ? body.split("Markdown Content:", 2)[1] : body;
  const { text, truncated } = capped(content.trim());
  return makeItem({ title, url, published_at: published, text, raw: truncated ? { truncated: true, chars: content.trim().length } : null });
}

export async function jinaRead(get: Get, target: string, timeoutMs = 25000): Promise<ReachItem[]> {
  const url = normalizePublicUrl(target).toString();
  const r = expectOk(
    await get("https://r.jina.ai/" + url, { headers: { accept: "text/plain" }, timeoutMs, maxBytes: 5 * 1024 * 1024 }),
    "Jina 阅读服务",
  );
  const body = decodeText(r.body, r.charset);
  if (isAntibotPage(body)) throw new ReachError(PLATFORM_BLOCKED, "Jina Reader 返回了反爬验证页，未取得目标内容");
  return [parseJina(url, body)];
}

const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "dd", "div", "dl", "dt", "figcaption", "figure", "footer", "form",
  "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tr", "ul", "h1", "h2", "h3", "h4", "h5", "h6",
]);
type DomNode = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<DomNode>; getAttribute?: (n: string) => string | null };

/** Render readable HTML to plain text while keeping paragraph, heading and list breaks. */
export function htmlToText(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const out: string[] = [];
  const walk = (node: DomNode, pre: boolean) => {
    if (node.nodeType === 3) {
      const t = node.textContent ?? "";
      out.push(pre ? t : t.replace(/\s+/g, " "));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.nodeName.toLowerCase();
    if (["script", "style", "noscript", "template", "svg"].includes(tag)) return;
    if (tag === "br") return void out.push("\n");
    if (tag === "img") {
      const alt = node.getAttribute?.("alt")?.trim();
      if (alt) out.push(`[图片：${alt}]`);
      return;
    }
    const block = BLOCK.has(tag) && tag !== "li";
    if (block) out.push("\n\n");
    if (/^h[1-6]$/.test(tag)) out.push("#".repeat(Number(tag[1])) + " ");
    if (tag === "li") out.push("\n- ");
    if (tag === "td" || tag === "th") out.push(" | ");
    const isPre = pre || tag === "pre";
    for (const child of Array.from(node.childNodes)) walk(child, isPre);
    if (block) out.push("\n\n");
    if (tag === "li") out.push("\n");
  };
  walk(document.body as unknown as DomNode, false);
  return out
    .join("")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+(?=\S)/, (m) => (m.length > 3 ? "" : m)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^- \s+/gm, "- ")
    .replace(/^(- .*)\n\n(?=- )/gm, "$1\n")
    .replace(/^(- .*)\n\n(?=- )/gm, "$1\n")
    .trim();
}

function meta(document: { querySelector: (s: string) => { getAttribute: (n: string) => string | null } | null }, ...names: string[]) {
  for (const n of names) {
    const v = document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.getAttribute("content")?.trim();
    if (v) return v;
  }
  return null;
}

/** Readability-style extraction of the main article from fetched HTML. */
export function extractReadable(url: string, source: string) {
  // linkedom needs a full document for <body>; fragments are wrapped.
  const html = /<html[\s>]/i.test(source) ? source : `<!doctype html><html><head></head><body>${source}</body></html>`;
  const { document } = parseHTML(html);
  const pageTitle = document.querySelector("title")?.textContent?.trim() || null;
  const author = meta(document, "author", "article:author", "og:article:author");
  const published = meta(document, "article:published_time", "og:published_time", "date", "dc.date");
  const siteName = meta(document, "og:site_name");
  let article: { title?: string | null; byline?: string | null; content?: string | null; excerpt?: string | null; publishedTime?: string | null } | null = null;
  try {
    article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  } catch {
    article = null;
  }
  let text = article?.content ? htmlToText(article.content) : "";
  let method = "readability";
  if (text.length < 80) {
    const { document: fresh } = parseHTML(html);
    for (const el of Array.from(fresh.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg"))) el.remove();
    text = htmlToText(fresh.body?.innerHTML ?? "");
    method = "body-text";
  }
  const { text: body, truncated } = capped(text);
  return makeItem({
    title: article?.title?.trim() || pageTitle,
    url,
    author: article?.byline?.trim() || author,
    published_at: article?.publishedTime || published,
    text: body,
    raw: {
      extractor: method,
      excerpt: article?.excerpt ?? null,
      site_name: siteName,
      ...(truncated ? { truncated: true, chars: text.length } : {}),
    },
  });
}

export async function directRead(get: Get, target: string, timeoutMs = 20000): Promise<ReachItem[]> {
  const url = normalizePublicUrl(target);
  const r = expectOk(
    await get(url.toString(), {
      headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1" },
      timeoutMs,
      maxBytes: 5 * 1024 * 1024,
      types: PAGE_TYPES,
    }),
    "网页",
  );
  const html = r.type === "text/html" || r.type === "application/xhtml+xml" || (!r.type && /^\s*</.test(r.body.subarray(0, 200).toString()));
  const body = decodeText(r.body, r.charset, html);
  if (!html) {
    const { text, truncated } = capped(body.trim());
    return [makeItem({ title: decodeURIComponent(url.pathname.split("/").pop() || url.hostname), url: r.url, text, raw: { extractor: "plain-text", ...(truncated ? { truncated: true } : {}) } })];
  }
  if (isChallengeHtml(body)) throw new ReachError(PLATFORM_BLOCKED, "站点返回了人工验证页，未取得正文");
  const item = extractReadable(r.url, body);
  if (!item.text) throw new ReachError(UPSTREAM_BROKEN, "页面没有可提取的正文，可能需要脚本渲染");
  return [item];
}

/** Jina first (as upstream), then direct fetch; every attempt is recorded. */
export async function webRead(get: Get, target: string, attempts: Attempt[]): Promise<{ backend: string; items: ReachItem[] }> {
  normalizePublicUrl(target);
  try {
    const items = await jinaRead(get, target);
    attempts.push({ backend: "jina", ok: true });
    return { backend: "jina", items };
  } catch (e) {
    const err = classify(e);
    // The user's URL was validated above, so any Jina failure (including the
    // reader host itself being unreachable) falls back to a direct read.
    attempts.push({ backend: "jina", ok: false, code: err.code, message: err.message });
  }
  try {
    const items = await directRead(get, target);
    attempts.push({ backend: "direct", ok: true });
    return { backend: "direct-readability", items };
  } catch (e) {
    const err = classify(e);
    attempts.push({ backend: "direct", ok: false, code: err.code, message: err.message });
    throw err;
  }
}

const LIMIT_RE =
  /\b429\b|rate[ _-]?limit|too many requests|\bquota\b|(?:usage|request|daily|monthly|free)[ _-]+limit|(?:credit|credits|balance).{0,40}(?:exhaust|deplet|insufficient|exceed|reach)|(?:out of|insufficient|exhausted).{0,20}credits?/i;
function exaError(text: string, code?: unknown) {
  if (code === -32602 || code === "-32602") return new ReachError(BAD_INPUT, `Exa 拒绝了参数：${text.slice(0, 300)}`);
  if (code === 429 || code === "429" || LIMIT_RE.test(text)) return new ReachError(RATE_LIMITED, `Exa：${text.slice(0, 300)}`, "Exa 免费搜索达到限额，请稍后再试。");
  return new ReachError(UPSTREAM_BROKEN, `Exa：${text.slice(0, 300)}`);
}

export function parseExaText(text: string): ReachItem[] {
  const items: ReachItem[] = [];
  for (const raw of ("\n" + text.trim()).split(/\n(?=Title: )/)) {
    const block = raw.trim();
    if (!block.startsWith("Title:")) continue;
    const fields: Record<string, string> = {};
    const lines = block.split("\n");
    let i = 0;
    for (; i < lines.length; i++) {
      const m = /^(Title|URL|Published|Author):\s*(.*)$/.exec(lines[i]);
      if (!m) break;
      fields[m[1].toLowerCase()] = m[2].trim();
    }
    const body = lines.slice(i).filter((l) => !["Highlights:", "Text:"].includes(l.trim()));
    const na = (v?: string) => (!v || v === "N/A" ? null : v);
    let url = na(fields.url);
    try {
      if (url) url = normalizePublicUrl(url).toString();
    } catch {
      url = null;
    }
    items.push(makeItem({ title: na(fields.title), url, author: na(fields.author), published_at: na(fields.published), text: body.join("\n").trim(), raw: fields }));
  }
  return items;
}

export async function exaSearch(get: Get, query: string, limit = 6, timeoutMs = 25000): Promise<ReachItem[]> {
  if (!query.trim()) throw new ReachError(BAD_INPUT, "请输入搜索关键词");
  const r = expectOk(
    await get(EXA, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "web_search_exa", arguments: { query, objective: query, numResults: limit } },
      }),
      timeoutMs,
      maxBytes: 2 * 1024 * 1024,
    }),
    "Exa 搜索",
  );
  const raw = decodeText(r.body, r.charset);
  const payloads = raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
  const msg: unknown = JSON.parse(payloads.at(-1) ?? raw);
  if (!isRecord(msg)) throw new ReachError(UPSTREAM_BROKEN, "Exa 返回的数据无法识别");
  if (isRecord(msg.error)) throw exaError(String(msg.error.message ?? JSON.stringify(msg.error)), msg.error.code);
  const result = isRecord(msg.result) ? msg.result : {};
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .filter((c) => isRecord(c) && c.type === "text")
    .map((c) => String((c as Record<string, unknown>).text ?? ""))
    .join("\n");
  if (result.isError) throw exaError(text);
  const items = parseExaText(text);
  if (!items.length) throw new ReachError(UPSTREAM_BROKEN, "Exa 没有返回可识别的搜索结果");
  return items.slice(0, limit);
}
