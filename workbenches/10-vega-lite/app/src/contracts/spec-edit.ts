// ABOUTME: 结构化修改规格：把字段插入编码通道（自动定位单视图/图层/分面/拼接中的目标视图）、切换数据来源。
import type { FieldType } from "./datasets.ts";
import { isRecord } from "./project.ts";

type Spec = Record<string, unknown>;
const FACET = new Set(["row", "column", "facet"]);

/** 找到应写入编码的视图：单视图/图层取自身，分面与重复取内层，拼接取第一个子图。 */
function targetView(spec: Spec, channel: string): Spec {
  if ("mark" in spec || "layer" in spec) return spec;
  if (isRecord(spec.spec)) {
    if (FACET.has(channel) && isRecord(spec.facet)) return spec;
    return targetView(spec.spec, channel);
  }
  for (const key of ["concat", "hconcat", "vconcat"])
    if (Array.isArray(spec[key]) && isRecord((spec[key] as unknown[])[0])) return targetView((spec[key] as Spec[])[0], channel);
  return spec;
}

export function insertEncoding(
  input: Spec,
  field: { name: string; type: FieldType },
  channel: string,
  dataset: string | null,
): Spec {
  const spec = structuredClone(input);
  const definition: Spec = { field: field.name, type: field.type };
  const view = targetView(spec, channel);
  if (FACET.has(channel) && isRecord(view.facet) && isRecord(view.spec)) {
    (view.facet as Spec)[channel === "facet" ? "row" : channel] = definition;
    return withData(spec, dataset);
  }
  const encoding: Spec = isRecord(view.encoding) ? view.encoding : {};
  if (channel === "tooltip") {
    const current = encoding.tooltip;
    const list = Array.isArray(current) ? current : isRecord(current) ? [current] : [];
    encoding.tooltip = [...list.filter((item) => !(isRecord(item) && item.field === field.name)), definition];
  } else encoding[channel] = definition;
  view.encoding = encoding;
  return withData(spec, dataset);
}

function withData(spec: Spec, dataset: string | null): Spec {
  if (dataset && spec.data === undefined && !hasData(spec)) spec.data = { name: dataset };
  return spec;
}
function hasData(spec: unknown): boolean {
  if (!isRecord(spec)) return false;
  if (spec.data !== undefined) return true;
  for (const key of ["layer", "concat", "hconcat", "vconcat"])
    if (Array.isArray(spec[key]) && (spec[key] as unknown[]).some(hasData)) return true;
  return isRecord(spec.spec) && hasData(spec.spec);
}

/** 让规格使用指定数据集：替换顶层 data（保留 format 以外的设置）。 */
export function withDataset(input: Spec, name: string): Spec {
  const spec = structuredClone(input);
  spec.data = { name };
  return spec;
}

export const formatSpec = (spec: unknown) => JSON.stringify(spec, null, 2);
