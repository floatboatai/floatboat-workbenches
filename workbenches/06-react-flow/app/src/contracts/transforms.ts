// ABOUTME: 每种节点操作的纯函数实现：输入值 + 配置 → 输出值，不访问网络或全局状态。
import { compilePattern, fillTemplate, pickPath } from "./expressions.ts";
import type { OpKind } from "./ops.ts";
import {
  PipelineError,
  cellText,
  inferCell,
  jsonToTable,
  parseCsv,
  table,
  text,
  toNumber,
  uniqueNames,
  valueToText,
  type JsonValue,
  type Row,
  type Value,
} from "./values.ts";

import {
  b,
  concat,
  dedupe,
  filter,
  group,
  join,
  mapFields,
  needColumn,
  s,
  sortRows,
  unescape,
  want,
  type Cfg,
} from "./table-ops.ts";

export interface OpResult {
  outputs: Record<string, Value>;
  /** 输出节点要展示的内容。 */
  view?: Value;
}
function groupNames(pattern: RegExp): string[] {
  // 用一次空匹配探测分组数；命名分组优先。
  const probe = new RegExp(pattern.source + "|", pattern.flags.replace("g", ""));
  const m = probe.exec("")!;
  const named = Object.keys(m.groups ?? {});
  const count = m.length - 1;
  if (named.length) return named;
  return Array.from({ length: count }, (_, index) => `组${index + 1}`);
}

function regexExtract(input: Value, config: Cfg): Value {
  const pattern = compilePattern(s(config, "pattern"), s(config, "flags"));
  const fields = groupNames(pattern);
  const named = fields.length > 0 && !fields[0].startsWith("组");
  const captured = (m: RegExpMatchArray): Row => {
    const row: Row = { match: m[0] };
    fields.forEach((name, index) => {
      const value = named ? m.groups?.[name] : m[index + 1];
      row[name] = value === undefined ? null : inferCell(value);
    });
    return row;
  };
  if (input.type === "text") {
    const rows: Row[] = [];
    for (const m of input.text.matchAll(pattern)) {
      rows.push(captured(m));
      if (rows.length > 200_000) throw new PipelineError("匹配超过 200,000 处。");
    }
    if (!fields.length) return table(["match"], rows);
    return table(
      fields,
      rows.map(({ match: _match, ...rest }) => rest),
    );
  }
  const source = want(input, "table");
  const column = s(config, "column");
  needColumn(source, column);
  const extra = fields.length ? fields : ["match"];
  const columns = uniqueNames([...source.columns, ...extra.filter((name) => !source.columns.includes(name))]);
  const rows: Row[] = [];
  for (const row of source.rows) {
    pattern.lastIndex = 0;
    const m = pattern.exec(cellText(row[column]));
    if (!m) {
      if (b(config, "keepUnmatched")) rows.push({ ...Object.fromEntries(extra.map((k) => [k, null])), ...row });
      continue;
    }
    const got = captured(m);
    rows.push({ ...row, ...(fields.length ? Object.fromEntries(fields.map((k) => [k, got[k]])) : { match: got.match }) });
  }
  return table(columns, rows);
}

function regexReplace(input: Value, config: Cfg): Value {
  const pattern = compilePattern(s(config, "pattern"), s(config, "flags"));
  const replacement = s(config, "replacement");
  if (input.type === "text") return text(input.text.replace(pattern, replacement));
  const source = want(input, "table");
  const column = s(config, "column");
  needColumn(source, column);
  return table(
    source.columns,
    source.rows.map((row) => ({ ...row, [column]: inferCell(cellText(row[column]).replace(pattern, replacement)) })),
  );
}

function textTransform(input: Value, config: Cfg): Value {
  const value = want(input, "text").text;
  const extra = s(config, "value");
  switch (config.mode) {
    case "upper":
      return text(value.toUpperCase());
    case "lower":
      return text(value.toLowerCase());
    case "trim":
      return text(value.trim());
    case "trimLines":
      return text(value.split("\n").map((line) => line.trim()).join("\n"));
    case "prefix":
      return text(extra + value);
    default:
      return text(value + extra);
  }
}

function splitLines(input: Value, config: Cfg): Value {
  const column = s(config, "column").trim() || "line";
  let lines = want(input, "text").text.split(/\r?\n/);
  if (b(config, "trim")) lines = lines.map((line) => line.trim());
  const rows: Row[] = [];
  lines.forEach((line, index) => {
    if (b(config, "skipEmpty") && !line.trim()) return;
    rows.push(b(config, "addIndex") ? { 行号: index + 1, [column]: line } : { [column]: line });
  });
  return table(b(config, "addIndex") ? uniqueNames(["行号", column]) : [column], rows);
}

function chart(input: Value, config: Cfg): Value {
  const source = want(input, "table");
  const label = s(config, "label") || source.columns[0];
  const value = s(config, "value") || source.columns.find((c) => source.rows.some((r) => typeof r[c] === "number")) || "";
  needColumn(source, label, "标签列");
  needColumn(source, value, "数值列");
  let rows = source.rows.map((row) => ({ label: cellText(row[label]), value: toNumber(row[value]) ?? 0 }));
  if (config.order === "desc") rows = rows.sort((x, y) => y.value - x.value);
  if (config.order === "asc") rows = rows.sort((x, y) => x.value - y.value);
  const limit = typeof config.limit === "number" ? config.limit : 12;
  return table(["label", "value"], rows.slice(0, limit));
}

export function runOp(op: OpKind, config: Cfg, inputs: Record<string, Value | undefined>): OpResult {
  const input = inputs.in;
  switch (op) {
    case "textInput":
      return { outputs: { out: text(s(config, "text")) } };
    case "csvInput":
      return {
        outputs: {
          out: parseCsv(s(config, "csv"), {
            delimiter: s(config, "delimiter"),
            header: b(config, "header"),
            inferNumbers: b(config, "inferNumbers"),
          }),
        },
      };
    case "jsonInput": {
      let value: JsonValue;
      try {
        value = JSON.parse(s(config, "json").replace(/^﻿/, "")) as JsonValue;
      } catch (error) {
        throw new PipelineError("JSON 解析失败：" + (error instanceof Error ? error.message : ""));
      }
      return { outputs: { out: { type: "json", value } } };
    }
    case "textTransform":
      return { outputs: { out: textTransform(input!, config) } };
    case "splitLines":
      return { outputs: { out: splitLines(input!, config) } };
    case "regexExtract":
      return { outputs: { out: regexExtract(want(input, input?.type === "table" ? "table" : "text"), config) } };
    case "regexReplace":
      return { outputs: { out: regexReplace(want(input, input?.type === "table" ? "table" : "text"), config) } };
    case "template": {
      const source = want(input, "table");
      const tpl = s(config, "template");
      const header = s(config, "header");
      const body = source.rows.map((row, index) => fillTemplate(tpl, row, index)).join(unescape(s(config, "separator")));
      return { outputs: { out: text(header ? unescape(header) + "\n" + body : body) } };
    }
    case "jsonPick": {
      const picked = pickPath(want(input, "json").value, s(config, "path"));
      return { outputs: { out: config.as === "table" ? jsonToTable(picked) : { type: "json", value: picked } } };
    }
    case "filter":
      return { outputs: filter(input!, config) };
    case "mapFields":
      return { outputs: { out: mapFields(input!, config) } };
    case "sort":
      return { outputs: { out: sortRows(input!, config) } };
    case "dedupe":
      return { outputs: { out: dedupe(input!, config) } };
    case "group":
      return { outputs: { out: group(input!, config) } };
    case "join":
      return { outputs: { out: join(inputs.left, inputs.right, config) } };
    case "concat":
      return { outputs: { out: concat(inputs.a, inputs.b, config) } };
    case "textOutput":
      if (!input) throw new PipelineError("输入端口没有连接。");
      return { outputs: {}, view: text(valueToText(input)) };
    case "tableOutput":
      return { outputs: {}, view: want(input, "table") };
    case "chartOutput":
      return { outputs: {}, view: chart(input!, config) };
    case "fileOutput":
      if (!input) throw new PipelineError("输入端口没有连接。");
      if (config.format === "csv" && input.type !== "table") throw new PipelineError("CSV 格式需要表格输入。");
      return { outputs: {}, view: input };
  }
}
