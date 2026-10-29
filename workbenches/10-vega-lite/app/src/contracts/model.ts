// ABOUTME: 图表文件模型（Vega-Lite 规格 + 项目数据集引用）、结构校验、首开示例与 AI 指令。
import { isRecord } from "./project.ts";
import { decodeDatasetRef, MAX_DATASETS, type DatasetRef } from "./datasets.ts";
import { gallery } from "./gallery.ts";
import { sampleDataset } from "./samples.ts";

export interface Model {
  spec: Record<string, unknown>;
  datasets: DatasetRef[];
}
/** 规格（含内嵌 data.values）序列化后的最大字节数；工作副本同时保存编辑器原文，需留在单次请求上限内。 */
export const MAX_SPEC_BYTES = 700_000;
export const VIEW_KEYS = ["mark", "layer", "facet", "repeat", "concat", "hconcat", "vconcat"] as const;

export function exampleModel(id: string): Model {
  const example = gallery.find((item) => item.id === id);
  if (!example) throw new Error("示例不存在。");
  return {
    spec: structuredClone(example.spec),
    datasets: example.datasets.map((name) => sampleDataset(name).ref),
  };
}
export const seed: Model = exampleModel("seasonal-temperature");
export const blankSpec = (dataset?: DatasetRef): Record<string, unknown> => ({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  data: dataset ? { name: dataset.name } : { values: [{ 类别: "A", 数值: 28 }, { 类别: "B", 数值: 55 }, { 类别: "C", 数值: 43 }] },
  mark: "bar",
  encoding: dataset
    ? {}
    : {
        x: { field: "类别", type: "nominal" },
        y: { field: "数值", type: "quantitative" },
      },
});

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
function inspect(value: unknown, depth = 0): void {
  if (depth > 64) throw new Error("规格嵌套过深（超过 64 层）。");
  if (Array.isArray(value)) {
    for (const item of value) inspect(item, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) throw new Error(`规格中不能使用属性名 "${key}"。`);
    inspect(item, depth + 1);
  }
}

/** 规格的结构检查（同步、两端共用）；完整的官方 schema 校验见 spec-schema.ts。 */
export function checkSpec(spec: unknown): Record<string, unknown> {
  if (!isRecord(spec)) throw new Error("规格需要是 JSON 对象。");
  if (typeof spec.$schema === "string" && /schema\/vega\/v\d/.test(spec.$schema))
    throw new Error("这是 Vega 规格，不是 Vega-Lite 规格。请使用 Vega-Lite（$schema 为 vega-lite/v6）。");
  if (!VIEW_KEYS.some((key) => key in spec))
    throw new Error("规格需要包含 mark、layer、facet、repeat、concat、hconcat 或 vconcat 之一。");
  if (new TextEncoder().encode(JSON.stringify(spec)).length > MAX_SPEC_BYTES)
    throw new Error(`规格超过 ${MAX_SPEC_BYTES / 1000} KB。较大的数据请在数据窗导入为数据集，再用 data: {"name": …} 引用。`);
  inspect(spec);
  return spec;
}

export function validate(value: unknown): Model {
  if (!isRecord(value)) throw new Error("请输入 Vega-Lite 图表。");
  const spec = checkSpec(value.spec);
  const rawSets = value.datasets ?? [];
  if (!Array.isArray(rawSets) || rawSets.length > MAX_DATASETS)
    throw new Error(`每张图表最多关联 ${MAX_DATASETS} 个数据集。`);
  const datasets = rawSets.map(decodeDatasetRef);
  const names = new Set<string>();
  for (const item of datasets) {
    if (names.has(item.name)) throw new Error(`数据集名称 "${item.name}" 重复。`);
    names.add(item.name);
  }
  return { spec, datasets };
}

export const instructions = [
  "你是 Vega-Lite v6 图表作者。根据用户要求返回一个完整的 Vega-Lite 规格 JSON 对象，形如 {\"spec\":{...}}。",
  "可以使用完整语法：layer、hconcat/vconcat/concat、facet、repeat、params（选择与滑块绑定）、transform（filter/aggregate/bin/window/regression 等）与所有 mark（bar/line/area/point/arc/boxplot/errorband/rect/text/rule 等）。",
  "若提供了可用数据集，必须用 data: {\"name\": 数据集名} 引用并只使用列出的字段；否则用 data.values 内嵌少量真实感示例数据。",
  "不得使用 url 加载外部数据或图片。标题、轴标题使用中文。不要设置固定 width，交给容器自适应（分面/拼接子图除外）。",
].join("");
