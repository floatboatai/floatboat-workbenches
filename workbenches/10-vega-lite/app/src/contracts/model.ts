import { isRecord } from "./project.ts";
export interface Model {
  spec: Record<string, unknown>;
}
export const seed: Model = {
  spec: {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    description: "各渠道本周收到的有效线索",
    data: {
      values: [
        { 渠道: "搜索", 线索: 42 },
        { 渠道: "社群", 线索: 67 },
        { 渠道: "推荐", 线索: 35 },
        { 渠道: "活动", 线索: 58 },
      ],
    },
    mark: {
      type: "bar",
      color: "#ca654b",
      cornerRadiusTopLeft: 5,
      cornerRadiusTopRight: 5,
    },
    encoding: {
      x: { field: "渠道", type: "nominal", axis: { labelAngle: 0 } },
      y: { field: "线索", type: "quantitative", title: "有效线索" },
    },
    width: 600,
    height: 340,
  },
};
const marks = new Set([
  "bar",
  "line",
  "point",
  "circle",
  "area",
  "rect",
  "tick",
  "rule",
  "text",
]);
function inspect(value: unknown, depth = 0): void {
  if (depth > 30) throw new Error("规格嵌套过深。");
  if (Array.isArray(value)) {
    for (const item of value) inspect(item, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (
      [
        "url",
        "href",
        "image",
        "__proto__",
        "constructor",
        "prototype",
      ].includes(key)
    )
      throw new Error("只支持内嵌数据与基础图形，不支持外部资源。");
    inspect(item, depth + 1);
  }
}
export function validate(value: unknown): Model {
  if (!isRecord(value) || !isRecord(value.spec))
    throw new Error("请输入 Vega-Lite JSON 规格。");
  const spec = value.spec;
  if (
    !isRecord(spec.data) ||
    !Array.isArray(spec.data.values) ||
    spec.data.values.length < 1 ||
    spec.data.values.length > 10000 ||
    !spec.data.values.every(isRecord)
  )
    throw new Error("data.values 需要 1–10000 行对象数据。");
  const mark =
    typeof spec.mark === "string"
      ? spec.mark
      : isRecord(spec.mark)
        ? spec.mark.type
        : undefined;
  if (typeof mark !== "string" || !marks.has(mark) || !isRecord(spec.encoding))
    throw new Error("请选择支持的基础图形并提供 encoding。");
  if (JSON.stringify(spec).length > 500000)
    throw new Error("规格超过 500,000 字符。");
  inspect(spec);
  return { spec };
}
export const instructions =
  '按要求生成 Vega-Lite v6 图表，返回 {"spec":{...}}。仅使用单视图 bar/line/point/area。data.values 必须内嵌实际示例数据，不允许 url/href/image。必须有 encoding。width:600,height:340。用中文标题和字段。';
