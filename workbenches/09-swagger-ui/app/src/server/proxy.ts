// ABOUTME: 试调代理：由用户点击 Execute 触发，转发到外部 API；默认阻止本机与内网目标，不记录凭据。
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";
import {
  PROXY_LIMITS,
  ProxyError,
  parseProxyRequest,
  type ProxyRequest,
  type ProxyResponse,
} from "../contracts/proxy.ts";

const blocked = new BlockList();
for (const [network, prefix] of [
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
  blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(network, prefix, "ipv6");

/** 把 IPv4 映射/NAT64/6to4 形式的 IPv6 还原为内含的 IPv4。 */
function embeddedIPv4(address: string): string | null {
  const lower = address.toLowerCase();
  const dotted = /^(?:::ffff:|::ffff:0:|64:ff9b::|::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return dotted[1];
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const high = parseInt(hex[1], 16),
      low = parseInt(hex[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  const sixToFour = /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/.exec(lower);
  if (sixToFour) {
    const high = parseInt(sixToFour[1], 16),
      low = parseInt(sixToFour[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return null;
}

export function isPrivateAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const family = isIP(bare);
  if (family === 4) return blocked.check(bare, "ipv4");
  if (family === 6) {
    const inner = embeddedIPv4(bare);
    if (inner) return blocked.check(inner, "ipv4");
    return blocked.check(bare, "ipv6");
  }
  return true;
}

/** 每次连接都检查实际解析到的地址，防止 DNS 重绑定绕过。 */
function guardedLookup(allowPrivate: boolean, seen: { address: string }): LookupFunction {
  return (hostname, options, callback) => {
    const family =
      options.family === "IPv4" ? 4 : options.family === "IPv6" ? 6 : (options.family ?? 0);
    dnsLookup(hostname, { all: true, family }, (error, addresses) => {
      if (error) return callback(error, []);
      const list = addresses as LookupAddress[];
      if (!list.length)
        return callback(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }), []);
      const unsafe = list.find((entry) => isPrivateAddress(entry.address));
      if (unsafe && !allowPrivate)
        return callback(
          Object.assign(new Error("BLOCKED_PRIVATE"), {
            code: "BLOCKED_PRIVATE",
            address: unsafe.address,
          }),
          [],
        );
      seen.address = list[0].address;
      if (options.all) callback(null, list);
      else callback(null, list[0].address, list[0].family);
    });
  };
}

function decoder(encoding: string | undefined) {
  const value = (encoding ?? "").trim().toLowerCase();
  if (value === "gzip" || value === "x-gzip") return createGunzip();
  if (value === "deflate") return createInflate();
  if (value === "br") return createBrotliDecompress();
  return null;
}

const DROPPED_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length",
  "content-encoding",
]);

let active = 0;

export interface ProxyContext {
  /** 当前工作台自身的 host:port，用于拒绝把请求绕回本服务。 */
  selfHost?: string;
  timeoutMs?: number;
  responseBytes?: number;
}

export async function sendProxy(
  input: ProxyRequest,
  context: ProxyContext = {},
): Promise<ProxyResponse> {
  const target = new URL(input.url);
  const host = target.hostname.replace(/^\[|\]$/g, "");
  const port = target.port || (target.protocol === "https:" ? "443" : "80");
  const literal = isIP(host) !== 0;
  if (host.toLowerCase() === "localhost" || host.toLowerCase().endsWith(".localhost")) {
    if (!input.allowPrivate)
      throw new ProxyError(
        "BLOCKED_PRIVATE",
        `已阻止访问本机地址 ${target.host}。如需调试本机服务，请先在「试调设置」中允许本机与内网目标。`,
        403,
      );
  }
  if (literal && isPrivateAddress(host) && !input.allowPrivate)
    throw new ProxyError(
      "BLOCKED_PRIVATE",
      `已阻止访问本机或内网地址 ${target.host}。如需调试本机服务，请先在「试调设置」中允许本机与内网目标。`,
      403,
    );
  if (context.selfHost) {
    const self = new URL("http://" + context.selfHost);
    const selfLoopback =
      self.hostname === "localhost" || isPrivateAddress(self.hostname);
    const sameName =
      host.toLowerCase() === self.hostname.toLowerCase() ||
      (selfLoopback && (host === "localhost" || isPrivateAddress(host)));
    if (sameName && port === (self.port || "80"))
      throw new ProxyError(
        "BLOCKED_SELF",
        "该地址就是工作台本身。内置示例服务请使用相对地址 /api/sample/…，无需经过代理。",
        403,
      );
  }
  if (active >= PROXY_LIMITS.concurrent)
    throw new ProxyError("BUSY", "同时进行的试调过多，请等上一个请求完成。", 429);
  active++;
  const timeoutMs = context.timeoutMs ?? PROXY_LIMITS.timeoutMs;
  const limit = context.responseBytes ?? PROXY_LIMITS.responseBytes;
  const seen = { address: literal ? host : "" };
  const started = performance.now();
  const body = input.body === null ? null : Buffer.from(input.body, "base64");
  try {
    return await new Promise<ProxyResponse>((resolve, reject) => {
      let settled = false;
      const finish = (error: unknown, value?: ProxyResponse) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(value!);
      };
      const headers: Record<string, string | string[]> = {};
      for (const [name, value] of input.headers) {
        const key = name.toLowerCase();
        const previous = headers[key];
        headers[key] =
          previous === undefined
            ? value
            : Array.isArray(previous)
              ? [...previous, value]
              : [previous, value];
      }
      headers["accept-encoding"] = "gzip, deflate, br";
      if (body) headers["content-length"] = String(body.length);
      const options = {
        method: input.method,
        host,
        port: Number(port),
        path: target.pathname + target.search,
        headers: { host: target.host, ...headers },
        lookup: guardedLookup(input.allowPrivate, seen),
        servername: literal ? undefined : host,
        agent: false as const,
      };
      const outgoing =
        target.protocol === "https:" ? httpsRequest(options) : httpRequest(options);
      const timer = setTimeout(() => {
        outgoing.destroy(
          new ProxyError(
            "TIMEOUT",
            `目标在 ${Math.round(timeoutMs / 1000)} 秒内没有完成响应，已停止等待。`,
            504,
          ),
        );
      }, timeoutMs);
      outgoing.on("error", (error: NodeJS.ErrnoException & { address?: string }) => {
        if (error instanceof ProxyError) return finish(error);
        if (error.code === "BLOCKED_PRIVATE")
          return finish(
            new ProxyError(
              "BLOCKED_PRIVATE",
              `${target.hostname} 解析到本机或内网地址 ${error.address ?? ""}，已阻止。如需调试本机服务，请先在「试调设置」中允许本机与内网目标。`,
              403,
            ),
          );
        if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN")
          return finish(
            new ProxyError("DNS", `无法解析域名 ${target.hostname}，请检查地址或网络。`, 502),
          );
        finish(
          new ProxyError(
            "CONNECT",
            `无法连接 ${target.host}（${error.code ?? "网络错误"}）。请确认服务已启动且地址、端口正确。`,
            502,
          ),
        );
      });
      outgoing.on("response", (incoming: IncomingMessage) => {
        const stream: Readable = (() => {
          const unpack = decoder(incoming.headers["content-encoding"] as string | undefined);
          if (!unpack) return incoming;
          incoming.on("error", (error) => unpack.destroy(error));
          return incoming.pipe(unpack);
        })();
        const chunks: Buffer[] = [];
        let size = 0,
          truncated = false;
        const complete = () => {
          const headerList: [string, string][] = [];
          const raw = incoming.rawHeaders;
          for (let index = 0; index < raw.length; index += 2)
            if (!DROPPED_RESPONSE_HEADERS.has(raw[index].toLowerCase()))
              headerList.push([raw[index], raw[index + 1]]);
          finish(null, {
            status: incoming.statusCode ?? 502,
            statusText: incoming.statusMessage ?? "",
            headers: headerList,
            body: Buffer.concat(chunks).toString("base64"),
            truncated,
            durationMs: Math.round(performance.now() - started),
            address: seen.address,
          });
        };
        stream.on("data", (chunk: Buffer) => {
          if (truncated) return;
          if (size + chunk.length > limit) {
            chunks.push(chunk.subarray(0, limit - size));
            size = limit;
            truncated = true;
            complete();
            outgoing.destroy();
            return;
          }
          size += chunk.length;
          chunks.push(chunk);
        });
        stream.on("end", complete);
        stream.on("error", (error) =>
          finish(
            error instanceof ProxyError
              ? error
              : new ProxyError("CONNECT", "响应传输中断或解压失败。", 502),
          ),
        );
      });
      outgoing.end(body ?? undefined);
    });
  } finally {
    active--;
  }
}

export async function handleProxy(value: unknown, context: ProxyContext) {
  try {
    return await sendProxy(parseProxyRequest(value), context);
  } catch (error) {
    const known =
      error instanceof ProxyError
        ? error
        : new ProxyError("CONNECT", "试调失败，请检查地址后重试。", 502);
    // 代理本身工作正常，只是目标不可达或被策略阻止：用 200 封装原因，区别于工作台服务故障。
    return Response.json(
      { error: { code: known.code, message: known.message, status: known.status } },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
