// ABOUTME: 配置项的中文标签与节点一行摘要（显示在节点卡片上）。
import type { NodeData } from "../contracts/flow";

export const optionLabels: Record<string, Record<string, string>> = {
  mode: { upper: "转大写", lower: "转小写", trim: "去首尾空白", trimLines: "逐行去空白", prefix: "加前缀", suffix: "加后缀", all: "全部满足", any: "任一满足" },
  op: {
    eq: "等于",
    neq: "不等于",
    gt: "大于",
    gte: "大于等于",
    lt: "小于",
    lte: "小于等于",
    contains: "包含",
    notContains: "不包含",
    startsWith: "开头是",
    endsWith: "结尾是",
    empty: "为空",
    notEmpty: "不为空",
    matches: "匹配正则",
    count: "计数",
    sum: "求和",
    avg: "平均",
    min: "最小",
    max: "最大",
    distinct: "去重计数",
  },
  delimiter: { auto: "自动识别", ",": "逗号 ,", ";": "分号 ;", "\t": "制表符", "|": "竖线 |" },
  as: { table: "表格", json: "JSON" },
  cast: { keep: "保持", number: "数字", text: "文本" },
  direction: { asc: "升序", desc: "降序" },
  keep: { first: "保留第一条", last: "保留最后一条" },
  kind: { inner: "内连接（只保留匹配）", left: "左连接（保留左表全部）" },
  order: { desc: "从大到小", asc: "从小到大", none: "原顺序" },
  format: { csv: "CSV", json: "JSON", txt: "文本 TXT" },
};

const symbol: Record<string, string> = { eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤" };
const str = (value: unknown) => (typeof value === "string" ? value : "");
const list = <T>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);
const kb = (value: string) =>
  value.length > 1024 ? `${(new Blob([value]).size / 1024).toFixed(0)} KB` : `${value.length} 字符`;

export function describe({ op, config: c }: NodeData): string {
  switch (op) {
    case "textInput":
      return str(c.fileName) || (str(c.text) ? kb(str(c.text)) : "尚未输入文本");
    case "csvInput":
      return (str(c.fileName) ? str(c.fileName) + " · " : "") + (str(c.csv) ? kb(str(c.csv)) : "尚未粘贴 CSV");
    case "jsonInput":
      return str(c.fileName) || kb(str(c.json));
    case "textTransform":
      return optionLabels.mode[str(c.mode)] + (c.mode === "prefix" || c.mode === "suffix" ? `「${str(c.value)}」` : "");
    case "splitLines":
      return `列名 ${str(c.column) || "line"}${c.skipEmpty ? " · 跳过空行" : ""}`;
    case "regexExtract":
    case "regexReplace":
      return str(c.pattern) ? `/${str(c.pattern)}/${str(c.flags)}${str(c.column) ? " · 列 " + str(c.column) : ""}` : "尚未填写正则";
    case "template":
      return str(c.template) || "尚未填写模板";
    case "jsonPick":
      return `${str(c.path) || "$"} → ${optionLabels.as[str(c.as)]}`;
    case "filter": {
      const conditions = list<{ column: string; op: string; value: string }>(c.conditions).filter((x) => x.column);
      if (!conditions.length) return "无条件（全部通过）";
      return conditions
        .map((x) => `${x.column} ${symbol[x.op] ?? optionLabels.op[x.op]}${x.op === "empty" || x.op === "notEmpty" ? "" : " " + x.value}`)
        .join(c.mode === "any" ? " 或 " : " 且 ");
    }
    case "mapFields": {
      const fields = list<{ from: string; to: string }>(c.fields).filter((f) => f.from);
      return fields.length ? fields.map((f) => (f.to && f.to !== f.from ? `${f.from}→${f.to}` : f.from)).join("，") : "未设置字段";
    }
    case "sort": {
      const keys = list<{ column: string; direction: string }>(c.keys).filter((k) => k.column);
      return keys.length ? keys.map((k) => `${k.column} ${k.direction === "desc" ? "↓" : "↑"}`).join("，") : "未选择排序列";
    }
    case "dedupe": {
      const columns = list<string>(c.columns);
      return (columns.length ? "按 " + columns.join("、") : "按整行") + " · " + optionLabels.keep[str(c.keep)];
    }
    case "group": {
      const by = list<string>(c.by);
      const aggs = list<{ op: string; column: string }>(c.aggregations);
      return (
        (by.length ? `按 ${by.join("、")}` : "全部合为一组") +
        " · " +
        (aggs.length ? aggs.map((a) => optionLabels.op[a.op] + (a.op === "count" ? "" : `(${a.column})`)).join("、") : "计数")
      );
    }
    case "join":
      return str(c.leftKey) ? `${str(c.leftKey)} = ${str(c.rightKey) || str(c.leftKey)} · ${c.kind === "left" ? "左连接" : "内连接"}` : "尚未选择关联键";
    case "concat":
      return str(c.sourceColumn) ? `来源列「${str(c.sourceColumn)}」` : "A 在上，B 在下";
    case "chartOutput":
      return str(c.value) ? `${str(c.label)} × ${str(c.value)}` : "自动选择列";
    case "fileOutput":
      return `${str(c.fileName) || "结果"}.${str(c.format)}`;
    default:
      return "";
  }
}
