// ABOUTME: 规格原文的语法层：YAML/JSON 解析、行列定位与 JSON Pointer 解析。
import { isMap, isPair, isScalar, isSeq, parseDocument, type Document, type Node as YamlNode } from "yaml";
import { locateJsonError } from "./json-locate.ts";

export type SpecFormat = "yaml" | "json";
export type Severity = "error" | "warning";
export interface Diagnostic {
  severity: Severity;
  message: string;
  line?: number;
  column?: number;
  pointer?: string;
}
export type Pointer = (string | number)[];
export interface Locator {
  (pointer: Pointer, key?: boolean): { line?: number; column?: number };
}
export type Add = (diagnostic: Diagnostic) => void;
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index++)
    if (text.charCodeAt(index) === 10) starts.push(index + 1);
  return starts;
}
function position(starts: number[], offset: number) {
  let low = 0,
    high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (starts[middle] <= offset) low = middle;
    else high = middle - 1;
  }
  return { line: low + 1, column: offset - starts[low] + 1 };
}

const YAML_CODES: Record<string, string> = {
  BAD_INDENT: "缩进不一致",
  TAB_AS_INDENT: "YAML 不能使用 Tab 缩进",
  DUPLICATE_KEY: "同一层级出现重复的键",
  MULTIPLE_DOCS: "只支持一个 YAML 文档（发现多个 ---）",
  MISSING_CHAR: "缺少必要的符号",
  BLOCK_AS_IMPLICIT_KEY: "键的位置写入了多行内容",
  MULTILINE_IMPLICIT_KEY: "隐式键不能跨行",
  UNEXPECTED_TOKEN: "出现意外的符号",
  BAD_ALIAS: "别名引用无效",
  BAD_SCALAR_START: "值的开头字符无效",
  TAG_RESOLVE_FAILED: "无法识别的 YAML 标签",
  ALIAS_PROPS: "别名不能带锚点或标签",
  BLOCK_IN_FLOW: "[ ] 或 { } 内不能换行写块结构，可能缺少右括号",
  BAD_DQ_ESCAPE: "双引号字符串中的转义无效",
  KEY_OVER_1024_CHARS: "键超过 1024 个字符",
};

export function makeLocator(doc: Document | null, starts: number[]): Locator {
  return (pointer, key = true) => {
    if (!doc) return {};
    let node: unknown = doc.contents;
    let offset: number | undefined = (node as YamlNode | null)?.range?.[0];
    for (const segment of pointer) {
      if (isMap(node)) {
        const pair = node.items.find(
          (item) =>
            isPair(item) &&
            isScalar(item.key) &&
            String(item.key.value) === String(segment),
        );
        if (!pair) break;
        const keyNode = pair.key as YamlNode;
        offset =
          key && segment === pointer[pointer.length - 1]
            ? keyNode.range?.[0]
            : ((pair.value as YamlNode | null)?.range?.[0] ?? keyNode.range?.[0]);
        node = pair.value;
      } else if (isSeq(node) && typeof segment === "number") {
        const item = node.items[segment] as YamlNode | undefined;
        if (!item) break;
        offset = item.range?.[0];
        node = item;
      } else break;
    }
    return offset === undefined ? {} : position(starts, offset);
  };
}

function decodePointer(ref: string): string[] {
  return ref
    .slice(2)
    .split("/")
    .filter((part, index, parts) => part !== "" || index < parts.length - 1)
    .map((part) => decodeURIComponent(part).replace(/~1/g, "/").replace(/~0/g, "~"));
}
export function resolvePointer(root: unknown, ref: string): unknown {
  if (ref === "#") return root;
  let node: unknown = root;
  for (const part of decodePointer(ref)) {
    if (Array.isArray(node)) node = node[Number(part)];
    else if (isObject(node) && Object.prototype.hasOwnProperty.call(node, part))
      node = node[part];
    else return undefined;
  }
  return node;
}

export function syntax(
  text: string,
  format: SpecFormat,
  starts: number[],
): { value: unknown; doc: Document | null; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  if (format === "json") {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      const error = locateJsonError(text);
      diagnostics.push({
        severity: "error",
        message: "JSON 语法：" + error.message + "。",
        ...position(starts, error.offset),
      });
      return { value: undefined, doc: null, diagnostics };
    }
    let doc: Document | null = null;
    try {
      doc = parseDocument(text, { uniqueKeys: false, prettyErrors: false });
      if (doc.errors.length) doc = null;
    } catch {
      doc = null;
    }
    return { value, doc, diagnostics };
  }
  let doc: Document;
  try {
    doc = parseDocument(text, {
      prettyErrors: false,
      uniqueKeys: true,
    });
  } catch (error) {
    diagnostics.push({
      severity: "error",
      message: "YAML 语法：" + (error instanceof Error ? error.message : "无法解析"),
      line: 1,
      column: 1,
    });
    return { value: undefined, doc: null, diagnostics };
  }
  // 一个缺括号会连锁产生大量错误：同一行只报一次，按行列出最靠前的 8 处。
  const byLine = new Map<number, Diagnostic>();
  // 文件末尾才发现的错误（缺右括号等）指向最后一行内容，而不是末尾空行。
  const lastContent = Math.max(0, text.trimEnd().length - 1);
  for (const error of doc.errors) {
    const at = position(starts, Math.min(error.pos[0], lastContent));
    if (byLine.has(at.line)) continue;
    byLine.set(at.line, {
      severity: "error",
      message:
        "YAML 语法：" +
        (/end with an? \]/.test(error.message)
          ? "前面的 [ 没有用 ] 结束，或续行缩进不足。"
          : /end with an? \}/.test(error.message)
            ? "前面的 { 没有用 } 结束，或续行缩进不足。"
            : YAML_CODES[error.code]
              ? YAML_CODES[error.code] + "。"
              : error.message),
      ...at,
    });
  }
  diagnostics.push(...[...byLine.values()].sort((a, b) => (a.line ?? 0) - (b.line ?? 0)).slice(0, 8));
  for (const warning of doc.warnings)
    diagnostics.push({
      severity: "warning",
      message: "YAML：" + (YAML_CODES[warning.code] ?? warning.message),
      ...position(starts, warning.pos[0]),
    });
  if (doc.errors.length) return { value: undefined, doc, diagnostics };
  try {
    return { value: doc.toJS({ maxAliasCount: 200 }), doc, diagnostics };
  } catch (error) {
    diagnostics.push({
      severity: "error",
      message:
        "YAML 无法展开：" +
        (error instanceof Error ? error.message : "别名引用过多或循环"),
      line: 1,
      column: 1,
    });
    return { value: undefined, doc, diagnostics };
  }
}
