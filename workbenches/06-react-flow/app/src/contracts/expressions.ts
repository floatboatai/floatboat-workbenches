// ABOUTME: 受限表达式：安全正则编译、{{字段}} 模板、JSON 路径——全部是解析器，不执行任意代码。
import { PipelineError, cellText, type JsonValue, type Row } from "./values.ts";

export const MAX_PATTERN = 500;
const ALLOWED_FLAGS = /^[imsu]*$/;

/**
 * 拒绝明显的灾难性回溯写法（量词包住含量词的分组，如 (a+)+、(\w*)*、((ab)+c)+）。
 * 这只是第一道防线；执行在 Worker 中进行并有超时终止，作为最终保障。
 */
export function unsafePatternReason(pattern: string): string | null {
  if (!pattern) return "请输入正则表达式。";
  if (pattern.length > MAX_PATTERN)
    return `正则不能超过 ${MAX_PATTERN} 个字符。`;
  // 每个打开的分组记录其内部是否已有重复量词。
  const stack: boolean[] = [];
  let closed: boolean | null = null;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    let repeat = false;
    if (ch === "\\") {
      i++;
    } else if (ch === "[") {
      let j = i + 1;
      if (pattern[j] === "^") j++;
      if (pattern[j] === "]") j++;
      while (j < pattern.length && pattern[j] !== "]") j += pattern[j] === "\\" ? 2 : 1;
      i = j;
    } else if (ch === "(") {
      stack.push(false);
      closed = null;
      continue;
    } else if (ch === ")") {
      const inner = stack.pop() ?? false;
      if (inner && stack.length) stack[stack.length - 1] = true;
      closed = inner;
      continue;
    } else if (ch === "*" || ch === "+") {
      repeat = true;
    } else if (ch === "{") {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(i));
      if (m) {
        repeat = m[2] !== undefined || Number(m[1]) > 1;
        i += m[0].length - 1;
      }
    }
    if (repeat) {
      if (closed) return "正则中有嵌套的重复量词（如 (a+)+），可能导致运行卡死。请改写为不嵌套的形式。";
      if (stack.length) stack[stack.length - 1] = true;
      if (pattern[i + 1] === "?" || pattern[i + 1] === "+") i++;
    }
    closed = null;
  }
  return null;
}

export function compilePattern(pattern: string, flags: string, global = true): RegExp {
  const reason = unsafePatternReason(pattern);
  if (reason) throw new PipelineError(reason);
  if (!ALLOWED_FLAGS.test(flags) || new Set(flags).size !== flags.length)
    throw new PipelineError("正则标志只能是 i、m、s、u。");
  try {
    return new RegExp(pattern, flags + (global ? "g" : ""));
  } catch (error) {
    throw new PipelineError(
      "正则无效：" + (error instanceof Error ? error.message.replace(/^Invalid regular expression: /, "") : ""),
    );
  }
}

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** 列出模板中引用的字段名。 */
export function templateFields(template: string): string[] {
  return [...template.matchAll(TOKEN)].map((m) => m[1]);
}

/** 用行数据填充 {{字段}}；{{#}} 是从 1 开始的行号。缺失字段替换为空。 */
export function fillTemplate(template: string, row: Row, index: number): string {
  return template.replace(TOKEN, (_, name: string) =>
    name === "#" ? String(index + 1) : cellText(row[name]),
  );
}

type Segment = { key: string } | { index: number } | { wildcard: true };

/**
 * 解析 JSON 路径：`$.data.items[*].name`、`data.items[0]`、`["带空格的键"]`。
 * 只支持属性、下标和 [*] 展开，不支持过滤表达式和脚本。
 */
export function parsePath(path: string): Segment[] {
  let rest = path.trim();
  if (rest.startsWith("$")) rest = rest.slice(1);
  const segments: Segment[] = [];
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === ".") {
      i++;
      if (rest[i] === "*") {
        segments.push({ wildcard: true });
        i++;
        continue;
      }
      const match = /^[^.[\]]+/.exec(rest.slice(i));
      if (!match) throw new PipelineError(`路径第 ${i + 1} 个字符附近缺少键名。`);
      segments.push({ key: match[0] });
      i += match[0].length;
    } else if (ch === "[") {
      const close = rest.indexOf("]", i);
      if (close < 0) throw new PipelineError("路径中的 [ 没有闭合。");
      const inner = rest.slice(i + 1, close).trim();
      if (inner === "*") segments.push({ wildcard: true });
      else if (/^-?\d+$/.test(inner)) segments.push({ index: Number(inner) });
      else if (/^(["']).*\1$/.test(inner)) segments.push({ key: inner.slice(1, -1) });
      else throw new PipelineError(`不支持的路径片段 [${inner}]。`);
      i = close + 1;
    } else if (i === 0) {
      const match = /^[^.[\]]+/.exec(rest);
      segments.push({ key: match![0] });
      i += match![0].length;
    } else throw new PipelineError(`路径第 ${i + 1} 个字符无效。`);
  }
  return segments;
}

/** 按路径取值；遇到 [*] 时结果展开为数组，缺失的项跳过。 */
export function pickPath(value: JsonValue, path: string): JsonValue {
  const segments = parsePath(path);
  let current: JsonValue[] = [value];
  let spread = false;
  for (const segment of segments) {
    const next: JsonValue[] = [];
    for (const item of current) {
      if ("wildcard" in segment) {
        if (Array.isArray(item)) next.push(...item);
        else if (item !== null && typeof item === "object") next.push(...Object.values(item));
      } else if ("index" in segment) {
        if (Array.isArray(item)) {
          const at = segment.index < 0 ? item.length + segment.index : segment.index;
          if (at >= 0 && at < item.length) next.push(item[at]);
        }
      } else if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        if (Object.prototype.hasOwnProperty.call(item, segment.key)) next.push(item[segment.key]);
      } else if (Array.isArray(item) && spread) {
        // 已展开后对数组的键访问：逐项取
        for (const inner of item)
          if (inner !== null && typeof inner === "object" && !Array.isArray(inner) && segment.key in inner)
            next.push(inner[segment.key]);
      }
    }
    if ("wildcard" in segment) spread = true;
    current = next;
  }
  if (spread) return current;
  if (!current.length) throw new PipelineError(`路径 ${path || "$"} 没有匹配到值。`);
  return current[0];
}
