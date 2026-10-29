// ABOUTME: 页面侧数据集访问：分块上传数据文件、按 id 读取并缓存解析后的行，以及加载官方 schema 校验器。
import {
  MAX_DATASET_BYTES,
  parseDataset,
  type DatasetColumn,
  type DatasetFormat,
  type DatasetRef,
  type ParsedTable,
} from "../contracts/datasets";
import { isRecord } from "../contracts/project";
import { createSpecChecker, type SpecChecker } from "../contracts/spec-schema";
import { getPageConnection } from "./connection";
import { request } from "./requests";

export interface UploadedDataset {
  id: string;
  file: string;
  format: DatasetFormat;
  bytes: number;
  rows: number;
  columns: DatasetColumn[];
}
function decodeUploaded(value: unknown): UploadedDataset {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.file !== "string" ||
    !["csv", "tsv", "json"].includes(String(value.format)) ||
    typeof value.bytes !== "number" ||
    typeof value.rows !== "number" ||
    !Array.isArray(value.columns)
  )
    throw new Error("服务端返回的数据集信息无效。");
  return value as unknown as UploadedDataset;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** 把数据文件分块上传到服务端，返回解析后的数据集信息。 */
export async function uploadDataset(
  file: string,
  bytes: Uint8Array,
  onProgress?: (fraction: number) => void,
): Promise<UploadedDataset> {
  if (!bytes.length) throw new Error(`“${file}”是空文件。`);
  if (bytes.length > MAX_DATASET_BYTES)
    throw new Error(`“${file}”超过 ${MAX_DATASET_BYTES / 1024 / 1024} MiB，请先筛选或聚合后再导入。`);
  const session = await request("/api/datasets/uploads", {
    method: "POST",
    body: JSON.stringify({ file, bytes: bytes.length }),
  });
  if (!isRecord(session) || typeof session.id !== "string" || typeof session.chunk !== "number")
    throw new Error("无法开始上传。");
  const id = session.id;
  try {
    for (let offset = 0; offset < bytes.length; offset += session.chunk) {
      await request(`/api/datasets/uploads/${id}/chunk`, {
        method: "POST",
        body: JSON.stringify({ offset, base64: base64(bytes.subarray(offset, offset + session.chunk)) }),
      });
      onProgress?.(Math.min(1, (offset + session.chunk) / bytes.length));
    }
    return decodeUploaded(await request(`/api/datasets/uploads/${id}/finish`, { method: "POST", body: "{}" }));
  } catch (error) {
    void request(`/api/datasets/uploads/${id}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}

const texts = new Map<string, Promise<string>>();
const tables = new Map<string, Promise<ParsedTable>>();
function remember<T>(cache: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const value = make();
  cache.set(key, value);
  value.catch(() => cache.delete(key));
  while (cache.size > 24) cache.delete(cache.keys().next().value as string);
  return value;
}

export function datasetText(id: string): Promise<string> {
  return remember(texts, id, async () => {
    const page = await getPageConnection();
    const response = await page.fetch(`/api/datasets/${encodeURIComponent(id)}`);
    if (!response.ok) {
      let message = "数据集读取失败。";
      try {
        const body: unknown = await response.json();
        if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string")
          message = body.error.message;
      } catch {
        /* 使用默认提示 */
      }
      throw new Error(message);
    }
    return response.text();
  });
}

export function datasetTable(ref: DatasetRef): Promise<ParsedTable> {
  return remember(tables, ref.id, async () => parseDataset(await datasetText(ref.id), ref.format));
}

export async function missingDatasets(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const result = await request("/api/datasets/missing", { method: "POST", body: JSON.stringify({ ids }) });
  return isRecord(result) && Array.isArray(result.missing) ? result.missing.map(String) : ids;
}

export interface SchemaTools {
  schema: Record<string, unknown>;
  check: SpecChecker;
}
let schemaTools: Promise<SchemaTools> | null = null;
/** 官方 Vega-Lite schema（服务端已规范化）。只加载一次。 */
export function loadSchemaTools(): Promise<SchemaTools> {
  schemaTools ??= (async () => {
    const page = await getPageConnection();
    const response = await page.fetch("/api/schema");
    if (!response.ok) throw new Error("无法加载 Vega-Lite schema。");
    const schema: unknown = await response.json();
    if (!isRecord(schema)) throw new Error("Vega-Lite schema 格式无效。");
    return { schema, check: createSpecChecker(schema) };
  })();
  schemaTools.catch(() => {
    schemaTools = null;
  });
  return schemaTools;
}
