import { randomUUID } from "node:crypto";
import { CHUNK_BYTES, MAX_IMPORT, MAX_MODEL } from "../contracts/asset.ts";
import { isRecord } from "../contracts/project.ts";
import type { UploadedFile } from "./importer.ts";

/**
 * The SDK caps each JSON request at 2,000,000 bytes, so files travel as ordered
 * base64 chunks into preallocated buffers and are only used once complete.
 */
interface Session {
  purpose: "import" | "resource";
  files: { name: string; buffer: Buffer; received: number }[];
  touched: number;
}
const TTL = 15 * 60 * 1000,
  MEMORY = 640 * 1024 * 1024;
export function uploadSessions(now = () => Date.now()) {
  const sessions = new Map<string, Session>();
  const sweep = () => {
    for (const [id, s] of sessions) if (now() - s.touched > TTL) sessions.delete(id);
  };
  const allocated = () =>
    [...sessions.values()].reduce(
      (s, x) => s + x.files.reduce((k, f) => k + f.buffer.length, 0),
      0,
    );
  const get = (id: string) => {
    const s = sessions.get(id);
    if (!s) throw Error("上传已过期，请重新选择文件。");
    s.touched = now();
    return s;
  };
  return {
    create(body: unknown) {
      sweep();
      if (
        !isRecord(body) ||
        !["import", "resource"].includes(String(body.purpose)) ||
        !Array.isArray(body.files) ||
        body.files.length < 1 ||
        body.files.length > 2000
      )
        throw Error("上传请求无效。");
      const purpose = body.purpose as Session["purpose"];
      const files = body.files.map((f) => {
        if (
          !isRecord(f) ||
          typeof f.name !== "string" ||
          !f.name ||
          f.name.length > 255 ||
          !Number.isInteger(f.bytes) ||
          Number(f.bytes) < 1
        )
          throw Error("上传文件信息无效。");
        return { name: f.name, bytes: Number(f.bytes) };
      });
      const total = files.reduce((s, f) => s + f.bytes, 0);
      if (purpose === "import" && total > MAX_IMPORT)
        throw Error("导入文件合计超过 64 MB。");
      if (purpose === "resource" && (files.length !== 1 || total > MAX_MODEL))
        throw Error("单个资源需在 128 MB 以内。");
      if (allocated() + total > MEMORY)
        throw Error("其他上传仍在进行，请稍后再试。");
      const id = randomUUID();
      sessions.set(id, {
        purpose,
        files: files.map((f) => ({
          name: f.name,
          buffer: Buffer.alloc(f.bytes),
          received: 0,
        })),
        touched: now(),
      });
      return { id, chunk: CHUNK_BYTES };
    },
    chunk(id: string, body: unknown) {
      const s = get(id);
      if (
        !isRecord(body) ||
        !Number.isInteger(body.index) ||
        !Number.isInteger(body.offset) ||
        typeof body.base64 !== "string" ||
        body.base64.length > Math.ceil(CHUNK_BYTES / 3) * 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)
      )
        throw Error("上传分块无效。");
      const file = s.files[Number(body.index)];
      if (!file) throw Error("上传文件序号无效。");
      if (Number(body.offset) !== file.received)
        throw Error("上传分块顺序不连续，请重新选择文件。");
      const bytes = Buffer.from(body.base64, "base64");
      if (!bytes.length || file.received + bytes.length > file.buffer.length)
        throw Error("上传分块超出文件长度。");
      bytes.copy(file.buffer, file.received);
      file.received += bytes.length;
      return {
        received: file.received,
        complete: s.files.every((f) => f.received === f.buffer.length),
      };
    },
    /** Removes the session and returns complete files. */
    take(id: string, purpose: Session["purpose"]): UploadedFile[] {
      const s = get(id);
      if (s.purpose !== purpose) throw Error("上传用途不匹配。");
      if (s.files.some((f) => f.received !== f.buffer.length))
        throw Error("文件尚未上传完整。");
      sessions.delete(id);
      return s.files.map((f) => ({ name: f.name, bytes: new Uint8Array(f.buffer) }));
    },
    drop(id: string) {
      sessions.delete(id);
      return { deleted: true };
    },
    get size() {
      return sessions.size;
    },
  };
}
