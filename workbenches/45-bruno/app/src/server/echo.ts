// Local echo service on 127.0.0.1 so a new collection can send real HTTP with no
// external service. It echoes what it received; it never forwards or stores data.
import { createServer, type IncomingMessage, type Server } from "node:http";
import { randomUUID } from "node:crypto";

const MAX_BODY = 4 * 1024 * 1024;

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("body too large"), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function queryObject(params: URLSearchParams) {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of params) {
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

export async function describe(req: IncomingMessage, raw: Buffer, url: URL) {
  const type = String(req.headers["content-type"] ?? "");
  const text = raw.toString("utf8");
  const out: Record<string, unknown> = {
    id: randomUUID(),
    method: req.method,
    path: url.pathname,
    query: queryObject(url.searchParams),
    headers: req.headers,
    bytes: raw.length,
    body: text.length > 65536 ? text.slice(0, 65536) : text,
    receivedAt: new Date().toISOString(),
  };
  if (/json/i.test(type) && raw.length)
    try {
      out.json = JSON.parse(text);
    } catch {
      out.jsonError = "正文不是有效 JSON";
    }
  if (/x-www-form-urlencoded/i.test(type)) out.form = queryObject(new URLSearchParams(text));
  if (/multipart\/form-data/i.test(type))
    try {
      const form = await new Response(new Uint8Array(raw), { headers: { "content-type": type } }).formData();
      const fields: Record<string, unknown> = {};
      for (const [k, v] of form)
        fields[k] = typeof v === "string" ? v : { filename: v.name, size: v.size, type: v.type };
      out.form = fields;
    } catch {
      out.formError = "multipart 正文无法解析";
    }
  return out;
}

export function createEchoServer(): Server {
  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const send = (status: number, value: unknown) => {
        const payload = JSON.stringify(value, null, 2);
        res.writeHead(status, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-echo-service": "floatboat-bruno",
        });
        res.end(req.method === "HEAD" ? undefined : payload);
      };
      try {
        if (url.pathname === "/health")
          return send(200, { status: "ok", service: "floatboat-bruno-echo", time: new Date().toISOString() });
        const raw = await readBody(req);
        const status = /^\/status\/(\d{3})$/.exec(url.pathname);
        if (status) {
          const code = Math.min(599, Math.max(200, Number(status[1])));
          return send(code, { status: code, ...(await describe(req, raw, url)) });
        }
        const delay = /^\/delay\/(\d+)$/.exec(url.pathname);
        if (delay) await new Promise((r) => setTimeout(r, Math.min(60000, Number(delay[1]))));
        return send(200, await describe(req, raw, url));
      } catch (e) {
        const code = (e as { status?: number }).status ?? 400;
        send(code, { error: e instanceof Error ? e.message : "invalid request" });
      }
    })();
  });
}

let started: Promise<string | null> | null = null;
/** Starts the echo service once; resolves to its base URL or null when the port cannot be bound. */
export function localEcho(): Promise<string | null> {
  started ??= new Promise((resolve) => {
    const server = createEchoServer();
    server.once("error", () => resolve(null));
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.unref();
      resolve(address && typeof address === "object" ? `http://127.0.0.1:${address.port}` : null);
    });
  });
  return started;
}
