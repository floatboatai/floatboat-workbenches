// ABOUTME: 文件导入：区分数据文件（CSV/TSV/JSON 数组）与规格/项目包，读取并校验大小。
import { MAX_DATASET_BYTES } from "../contracts/datasets";
import { readImportedJson, type ImportedFile } from "../contracts/bundle";
import { isRecord } from "../contracts/project";

export const SPEC_ACCEPT = ".json,.vl.json,application/json";
const MAX_IMPORT = 64 * 1024 * 1024;
export const baseTitle = (name: string) =>
  name
    .replace(/(\.vl|\.vlproject)?\.json$/i, "")
    .replace(/\.[^.]+$/, "")
    .trim()
    .slice(0, 120) || "导入的图表";

export type DroppedFile = { kind: "data"; file: File } | ImportedFile;

/** 读取规格或项目包 JSON。数组或 {data:[…]} 视为数据文件。 */
export async function classifyFile(file: File): Promise<DroppedFile> {
  if (!/\.json$/i.test(file.name)) {
    if (file.size > MAX_DATASET_BYTES)
      throw new Error(`“${file.name}”超过 ${MAX_DATASET_BYTES / 1024 / 1024} MiB，请先筛选或聚合后再导入。`);
    return { kind: "data", file };
  }
  if (file.size > MAX_IMPORT) throw new Error(`“${file.name}”超过 64 MiB。`);
  const text = (await file.text()).replace(/^﻿/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`“${file.name}”不是有效的 JSON：${error instanceof Error ? error.message : "格式错误"}`);
  }
  const values = isRecord(raw) ? Object.values(raw) : [];
  const looksLikeData =
    Array.isArray(raw) ||
    (isRecord(raw) && values.length === 1 && Array.isArray(values[0]) && !("mark" in raw) && !("layer" in raw));
  if (looksLikeData) {
    if (file.size > MAX_DATASET_BYTES)
      throw new Error(`“${file.name}”超过 ${MAX_DATASET_BYTES / 1024 / 1024} MiB，请先筛选或聚合后再导入。`);
    return { kind: "data", file };
  }
  return readImportedJson(raw, baseTitle(file.name));
}
