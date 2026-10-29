// ABOUTME: 节点类型目录：类别、带类型的输入/输出端口与配置结构（含默认值和长度限制）。
import { LIMITS, type PortType } from "./values.ts";

export type Category = "input" | "transform" | "output";

export type Field =
  | { kind: "string"; max: number; default: string }
  | { kind: "bool"; default: boolean }
  | { kind: "enum"; values: readonly string[]; default: string }
  | { kind: "int"; min: number; max: number; default: number }
  | { kind: "strings"; max: number; itemMax: number }
  | { kind: "list"; max: number; item: Record<string, Field> };

export interface InputPort {
  id: string;
  label: string;
  accepts: PortType[];
}
export interface OutputPort {
  id: string;
  label: string;
  /** 固定类型，或 "same"（与第一个已连接输入相同），或由配置决定。 */
  type: PortType | "same" | ((config: Record<string, unknown>) => PortType);
}

export interface OpSpec {
  title: string;
  category: Category;
  description: string;
  inputs: InputPort[];
  outputs: OutputPort[];
  config: Record<string, Field>;
}

const str = (max: number, value = ""): Field => ({ kind: "string", max, default: value });
const bool = (value: boolean): Field => ({ kind: "bool", default: value });
const choice = (values: readonly string[], value = values[0]): Field => ({
  kind: "enum",
  values,
  default: value,
});
const int = (min: number, max: number, value: number): Field => ({ kind: "int", min, max, default: value });
const names = (max = 50): Field => ({ kind: "strings", max, itemMax: 200 });
const list = (max: number, item: Record<string, Field>): Field => ({ kind: "list", max, item });

const single = (accepts: PortType[], label = "输入"): InputPort[] => [{ id: "in", label, accepts }];
const out = (type: OutputPort["type"], label = "输出"): OutputPort[] => [{ id: "out", label, type }];

export const conditionOps = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "empty",
  "notEmpty",
  "matches",
] as const;
export const aggregateOps = ["count", "sum", "avg", "min", "max", "distinct"] as const;

export const OPS = {
  textInput: {
    title: "文本输入",
    category: "input",
    description: "粘贴日志、清单或任意文本。",
    inputs: [],
    outputs: out("text", "文本"),
    config: { text: str(LIMITS.inline), fileName: str(200) },
  },
  csvInput: {
    title: "CSV 输入",
    category: "input",
    description: "粘贴或上传 CSV / TSV，第一行为列名。",
    inputs: [],
    outputs: out("table", "表格"),
    config: {
      csv: str(LIMITS.inline),
      delimiter: choice(["auto", ",", ";", "\t", "|"]),
      header: bool(true),
      inferNumbers: bool(true),
      fileName: str(200),
    },
  },
  jsonInput: {
    title: "JSON 输入",
    category: "input",
    description: "粘贴或上传 JSON 文档。",
    inputs: [],
    outputs: out("json", "JSON"),
    config: { json: str(LIMITS.inline, "{}"), fileName: str(200) },
  },
  textTransform: {
    title: "文本处理",
    category: "transform",
    description: "大小写、去空白、加前后缀。",
    inputs: single(["text"]),
    outputs: out("text"),
    config: {
      mode: choice(["upper", "lower", "trim", "trimLines", "prefix", "suffix"]),
      value: str(2000),
    },
  },
  splitLines: {
    title: "按行拆分",
    category: "transform",
    description: "把文本拆成每行一条记录。",
    inputs: single(["text"]),
    outputs: out("table"),
    config: { column: str(80, "line"), trim: bool(true), skipEmpty: bool(true), addIndex: bool(false) },
  },
  regexExtract: {
    title: "正则提取",
    category: "transform",
    description: "用命名分组 (?<名>…) 把匹配拆成列。",
    inputs: single(["text", "table"]),
    outputs: out("table"),
    config: {
      pattern: str(500),
      flags: str(4, "m"),
      column: str(200),
      keepUnmatched: bool(false),
    },
  },
  regexReplace: {
    title: "正则替换",
    category: "transform",
    description: "替换文本或某一列，支持 $1 / $<名>。",
    inputs: single(["text", "table"]),
    outputs: out("same"),
    config: { pattern: str(500), flags: str(4, ""), replacement: str(2000), column: str(200) },
  },
  template: {
    title: "模板填充",
    category: "transform",
    description: "每行套用 {{字段}} 模板，生成文本。",
    inputs: single(["table"]),
    outputs: out("text", "文本"),
    config: { template: str(5000, "{{#}}. {{name}}"), separator: str(20, "\\n"), header: str(2000) },
  },
  jsonPick: {
    title: "JSON 取值",
    category: "transform",
    description: "按路径 $.data.items[*] 取出数据。",
    inputs: single(["json"]),
    outputs: out((config) => (config.as === "table" ? "table" : "json")),
    config: { path: str(500, "$"), as: choice(["table", "json"]) },
  },
  filter: {
    title: "筛选行",
    category: "transform",
    description: "按条件保留行；不满足的行从“其余”端口流出。",
    inputs: single(["table"]),
    outputs: [
      { id: "out", label: "符合", type: "table" },
      { id: "rest", label: "其余", type: "table" },
    ],
    config: {
      mode: choice(["all", "any"]),
      conditions: list(20, {
        column: str(200),
        op: choice(conditionOps),
        value: str(500),
      }),
    },
  },
  mapFields: {
    title: "字段映射",
    category: "transform",
    description: "重命名、挑选列、转换类型或用模板生成新列。",
    inputs: single(["table"]),
    outputs: out("table"),
    config: {
      keepOthers: bool(true),
      fields: list(60, {
        from: str(500),
        to: str(200),
        cast: choice(["keep", "number", "text"]),
      }),
    },
  },
  sort: {
    title: "排序",
    category: "transform",
    description: "按一列或多列升序/降序。",
    inputs: single(["table"]),
    outputs: out("table"),
    config: {
      keys: list(8, { column: str(200), direction: choice(["asc", "desc"]) }),
    },
  },
  dedupe: {
    title: "去重",
    category: "transform",
    description: "按指定列（为空则整行）去掉重复记录。",
    inputs: single(["table"]),
    outputs: out("table"),
    config: { columns: names(), keep: choice(["first", "last"]) },
  },
  group: {
    title: "分组汇总",
    category: "transform",
    description: "按列分组并计数、求和、平均、最值。",
    inputs: single(["table"]),
    outputs: out("table"),
    config: {
      by: names(),
      aggregations: list(20, {
        op: choice(aggregateOps),
        column: str(200),
        as: str(200),
      }),
    },
  },
  join: {
    title: "关联两表",
    category: "transform",
    description: "按键把右表的列并到左表（内连接/左连接）。",
    inputs: [
      { id: "left", label: "左表", accepts: ["table"] },
      { id: "right", label: "右表", accepts: ["table"] },
    ],
    outputs: out("table"),
    config: {
      leftKey: str(200),
      rightKey: str(200),
      kind: choice(["inner", "left"]),
      rightPrefix: str(40),
    },
  },
  concat: {
    title: "合并追加",
    category: "transform",
    description: "上下拼接两张表（列取并集）或两段文本。",
    inputs: [
      { id: "a", label: "A", accepts: ["table", "text"] },
      { id: "b", label: "B", accepts: ["table", "text"] },
    ],
    outputs: out("same"),
    config: { separator: str(20, "\\n"), sourceColumn: str(80), labelA: str(80, "A"), labelB: str(80, "B") },
  },
  textOutput: {
    title: "文本预览",
    category: "output",
    description: "显示最终文本（表格显示为 CSV）。",
    inputs: single(["text", "table", "json"]),
    outputs: [],
    config: {},
  },
  tableOutput: {
    title: "表格预览",
    category: "output",
    description: "以表格查看结果。",
    inputs: single(["table"]),
    outputs: [],
    config: {},
  },
  chartOutput: {
    title: "柱状图",
    category: "output",
    description: "用一列作标签、一列作数值画水平柱状图。",
    inputs: single(["table"]),
    outputs: [],
    config: {
      label: str(200),
      value: str(200),
      limit: int(1, 50, 12),
      order: choice(["desc", "asc", "none"]),
    },
  },
  fileOutput: {
    title: "下载文件",
    category: "output",
    description: "把结果导出为 CSV、JSON 或文本文件。",
    inputs: single(["table", "text", "json"]),
    outputs: [],
    config: { format: choice(["csv", "json", "txt"]), fileName: str(120, "结果") },
  },
} satisfies Record<string, OpSpec>;

export type OpKind = keyof typeof OPS;
export const opKinds = Object.keys(OPS) as OpKind[];
export const isOpKind = (value: unknown): value is OpKind =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(OPS, value);
export const spec = (op: OpKind): OpSpec => OPS[op];

export const categoryLabels: Record<Category, string> = {
  input: "输入",
  transform: "变换",
  output: "输出",
};

export function defaultConfig(op: OpKind): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(spec(op).config))
    config[key] = fieldDefault(field);
  return config;
}

function fieldDefault(field: Field): unknown {
  if (field.kind === "strings" || field.kind === "list") return [];
  return field.default;
}

/** 按字段结构校验配置并补全缺省值；未知字段被丢弃，类型错误抛出。 */
export function normalizeConfig(op: OpKind, raw: unknown): Record<string, unknown> {
  const source = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (raw !== undefined && source !== raw) throw new Error(`${spec(op).title} 的配置格式无效。`);
  return normalizeFields(spec(op).config, source, spec(op).title);
}

function normalizeFields(fields: Record<string, Field>, source: Record<string, unknown>, where: string) {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields))
    result[key] = normalizeField(field, source[key], `${where}·${key}`);
  return result;
}

function normalizeField(field: Field, value: unknown, where: string): unknown {
  if (value === undefined) return fieldDefault(field);
  const fail = (message: string) => {
    throw new Error(`${where}：${message}`);
  };
  switch (field.kind) {
    case "string":
      if (typeof value !== "string") fail("需要文本。");
      if ((value as string).length > field.max)
        fail(`不能超过 ${field.max.toLocaleString("zh-CN")} 个字符。`);
      return value;
    case "bool":
      if (typeof value !== "boolean") fail("需要开关值。");
      return value;
    case "enum":
      if (typeof value !== "string" || !field.values.includes(value)) fail("选项无效。");
      return value;
    case "int":
      if (typeof value !== "number" || !Number.isInteger(value) || value < field.min || value > field.max)
        fail(`需要 ${field.min}–${field.max} 的整数。`);
      return value;
    case "strings":
      if (!Array.isArray(value) || value.length > field.max) fail(`最多 ${field.max} 项。`);
      return (value as unknown[]).map((item) => {
        if (typeof item !== "string" || item.length > field.itemMax) fail("列名无效。");
        return item;
      });
    case "list":
      if (!Array.isArray(value) || value.length > field.max) fail(`最多 ${field.max} 项。`);
      return (value as unknown[]).map((item, index) => {
        if (item === null || typeof item !== "object" || Array.isArray(item)) fail(`第 ${index + 1} 项格式无效。`);
        return normalizeFields(field.item, item as Record<string, unknown>, `${where}[${index + 1}]`);
      });
  }
}
