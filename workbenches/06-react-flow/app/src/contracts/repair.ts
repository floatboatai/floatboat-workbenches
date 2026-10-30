// ABOUTME: AI 起草专用：由字段结构生成配置说明，并修正模型输出中可识别的配置偏差。
import { fieldDefault, normalizeField, spec, type Field, type OpKind } from "./ops.ts";

/** 配置结构的文字说明（取值、范围、默认值），供 AI 起草提示词使用，与校验同源。 */
export function describeConfig(op: OpKind): string {
  const fields = Object.entries(spec(op).config);
  return fields.length ? fields.map(([key, field]) => `${key}:${describeField(field)}`).join("，") : "无";
}

function describeField(field: Field): string {
  switch (field.kind) {
    case "string":
      return `文本≤${field.max}`;
    case "bool":
      return `true|false，默认 ${field.default}`;
    case "enum":
      return `${field.values.map((value) => JSON.stringify(value)).join("|")} 之一，默认 ${JSON.stringify(field.default)}`;
    case "int":
      return `整数 ${field.min}–${field.max}，默认 ${field.default}`;
    case "strings":
      return `[列名]，最多 ${field.max} 项`;
    case "list":
      return `[{${Object.entries(field.item)
        .map(([key, item]) => `${key}:${describeField(item)}`)
        .join("，")}}]，最多 ${field.max} 项`;
  }
}

// 模型常用的同义写法；只有映射目标属于该字段的可选值时才采用。
const SYNONYMS: Record<string, string[]> = {
  and: ["all"],
  every: ["all"],
  "&&": ["all"],
  or: ["any"],
  some: ["any"],
  "||": ["any"],
  ascending: ["asc"],
  descending: ["desc"],
  uppercase: ["upper"],
  lowercase: ["lower"],
  string: ["text", "txt"],
  text: ["txt"],
  numeric: ["number"],
  float: ["number"],
  int: ["number"],
  integer: ["number"],
  "=": ["eq"],
  "==": ["eq"],
  "===": ["eq"],
  equal: ["eq"],
  equals: ["eq"],
  "!=": ["neq"],
  "!==": ["neq"],
  "<>": ["neq"],
  ne: ["neq"],
  notequal: ["neq"],
  notequals: ["neq"],
  ">": ["gt"],
  ">=": ["gte"],
  ge: ["gte"],
  "<": ["lt"],
  "<=": ["lte"],
  le: ["lte"],
  includes: ["contains"],
  notincludes: ["notContains"],
  regex: ["matches"],
  match: ["matches"],
  isempty: ["empty"],
  isnotempty: ["notEmpty"],
  mean: ["avg"],
  average: ["avg"],
  unique: ["distinct"],
  countdistinct: ["distinct"],
  comma: [","],
  semicolon: [";"],
  tab: ["\t"],
  pipe: ["|"],
};
const looseKey = (value: string) => value.toLowerCase().replace(/[\s_-]/g, "");

/**
 * AI 起草专用：按字段结构修正可识别的偏差（大小写、同义词、越界、单值写成列表等），
 * 无法识别的值改回默认值，每处修正写入 repairs。正式文档仍走 normalizeConfig 严格校验。
 */
export function repairConfig(op: OpKind, raw: unknown, where: string, repairs: string[]): Record<string, unknown> {
  const source = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (raw !== undefined && source !== raw) repairs.push(`${where}：配置格式无效，已使用默认配置。`);
  return repairFields(spec(op).config, source, where, repairs);
}

function repairFields(fields: Record<string, Field>, source: Record<string, unknown>, where: string, repairs: string[]) {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields))
    result[key] = repairField(field, source[key], `${where}·${key}`, repairs);
  // 写错字段名时内容会被丢弃（例如把 CSV 放进 text），必须让用户知道。
  const unknown = Object.keys(source).filter((key) => !Object.prototype.hasOwnProperty.call(fields, key));
  if (unknown.length)
    repairs.push(`${where}：不支持的配置 ${unknown.slice(0, 5).join("、")} 已忽略（可用：${Object.keys(fields).join("、") || "无"}）。`);
  return result;
}

function repairField(field: Field, value: unknown, where: string, repairs: string[]): unknown {
  try {
    return normalizeField(field, value, where);
  } catch {
    // 继续按字段类型修正。
  }
  const shown = JSON.stringify(value)?.slice(0, 40) ?? String(value);
  const fallback = (reason: string) => {
    const result = fieldDefault(field);
    repairs.push(`${where}：${shown} ${reason}，已改为默认值${field.kind === "enum" ? ` ${JSON.stringify(result)}` : ""}。`);
    return result;
  };
  const changed = (result: unknown) => {
    repairs.push(`${where}：${shown} 已改为 ${JSON.stringify(result)?.slice(0, 40)}。`);
    return result;
  };
  switch (field.kind) {
    case "string":
      if (typeof value === "number" || typeof value === "boolean") return changed(String(value));
      if (typeof value === "string") return changed(value.slice(0, field.max));
      return fallback("不是文本");
    case "bool":
      if (value === "true" || value === 1) return changed(true);
      if (value === "false" || value === 0) return changed(false);
      return fallback("不是开关值");
    case "enum": {
      if (typeof value !== "string") return fallback("不是可选值");
      const key = looseKey(value);
      const match =
        field.values.find((option) => looseKey(option) === key) ??
        SYNONYMS[key]?.find((option) => field.values.includes(option));
      return match === undefined ? fallback(`不是可选值（${field.values.join("|")}）`) : changed(match);
    }
    case "int": {
      const number = typeof value === "string" && value.trim() ? Number(value) : value;
      if (typeof number !== "number" || !Number.isFinite(number)) return fallback("不是整数");
      return changed(Math.min(field.max, Math.max(field.min, Math.round(number))));
    }
    case "strings": {
      const items = typeof value === "string" ? [value] : Array.isArray(value) ? value : null;
      if (!items) return fallback("不是列名列表");
      return changed(
        items
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.slice(0, field.itemMax))
          .slice(0, field.max),
      );
    }
    case "list": {
      const items = Array.isArray(value) ? value : value !== null && typeof value === "object" ? [value] : null;
      if (!items) return fallback("不是列表");
      if (items.length > field.max) repairs.push(`${where}：超过 ${field.max} 项，只保留前 ${field.max} 项。`);
      return items.slice(0, field.max).flatMap((item, index) => {
        if (item === null || typeof item !== "object" || Array.isArray(item)) {
          repairs.push(`${where}[${index + 1}]：格式无效，已移除。`);
          return [];
        }
        return [repairFields(field.item, item as Record<string, unknown>, `${where}[${index + 1}]`, repairs)];
      });
    }
  }
}

export const GENERATE_ATTEMPTS = 3;

/** 取出模型回复里的 JSON 对象（容忍 Markdown 围栏和前后说明文字）；不完整时返回 undefined。 */
export function parseModelJson(reply: string): unknown {
  const text = reply
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  const start = text.indexOf("{"),
    end = text.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
