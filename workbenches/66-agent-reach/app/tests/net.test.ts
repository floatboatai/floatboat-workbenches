import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import {
  isPublicAddress,
  normalizePublicUrl,
  fetchPublic,
  proxyFor,
  type FetchOptions,
} from "../src/server/reach/net.ts";
import { ReachError } from "../src/server/reach/result.ts";

let server: http.Server, proxy: http.Server, port = 0, proxyPort = 0;
const proxied: string[] = [];
before(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    if (u.pathname === "/page") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end("<title>页</title><p>你好</p>");
    }
    if (u.pathname === "/gbk") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(Buffer.concat([Buffer.from('<meta charset="gbk"><p>'), Buffer.from([0xc4, 0xe3, 0xba, 0xc3]), Buffer.from("</p>")]));
    }
    if (u.pathname === "/gzip") {
      res.writeHead(200, { "content-type": "text/plain", "content-encoding": "gzip" });
      return res.end(zlib.gzipSync("compressed body"));
    }
    if (u.pathname === "/pdf") {
      res.writeHead(200, { "content-type": "application/pdf" });
      return res.end("%PDF-1.7");
    }
    if (u.pathname === "/big") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("x".repeat(5000));
    }
    if (u.pathname === "/slow") {
      setTimeout(() => res.end("late"), 1500);
      return;
    }
    if (u.pathname === "/hop") {
      res.writeHead(302, { location: "/page" });
      return res.end();
    }
    if (u.pathname === "/to-loopback") {
      res.writeHead(302, { location: `http://127.0.0.1:${port}/page` });
      return res.end();
    }
    if (u.pathname === "/to-private-name") {
      res.writeHead(301, { location: `http://intranet.test:${port}/page` });
      return res.end();
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
  proxy = http.createServer((req, res) => {
    proxied.push(req.url ?? "");
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("via proxy " + req.headers.host);
  });
  await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
  proxyPort = (proxy.address() as AddressInfo).port;
});
after(() => {
  server.close();
  proxy.close();
});

const names: Record<string, string> = { "fixture.test": "127.0.0.1", "intranet.test": "10.0.0.8" };
const resolver: FetchOptions["resolver"] = async (h) => (names[h] ? [{ address: names[h], family: 4 }] : []);
const local: FetchOptions = { resolver, allowAddress: (ip) => ip === "127.0.0.1", proxy: null, timeoutMs: 3000 };
const code = (e: unknown) => (e instanceof ReachError ? e.code : String(e));

test("public address filter blocks loopback, private, link-local, CGNAT, mapped and special ranges", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "198.18.0.1", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "2001:db8::1"])
    assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["93.184.216.34", "140.82.112.5", "2606:4700::6810:84e5", "::ffff:8.8.8.8"]) assert.equal(isPublicAddress(ip), true, ip);
});

test("URL normalization rejects local names, literal private IPs, credentials and non-http schemes", () => {
  assert.equal(normalizePublicUrl("example.com/a#frag").toString(), "https://example.com/a");
  for (const bad of ["http://localhost/", "http://127.0.0.1/", "http://0x7f.1/", "http://[::1]/", "http://10.0.0.1/", "http://169.254.169.254/latest/meta-data", "https://user:pw@example.com/", "file:///etc/passwd", "ftp://example.com/", "http://intranet/", "http://printer.local/", "http://a.internal/"])
    assert.throws(() => normalizePublicUrl(bad), ReachError, bad);
});

test("hostnames resolving to private addresses are refused after DNS resolution", async () => {
  await assert.rejects(fetchPublic(`http://fixture.test:${port}/page`, { resolver, proxy: null }), (e) => code(e) === "BLOCKED_ADDRESS");
  await assert.rejects(fetchPublic(`http://intranet.test:${port}/page`, { ...local }), (e) => code(e) === "BLOCKED_ADDRESS");
});

test("redirects are followed but each hop is re-checked", async () => {
  const r = await fetchPublic(`http://fixture.test:${port}/hop`, local);
  assert.equal(r.status, 200);
  assert.match(r.url, /\/page$/);
  await assert.rejects(fetchPublic(`http://fixture.test:${port}/to-loopback`, local), (e) => code(e) === "BLOCKED_ADDRESS");
  await assert.rejects(fetchPublic(`http://fixture.test:${port}/to-private-name`, local), (e) => code(e) === "BLOCKED_ADDRESS");
});

test("content type, size limit, timeout, gzip and charset are enforced", async () => {
  await assert.rejects(fetchPublic(`http://fixture.test:${port}/pdf`, { ...local, types: ["text/html"] }), (e) => code(e) === "UNSUPPORTED_TYPE");
  await assert.rejects(fetchPublic(`http://fixture.test:${port}/big`, { ...local, maxBytes: 1000 }), (e) => code(e) === "TOO_LARGE");
  await assert.rejects(fetchPublic(`http://fixture.test:${port}/slow`, { ...local, timeoutMs: 300 }), (e) => code(e) === "TIMEOUT");
  const gz = await fetchPublic(`http://fixture.test:${port}/gzip`, local);
  assert.equal(gz.body.toString(), "compressed body");
  const { decodeText } = await import("../src/server/reach/net.ts");
  const gbk = await fetchPublic(`http://fixture.test:${port}/gbk`, local);
  assert.match(decodeText(gbk.body, gbk.charset, true), /你好/);
});

test("environment proxy is honoured for plain HTTP after the local DNS check", async () => {
  const r = await fetchPublic(`http://fixture.test:${port}/page`, { ...local, proxy: new URL(`http://127.0.0.1:${proxyPort}`) });
  assert.equal(r.body.toString(), `via proxy fixture.test:${port}`);
  assert.equal(proxied.at(-1), `http://fixture.test:${port}/page`);
  await assert.rejects(
    fetchPublic(`http://intranet.test:${port}/page`, { ...local, proxy: new URL(`http://127.0.0.1:${proxyPort}`) }),
    (e) => code(e) === "BLOCKED_ADDRESS",
  );
});

test("proxy selection follows HTTPS_PROXY / HTTP_PROXY and NO_PROXY", () => {
  const env = { HTTPS_PROXY: "http://127.0.0.1:7897", NO_PROXY: "localhost,.corp.example" };
  assert.equal(proxyFor(new URL("https://api.github.com/x"), env)?.port, "7897");
  assert.equal(proxyFor(new URL("https://wiki.corp.example/"), env), null);
  assert.equal(proxyFor(new URL("http://example.com/"), env), null);
  assert.equal(proxyFor(new URL("https://example.com/"), {}), null);
  assert.equal(proxyFor(new URL("https://example.com/"), { HTTPS_PROXY: "socks5://127.0.0.1:1080" }), null);
});
