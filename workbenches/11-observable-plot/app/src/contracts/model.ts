import { isRecord, boundedText } from "./project.ts";
export interface Model {
  format: "csv" | "json";
  source: string;
  kind: "bar" | "line" | "dot";
  x: string;
  y: string;
}
export type Row = Record<string, string | number | null>;
export const seed: Model = {
  format: "csv",
  source: "日期,访问量\n周一,120\n周二,180\n周三,156\n周四,240\n周五,210",
  kind: "line",
  x: "日期",
  y: "访问量",
};
export function parseCsv(source: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closedQuote = false;
  const text = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (closedQuote && char !== "," && char !== "\n" && char !== "\r")
      throw new Error("CSV 闭合引号后只能是分隔符或换行。");
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.length)
        throw new Error("CSV 引号前存在多余字符。");
      else {
        if (quoted) closedQuote = true;
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      closedQuote = false;
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      closedQuote = false;
    } else cell += char;
  }
  if (quoted) throw new Error("CSV 引号没有闭合。");
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  const headers = rows.shift()?.map((value) => value.trim());
  if (
    !headers?.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("CSV 表头不能为空或重复。");
  if (
    headers.some((h) => ["__proto__", "constructor", "prototype"].includes(h))
  )
    throw new Error("CSV 表头包含不支持的名称。");
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(`CSV 第 ${index + 2} 行的列数不一致。`);
    return Object.fromEntries(
      headers.map((name, i) => [name, values[i].trim()]),
    );
  });
}
export function rowsFrom(model: Pick<Model, "format" | "source">): Row[] {
  let rows: unknown;
  if (model.format === "csv") rows = parseCsv(model.source);
  else {
    try {
      rows = JSON.parse(model.source);
    } catch {
      throw new Error("JSON 数据需要有效数组。");
    }
  }
  if (
    !Array.isArray(rows) ||
    rows.length < 1 ||
    rows.length > 10000 ||
    !rows.every(isRecord)
  )
    throw new Error("数据需要 1–10000 行对象。");
  const columns = Object.keys(rows[0]);
  if (!columns.length || columns.length > 40)
    throw new Error("数据需要 1–40 列。");
  for (const row of rows)
    for (const value of Object.values(row))
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "number"
      )
        throw new Error("只支持文本、数字和空值单元格。");
  return rows as Row[];
}
export function validate(value: unknown): Model {
  if (
    !isRecord(value) ||
    (value.format !== "csv" && value.format !== "json") ||
    (value.kind !== "bar" && value.kind !== "line" && value.kind !== "dot") ||
    typeof value.x !== "string" ||
    typeof value.y !== "string"
  )
    throw new Error("图表参数无效。");
  const model = {
    format: value.format as Model["format"],
    source: boundedText(value.source, 500000),
    kind: value.kind as Model["kind"],
    x: value.x,
    y: value.y,
  };
  const rows = rowsFrom(model),
    columns = Object.keys(rows[0]);
  if (!columns.includes(model.x) || !columns.includes(model.y))
    throw new Error("横轴与数值列必须存在于数据中。");
  if (rows.some((row) => !(model.x in row) || !(model.y in row)))
    throw new Error("每行数据都需要横轴与数值字段。");
  if (
    rows.some(
      (row) =>
        row[model.y] === null ||
        row[model.y] === "" ||
        !Number.isFinite(Number(row[model.y])),
    )
  )
    throw new Error("数值列存在空值或非数字内容，请修正后绘图。");
  return model;
}
export const instructions =
  '生成轻量图表配置，返回 {"format":"csv","source":"CSV数据","kind":"bar或line或dot","x":"横轴列名","y":"数值列名"}。CSV表头唯一，每行列数一致，y列全部为有限数字。最多30行。只返回JSON，不返回JavaScript代码。';

export function plotData(model: Model) {
  const source = rowsFrom(model);
  const numeric =
    model.kind !== "bar" &&
    source.every(
      (row) =>
        row[model.x] !== null &&
        String(row[model.x]).trim() !== "" &&
        Number.isFinite(Number(row[model.x])),
    );
  const rows = source.map((row) => ({
    xValue: numeric ? Number(row[model.x]) : String(row[model.x] ?? ""),
    yValue: Number(row[model.y]),
  }));
  return {
    rows,
    domain: numeric
      ? undefined
      : Array.from(new Set(rows.map((row) => String(row.xValue)))),
  };
}
