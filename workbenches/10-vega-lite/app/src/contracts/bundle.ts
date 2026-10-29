// ABOUTME: 图表项目包（规格 + 数据集原文）的导出格式与导入校验，以及外部 Vega-Lite 规格文件的识别。
import {
  isDatasetName,
  MAX_DATASET_BYTES,
  MAX_DATASETS,
  type DatasetFormat,
  type DatasetRef,
} from "./datasets.ts";
import { checkSpec } from "./model.ts";
import { isRecord } from "./project.ts";

export const BUNDLE_FORMAT = "floatboat.vega-lite-studio.project";
export interface BundleDataset {
  name: string;
  file: string;
  format: DatasetFormat;
  content: string;
}
export interface ProjectBundle {
  format: typeof BUNDLE_FORMAT;
  version: 1;
  title: string;
  spec: Record<string, unknown>;
  datasets: BundleDataset[];
  exportedAt: string;
}

export function encodeBundle(
  title: string,
  spec: Record<string, unknown>,
  datasets: { ref: DatasetRef; content: string }[],
): string {
  const bundle: ProjectBundle = {
    format: BUNDLE_FORMAT,
    version: 1,
    title,
    spec,
    datasets: datasets.map(({ ref, content }) => ({ name: ref.name, file: ref.file, format: ref.format, content })),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(bundle, null, 1);
}

export type ImportedFile =
  | { kind: "bundle"; title: string; spec: Record<string, unknown>; datasets: BundleDataset[] }
  | { kind: "spec"; title: string; spec: Record<string, unknown> };

/** 识别导入的 JSON：项目包、Vega-Lite 规格（或 {spec} 包装）。 */
export function readImportedJson(raw: unknown, fallbackTitle: string): ImportedFile {
  if (isRecord(raw) && raw.format === BUNDLE_FORMAT) {
    if (raw.version !== 1) throw new Error("项目包版本不受支持。");
    const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 120) : fallbackTitle;
    const spec = checkSpec(raw.spec);
    if (!Array.isArray(raw.datasets) || raw.datasets.length > MAX_DATASETS)
      throw new Error(`项目包中的数据集数量无效（最多 ${MAX_DATASETS} 个）。`);
    const taken = new Set<string>();
    const datasets = raw.datasets.map((item): BundleDataset => {
      if (
        !isRecord(item) ||
        !isDatasetName(item.name) ||
        typeof item.file !== "string" ||
        !item.file ||
        item.file.length > 160 ||
        !["csv", "tsv", "json"].includes(String(item.format)) ||
        typeof item.content !== "string" ||
        item.content.length > MAX_DATASET_BYTES
      )
        throw new Error("项目包中的数据集格式无效。");
      if (taken.has(item.name)) throw new Error(`项目包中的数据集名称 "${item.name}" 重复。`);
      taken.add(item.name);
      return { name: item.name, file: item.file.replace(/[/\\]/g, "_"), format: item.format as DatasetFormat, content: item.content };
    });
    return { kind: "bundle", title, spec, datasets };
  }
  const inner = isRecord(raw) && isRecord(raw.spec) && !("mark" in raw) && !("layer" in raw) ? raw.spec : raw;
  if (isRecord(inner) && typeof inner.$schema === "string" && /schema\/vega\/v\d/.test(inner.$schema))
    throw new Error("这是 Vega 规格，不是 Vega-Lite 规格。请导入 Vega-Lite 规格（$schema 为 vega-lite）。");
  if (Array.isArray(raw)) throw new Error("这是数据数组，请在数据窗中导入为数据集。");
  const spec = checkSpec(inner);
  const title =
    isRecord(spec.title) && typeof spec.title.text === "string"
      ? spec.title.text
      : typeof spec.title === "string"
        ? spec.title
        : typeof spec.description === "string" && spec.description.length <= 60
          ? spec.description
          : fallbackTitle;
  return { kind: "spec", title: title.trim().slice(0, 120) || fallbackTitle, spec };
}

