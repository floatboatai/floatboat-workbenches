// ABOUTME: 本地检索的公网读取：URL规范化、DNS解析后拒绝内网、逐跳重定向复核、代理、超时与体积上限；离线验收夹具。
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";
import zlib from "node:zlib";
import type { Readable } from "node:stream";

export const BAD_INPUT = "BAD_INPUT",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMITED = "RATE_LIMITED",
  TIMEOUT = "TIMEOUT",
  UPSTREAM = "UPSTREAM",
  BLOCKED = "BLOCKED_ADDRESS",
  TOO_LARGE = "TOO_LARGE",
  UNSUPPORTED = "UNSUPPORTED_TYPE",
  NETWORK = "NETWORK",
  CHALLENGE = "CHALLENGE";

export class RetrievalError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
const networkCodes: Record<string, string> = {
  ECONNREFUSED: "对方拒绝连接",
  ECONNRESET: "连接被重置",
  ENOTFOUND: "域名无法解析",
  EAI_AGAIN: "域名解析暂时失败",
  EHOSTUNREACH: "主机不可达",
  ENETUNREACH: "网络不可达",
  CERT_HAS_EXPIRED: "证书已过期",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "证书无法验证",
};
/** Map any failure to a coded Chinese message; never surface a bare "fetch failed". */
export function classify(error: unknown): RetrievalError {
  if (error instanceof RetrievalError) return error;
  const e = error as { name?: string; code?: string; message?: string; cause?: { code?: string } };
  if (e?.name === "TimeoutError" || e?.name === "AbortError" || e?.code === "ETIMEDOUT")
    return new RetrievalError(TIMEOUT, "没有在时限内回应");
  const code = e?.code ?? e?.cause?.code ?? "";
  if (networkCodes[code]) return new RetrievalError(NETWORK, `${networkCodes[code]}（${code}）`);
  return new RetrievalError(UPSTREAM, String(e?.message ?? "读取失败").replace(/\/\/[^/@\s]+@/g, "//***@").slice(0, 300));
}

const blockedHosts = new Set(["localhost", "local", "internal", "lan", "home.arpa", "metadata.google.internal", "instance-data"]);
const blockedSuffixes = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".localdomain"];
const nonPublic = new net.BlockList();
for (const [p, b] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const)
  nonPublic.addSubnet(p, b, "ipv4");
for (const [p, b] of [
  ["::", 128], ["::1", 128], ["::", 96], ["100::", 64], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const)
  nonPublic.addSubnet(p, b, "ipv6");
const fakeIp = new net.BlockList();
fakeIp.addSubnet("198.18.0.0", 15, "ipv4");

function embeddedV4(ip: string) {
  const m = /^(?:::ffff:|64:ff9b::)(.+)$/.exec(ip.toLowerCase());
  if (!m) return null;
  if (net.isIPv4(m[1])) return m[1];
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(m[1]);
  if (!hex) return null;
  const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16);
  return [a >> 8, a & 255, b >> 8, b & 255].join(".");
}
export function isPublicAddress(ip: string) {
  const bare = ip.replace(/^\[|\]$/g, "");
  const v4 = net.isIPv4(bare) ? bare : embeddedV4(bare);
  if (v4) return !nonPublic.check(v4, "ipv4");
  return net.isIPv6(bare) && !nonPublic.check(bare, "ipv6");
}

/** Loopback origin of the offline acceptance fixture (RESEARCH_FIXTURE_ORIGIN), or null. */
export function fixtureOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.RESEARCH_FIXTURE_ORIGIN;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ? u.origin : null;
  } catch {
    return null;
  }
}

export function normalizePublicUrl(target: string): URL {
  let candidate = String(target ?? "").trim();
  if (!candidate || candidate.includes("\\") || /[\s\u0000-\u001f\u007f]/.test(candidate))
    throw new RetrievalError(BAD_INPUT, "请输入公开的 http(s) 网址");
  if (!candidate.includes("://")) candidate = "https://" + candidate;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    throw new RetrievalError(BAD_INPUT, "网址格式无效");
  }
  u.hash = "";
  if (u.origin === fixtureOrigin()) return u;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const literal = net.isIP(host.replace(/^\[|\]$/g, "")) !== 0;
  const named = blockedHosts.has(host) || blockedSuffixes.some((s) => host.endsWith(s));
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || !host || host.includes("%"))
    throw new RetrievalError(BAD_INPUT, "只读取不含登录信息的 http(s) 网址");
  if (named || (literal && !isPublicAddress(host)))
    throw new RetrievalError(BLOCKED, "只读取公网地址；本机、内网和链路本地地址已被拒绝");
  if (!host.includes(".") && !literal) throw new RetrievalError(BAD_INPUT, "网址缺少有效域名");
  return u;
}

export function proxyFor(url: URL, env: NodeJS.ProcessEnv = process.env): URL | null {
  const raw = url.protocol === "https:" ? (env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy) : (env.HTTP_PROXY ?? env.http_proxy);
  if (!raw) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const skip = (env.NO_PROXY ?? env.no_proxy ?? "").split(",").map((x) => x.trim().toLowerCase().replace(/:\d+$/, "")).filter(Boolean);
  if (skip.some((n) => n === "*" || host === n.replace(/^\*?\./, "") || host.endsWith("." + n.replace(/^\*?\./, "")))) return null;
  try {
    const p = new URL(raw.includes("://") ? raw : "http://" + raw);
    return p.protocol === "http:" ? p : null;
  } catch {
    return null;
  }
}

type Address = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<Address[]>;
const systemResolver: Resolver = (h) => dns.promises.lookup(h, { all: true, verbatim: true });
export type FetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  types?: string[];
  resolver?: Resolver;
  allowAddress?: (ip: string) => boolean;
  proxy?: URL | null;
};
export type FetchResult = { url: string; status: number; headers: http.IncomingHttpHeaders; type: string; charset: string | null; body: Buffer };
export type Get = (url: string, o?: FetchOptions) => Promise<FetchResult>;

function guardedLookup(resolver: Resolver, allow: (ip: string) => boolean): net.LookupFunction {
  return ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
    resolver(hostname).then(
      (addresses) => {
        const blocked = addresses.find((a) => !allow(a.address));
        if (blocked) return callback(new RetrievalError(BLOCKED, `${hostname} 解析到非公网地址 ${blocked.address}，已拒绝读取`));
        const usable = options?.family ? addresses.filter((a) => a.family === options.family) : addresses;
        if (!usable.length) return callback(Object.assign(new Error("域名没有可用地址"), { code: "ENOTFOUND" }));
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
function tunnel(proxy: URL, url: URL, remaining: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const target = `${url.hostname}:${url.port || (url.protocol === "https:" ? 443 : 80)}`;
    const auth = proxy.username
      ? { "proxy-authorization": "Basic " + Buffer.from(decodeURIComponent(proxy.username) + ":" + decodeURIComponent(proxy.password)).toString("base64") }
      : {};
    const req = http.request({ host: proxy.hostname.replace(/^\[|\]$/g, ""), port: Number(proxy.port || 80), method: "CONNECT", path: target, headers: { host: target, ...auth }, agent: false });
    req.setTimeout(remaining, () => req.destroy(new RetrievalError(TIMEOUT, "代理没有在时限内建立连接")));
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new RetrievalError(NETWORK, `代理拒绝连接 ${url.hostname}（HTTP ${res.statusCode}）`));
      } else resolve(socket);
    });
    req.on("error", reject);
    req.end();
  });
}
function once(url: URL, o: FetchOptions, lookup: net.LookupFunction, check: (h: string) => Promise<void>, deadline: number, maxBytes: number) {
  return (async () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new RetrievalError(TIMEOUT, "没有在时限内回应");
    const proxy = o.proxy === undefined ? proxyFor(url) : o.proxy;
    const headers: Record<string, string> = {
      "user-agent": "Mozilla/5.0 (compatible; FloatboatResearchDesk/0.9)",
      "accept-encoding": "gzip, deflate, br",
      host: url.host,
      ...o.headers,
      ...(o.body ? { "content-length": String(Buffer.byteLength(o.body)) } : {}),
    };
    let options: http.RequestOptions = { method: o.method ?? "GET", headers, lookup, agent: false };
    if (proxy) {
      await check(url.hostname.replace(/^\[|\]$/g, ""));
      if (url.protocol === "https:") {
        const socket = await tunnel(proxy, url, remaining);
        const host = url.hostname.replace(/^\[|\]$/g, "");
        options = { ...options, agent: undefined, defaultPort: 443, createConnection: () => tls.connect({ socket, servername: net.isIP(host) ? undefined : host, ALPNProtocols: ["http/1.1"] }) };
      } else options = { ...options, host: proxy.hostname, port: Number(proxy.port || 80), path: url.toString(), lookup: undefined };
    }
    return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
      const onResponse = (res: http.IncomingMessage) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const stream = decoded(res);
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            stream.destroy();
            req.destroy();
            reject(new RetrievalError(TOO_LARGE, `响应超过 ${Math.round(maxBytes / 1048576)}MB 读取上限`));
          } else chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", reject);
      };
      const req = proxy && url.protocol === "http:" ? http.request(options, onResponse) : (url.protocol === "https:" ? https : http).request(url, options, onResponse);
      req.setTimeout(remaining, () => req.destroy(new RetrievalError(TIMEOUT, "没有在时限内回应")));
      req.on("error", reject);
      if (o.body) req.write(o.body);
      req.end();
    });
  })();
}
function finish(url: string, r: { status: number; headers: http.IncomingHttpHeaders; body: Buffer }, o: FetchOptions): FetchResult {
  const contentType = String(r.headers["content-type"] ?? "").toLowerCase();
  const type = contentType.split(";")[0].trim();
  const charset = /charset\s*=\s*"?([\w.:-]+)/i.exec(contentType)?.[1] ?? null;
  if (r.status >= 200 && r.status < 300 && o.types && type && !o.types.includes(type))
    throw new RetrievalError(UNSUPPORTED, `网址返回 ${type}，不是可阅读的网页或纯文本`);
  return { url, status: r.status, headers: r.headers, type, charset, body: r.body };
}
/** Fixture requests stay on loopback without proxy; used only when RESEARCH_FIXTURE_ORIGIN is set. */
async function fixtureFetch(url: URL, o: FetchOptions): Promise<FetchResult> {
  const r = await once(url, { ...o, proxy: null }, ((h: string, opts: dns.LookupOptions, cb: (...a: unknown[]) => void) => dns.lookup(h, opts, cb)) as unknown as net.LookupFunction, async () => {}, Date.now() + (o.timeoutMs ?? 20000), o.maxBytes ?? 5 * 1048576);
  return finish(url.toString(), r, o);
}

/** Public fetch: every hop normalized, hostnames resolved and checked inside the socket lookup. */
export async function fetchPublic(target: string, o: FetchOptions = {}): Promise<FetchResult> {
  let url = normalizePublicUrl(target);
  if (url.origin === fixtureOrigin()) return fixtureFetch(url, o);
  const allow = o.allowAddress ?? isPublicAddress;
  const resolver = o.resolver ?? systemResolver;
  const lookup = guardedLookup(resolver, allow);
  const check = (host: string) =>
    new Promise<void>((resolve, reject) => {
      if (net.isIP(host)) return allow(host) ? resolve() : reject(new RetrievalError(BLOCKED, `目标地址 ${host} 不是公网地址`));
      const viaProxy = (ip: string) => allow(ip) || (!o.allowAddress && fakeIp.check(ip, "ipv4"));
      guardedLookup(resolver, viaProxy)(host, {}, ((error: Error | null) => (error ? reject(error) : resolve())) as never);
    });
  const maxBytes = o.maxBytes ?? 5 * 1048576;
  const deadline = Date.now() + (o.timeoutMs ?? 20000);
  let method = o.method ?? "GET", body = o.body;
  for (let hop = 0; ; hop++) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && !allow(host)) throw new RetrievalError(BLOCKED, `目标地址 ${host} 不是公网地址，已拒绝读取`);
    const r = await once(url, { ...o, method, body }, lookup, check, deadline, maxBytes);
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      if (hop >= 5) throw new RetrievalError(UPSTREAM, "重定向次数过多");
      url = normalizePublicUrl(new URL(String(r.headers.location), url).toString());
      if (url.origin === fixtureOrigin()) throw new RetrievalError(BLOCKED, "公网地址不能重定向到本机夹具");
      if (r.status === 303 || ((r.status === 301 || r.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
      continue;
    }
    return finish(url.toString(), r, o);
  }
}
export function expectOk(r: FetchResult, what: string) {
  if (r.status >= 200 && r.status < 300) return r;
  if (r.status === 404 || r.status === 410) throw new RetrievalError(NOT_FOUND, `${what}不存在（HTTP ${r.status}）`);
  if (r.status === 429) throw new RetrievalError(RATE_LIMITED, `${what}达到访问限额（HTTP 429）`);
  throw new RetrievalError(UPSTREAM, `${what}返回 HTTP ${r.status}`);
}
export function decodeText(body: Buffer, charset: string | null, html = false) {
  let label = charset;
  if (!label && html) label = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(body.subarray(0, 4096).toString("latin1"))?.[1] ?? null;
  try {
    return new TextDecoder(label ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}
