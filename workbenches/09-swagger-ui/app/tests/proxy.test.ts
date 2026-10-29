import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { parseProxyRequest, ProxyError } from "../src/contracts/proxy.ts";
import { handleProxy, isPrivateAddress, sendProxy } from "../src/server/proxy.ts";

let server: Server;
let base = "";
const seen: { method?: string; headers?: Record<string, unknown>; body?: string }[] = [];

before(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      seen.push({ method: request.method, headers: request.headers, body: Buffer.concat(chunks).toString() });
      if (request.url === "/gzip") {
        response.writeHead(200, { "content-type": "application/json", "content-encoding": "gzip" });
        response.end(gzipSync(JSON.stringify({ zipped: true })));
      } else if (request.url === "/redirect") {
        response.writeHead(302, { location: "http://169.254.169.254/latest" });
        response.end();
      } else if (request.url === "/big") {
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("x".repeat(5000));
      } else if (request.url === "/slow") {
        setTimeout(() => response.end("late"), 400);
      } else {
        response.writeHead(201, "Created", {
          "content-type": "application/json",
          "set-cookie": "session=1",
          "x-trace": "abc",
        });
        response.end(JSON.stringify({ echo: Buffer.concat(chunks).toString() }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const decode = (body: string) => Buffer.from(body, "base64").toString();

test("识别本机、内网与映射地址", () => {
  for (const address of [
    "127.0.0.1",
    "10.2.3.4",
    "172.20.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a00:1",
    "[::1]",
    "not-an-ip",
  ])
    assert.equal(isPrivateAddress(address), true, address);
  for (const address of ["93.184.216.34", "8.8.8.8", "2606:4700::1111", "::ffff:8.8.8.8"])
    assert.equal(isPrivateAddress(address), false, address);
});

test("请求封装校验", () => {
  const ok = parseProxyRequest({
    method: "post",
    url: "https://api.example.com/v1/items?a=1",
    headers: [["Authorization", "Bearer x"], ["Host", "evil"], ["Content-Length", "9"]],
    body: Buffer.from("{}").toString("base64"),
  });
  assert.equal(ok.method, "POST");
  assert.deepEqual(ok.headers, [["Authorization", "Bearer x"]]);
  assert.equal(ok.allowPrivate, false);
  const invalid = [
    { method: "TRACE", url: "https://a.example", headers: [] },
    { method: "GET", url: "ftp://a.example/x", headers: [] },
    { method: "GET", url: "/relative", headers: [] },
    { method: "GET", url: "https://user:pw@a.example", headers: [] },
    { method: "GET", url: "https://a.example", headers: [["Bad Name", "x"]] },
    { method: "GET", url: "https://a.example", headers: [["X", "a\r\nb"]] },
    { method: "GET", url: "https://a.example", headers: [], body: "e30=" },
    { method: "POST", url: "https://a.example", headers: [], body: "not base64!" },
  ];
  for (const value of invalid)
    assert.throws(() => parseProxyRequest(value), (error) => error instanceof ProxyError, JSON.stringify(value));
  assert.throws(
    () =>
      parseProxyRequest({
        method: "POST",
        url: "https://a.example",
        headers: [],
        body: Buffer.alloc(1_100_000).toString("base64"),
      }),
    (error) => error instanceof ProxyError && error.code === "TOO_LARGE",
  );
});

test("默认阻止本机目标，并返回可读原因", async () => {
  const response = await handleProxy({ method: "GET", url: base + "/x", headers: [] }, {});
  assert.ok(response instanceof Response);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { error: { code: string; message: string; status: number } };
  assert.equal(body.error.code, "BLOCKED_PRIVATE");
  assert.equal(body.error.status, 403);
  assert.match(body.error.message, /允许本机与内网目标/);
  await assert.rejects(
    sendProxy({ method: "GET", url: "http://localhost:9/", headers: [], body: null, allowPrivate: false }),
    (error) => error instanceof ProxyError && error.code === "BLOCKED_PRIVATE",
  );
  assert.equal(seen.length, 0);
});

test("显式允许后转发方法、请求头与请求体，保留状态与响应头", async () => {
  const result = await sendProxy({
    method: "POST",
    url: base + "/echo?x=1",
    headers: [["Authorization", "Bearer demo"], ["Content-Type", "application/json"]],
    body: Buffer.from('{"title":"书"}').toString("base64"),
    allowPrivate: true,
  });
  assert.equal(result.status, 201);
  assert.equal(result.statusText, "Created");
  assert.deepEqual(JSON.parse(decode(result.body)), { echo: '{"title":"书"}' });
  assert.ok(result.headers.some(([name, value]) => name.toLowerCase() === "x-trace" && value === "abc"));
  assert.ok(result.headers.some(([name]) => name.toLowerCase() === "set-cookie"));
  assert.equal(result.address, "127.0.0.1");
  const last = seen.at(-1)!;
  assert.equal(last.method, "POST");
  assert.equal(last.headers?.authorization, "Bearer demo");
  assert.equal(last.headers?.["content-length"], String(Buffer.byteLength('{"title":"书"}')));
});

test("解压响应、不跟随重定向、截断过大响应、超时", async () => {
  const zipped = await sendProxy({ method: "GET", url: base + "/gzip", headers: [], body: null, allowPrivate: true });
  assert.deepEqual(JSON.parse(decode(zipped.body)), { zipped: true });
  assert.ok(!zipped.headers.some(([name]) => name.toLowerCase() === "content-encoding"));

  const redirect = await sendProxy({ method: "GET", url: base + "/redirect", headers: [], body: null, allowPrivate: true });
  assert.equal(redirect.status, 302);
  assert.ok(redirect.headers.some(([name, value]) => name.toLowerCase() === "location" && value.includes("169.254")));

  const big = await sendProxy(
    { method: "GET", url: base + "/big", headers: [], body: null, allowPrivate: true },
    { responseBytes: 1000 },
  );
  assert.equal(big.truncated, true);
  assert.equal(decode(big.body).length, 1000);

  await assert.rejects(
    sendProxy({ method: "GET", url: base + "/slow", headers: [], body: null, allowPrivate: true }, { timeoutMs: 100 }),
    (error) => error instanceof ProxyError && error.code === "TIMEOUT",
  );
});

test("拒绝绕回工作台自身", async () => {
  const port = new URL(base).port;
  await assert.rejects(
    sendProxy(
      { method: "GET", url: `http://localhost:${port}/api/projects`, headers: [], body: null, allowPrivate: true },
      { selfHost: `127.0.0.1:${port}` },
    ),
    (error) => error instanceof ProxyError && error.code === "BLOCKED_SELF",
  );
});

test("连接失败与无法解析的域名给出明确原因", async () => {
  await assert.rejects(
    sendProxy({ method: "GET", url: "http://127.0.0.1:9/", headers: [], body: null, allowPrivate: true }),
    (error) => error instanceof ProxyError && error.code === "CONNECT" && /无法连接/.test(error.message),
  );
  await assert.rejects(
    sendProxy({ method: "GET", url: "http://no-such-host.invalid/", headers: [], body: null, allowPrivate: false }),
    (error) => error instanceof ProxyError && error.code === "DNS",
  );
});
