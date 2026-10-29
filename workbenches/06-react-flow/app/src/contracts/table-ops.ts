// ABOUTME: 表格类操作的纯函数（筛选、映射、排序、去重、分组、关联、合并）与共用的取值/比较工具。
import { compilePattern, fillTemplate } from "./expressions.ts";
import {
  PipelineError,
  cellText,
  inferCell,
  table,
  text,
  toNumber,
  uniqueNames,
  type Cell,
  type Row,
  type Value,
} from "./values.ts";

export type Cfg = Record<string, unknown>;
export type Table = Extract<Value, { type: "table" }>;

export const s = (config: Cfg, key: string) => (typeof config[key] === "string" ? (config[key] as string) : "");
export const b = (config: Cfg, key: string) => config[key] === true;
export const items = <T>(config: Cfg, key: string) => (Array.isArray(config[key]) ? (config[key] as T[]) : []);
export const unescape = (value: string) => value.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

export function want<T extends Value["type"]>(value: Value | undefined, type: T, port = "输入"): Extract<Value, { type: T }> {
  if (!value) throw new PipelineError(`${port}端口没有连接。`);
  if (value.type !== type) throw new PipelineError(`${port}需要${type === "table" ? "表格" : type === "text" ? "文本" : "JSON"}。`);
  return value as Extract<Value, { type: T }>;
}

export function needColumn(input: Table, column: string, what = "列") {
  if (!column) throw new PipelineError(`请选择${what}。`);
  if (!input.columns.includes(column))
    throw new PipelineError(`找不到列「${column}」。可用列：${input.columns.slice(0, 12).join("、") || "（无）"}`);
}

export function compare(a: Cell | undefined, b: Cell | undefined): number {
  const x = toNumber(a ?? null),
    y = toNumber(b ?? null);
  if (x !== null && y !== null) return x - y;
  if (a === null || a === undefined || a === "") return b === null || b === undefined || b === "" ? 0 : 1;
  if (b === null || b === undefined || b === "") return -1;
  return collator.compare(cellText(a), cellText(b));
}
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export type Condition = { column: string; op: string; value: string };
export function matchCondition(row: Row, condition: Condition, patterns: Map<string, RegExp>): boolean {
  const cell = row[condition.column];
  const left = cellText(cell);
  const right = condition.value;
  switch (condition.op) {
    case "eq": {
      const x = toNumber(cell ?? null),
        y = right.trim() ? toNumber(right) : null;
      return x !== null && y !== null ? x === y : left === right;
    }
    case "neq":
      return !matchCondition(row, { ...condition, op: "eq" }, patterns);
    case "gt":
      return compare(cell, inferCell(right)) > 0;
    case "gte":
      return compare(cell, inferCell(right)) >= 0;
    case "lt":
      return compare(cell, inferCell(right)) < 0;
    case "lte":
      return compare(cell, inferCell(right)) <= 0;
    case "contains":
      return left.includes(right);
    case "notContains":
      return !left.includes(right);
    case "startsWith":
      return left.startsWith(right);
    case "endsWith":
      return left.endsWith(right);
    case "empty":
      return left.trim() === "";
    case "notEmpty":
      return left.trim() !== "";
    case "matches": {
      let pattern = patterns.get(right);
      if (!pattern) {
        pattern = compilePattern(right, "", false);
        patterns.set(right, pattern);
      }
      return pattern.test(left);
    }
  }
  throw new PipelineError(`不支持的条件 ${condition.op}。`);
}

export function filter(input: Value, config: Cfg): Record<string, Value> {
  const source = want(input, "table");
  const conditions = items<Condition>(config, "conditions").filter((c) => c.column);
  for (const c of conditions) needColumn(source, c.column, "条件中的列");
  const any = config.mode === "any";
  const patterns = new Map<string, RegExp>();
  const kept: Row[] = [],
    rest: Row[] = [];
  for (const row of source.rows) {
    const ok = !conditions.length
      ? true
      : any
        ? conditions.some((c) => matchCondition(row, c, patterns))
        : conditions.every((c) => matchCondition(row, c, patterns));
    (ok ? kept : rest).push(row);
  }
  return { out: table(source.columns, kept), rest: table(source.columns, rest) };
}

export function mapFields(input: Value, config: Cfg): Value {
  const source = want(input, "table");
  const fields = items<{ from: string; to: string; cast: string }>(config, "fields").filter((f) => f.from.trim());
  for (const field of fields) if (!field.from.includes("{{")) needColumn(source, field.from, "来源列");
  const renamed = new Set(fields.filter((f) => !f.from.includes("{{")).map((f) => f.from));
  const keep = b(config, "keepOthers");
  const columns = uniqueNames([
    ...(keep ? source.columns.filter((c) => !renamed.has(c)) : []),
    ...fields.map((f) => f.to.trim() || f.from),
  ]);
  const cast = (cell: Cell, how: string): Cell =>
    how === "number" ? toNumber(cell) : how === "text" ? cellText(cell) : cell;
  const rows = source.rows.map((row, index) => {
    const next: Row = {};
    if (keep) for (const column of source.columns) if (!renamed.has(column)) next[column] = row[column] ?? null;
    for (const field of fields) {
      const value = field.from.includes("{{") ? fillTemplate(field.from, row, index) : (row[field.from] ?? null);
      next[field.to.trim() || field.from] = cast(value, field.cast);
    }
    return next;
  });
  return table(columns, rows);
}

export function sortRows(input: Value, config: Cfg): Value {
  const source = want(input, "table");
  const keys = items<{ column: string; direction: string }>(config, "keys").filter((k) => k.column);
  if (!keys.length) throw new PipelineError("请至少添加一个排序列。");
  for (const key of keys) needColumn(source, key.column, "排序列");
  const rows = source.rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const key of keys) {
        // 空值始终排在最后，不随升降序翻转。
        const ex = cellText(x.row[key.column]) === "",
          ey = cellText(y.row[key.column]) === "";
        if (ex !== ey) return ex ? 1 : -1;
        const d = compare(x.row[key.column], y.row[key.column]);
        if (d) return key.direction === "desc" ? -d : d;
      }
      return x.index - y.index;
    })
    .map(({ row }) => row);
  return table(source.columns, rows);
}

export function dedupe(input: Value, config: Cfg): Value {
  const source = want(input, "table");
  const columns = items<string>(config, "columns").filter(Boolean);
  for (const column of columns) needColumn(source, column, "去重列");
  const keyColumns = columns.length ? columns : source.columns;
  const seen = new Map<string, number>();
  const rows: Row[] = [];
  for (const row of source.rows) {
    const key = JSON.stringify(keyColumns.map((c) => cellText(row[c])));
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, rows.length);
      rows.push(row);
    } else if (config.keep === "last") rows[at] = row;
  }
  return table(source.columns, rows);
}

export type Aggregation = { op: string; column: string; as: string };
export function group(input: Value, config: Cfg): Value {
  const source = want(input, "table");
  const by = items<string>(config, "by").filter(Boolean);
  for (const column of by) needColumn(source, column, "分组列");
  let aggregations = items<Aggregation>(config, "aggregations");
  if (!aggregations.length) aggregations = [{ op: "count", column: "", as: "数量" }];
  for (const a of aggregations) if (a.op !== "count") needColumn(source, a.column, "汇总列");
  const names = aggregations.map((a) => a.as.trim() || (a.op === "count" ? "数量" : `${a.column}_${a.op}`));
  const buckets = new Map<string, { keys: Row; rows: Row[] }>();
  for (const row of source.rows) {
    const key = JSON.stringify(by.map((c) => cellText(row[c])));
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { keys: Object.fromEntries(by.map((c) => [c, row[c] ?? null])), rows: [] };
      buckets.set(key, bucket);
    }
    bucket.rows.push(row);
  }
  const rows = [...buckets.values()].map(({ keys, rows: members }) => {
    const out: Row = { ...keys };
    aggregations.forEach((a, index) => {
      const numbers = members.map((r) => toNumber(r[a.column])).filter((n): n is number => n !== null);
      const round = (n: number) => Math.round(n * 1e6) / 1e6;
      out[names[index]] =
        a.op === "count"
          ? members.length
          : a.op === "distinct"
            ? new Set(members.map((r) => cellText(r[a.column]))).size
            : !numbers.length
              ? null
              : a.op === "sum"
                ? round(numbers.reduce((x, y) => x + y, 0))
                : a.op === "avg"
                  ? Math.round((numbers.reduce((x, y) => x + y, 0) / numbers.length) * 100) / 100
                  : a.op === "min"
                    ? Math.min(...numbers)
                    : Math.max(...numbers);
    });
    return out;
  });
  return table(uniqueNames([...by, ...names]), rows);
}

export function join(left: Value | undefined, right: Value | undefined, config: Cfg): Value {
  const l = want(left, "table", "左表"),
    r = want(right, "table", "右表");
  const lk = s(config, "leftKey"),
    rk = s(config, "rightKey") || lk;
  needColumn(l, lk, "左表键");
  needColumn(r, rk, "右表键");
  const prefix = s(config, "rightPrefix");
  const rightColumns = r.columns.filter((c) => c !== rk);
  const rename = new Map(
    rightColumns.map((c) => [c, prefix ? prefix + c : l.columns.includes(c) ? `${c}_右` : c]),
  );
  const index = new Map<string, Row[]>();
  for (const row of r.rows) {
    const key = cellText(row[rk]);
    index.set(key, [...(index.get(key) ?? []), row]);
  }
  const rows: Row[] = [];
  for (const row of l.rows) {
    const matches = index.get(cellText(row[lk]));
    if (!matches) {
      if (config.kind === "left") rows.push({ ...row, ...Object.fromEntries(rightColumns.map((c) => [rename.get(c)!, null])) });
      continue;
    }
    for (const match of matches) {
      rows.push({ ...row, ...Object.fromEntries(rightColumns.map((c) => [rename.get(c)!, match[c] ?? null])) });
      if (rows.length > 200_000) throw new PipelineError("关联结果超过 200,000 行，请检查键是否唯一。");
    }
  }
  return table([...l.columns, ...rightColumns.map((c) => rename.get(c)!)], rows);
}

export function concat(a: Value | undefined, b: Value | undefined, config: Cfg): Value {
  if (!a || !b) throw new PipelineError("合并需要连接 A 和 B 两个输入。");
  if (a.type !== b.type) throw new PipelineError("A 与 B 的数据类型不同，无法合并。");
  if (a.type === "text") return text(a.text + unescape(s(config, "separator")) + (b as typeof a).text);
  if (a.type !== "table") throw new PipelineError("只能合并表格或文本。");
  const tb = b as Table;
  const tag = s(config, "sourceColumn").trim();
  const columns = uniqueNames([...(tag ? [tag] : []), ...a.columns, ...tb.columns.filter((c) => !a.columns.includes(c))].filter((c, i, all) => all.indexOf(c) === i));
  const label = (rows: Row[], name: string) => (tag ? rows.map((row) => ({ [tag]: name, ...row })) : rows);
  return table(columns, [...label(a.rows, s(config, "labelA") || "A"), ...label(tb.rows, s(config, "labelB") || "B")]);
}
