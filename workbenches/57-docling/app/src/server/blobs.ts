// ABOUTME: 原文件与 DoclingDocument 的内容寻址存储：1 MiB 分块上传、幂等续传、SHA-256 校验与内置示例只读回退。
import { createHash } from "node:crypto";
import { appendFile, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";
import { boundedText, isRecord } from "../contracts/project.ts";
import { parseDocument, type Document } from "../contracts/docling.ts";
import { sha } from "../contracts/review.ts";
import { StoreError } from "./store.ts";
export const CHUNK = 1024 * 1024;
export const LIMITS = { source: 64 * 1024 * 1024, docling: 48 * 1024 * 1024 } as const;
export type BlobKind = keyof typeof LIMITS;
export const digest = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
export interface BlobInfo {
  id: string;
  kind: BlobKind;
  name: string;
  bytes: number;
  received: number;
  stored: boolean;
}
type PathFn = (name: string, write?: boolean) => Promise<string>;
export function createBlobs(db: DatabaseSync, path: PathFn, examples: Map<string, string> = new Map()) {
  const file = (id: string, kind: BlobKind) => path(`blob-${id}.${kind}`, true);
  const part = (id: string, kind: BlobKind) => path(`blob-${id}.${kind}.part`, true);
  const row = (id: string) =>
    db.prepare("SELECT id,kind,name,bytes,received,state FROM docling_blobs WHERE id=?").get(id);
  const info = (r: Record<string, unknown>): BlobInfo => ({
    id: String(r.id),
    kind: r.kind as BlobKind,
    name: String(r.name),
    bytes: Number(r.bytes),
    received: Number(r.received),
    stored: r.state === "stored",
  });
  const docs = new Map<string, Document>();
  const kindOf = (value: unknown): BlobKind => {
    if (value !== "source" && value !== "docling") throw new StoreError(400, "文件类型无效。");
    return value;
  };
  async function begin(value: unknown): Promise<BlobInfo> {
    if (!isRecord(value) || !sha(value.id)) throw new StoreError(400, "文件标识无效。");
    const kind = kindOf(value.kind),
      bytes = Number(value.bytes),
      name = boundedText(value.name, 300);
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > LIMITS[kind])
      throw new StoreError(413, kind === "source" ? "原文件需在 64 MB 以内。" : "结构文档需在 48 MB 以内。");
    if (examples.has(value.id))
      return { id: value.id, kind, name, bytes, received: bytes, stored: true };
    const existing = row(value.id);
    if (existing) {
      const current = info(existing);
      if (current.kind !== kind || current.bytes !== bytes) throw new StoreError(409, "同一标识已用于不同文件。");
      return current;
    }
    const now = new Date().toISOString();
    await writeFile(await part(value.id, kind), new Uint8Array(0));
    db.prepare(
      "INSERT INTO docling_blobs(id,kind,name,bytes,received,state,created_at,updated_at) VALUES(?,?,?,?,0,'uploading',?,?)",
    ).run(value.id, kind, name, bytes, now, now);
    return info(row(value.id)!);
  }
  async function chunk(id: string, index: number, value: unknown): Promise<BlobInfo> {
    const r = row(id);
    if (!r) throw new StoreError(404, "上传尚未开始。");
    const current = info(r);
    if (current.stored) return current;
    if (!isRecord(value) || typeof value.data !== "string") throw new StoreError(400, "分块格式无效。");
    const expected = Math.floor(current.received / CHUNK);
    // A retried chunk whose first write already landed is acknowledged without appending twice.
    if (index < expected) return current;
    if (index !== expected) throw new StoreError(409, `需要第 ${expected + 1} 块。`);
    const bytes = Buffer.from(value.data, "base64");
    if (bytes.toString("base64") !== value.data) throw new StoreError(400, "分块编码无效。");
    const last = Math.ceil(current.bytes / CHUNK) - 1;
    if (bytes.length !== (index === last ? current.bytes - index * CHUNK : CHUNK))
      throw new StoreError(400, "分块大小不符。");
    const target = await part(id, current.kind);
    const size = (await stat(target).catch(() => ({ size: 0 }))).size;
    if (size !== current.received) throw new StoreError(409, "上传状态不一致，请重新选择文件。");
    await appendFile(target, bytes);
    db.prepare("UPDATE docling_blobs SET received=?,updated_at=? WHERE id=?").run(
      current.received + bytes.length,
      new Date().toISOString(),
      id,
    );
    return info(row(id)!);
  }
  async function complete(id: string): Promise<BlobInfo> {
    if (examples.has(id)) return { id, kind: examples.get(id)!.endsWith(".docling.json") ? "docling" : "source", name: "", bytes: 0, received: 0, stored: true };
    const r = row(id);
    if (!r) throw new StoreError(404, "上传尚未开始。");
    const current = info(r);
    if (current.stored) return current;
    if (current.received !== current.bytes) throw new StoreError(409, "文件尚未传完。");
    const temp = await part(id, current.kind);
    const bytes = await readFile(temp);
    if (digest(bytes) !== id) {
      await unlink(temp).catch(() => undefined);
      db.prepare("DELETE FROM docling_blobs WHERE id=?").run(id);
      throw new StoreError(400, "文件校验失败，请重新上传。");
    }
    if (current.kind === "docling") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(bytes.toString("utf8"));
      } catch {
        throw new StoreError(400, "结构文档不是有效 JSON。");
      }
      docs.set(id, parseDocument(parsed, bytes.length));
    }
    await rename(temp, await file(id, current.kind));
    db.prepare("UPDATE docling_blobs SET state='stored',updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    return info(row(id)!);
  }
  /** Stores server-produced bytes (e.g. a Docling Serve result) directly. */
  async function put(kind: BlobKind, name: string, bytes: Uint8Array): Promise<BlobInfo> {
    const id = digest(bytes);
    const existing = row(id);
    if (existing && info(existing).stored) return info(existing);
    const temp = await part(id, kind);
    await writeFile(temp, bytes);
    await rename(temp, await file(id, kind));
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO docling_blobs(id,kind,name,bytes,received,state,created_at,updated_at) VALUES(?,?,?,?,?,'stored',?,?) ON CONFLICT(id) DO UPDATE SET state='stored',received=excluded.received,updated_at=excluded.updated_at",
    ).run(id, kind, name.slice(0, 300), bytes.length, bytes.length, now, now);
    return info(row(id)!);
  }
  async function read(id: string, kind: BlobKind): Promise<Buffer> {
    if (!sha(id)) throw new StoreError(400, "文件标识无效。");
    const example = examples.get(id);
    if (example) return readFile(example);
    const r = row(id);
    if (!r || !info(r).stored || info(r).kind !== kind)
      throw new StoreError(404, kind === "source" ? "原文件不在当前工作台，请重新选择原文件。" : "结构文档不在当前工作台，请重新导入。");
    return readFile(await file(id, kind));
  }
  async function document(id: string): Promise<Document> {
    const cached = docs.get(id);
    if (cached) return cached;
    const bytes = await read(id, "docling");
    const doc = parseDocument(JSON.parse(bytes.toString("utf8")), bytes.length);
    if (docs.size > 8) docs.delete(docs.keys().next().value!);
    docs.set(id, doc);
    return doc;
  }
  function stored(id: string): boolean {
    if (examples.has(id)) return true;
    const r = row(id);
    return !!r && info(r).stored;
  }
  return { begin, chunk, complete, put, read, document, stored, row: (id: string) => (row(id) ? info(row(id)!) : null) };
}
export type Blobs = ReturnType<typeof createBlobs>;
