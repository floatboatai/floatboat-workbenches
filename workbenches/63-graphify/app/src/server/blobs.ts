// ABOUTME: 内容地址库：原文与图谱按 SHA-256 存入 SQLite；大文件分片上传，单次请求不超过运行时 2MB 上限。

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { isHash } from "../contracts/hash.ts";
import { LIMITS } from "../contracts/corpus.ts";

export type BlobKind = "source" | "graph" | "upload";
export const digest = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
export class BlobError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const STAGE_TTL = 15 * 60 * 1000;
const STAGE_BYTES = 96 * 1024 * 1024;

export function createBlobStore(db: DatabaseSync) {
  const staged = new Map<string, { kind: BlobKind; parts: (string | undefined)[]; at: number; bytes: number }>();
  let stagedBytes = 0;
  const sweep = () => {
    const now = Date.now();
    for (const [h, s] of staged)
      if (now - s.at > STAGE_TTL) {
        stagedBytes -= s.bytes;
        staged.delete(h);
      }
  };
  const has = (hash: string) => !!db.prepare("SELECT 1 AS x FROM blobs WHERE hash=?").get(hash);
  const get = (hash: string): { kind: BlobKind; body: string } | null => {
    const row = db.prepare("SELECT kind,body FROM blobs WHERE hash=?").get(hash);
    return row ? { kind: String(row.kind) as BlobKind, body: String(row.body) } : null;
  };
  /** 写入（幂等）；内容必须与地址一致。 */
  const put = (kind: BlobKind, body: string, expected?: string) => {
    const hash = digest(body);
    if (expected && expected !== hash) throw new BlobError(400, "上传内容与校验值不一致，请重新选择文件。");
    db.prepare("INSERT INTO blobs(hash,kind,bytes,body,created_at) VALUES(?,?,?,?,?) ON CONFLICT(hash) DO NOTHING").run(
      hash, kind, Buffer.byteLength(body), body, new Date().toISOString(),
    );
    return hash;
  };
  /** 接收一个分片；全部到齐后校验并入库。 */
  const stage = (hash: string, kind: BlobKind, index: number, total: number, text: string) => {
    sweep();
    if (has(hash)) return true;
    if (total === 1) {
      put(kind, text, hash);
      return true;
    }
    let s = staged.get(hash);
    if (!s) {
      s = { kind, parts: new Array(total).fill(undefined), at: Date.now(), bytes: 0 };
      staged.set(hash, s);
    }
    if (s.parts.length !== total) throw new BlobError(400, "分片数量不一致，请重新上传。");
    if (s.parts[index] === undefined) {
      const bytes = Buffer.byteLength(text);
      if (stagedBytes + bytes > STAGE_BYTES) throw new BlobError(413, "同时上传的内容过多，请稍后重试。");
      s.parts[index] = text;
      s.bytes += bytes;
      stagedBytes += bytes;
    }
    s.at = Date.now();
    if (s.parts.some((p) => p === undefined)) return false;
    staged.delete(hash);
    stagedBytes -= s.bytes;
    put(kind, s.parts.join(""), hash);
    return true;
  };
  return { has, get, put, stage };
}
export type BlobStore = ReturnType<typeof createBlobStore>;

export function registerBlobRoutes(app: WorkbenchServer, blobs: BlobStore) {
  const fail = (e: unknown) =>
    Response.json({ error: { message: e instanceof Error ? e.message : "上传失败" } }, { status: e instanceof BlobError ? e.status : 400 });
  app.route("POST", "/api/blobs/missing", ({ body }) => {
    if (!isRecord(body) || !Array.isArray(body.hashes) || body.hashes.length > LIMITS.files + 10 || !body.hashes.every(isHash))
      return fail(new BlobError(400, "校验值列表无效。"));
    return { missing: [...new Set(body.hashes as string[])].filter((h) => !blobs.has(h)) };
  });
  app.route("POST", "/api/blobs", ({ body }) => {
    try {
      if (!isRecord(body) || !Array.isArray(body.items) || !body.items.length || body.items.length > 500) throw new BlobError(400, "上传请求无效。");
      const stored: string[] = [], pending: string[] = [];
      for (const item of body.items) {
        if (
          !isRecord(item) || !isHash(item.hash) || !["source", "upload"].includes(String(item.kind)) ||
          !Number.isInteger(item.index) || !Number.isInteger(item.total) || Number(item.total) < 1 || Number(item.total) > 64 ||
          Number(item.index) < 0 || Number(item.index) >= Number(item.total) || typeof item.text !== "string"
        )
          throw new BlobError(400, "上传分片格式无效。");
        if (blobs.stage(item.hash, item.kind as BlobKind, Number(item.index), Number(item.total), item.text)) stored.push(item.hash);
        else pending.push(item.hash);
      }
      return { stored: [...new Set(stored)], pending: [...new Set(pending)].filter((h) => !stored.includes(h)) };
    } catch (e) {
      return fail(e);
    }
  });
  // 同一内容可能既是原文又是图谱（例如资料里本身有 graph.json），由调用方声明读取方式
  app.route("GET", "/api/blobs/:hash", ({ params, url }) => {
    if (!isHash(params.hash)) return fail(new BlobError(400, "校验值无效。"));
    const blob = blobs.get(params.hash);
    if (!blob) return fail(new BlobError(404, "内容不在本机内容库中。请重新导入完整项目，或重新选择原文件后再抽取。"));
    const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=31536000, immutable" };
    return new Response(url.searchParams.get("as") === "graph" ? blob.body : JSON.stringify({ text: blob.body }), { headers });
  });
}
