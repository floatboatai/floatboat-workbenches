// ABOUTME: 检索渠道：网页直读+Readability（失败时经Jina阅读）、Exa免密钥网页搜索、GitHub仓库搜索与README。
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { isRecord } from "../../contracts/project.ts";
import { SOURCE_TEXT_MAX } from "../../contracts/research.ts";
import type { RetrievedItem } from "../../contracts/retrieval.ts";
import {
  RetrievalError,
  BAD_INPUT,
  CHALLENGE,
  NOT_FOUND,
  RATE_LIMITED,
  UPSTREAM,
  classify,
  decodeText,
  expectOk,
  fixtureOrigin,
  normalizePublicUrl,
  type Get,
} from "./net.ts";

/** Upstream endpoints; the offline fixture replaces all of them with one loopback origin. */
export function endpoints(env: NodeJS.ProcessEnv = process.env) {
  const f = fixtureOrigin(env);
  return f
    ? { github: f + "/github", exa: f + "/exa/mcp", jina: f + "/jina/", fixture: f }
    : { github: "https://api.github.com", exa: "https://mcp.exa.ai/mcp", jina: "https://r.jina.ai/", fixture: null };
}
const PAGE_TYPES = ["text/html", "application/xhtml+xml", "text/plain", "text/markdown", "text/x-markdown"];
const cap = (s: string, n = SOURCE_TEXT_MAX) => (s.length > n ? s.slice(0, n) : s);
const excerptOf = (s: string) => {
  const t = s.replace(/^#+ .*$/gm, "").replace(/\s+/g, " ").trim();
  return t.length > 600 ? t.slice(0, 600) + "…" : t;
};
const item = (v: Partial<RetrievedItem> & { url: string }): RetrievedItem => ({
  title: (v.title ?? "").trim().slice(0, 300) || new URL(v.url).hostname,
  url: v.url,
  excerpt: (v.excerpt ?? "").slice(0, 3000),
  text: cap(v.text ?? ""),
  via: v.via ?? "",
  published: (v.published ?? "").slice(0, 60),
});

const BLOCK = new Set(["address", "article", "aside", "blockquote", "dd", "div", "dl", "dt", "figcaption", "figure", "footer", "form", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tr", "ul", "h1", "h2", "h3", "h4", "h5", "h6"]);
type DomNode = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<DomNode> };
export function htmlToText(html: string) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const out: string[] = [];
  const walk = (node: DomNode, pre: boolean) => {
    if (node.nodeType === 3) return void out.push(pre ? (node.textContent ?? "") : (node.textContent ?? "").replace(/\s+/g, " "));
    if (node.nodeType !== 1) return;
    const tag = node.nodeName.toLowerCase();
    if (["script", "style", "noscript", "template", "svg", "img"].includes(tag)) return;
    if (tag === "br") return void out.push("\n");
    const block = BLOCK.has(tag) && tag !== "li";
    if (block) out.push("\n\n");
    if (/^h[1-6]$/.test(tag)) out.push("#".repeat(Number(tag[1])) + " ");
    if (tag === "li") out.push("\n- ");
    for (const child of Array.from(node.childNodes)) walk(child, pre || tag === "pre");
    if (block) out.push("\n\n");
  };
  walk(document.body as unknown as DomNode, false);
  return out.join("").split("\n").map((l) => l.trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
/** Readability extraction; falls back to body text without navigation chrome. */
export function extractReadable(url: string, source: string) {
  const html = /<html[\s>]/i.test(source) ? source : `<!doctype html><html><head></head><body>${source}</body></html>`;
  const { document } = parseHTML(html);
  const pageTitle = document.querySelector("title")?.textContent?.trim() ?? "";
  const description = document.querySelector('meta[name="description"],meta[property="og:description"]')?.getAttribute("content")?.trim() ?? "";
  let article: { title?: string | null; content?: string | null; excerpt?: string | null; publishedTime?: string | null } | null = null;
  try {
    article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  } catch {
    article = null;
  }
  let text = article?.content ? htmlToText(article.content) : "";
  if (text.length < 80) {
    const { document: fresh } = parseHTML(html);
    for (const el of Array.from(fresh.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg"))) el.remove();
    text = htmlToText(fresh.body?.innerHTML ?? "");
  }
  return item({
    url,
    title: article?.title?.trim() || pageTitle,
    text,
    excerpt: article?.excerpt?.trim() || description || excerptOf(text),
    via: "网页直读",
    published: article?.publishedTime ?? "",
  });
}
function isChallenge(body: string) {
  const s = body.slice(0, 20000).toLowerCase();
  return (s.includes("just a moment...") || s.includes("attention required! | cloudflare")) && (s.includes("cf-chl") || s.includes("/cdn-cgi/challenge-platform/") || s.includes("ray id"));
}
export async function directRead(get: Get, target: string): Promise<RetrievedItem> {
  const url = normalizePublicUrl(target);
  const r = expectOk(await get(url.toString(), { headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.9" }, types: PAGE_TYPES, timeoutMs: 20000 }), "网页");
  const html = r.type === "text/html" || r.type === "application/xhtml+xml" || (!r.type && /^\s*</.test(r.body.subarray(0, 200).toString()));
  const body = decodeText(r.body, r.charset, html);
  if (!html) return item({ url: r.url, title: decodeURIComponent(new URL(r.url).pathname.split("/").pop() || ""), text: body.trim(), excerpt: excerptOf(body), via: "网页直读" });
  if (isChallenge(body)) throw new RetrievalError(CHALLENGE, "站点返回了人工验证页，未取得正文");
  const out = extractReadable(r.url, body);
  if (!out.text) throw new RetrievalError(UPSTREAM, "页面没有可提取的正文，可能需要脚本渲染");
  return out;
}
export async function jinaRead(get: Get, target: string): Promise<RetrievedItem> {
  const url = normalizePublicUrl(target).toString();
  const r = expectOk(await get(endpoints().jina + url, { headers: { accept: "text/plain" }, timeoutMs: 25000 }), "Jina 阅读服务");
  const body = decodeText(r.body, r.charset);
  if (body.slice(0, 4096).toLowerCase().includes("requiring captcha")) throw new RetrievalError(CHALLENGE, "Jina 返回了验证页，未取得目标内容");
  const title = /^Title:\s*(.*)$/m.exec(body)?.[1]?.trim() ?? "";
  const content = (body.includes("Markdown Content:") ? body.split("Markdown Content:", 2)[1] : body).trim();
  return item({ url, title, text: content, excerpt: excerptOf(content), via: "Jina 阅读", published: /^Published Time:\s*(.*)$/m.exec(body)?.[1] ?? "" });
}

const GITHUB_REPO = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;
async function githubApi(get: Get, path: string, accept = "application/vnd.github+json") {
  const token = process.env.GITHUB_TOKEN;
  const r = await get(endpoints().github + path, {
    headers: { accept, "x-github-api-version": "2022-11-28", ...(token && !endpoints().fixture ? { authorization: "Bearer " + token } : {}) },
    timeoutMs: 20000,
    maxBytes: 2 * 1048576,
  });
  if (r.status === 429 || (r.status === 403 && (r.headers["x-ratelimit-remaining"] === "0" || r.headers["retry-after"])))
    throw new RetrievalError(RATE_LIMITED, "GitHub API 达到访问限额（未登录每小时60次）；可在服务端设置 GITHUB_TOKEN 或稍后再试");
  return expectOk(r, "GitHub");
}
const obj = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});
function repoText(repo: Record<string, unknown>) {
  const facts = [
    typeof repo.stargazers_count === "number" ? `★ ${repo.stargazers_count}` : "",
    typeof repo.language === "string" ? repo.language : "",
    typeof repo.pushed_at === "string" ? "最近提交 " + repo.pushed_at.slice(0, 10) : "",
    typeof obj(repo.license).spdx_id === "string" ? String(obj(repo.license).spdx_id) : "",
    repo.archived === true ? "已归档" : "",
  ].filter(Boolean);
  return [typeof repo.description === "string" ? repo.description : "", facts.join(" · ")].filter(Boolean).join("\n");
}
export async function githubSearch(get: Get, query: string, limit = 6): Promise<RetrievedItem[]> {
  if (!query.trim()) throw new RetrievalError(BAD_INPUT, "请输入检索词");
  const path = "/search/repositories?" + new URLSearchParams({ q: query, per_page: String(limit) });
  const data = obj(JSON.parse(decodeText((await githubApi(get, path)).body, null)));
  const items = Array.isArray(data.items) ? data.items : [];
  return items.slice(0, limit).flatMap((raw) => {
    const r = obj(raw);
    if (typeof r.html_url !== "string" || typeof r.full_name !== "string") return [];
    const text = repoText(r);
    return [item({ url: r.html_url, title: r.full_name, text, excerpt: text, via: "GitHub 搜索", published: typeof r.pushed_at === "string" ? r.pushed_at : "" })];
  });
}
export async function githubRepo(get: Get, url: string): Promise<RetrievedItem> {
  const m = GITHUB_REPO.exec(url);
  if (!m) throw new RetrievalError(BAD_INPUT, "不是 GitHub 仓库地址");
  const base = `/repos/${encodeURIComponent(m[1])}/${encodeURIComponent(m[2])}`;
  const repo = obj(JSON.parse(decodeText((await githubApi(get, base)).body, null)));
  let readme = "";
  try {
    readme = decodeText((await githubApi(get, base + "/readme", "application/vnd.github.raw")).body, "utf-8");
  } catch (e) {
    if (!(e instanceof RetrievalError) || e.code !== NOT_FOUND) throw e;
  }
  const summary = repoText(repo);
  return item({ url: typeof repo.html_url === "string" ? repo.html_url : url, title: String(repo.full_name ?? m[1] + "/" + m[2]), text: [summary, readme].filter(Boolean).join("\n\n"), excerpt: summary || excerptOf(readme), via: "GitHub README" });
}

/** Read one URL: GitHub repositories through the API, other pages directly, then via Jina. */
export async function readUrl(get: Get, target: string, attempts: string[]): Promise<RetrievedItem> {
  const url = normalizePublicUrl(target).toString();
  if (GITHUB_REPO.test(url)) {
    attempts.push("github:" + url);
    return githubRepo(get, url);
  }
  try {
    attempts.push("direct:" + url);
    return await directRead(get, url);
  } catch (first) {
    const e = classify(first);
    if ([BAD_INPUT, "BLOCKED_ADDRESS", NOT_FOUND, "UNSUPPORTED_TYPE", "TOO_LARGE"].includes(e.code)) throw e;
    attempts.push("jina:" + url);
    try {
      return await jinaRead(get, url);
    } catch (second) {
      const j = classify(second);
      throw new RetrievalError(e.code, `${e.message}；经 Jina 阅读也未成功：${j.message}`);
    }
  }
}

export async function exaSearch(get: Get, query: string, limit = 6): Promise<RetrievedItem[]> {
  if (!query.trim()) throw new RetrievalError(BAD_INPUT, "请输入检索词");
  const r = expectOk(
    await get(endpoints().exa, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "web_search_exa", arguments: { query, numResults: limit } } }),
      timeoutMs: 25000,
      maxBytes: 2 * 1048576,
    }),
    "Exa 网页搜索",
  );
  const raw = decodeText(r.body, r.charset);
  const payloads = raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
  let msg: unknown;
  try {
    msg = JSON.parse(payloads.at(-1) ?? raw);
  } catch {
    throw new RetrievalError(UPSTREAM, "Exa 返回的数据无法识别");
  }
  if (!isRecord(msg)) throw new RetrievalError(UPSTREAM, "Exa 返回的数据无法识别");
  if (isRecord(msg.error)) {
    const text = String(msg.error.message ?? "");
    throw new RetrievalError(/limit|quota|429/i.test(text) ? RATE_LIMITED : UPSTREAM, "Exa：" + text.slice(0, 300));
  }
  const result = obj(msg.result);
  const text = (Array.isArray(result.content) ? result.content : [])
    .filter((c) => isRecord(c) && c.type === "text")
    .map((c) => String(obj(c).text ?? ""))
    .join("\n");
  if (result.isError) throw new RetrievalError(/limit|quota/i.test(text) ? RATE_LIMITED : UPSTREAM, "Exa：" + text.slice(0, 300));
  const items: RetrievedItem[] = [];
  for (const block of ("\n" + text.trim()).split(/\n(?=Title: )/)) {
    const b = block.trim();
    if (!b.startsWith("Title:")) continue;
    const fields: Record<string, string> = {};
    const lines = b.split("\n");
    let i = 0;
    for (; i < lines.length; i++) {
      const m = /^(Title|URL|Published|Author):\s*(.*)$/.exec(lines[i]);
      if (!m) break;
      fields[m[1].toLowerCase()] = m[2].trim();
    }
    try {
      const url = normalizePublicUrl(fields.url ?? "").toString();
      const body = lines
        .slice(i)
        .map((l) => l.replace(/^(Text|Highlights|Summary):\s*/, ""))
        .join("\n")
        .trim();
      items.push(item({ url, title: fields.title === "N/A" ? "" : fields.title, text: body, excerpt: excerptOf(body), via: "Exa 搜索", published: fields.published === "N/A" ? "" : (fields.published ?? "") }));
    } catch {
      /* skip results without a public URL */
    }
  }
  if (!items.length) throw new RetrievalError(UPSTREAM, "Exa 没有返回可识别的搜索结果");
  return items.slice(0, limit);
}
