// ABOUTME: 公网HTTP读取：URL规范化、DNS解析后拒绝私网地址、逐跳重定向复核、超时、体积与类型限制。

import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import {
  ReachError,
  BAD_INPUT,
  BLOCKED_ADDRESS,
  NOT_FOUND,
  RATE_LIMITED,
  TIMEOUT,
  TOO_LARGE,
  NETWORK,
  UNSUPPORTED_TYPE,
  UPSTREAM_BROKEN,
} from "./result.ts";

const blockedHosts = new Set([
  "home.arpa",
  "instance-data",
  "internal",
  "ip6-localhost",
  "ip6-loopback",
  "lan",
  "local",
  "localdomain",
  "localhost",
  "metadata.google.internal",
]);
const blockedSuffixes = [".home.arpa", ".internal", ".lan", ".local", ".localdomain", ".localhost"];

const nonPublic = new net.BlockList();
for (const [prefix, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  nonPublic.addSubnet(prefix, bits, "ipv4");
for (const [prefix, bits] of [
  ["::", 128],
  ["::1", 128],
  ["::", 96], // IPv4-compatible (deprecated)
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16], // 6to4 may embed private IPv4
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const)
  nonPublic.addSubnet(prefix, bits, "ipv6");

const fakeIp = new net.BlockList();
fakeIp.addSubnet("198.18.0.0", 15, "ipv4");

function embeddedV4(ip: string): string | null {
  // ::ffff:a.b.c.d / ::ffff:7f00:1 and NAT64 64:ff9b::/96 carry an IPv4 target.
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const m = /^(?:::ffff:|64:ff9b::)(.+)$/.exec(lower);
  if (!m) return null;
  if (net.isIPv4(m[1])) return m[1];
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(m[1]);
  if (!hex) return null;
  const a = parseInt(hex[1], 16),
    b = parseInt(hex[2], 16);
  return [a >> 8, a & 255, b >> 8, b & 255].join(".");
}

/** True only for globally routable unicast addresses. */
export function isPublicAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "");
  const v4 = net.isIPv4(bare) ? bare : embeddedV4(bare);
  if (v4) return !nonPublic.check(v4, "ipv4");
  if (!net.isIPv6(bare)) return false;
  return !nonPublic.check(bare, "ipv6");
}

/** Port of agent_reach.utils.url.normalize_public_http_url. */
export function normalizePublicUrl(target: string): URL {
  let candidate = String(target ?? "").trim();
  if (!candidate || candidate.includes("\\") || /[\s\u0000-\u001f\u007f]/.test(candidate))
    throw new ReachError(BAD_INPUT, "请输入公开的 http(s) 链接");
  if (!candidate.includes("://")) candidate = "https://" + candidate;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    throw new ReachError(BAD_INPUT, "链接格式无效");
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const literal = net.isIP(host.replace(/^\[|\]$/g, "")) !== 0;
  if (
    !["http:", "https:"].includes(u.protocol) ||
    !host ||
    u.username ||
    u.password ||
    host.includes("%") ||
    blockedHosts.has(host) ||
    blockedSuffixes.some((s) => host.endsWith(s)) ||
    (!host.includes(".") && !literal) ||
    (literal && !isPublicAddress(host))
  )
    throw new ReachError(
      literal || blockedHosts.has(host) || blockedSuffixes.some((s) => host.endsWith(s))
        ? BLOCKED_ADDRESS
        : BAD_INPUT,
      "只允许不含登录信息的公网 http(s) 链接",
    );
  u.hash = "";
  return u;
}

type Address = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<Address[]>;
const systemResolver: Resolver = (hostname) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true });

export type FetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Lowercase MIME types accepted for 2xx responses; omitted = any. */
  types?: string[];
  /** Test seams. Production uses the system resolver and the public filter. */
  resolver?: Resolver;
  allowAddress?: (ip: string) => boolean;
  /** null disables the environment proxy; undefined reads HTTPS_PROXY/HTTP_PROXY. */
  proxy?: URL | null;
};
export type FetchResult = {
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  type: string;
  charset: string | null;
  body: Buffer;
};

function guardedLookup(resolver: Resolver, allow: (ip: string) => boolean): net.LookupFunction {
  return ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
    resolver(hostname).then(
      (addresses) => {
        const blocked = addresses.find((a) => !allow(a.address));
        if (!addresses.length)
          return callback(Object.assign(new Error("域名没有可用地址"), { code: "ENOTFOUND" }));
        if (blocked)
          return callback(
            new ReachError(BLOCKED_ADDRESS, `${hostname} 解析到非公网地址 ${blocked.address}，已拒绝读取`),
          );
        const family = options?.family;
        const usable = family ? addresses.filter((a) => a.family === family) : addresses;
        if (!usable.length)
          return callback(Object.assign(new Error("域名没有可用地址"), { code: "ENOTFOUND" }));
        if (options?.all) callback(null, usable);
        else callback(null, usable[0].address, usable[0].family);
      },
      (error) => callback(error),
    );
  }) as unknown as net.LookupFunction;
}

function decoded(res: http.IncomingMessage): Readable {
  const enc = String(res.headers["content-encoding"] ?? "").toLowerCase().trim();
  if (enc === "gzip" || enc === "x-gzip") return res.pipe(zlib.createGunzip());
  if (enc === "deflate") return res.pipe(zlib.createInflate());
  if (enc === "br") return res.pipe(zlib.createBrotliDecompress());
  return res;
}

/** Proxy from HTTPS_PROXY/HTTP_PROXY (http:// proxies only), honouring NO_PROXY. */
export function proxyFor(url: URL, env: NodeJS.ProcessEnv = process.env): URL | null {
  const raw =
    url.protocol === "https:"
      ? (env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy)
      : (env.HTTP_PROXY ?? env.http_proxy);
  if (!raw) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const skip = (env.NO_PROXY ?? env.no_proxy ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
  if (
    skip.some((n) => {
      if (n === "*") return true;
      const d = n.replace(/^\*?\./, "");
      return host === d || host.endsWith("." + d);
    })
  )
    return null;
  try {
    const p = new URL(raw.includes("://") ? raw : "http://" + raw);
    return p.protocol === "http:" ? p : null;
  } catch {
    return null;
  }
}

const proxyAuth = (proxy: URL): Record<string, string> =>
  proxy.username
    ? {
        "proxy-authorization":
          "Basic " +
          Buffer.from(decodeURIComponent(proxy.username) + ":" + decodeURIComponent(proxy.password)).toString("base64"),
      }
    : {};

function tunnel(proxy: URL, url: URL, remaining: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const target = `${url.hostname}:${url.port || (url.protocol === "https:" ? 443 : 80)}`;
    const req = http.request({
      host: proxy.hostname.replace(/^\[|\]$/g, ""),
      port: Number(proxy.port || 80),
      method: "CONNECT",
      path: target,
      headers: { host: target, ...proxyAuth(proxy) },
      agent: false,
    });
    req.setTimeout(remaining, () => req.destroy(new ReachError(TIMEOUT, "代理没有在时限内建立连接")));
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new ReachError(NETWORK, `代理拒绝连接 ${url.hostname}（HTTP ${res.statusCode}）`));
      } else resolve(socket);
    });
    req.on("error", reject);
    req.end();
  });
}

async function once(
  url: URL,
  o: FetchOptions,
  check: (host: string) => Promise<void>,
  lookup: net.LookupFunction,
  deadline: number,
  maxBytes: number,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new ReachError(TIMEOUT, "上游没有在时限内回应");
  const proxy = o.proxy === undefined ? proxyFor(url) : o.proxy;
  const headers: Record<string, string> = {
    "user-agent": "Mozilla/5.0 (compatible; FloatboatAgentReach/0.9; +https://github.com/Panniantong/Agent-Reach)",
    "accept-encoding": "gzip, deflate, br",
    // Explicit Host: without an agent Node would append ":443" through a tunnel.
    host: url.host,
    ...o.headers,
    ...(o.body ? { "content-length": String(Buffer.byteLength(o.body)) } : {}),
  };
  let options: http.RequestOptions & { servername?: string } = { method: o.method ?? "GET", headers, lookup, agent: false };
  if (proxy) {
    // The proxy resolves the name itself; check the local resolution first so
    // names that point at loopback/private networks are still refused.
    await check(url.hostname.replace(/^\[|\]$/g, ""));
    if (url.protocol === "https:") {
      const socket = await tunnel(proxy, url, remaining);
      const host = url.hostname.replace(/^\[|\]$/g, "");
      // agent must be undefined (not false) or Node ignores createConnection.
      options = {
        ...options,
        agent: undefined,
        defaultPort: 443,
        createConnection: () => tls.connect({ socket, servername: net.isIP(host) ? undefined : host, ALPNProtocols: ["http/1.1"] }),
      };
    } else {
      options = {
        ...options,
        host: proxy.hostname.replace(/^\[|\]$/g, ""),
        port: Number(proxy.port || 80),
        path: url.toString(),
        headers: { ...headers, host: url.host, ...proxyAuth(proxy) },
        lookup: undefined,
      };
    }
  }
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const onResponse = (res: http.IncomingMessage) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
      }
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes * 4) {
        res.destroy();
        return reject(new ReachError(TOO_LARGE, `响应超过 ${Math.round(maxBytes / 1048576)}MB 读取上限`));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      const stream = decoded(res);
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          stream.destroy();
          res.destroy();
          req.destroy();
          reject(new ReachError(TOO_LARGE, `响应超过 ${Math.round(maxBytes / 1048576)}MB 读取上限`));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
      stream.on("error", (error) => reject(error));
      res.on("error", (error) => reject(error));
    };
    const req =
      proxy && url.protocol === "http:"
        ? http.request(options, onResponse)
        : client.request(url, options, onResponse);
    req.setTimeout(remaining, () => req.destroy(new ReachError(TIMEOUT, "上游没有在时限内回应")));
    req.on("error", reject);
    if (o.body) req.write(o.body);
    req.end();
  });
}

/**
 * Fetch a public URL. Every hop (initial and each redirect) is normalized,
 * literal IPs are checked, and hostnames are resolved and checked inside the
 * socket lookup itself, so the connection uses the address that was checked.
 */
export async function fetchPublic(target: string | URL, o: FetchOptions = {}): Promise<FetchResult> {
  const allow = o.allowAddress ?? isPublicAddress;
  const resolver = o.resolver ?? systemResolver;
  const lookup = guardedLookup(resolver, allow);
  const check = (host: string) =>
    new Promise<void>((resolve, reject) => {
      if (net.isIP(host)) return allow(host) ? resolve() : reject(new ReachError(BLOCKED_ADDRESS, `目标地址 ${host} 不是公网地址`));
      // Proxy users with fake-ip DNS (198.18.0.0/15) still go out by hostname.
      const viaProxy = (ip: string) => allow(ip) || (!o.allowAddress && fakeIp.check(ip, "ipv4"));
      guardedLookup(resolver, viaProxy)(host, {}, ((error: Error | null) => (error ? reject(error) : resolve())) as never);
    });
  const maxBytes = o.maxBytes ?? 5 * 1024 * 1024;
  const deadline = Date.now() + (o.timeoutMs ?? 20000);
  let url = typeof target === "string" ? normalizePublicUrl(target) : target;
  let method = o.method ?? "GET",
    body = o.body;
  for (let hop = 0; ; hop++) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw new ReachError(BLOCKED_ADDRESS, "重定向目标不是公开 http(s) 链接");
    if (net.isIP(host) && !allow(host))
      throw new ReachError(BLOCKED_ADDRESS, `目标地址 ${host} 不是公网地址，已拒绝读取`);
    const r = await once(url, { ...o, method, body }, check, lookup, deadline, maxBytes);
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      if (hop >= (o.maxRedirects ?? 5)) throw new ReachError(UPSTREAM_BROKEN, "重定向次数过多");
      const next = new URL(String(r.headers.location), url);
      url = normalizePublicUrl(next.toString());
      if (r.status === 303 || ((r.status === 301 || r.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
      continue;
    }
    const contentType = String(r.headers["content-type"] ?? "").toLowerCase();
    const type = contentType.split(";")[0].trim();
    const charset = /charset\s*=\s*"?([\w.:-]+)/i.exec(contentType)?.[1] ?? null;
    if (r.status >= 200 && r.status < 300 && o.types && type && !o.types.includes(type))
      throw new ReachError(UNSUPPORTED_TYPE, `链接返回 ${type}，不是可阅读的网页或纯文本`);
    return { url: url.toString(), status: r.status, headers: r.headers, type, charset, body: r.body };
  }
}

/** Raise the unified error for a non-2xx response. */
export function expectOk(r: FetchResult, what: string): FetchResult {
  if (r.status >= 200 && r.status < 300) return r;
  if (r.status === 404 || r.status === 410) throw new ReachError(NOT_FOUND, `${what}不存在（HTTP ${r.status}）`);
  if (r.status === 429) throw new ReachError(RATE_LIMITED, `${what}达到访问限额（HTTP 429）`);
  throw new ReachError(UPSTREAM_BROKEN, `${what}返回 HTTP ${r.status}`);
}

/** Decode bytes using the declared charset, an HTML meta charset, or UTF-8. */
export function decodeText(body: Buffer, charset: string | null, html = false): string {
  let label = charset;
  if (!label && html) {
    const head = body.subarray(0, 4096).toString("latin1");
    label =
      /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1] ??
      null;
  }
  try {
    return new TextDecoder(label ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export function json(r: FetchResult): unknown {
  return JSON.parse(decodeText(r.body, r.charset));
}
