import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { executeRetrieval } from "../src/server/retrieval/index.ts";
import { fetchPublic, fixtureOrigin, isPublicAddress, normalizePublicUrl, proxyFor, classify, BLOCKED } from "../src/server/retrieval/net.ts";
import { extractReadable } from "../src/server/retrieval/channels.ts";

let server: Server;
let origin = "";
const hits: string[] = [];
const article = `<!doctype html><html><head><title>WAL 夹具文章</title><meta name="description" content="夹具摘要：WAL 让读写并发。"></head><body>
<nav>导航 首页 关于</nav><article><h1>WAL 夹具文章</h1><p>${"在 WAL 模式下，读者读取快照，写者向日志追加内容，因此读写可以并发进行。".repeat(6)}</p>
<h2>代价</h2><ul><li>需要检查点</li><li>必须同机访问</li></ul></article><footer>页脚版权</footer><script>track()</script></body></html>`;
before(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? "";
    hits.push(req.method + " " + url);
    const json = (v: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(v));
    };
    if (url.startsWith("/github/search/repositories")) {
      const q = new URL(url, "http://x").searchParams.get("q");
      if (q === "limit") {
        res.writeHead(403, { "x-ratelimit-remaining": "0" });
        return res.end("{}");
      }
      return json({ items: [{ full_name: "fixture/wal-notes", html_url: "https://github.com/fixture/wal-notes", description: "夹具仓库：WAL 检查点实践", stargazers_count: 42, language: "TypeScript", pushed_at: "2026-09-01T00:00:00Z", license: { spdx_id: "MIT" } }, { full_name: "broken" }] });
    }
    if (url === "/github/repos/fixture/wal-notes") return json({ full_name: "fixture/wal-notes", html_url: "https://github.com/fixture/wal-notes", description: "夹具仓库" });
    if (url === "/github/repos/fixture/wal-notes/readme") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("# wal-notes\n\n定时检查 -wal 文件大小。");
    }
    if (url === "/pages/article.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(article);
    }
    if (url === "/pages/script-only.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("<html><body><div id=app></div><script>render()</script></body></html>");
    }
    if (url === "/pages/file.pdf") {
      res.writeHead(200, { "content-type": "application/pdf" });
      return res.end("%PDF");
    }
    if (url.startsWith("/jina/")) {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("Title: 经 Jina 渲染的页面\nURL Source: x\n\nMarkdown Content:\n渲染后的正文段落，说明检查点。");
    }
    if (url === "/exa/mcp" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const q = JSON.parse(body).params.arguments.query;
        res.writeHead(200, { "content-type": "text/event-stream" });
        const text = q === "nothing" ? "" : `Title: SQLite WAL 说明\nURL: ${origin}/pages/article.html\nPublished: 2026-01-01\nText: 读写并发的说明。\n\nTitle: 私网结果\nURL: http://10.0.0.8/a\nText: 应被忽略`;
        res.end("event: message\ndata: " + JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text }] } }) + "\n\n");
      });
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("missing");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("no address");
  origin = "http://127.0.0.1:" + a.port;
  process.env.RESEARCH_FIXTURE_ORIGIN = origin;
});
after(async () => {
  delete process.env.RESEARCH_FIXTURE_ORIGIN;
  await new Promise<void>((r) => server.close(() => r()));
});

test("fixture origin is loopback-only; public URL policy rejects private, link-local and credentialed targets", () => {
  assert.equal(fixtureOrigin({ RESEARCH_FIXTURE_ORIGIN: "http://example.com" }), null);
  assert.equal(fixtureOrigin({ RESEARCH_FIXTURE_ORIGIN: "http://127.0.0.1:9" }), "http://127.0.0.1:9");
  for (const bad of ["http://127.0.0.1:1/x", "http://169.254.169.254/latest", "http://localhost/", "http://router.lan/", "http://[::ffff:7f00:1]/"])
    assert.throws(() => normalizePublicUrl(bad), (e: { code?: string }) => e.code === BLOCKED, bad);
  assert.throws(() => normalizePublicUrl("https://u:p@example.org"), /登录信息/);
  assert.equal(normalizePublicUrl("example.org/a#frag").toString(), "https://example.org/a");
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("::ffff:10.0.0.1"), false);
  assert.equal(isPublicAddress("64:ff9b::7f00:1"), false);
});
test("DNS answers are checked inside the connection: a public name resolving to a private address is refused", async () => {
  await assert.rejects(
    fetchPublic("https://looks-public.example/", { resolver: async () => [{ address: "10.1.2.3", family: 4 }], proxy: null, timeoutMs: 2000 }),
    (e: Error) => classify(e).code === BLOCKED,
  );
});
test("proxy selection honours NO_PROXY and http proxies only", () => {
  assert.equal(proxyFor(new URL("https://api.github.com"), { HTTPS_PROXY: "http://127.0.0.1:7897" })?.port, "7897");
  assert.equal(proxyFor(new URL("https://api.github.com"), { HTTPS_PROXY: "http://p:1", NO_PROXY: "github.com" }), null);
  assert.equal(proxyFor(new URL("https://x.org"), { HTTPS_PROXY: "socks5://p:1" }), null);
});
test("readability keeps the article and drops navigation, footer and scripts", () => {
  const item = extractReadable("https://x.org/a", article);
  assert.equal(item.title, "WAL 夹具文章");
  assert.match(item.text, /读写可以并发/);
  assert.match(item.text, /- 需要检查点/);
  assert.ok(!/导航|页脚|track\(\)/.test(item.text));
  assert.ok(item.text.length <= 6000);
});
test("read step: page via direct read, script-only page via Jina fallback, GitHub repo via README, failures coded", async () => {
  const r = await executeRetrieval({
    kind: "read",
    query: "",
    urls: [origin + "/pages/article.html", origin + "/pages/script-only.html", "https://github.com/fixture/wal-notes", origin + "/pages/missing", origin + "/pages/file.pdf"],
  });
  assert.deepEqual(r.items.map((i) => i.via), ["网页直读", "Jina 阅读", "GitHub README"]);
  assert.equal(r.items[1].title, "经 Jina 渲染的页面");
  assert.match(r.items[2].text, /定时检查 -wal/);
  assert.deepEqual(r.failures.map((f) => f.code).sort(), ["NOT_FOUND", "UNSUPPORTED_TYPE"]);
  assert.ok(r.failures.every((f) => !/fetch failed/.test(f.message)));
  assert.ok(hits.some((h) => h.startsWith("GET /jina/")));
});
test("GitHub search and Exa web search map results; private URLs in search results are dropped; rate limits explained", async () => {
  const g = await executeRetrieval({ kind: "github", query: "sqlite wal", urls: [] });
  assert.equal(g.items.length, 1);
  assert.equal(g.items[0].title, "fixture/wal-notes");
  assert.match(g.items[0].excerpt, /★ 42 · TypeScript · 最近提交 2026-09-01 · MIT/);
  const limited = await executeRetrieval({ kind: "github", query: "limit", urls: [] });
  assert.equal(limited.failures[0].code, "RATE_LIMITED");
  assert.match(limited.failures[0].message, /GITHUB_TOKEN/);
  const w = await executeRetrieval({ kind: "web-search", query: "sqlite wal", urls: [] });
  assert.deepEqual(w.items.map((i) => i.title), ["SQLite WAL 说明"]);
  assert.equal(w.items[0].published, "2026-01-01");
  const none = await executeRetrieval({ kind: "web-search", query: "nothing", urls: [] });
  assert.equal(none.items.length, 0);
  assert.match(none.failures[0].message, /没有返回可识别/);
});
test("an unreachable upstream is reported as a coded network error, never a bare 'fetch failed'", async () => {
  process.env.RESEARCH_FIXTURE_ORIGIN = "http://127.0.0.1:1";
  try {
    const r = await executeRetrieval({ kind: "github", query: "x", urls: [] });
    assert.equal(r.failures[0].code, "NETWORK");
    assert.match(r.failures[0].message, /ECONNREFUSED/);
  } finally {
    process.env.RESEARCH_FIXTURE_ORIGIN = origin;
  }
});
