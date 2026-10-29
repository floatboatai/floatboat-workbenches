import assert from "node:assert/strict";
import { test } from "node:test";
import type { FetchOptions, FetchResult } from "../src/server/reach/net.ts";
import { parseTarget, githubRead, githubSearch, README_MAX_CHARS } from "../src/server/reach/github.ts";
import { parseTopicId, v2exRead, v2exNode } from "../src/server/reach/v2ex.ts";
import { parseJina, isAntibotPage, parseExaText, extractReadable, htmlToText, webRead, directRead, exaSearch } from "../src/server/reach/web.ts";
import { collect } from "../src/server/reach/collect.ts";
import { ReachError } from "../src/server/reach/result.ts";
import { envelopeValue } from "../src/contracts/research.ts";

type Route = { status?: number; type?: string; body: string; headers?: Record<string, string> };
function fake(routes: Record<string, Route | ((o?: FetchOptions) => Route)>) {
  const calls: Array<{ url: string; o?: FetchOptions }> = [];
  const get = async (url: string, o?: FetchOptions): Promise<FetchResult> => {
    calls.push({ url, o });
    const key = Object.keys(routes).find((k) => url === k || url.startsWith(k));
    if (!key) return { url, status: 404, headers: {}, type: "text/plain", charset: null, body: Buffer.from("nf") };
    const v = routes[key];
    const r = typeof v === "function" ? v(o) : v;
    return { url, status: r.status ?? 200, headers: r.headers ?? {}, type: r.type ?? "application/json", charset: null, body: Buffer.from(r.body) };
  };
  return { get, calls };
}
const code = (e: unknown) => (e instanceof ReachError ? e.code : String(e));

test("GitHub target parsing accepts owner/repo, repo links and issue/PR links", () => {
  assert.deepEqual(parseTarget("sqlite/sqlite-wasm"), { owner: "sqlite", repo: "sqlite-wasm", number: null });
  assert.deepEqual(parseTarget("https://github.com/a/b.git"), { owner: "a", repo: "b", number: null });
  assert.deepEqual(parseTarget("https://github.com/a/b/pull/12?x=1"), { owner: "a", repo: "b", number: 12 });
  assert.throws(() => parseTarget("not a repo"), ReachError);
});

test("GitHub repo read includes README; missing README is tolerated", async () => {
  const repo = { full_name: "a/b", html_url: "https://github.com/a/b", owner: { login: "a" }, created_at: "2024-01-01T00:00:00Z", description: "desc", license: { spdx_id: "MIT" }, stargazers_count: 3 };
  const withReadme = fake({
    "https://api.github.com/repos/a/b/readme": { body: "# Title\n" + "x".repeat(README_MAX_CHARS + 50) },
    "https://api.github.com/repos/a/b": { body: JSON.stringify(repo) },
  });
  const [item] = await githubRead(withReadme.get, "a/b");
  assert.equal(item.title, "a/b");
  assert.equal(item.text?.length, README_MAX_CHARS);
  assert.equal((item.raw as Record<string, unknown>).license, "MIT");
  assert.equal(withReadme.calls[1].o?.headers?.accept, "application/vnd.github.raw");
  const noReadme = fake({ "https://api.github.com/repos/a/b/readme": { status: 404, body: "{}" }, "https://api.github.com/repos/a/b": { body: JSON.stringify(repo) } });
  assert.equal((await githubRead(noReadme.get, "a/b"))[0].text, "desc");
});

test("GitHub issue read joins comments; rate limit maps to RATE_LIMITED", async () => {
  const f = fake({
    "https://api.github.com/repos/a/b/issues/7/comments": { body: JSON.stringify([{ user: { login: "c1" }, body: "first" }]) },
    "https://api.github.com/repos/a/b/issues/7": { body: JSON.stringify({ title: "Bug", html_url: "https://github.com/a/b/issues/7", user: { login: "u" }, body: "body", labels: [{ name: "bug" }], state: "open" }) },
  });
  const [item] = await githubRead(f.get, "https://github.com/a/b/issues/7");
  assert.equal(item.text, "body\n\n@c1: first");
  assert.deepEqual((item.raw as Record<string, unknown>).labels, ["bug"]);
  const limited = fake({ "https://api.github.com/search": { status: 403, body: "{}", headers: { "x-ratelimit-remaining": "0" } } });
  await assert.rejects(githubSearch(limited.get, "x"), (e) => code(e) === "RATE_LIMITED");
});

test("V2EX topic ids, replies and node validation", async () => {
  assert.equal(parseTopicId("https://www.v2ex.com/t/12345#reply3"), 12345);
  assert.throws(() => parseTopicId("https://example.com/t/1"), ReachError);
  const f = fake({
    "https://www.v2ex.com/api/topics/show.json?id=9": { body: JSON.stringify([{ id: 9, title: "T", url: "https://www.v2ex.com/t/9", content: "main", created: 1700000000, member: { username: "m" } }]) },
    "https://www.v2ex.com/api/replies/show.json": { body: JSON.stringify([{ member: { username: "r" }, content: "reply" }]) },
  });
  const [item] = await v2exRead(f.get, "9");
  assert.equal(item.text, "main\n\n@r: reply");
  assert.equal(item.published_at, "2023-11-14T22:13:20Z");
  await assert.rejects(v2exNode(f.get, "../x"), (e) => code(e) === "BAD_INPUT");
});

test("Jina output parsing and anti-bot detection", () => {
  const item = parseJina("https://e.com/", "Title: Hello\nURL Source: https://e.com/\nPublished Time: 2025-01-02\nMarkdown Content:\nBody text");
  assert.deepEqual([item.title, item.published_at, item.text], ["Hello", "2025-01-02", "Body text"]);
  assert.equal(isAntibotPage("Title: Just a moment...\nWarning: target requiring CAPTCHA"), true);
  assert.equal(isAntibotPage("Title: Ordinary page"), false);
});

test("Exa text blocks become items and drop non-public result links", () => {
  const items = parseExaText("Title: A\nURL: https://a.example/x\nPublished: N/A\nAuthor: Ann\nText: body a\n\nTitle: B\nURL: http://127.0.0.1/\nHighlights:\nbody b");
  assert.equal(items.length, 2);
  assert.deepEqual([items[0].url, items[0].author, items[0].published_at], ["https://a.example/x", "Ann", null]);
  assert.equal(items[1].url, null);
});

test("Exa JSON-RPC errors map to unified codes", async () => {
  const f = fake({ "https://mcp.exa.ai/mcp": { type: "text/event-stream", body: 'event: message\ndata: {"jsonrpc":"2.0","id":1,"error":{"code":429,"message":"Too many requests"}}\n' } });
  await assert.rejects(exaSearch(f.get, "q"), (e) => code(e) === "RATE_LIMITED");
  const ok = fake({ "https://mcp.exa.ai/mcp": { body: JSON.stringify({ result: { content: [{ type: "text", text: "Title: R\nURL: https://r.example/\nText: hi" }] } }) } });
  const items = await exaSearch(ok.get, "q");
  assert.equal(items[0].title, "R");
  assert.match(String(ok.calls[0].o?.body), /web_search_exa/);
});

test("readability extraction keeps the article, headings and lists, and drops navigation", () => {
  const html = `<html><head><title>Site · Article</title><meta name="author" content="Lee"><meta property="article:published_time" content="2025-05-01"></head><body>
    <nav><a href="/">Home</a> <a href="/about">About</a></nav>
    <article><h1>Choosing storage</h1><p>${"OPFS gives each origin a private file system that SQLite can use. ".repeat(6)}</p>
    <h2>Options</h2><ul><li>opfs</li><li>opfs-sahpool</li></ul><p>${"Worker threads are required for synchronous access handles. ".repeat(5)}</p></article>
    <footer>Copyright footer</footer><script>alert(1)</script></body></html>`;
  const item = extractReadable("https://e.com/a", html);
  assert.match(item.text ?? "", /## Options/);
  assert.match(item.text ?? "", /- opfs\n- opfs-sahpool/);
  assert.doesNotMatch(item.text ?? "", /Copyright footer|alert\(1\)|About/);
  assert.equal(item.author, "Lee");
  assert.equal((item.raw as Record<string, unknown>).extractor, "readability");
  assert.equal(htmlToText("<p>a</p><p>b<br>c</p>"), "a\n\nb\nc");
});

test("web read falls back from Jina to direct fetch and records attempts", async () => {
  const article = `<title>T</title><article><p>${"Direct fetch paragraph text. ".repeat(20)}</p></article>`;
  const f = fake({
    "https://r.jina.ai/": { status: 451, body: "blocked" },
    "https://e.example/post": { type: "text/html", body: article },
  });
  const attempts: Array<{ backend: string; ok: boolean; code?: string }> = [];
  const r = await webRead(f.get, "https://e.example/post", attempts);
  assert.equal(r.backend, "direct-readability");
  assert.deepEqual(attempts.map((a) => [a.backend, a.ok]), [["jina", false], ["direct", true]]);
  assert.match(r.items[0].text ?? "", /Direct fetch paragraph/);
  await assert.rejects(webRead(f.get, "http://192.168.0.1/", []), (e) => code(e) === "BLOCKED_ADDRESS");
  // The reader host failing its own address check must not stop the direct fallback.
  const blockedReader = async (url: string, o?: FetchOptions) => {
    if (url.startsWith("https://r.jina.ai/")) throw new ReachError("BLOCKED_ADDRESS", "r.jina.ai resolved oddly");
    return f.get(url, o);
  };
  const fallback: Array<{ backend: string; ok: boolean }> = [];
  assert.equal((await webRead(blockedReader, "https://e.example/post", fallback)).backend, "direct-readability");
  assert.deepEqual(fallback.map((a) => a.ok), [false, true]);
  const failing: Array<{ backend: string; ok: boolean }> = [];
  await assert.rejects(webRead(blockedReader, "https://e.example/missing", failing), (e) => code(e) === "NOT_FOUND");
  assert.deepEqual(failing.map((a) => [a.backend, a.ok]), [["jina", false], ["direct", false]]);
  const plain = fake({ "https://e.example/notes.txt": { type: "text/plain", body: "plain notes" } });
  assert.equal((await directRead(plain.get, "https://e.example/notes.txt"))[0].text, "plain notes");
  assert.deepEqual(f.calls.find((c) => c.url === "https://e.example/post")?.o?.types?.includes("text/html"), true);
});

test("collect wraps results and failures in a valid schema_version 1 envelope", async () => {
  const bad = await collect({ channel: "x", action: "read", query: "a" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error?.code, "BAD_INPUT");
  envelopeValue(bad);
  const empty = await collect({ channel: "web", action: "read", query: "  " });
  assert.equal(empty.error?.code, "BAD_INPUT");
  const f = fake({ "https://www.v2ex.com/api/topics/hot.json": { body: JSON.stringify([{ id: 1, title: "Hot", url: "https://www.v2ex.com/t/1", content: "c", member: { username: "u" } }]) } });
  const ok = await collect({ channel: "v2ex", action: "hot", query: "" }, f.get);
  assert.equal(ok.ok, true);
  assert.equal(ok.backend, "v2ex-api");
  assert.equal(envelopeValue(ok).items[0].title, "Hot");
  const local = await collect({ channel: "web", action: "fetch", query: "http://localhost:8080/admin" });
  assert.equal(local.error?.code, "BLOCKED_ADDRESS");
});
