// ABOUTME: 渲染前准备规格：注入项目数据集、把引用已导入文件名的 url 改写为数据集名、为单视图补容器尺寸，并找出被阻止的外部资源。
import { isRecord } from "./project.ts";
import type { DatasetRef } from "./datasets.ts";
import { pointerOf } from "./json-source.ts";

export interface ExternalRef {
  pointer: string;
  url: string;
  kind: "data" | "image" | "link";
}

const baseName = (url: string) => {
  const clean = url.split(/[?#]/)[0];
  return clean.slice(clean.lastIndexOf("/") + 1);
};
const isExternal = (url: string) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url) && !/^data:image\//i.test(url);

/** 按 url 找到项目中已导入的数据集：完整文件名、去掉目录后的文件名或数据集名均可。 */
export function matchDataset(url: string, datasets: DatasetRef[]): DatasetRef | undefined {
  if (isExternal(url)) return undefined;
  const name = baseName(url);
  return datasets.find((item) => item.file === url || item.file === name || item.name === url || item.name === name);
}

/** 列出规格中所有 url/href 引用：未匹配到项目数据集的会在渲染时被阻止。 */
export function findExternalRefs(spec: unknown, datasets: DatasetRef[]): ExternalRef[] {
  const found: ExternalRef[] = [];
  const walk = (value: unknown, path: (string | number)[]) => {
    if (found.length > 50) return;
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, index]));
    else if (isRecord(value))
      for (const [key, item] of Object.entries(value)) {
        const parent = path[path.length - 1];
        if (key === "url" && typeof item === "string" && !matchDataset(item, datasets))
          found.push({ pointer: pointerOf([...path, key]), url: item, kind: "data" });
        else if (key === "url" && isRecord(item) && typeof item.value === "string" && isExternal(item.value))
          found.push({ pointer: pointerOf([...path, key, "value"]), url: item.value, kind: "image" });
        else if ((key === "href" || (key === "value" && parent === "url")) && typeof item === "string" && isExternal(item))
          found.push({ pointer: pointerOf([...path, key]), url: item, kind: key === "href" ? "link" : "image" });
        else walk(item, [...path, key]);
      }
  };
  walk(spec, []);
  return found;
}

/** 引用到的数据集名称（data.name、lookup.from.data.name，以及按文件名匹配的 url）。 */
export function referencedDatasets(spec: unknown, datasets: DatasetRef[]): Set<string> {
  const names = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (isRecord(value)) {
      if (isRecord(value.data)) {
        if (typeof value.data.name === "string") names.add(value.data.name);
        if (typeof value.data.url === "string") {
          const hit = matchDataset(value.data.url, datasets);
          if (hit) names.add(hit.name);
        }
      }
      Object.values(value).forEach(walk);
    }
  };
  walk(spec);
  return names;
}

const isUnitOrLayer = (spec: Record<string, unknown>) => "mark" in spec || "layer" in spec;
/** 单视图/图层且没有写死 width 或 height、没有分面通道时，按容器尺寸绘制。 */
export function wantsContainerSize(spec: Record<string, unknown>): boolean {
  if (!isUnitOrLayer(spec)) return false;
  const encoding = isRecord(spec.encoding) ? spec.encoding : {};
  if ("row" in encoding || "column" in encoding || "facet" in encoding) return false;
  return spec.width === undefined || spec.height === undefined;
}

export interface PrepareOptions {
  width?: number;
  height?: number;
}
/**
 * 生成用于编译的副本，不修改原规格：
 * - 已导入数据集作为顶层 datasets 注入（规格自带同名 datasets 时以规格为准）；
 * - data.url 指向已导入的文件名时改写为 data.name；
 * - 单视图/图层未写 width/height 时，按容器尺寸填满。
 */
export function prepareSpec(
  spec: Record<string, unknown>,
  datasets: DatasetRef[],
  rows: Map<string, Record<string, unknown>[]>,
  options: PrepareOptions = {},
): Record<string, unknown> {
  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!isRecord(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "data" && isRecord(item) && typeof item.url === "string") {
        const hit = matchDataset(item.url, datasets);
        if (hit) {
          const { url: _url, format: _format, ...rest } = item;
          out[key] = { ...rest, name: hit.name };
          continue;
        }
      }
      out[key] = rewrite(item);
    }
    return out;
  };
  const next = rewrite(spec) as Record<string, unknown>;
  const used = referencedDatasets(next, datasets);
  const own = isRecord(next.datasets) ? next.datasets : {};
  const injected: Record<string, unknown> = {};
  for (const item of datasets)
    if (used.has(item.name) && !(item.name in own) && rows.has(item.name)) injected[item.name] = rows.get(item.name);
  if (Object.keys(injected).length) next.datasets = { ...injected, ...own };
  if (isUnitOrLayer(next)) {
    const facetChannels = (() => {
      const encoding = isRecord(next.encoding) ? next.encoding : {};
      return "row" in encoding || "column" in encoding || "facet" in encoding;
    })();
    if (!facetChannels) {
      const fill = next.width === undefined && options.width !== undefined;
      const fillHeight = next.height === undefined && options.height !== undefined;
      if (fill) next.width = Math.max(240, Math.round(options.width!));
      if (fillHeight) next.height = Math.max(180, Math.round(options.height!));
      if ((fill || fillHeight) && next.autosize === undefined)
        next.autosize = { type: "fit", contains: "padding" };
    }
  }
  return next;
}
