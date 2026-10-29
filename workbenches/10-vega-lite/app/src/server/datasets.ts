// ABOUTME: 数据集存储与分块上传：解码 UTF-8/GB18030 文本、解析校验、按内容哈希去重写入 SQLite，并预置示例数据。
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  formatOf,
  isDatasetId,
  MAX_DATASET_BYTES,
  parseDataset,
  type DatasetColumn,
  type DatasetFormat,
} from "../contracts/datasets.ts";
import { isRecord } from "../contracts/project.ts";
import { sampleDataset, sampleDatasets } from "../contracts/samples.ts";
import { StoreError } from "./store.ts";

export interface StoredDataset {
  id: string;
  file: string;
  format: DatasetFormat;
  bytes: number;
  rows: number;
  columns: DatasetColumn[];
}

/** 先按 UTF-8 严格解码，失败时按 GB18030（Excel 中文 CSV 常见编码）解码。 */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("gb18030", { fatal: true }).decode(bytes);
    } catch {
      throw new StoreError(415, "文件不是 UTF-8 或 GB18030 编码的文本，请另存为 UTF-8 CSV 后重试。");
    }
  }
}

/** 根据扩展名和内容判断格式；.txt 等未知扩展名按内容嗅探。 */
export function sniffFormat(file: string, text: string): DatasetFormat {
  const byName = formatOf(file);
  const isText = /\.txt$/i.test(file);
  if (byName === "json" || byName === "tsv") return byName;
  if (byName === "csv" && !isText) return "csv";
  const head = text.replace(/^\uFEFF/, "").trimStart();
  if (/^[[{]/.test(head)) return "json";
  const firstLine = head.split(/\r?\n/, 1)[0] ?? "";
  if (firstLine.includes("\t") && !firstLine.includes(",")) return "tsv";
  if (firstLine.includes(",") || isText) return "csv";
  throw new StoreError(415, "请导入 CSV、TSV 或 JSON 数据文件。");
}

export function createDatasetStore(db: DatabaseSync) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO datasets(id,format,bytes,rows,columns,content,created_at) VALUES(?,?,?,?,?,?,?)",
  );
  function info(id: string): Omit<StoredDataset, "file"> | null {
    const row = db.prepare("SELECT id,format,bytes,rows,columns FROM datasets WHERE id=?").get(id);
    if (!row) return null;
    return {
      id: String(row.id),
      format: String(row.format) as DatasetFormat,
      bytes: Number(row.bytes),
      rows: Number(row.rows),
      columns: JSON.parse(String(row.columns)) as DatasetColumn[],
    };
  }
  return {
    installSamples() {
      for (const sample of sampleDatasets) {
        const { text, ref } = sampleDataset(sample.name);
        insert.run(ref.id, "csv", ref.bytes, ref.rows, JSON.stringify(ref.columns), text, new Date().toISOString());
      }
    },
    info,
    has(id: string) {
      return isDatasetId(id) && !!db.prepare("SELECT 1 AS ok FROM datasets WHERE id=?").get(id);
    },
    content(id: string): { format: DatasetFormat; content: string } {
      if (!isDatasetId(id)) throw new StoreError(400, "数据集标识无效。");
      const row = db.prepare("SELECT format,content FROM datasets WHERE id=?").get(id);
      if (!row) throw new StoreError(404, "数据集不存在，请重新导入该数据文件。");
      return { format: String(row.format) as DatasetFormat, content: String(row.content) };
    },
    missing(ids: unknown): string[] {
      if (!Array.isArray(ids) || ids.length > 64) throw new StoreError(400, "数据集列表无效。");
      return ids.filter((id) => typeof id !== "string" || !this.has(id)).map(String);
    },
    /** 解析并保存文本；同一内容只存一份。 */
    save(file: string, text: string, format = sniffFormat(file, text)): StoredDataset {
      const bytes = Buffer.byteLength(text);
      if (bytes > MAX_DATASET_BYTES)
        throw new StoreError(413, `数据文件超过 ${MAX_DATASET_BYTES / 1024 / 1024} MiB。`);
      let table;
      try {
        table = parseDataset(text, format);
      } catch (error) {
        throw new StoreError(422, error instanceof Error ? error.message : "数据文件无法解析。");
      }
      if (!table.columns.length) throw new StoreError(422, "数据文件中没有字段。");
      const id = createHash("sha256").update(format + "\0" + text).digest("hex");
      insert.run(id, format, bytes, table.rows.length, JSON.stringify(table.columns), text, new Date().toISOString());
      return { id, file, format, bytes, rows: table.rows.length, columns: table.columns };
    },
  };
}
export type DatasetStore = ReturnType<typeof createDatasetStore>;

export const CHUNK_BYTES = 1024 * 1024;
interface Session {
  file: string;
  buffer: Buffer;
  received: number;
  touched: number;
}
/** SDK 每个 JSON 请求上限 2,000,000 字节，数据文件以 base64 分块顺序上传。 */
export function uploadSessions(now = () => Date.now()) {
  const sessions = new Map<string, Session>();
  const TTL = 15 * 60 * 1000;
  const sweep = () => {
    for (const [id, s] of sessions) if (now() - s.touched > TTL) sessions.delete(id);
  };
  const get = (id: string) => {
    const s = sessions.get(id);
    if (!s) throw new StoreError(404, "上传已过期，请重新选择文件。");
    s.touched = now();
    return s;
  };
  return {
    create(body: unknown) {
      sweep();
      if (
        !isRecord(body) ||
        typeof body.file !== "string" ||
        !body.file.trim() ||
        body.file.length > 160 ||
        /[/\\\u0000-\u001f]/.test(body.file) ||
        !Number.isInteger(body.bytes) ||
        Number(body.bytes) < 1
      )
        throw new StoreError(400, "上传文件信息无效。");
      if (Number(body.bytes) > MAX_DATASET_BYTES)
        throw new StoreError(413, `数据文件超过 ${MAX_DATASET_BYTES / 1024 / 1024} MiB，请先筛选或聚合后再导入。`);
      if (sessions.size >= 8) throw new StoreError(429, "同时进行的上传过多，请稍后再试。");
      const id = randomUUID();
      sessions.set(id, { file: body.file.trim(), buffer: Buffer.alloc(Number(body.bytes)), received: 0, touched: now() });
      return { id, chunk: CHUNK_BYTES };
    },
    chunk(id: string, body: unknown) {
      const s = get(id);
      if (
        !isRecord(body) ||
        !Number.isInteger(body.offset) ||
        typeof body.base64 !== "string" ||
        body.base64.length > Math.ceil(CHUNK_BYTES / 3) * 4 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)
      )
        throw new StoreError(400, "上传分块无效。");
      if (Number(body.offset) !== s.received) throw new StoreError(409, "上传分块顺序不连续，请重新选择文件。");
      const bytes = Buffer.from(body.base64, "base64");
      if (!bytes.length || s.received + bytes.length > s.buffer.length)
        throw new StoreError(400, "上传分块超出文件长度。");
      bytes.copy(s.buffer, s.received);
      s.received += bytes.length;
      return { received: s.received, complete: s.received === s.buffer.length };
    },
    take(id: string): { file: string; bytes: Uint8Array } {
      const s = get(id);
      if (s.received !== s.buffer.length) throw new StoreError(409, "文件尚未上传完整。");
      sessions.delete(id);
      return { file: s.file, bytes: new Uint8Array(s.buffer) };
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
