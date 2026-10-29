// ABOUTME: 用 Vega-Lite 官方 JSON Schema 校验规格，并把 anyOf 分支产生的大量错误归纳成少数可定位的中文问题。
import { Validator, type OutputUnit } from "@cfworker/json-schema";
import { isRecord } from "./project.ts";

export interface SpecIssue {
  /** JSON Pointer（不含 #），例如 /encoding/x/type */
  pointer: string;
  message: string;
  /** 定位到属性名而不是属性值。 */
  atKey: boolean;
}
type Schema = Record<string, unknown>;

/**
 * 官方 schema 的定义名含有 <>|" 等字符，部分校验器无法按 URI 解析这些 $ref。
 * 这里把定义名改成安全名称并同步改写所有引用，语义不变。
 */
export function normalizeSchema(raw: unknown): Schema {
  if (!isRecord(raw) || !isRecord(raw.definitions)) throw new Error("Vega-Lite schema 格式无效。");
  const names = Object.keys(raw.definitions);
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const name of names) {
    let safe = name.replace(/[^A-Za-z0-9_.-]/g, "_");
    while (used.has(safe)) safe += "_";
    used.add(safe);
    map.set(name, safe);
  }
  const fix = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(fix);
    if (!isRecord(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "$ref" && typeof item === "string" && item.startsWith("#/definitions/")) {
        const target = map.get(decodeURIComponent(item.slice(14)));
        out[key] = "#/definitions/" + (target ?? item.slice(14));
      } else out[key] = fix(item);
    }
    return out;
  };
  const definitions: Record<string, unknown> = {};
  for (const name of names) definitions[map.get(name)!] = fix(raw.definitions[name]);
  const top = fix({ ...raw, definitions: undefined }) as Schema;
  delete top.definitions;
  return { ...top, definitions };
}

const STRUCTURAL = new Set([
  "$ref",
  "anyOf",
  "oneOf",
  "allOf",
  "properties",
  "items",
  // additionalProperties:false 的子错误不带分支路径，改用父级错误（含分支路径）表示未知属性。
  "false",
  "additionalItems",
  "patternProperties",
  "if",
  "then",
  "else",
  "propertyNames",
  "contains",
  "dependencies",
]);

interface Leaf {
  unit: OutputUnit;
  pointer: string;
  depth: number;
  /** 每个 anyOf/oneOf 分支在 keywordLocation 中的起止位置。 */
  cuts: { start: number; end: number }[];
}

const pointerDepth = (pointer: string) => (pointer ? pointer.split("/").length - 1 : 0);
const decodePart = (part: string) => part.replace(/~1/g, "/").replace(/~0/g, "~");
function instancePointer(location: string): string {
  const raw = location.replace(/^#/, "");
  // cfworker 对实例路径做 URI 编码，这里还原成普通 JSON Pointer。
  try {
    return raw
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");
  } catch {
    return raw;
  }
}
export function valueAt(root: unknown, pointer: string): unknown {
  let current = root;
  for (const part of pointer.split("/").slice(1)) {
    const key = decodePart(part);
    if (Array.isArray(current)) current = current[Number(key)];
    else if (isRecord(current)) current = current[key];
    else return undefined;
  }
  return current;
}

function problemKey(leaf: Leaf): string {
  const k = leaf.unit.keyword;
  const kind = k === "const" || k === "enum" || k === "type" ? "value" : k;
  return leaf.pointer + "|" + kind;
}
function choose(leaves: Leaf[], level: number): Leaf[] {
  const common = leaves.filter((leaf) => leaf.cuts.length <= level);
  const branching = leaves.filter((leaf) => leaf.cuts.length > level);
  if (!branching.length) return leaves;
  const byLocation = new Map<string, Leaf[]>();
  for (const leaf of branching) {
    const key = leaf.unit.keywordLocation.slice(0, leaf.cuts[level].start);
    byLocation.set(key, [...(byLocation.get(key) ?? []), leaf]);
  }
  const result = [...common];
  for (const group of byLocation.values()) {
    const byBranch = new Map<string, Leaf[]>();
    for (const leaf of group) {
      const key = leaf.unit.keywordLocation.slice(0, leaf.cuts[level].end);
      byBranch.set(key, [...(byBranch.get(key) ?? []), leaf]);
    }
    // 同一位置的取值类错误（const/enum/type）合并所有分支，列出全部可选值。
    const valueOnly = group.every(
      (leaf) => leaf.pointer === group[0].pointer && ["const", "enum", "type"].includes(leaf.unit.keyword),
    );
    if (valueOnly) {
      result.push(...group);
      continue;
    }
    let best: Leaf[][] = [],
      bestDepth = -1,
      bestProblems = Infinity;
    for (const branch of byBranch.values()) {
      const resolved = choose(branch, level + 1);
      const depth = Math.max(...resolved.map((leaf) => leaf.depth));
      const problems = new Set(resolved.map(problemKey)).size;
      if (depth > bestDepth || (depth === bestDepth && problems < bestProblems)) {
        best = [resolved];
        bestDepth = depth;
        bestProblems = problems;
      } else if (depth === bestDepth && problems === bestProblems) best.push(resolved);
    }
    // 并列的分支若都只是同一位置的取值错误（如 mark.type 在多个定义中各有一组可选值），合并列出全部可选值。
    const merged = best.flat();
    const sameValue =
      best.length > 1 &&
      merged.every((leaf) => leaf.pointer === merged[0].pointer && ["const", "enum", "type"].includes(leaf.unit.keyword));
    result.push(...(sameValue ? merged : best[0]));
  }
  return result;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = saved;
    }
  }
  return row[b.length];
}

const typeName: Record<string, string> = {
  string: "字符串",
  number: "数字",
  integer: "整数",
  boolean: "布尔值",
  object: "对象",
  array: "数组",
  null: "null",
};
const actualType = (value: unknown) =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const show = (value: unknown) => {
  const text = JSON.stringify(value);
  return text === undefined ? String(value) : text.length > 40 ? text.slice(0, 37) + "…" : text;
};

function quoteList(values: string[], limit = 14): string {
  const unique = [...new Set(values)];
  const head = unique.slice(0, limit).join("、");
  return unique.length > limit ? `${head} 等 ${unique.length} 项` : head;
}

export function createSpecChecker(schema: Schema) {
  const validator = new Validator(schema, "7", false);
  const vocabulary = new Set<string>();
  const collect = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (isRecord(value)) {
      if (isRecord(value.properties)) for (const key of Object.keys(value.properties)) vocabulary.add(key);
      Object.values(value).forEach(collect);
    }
  };
  collect(schema.definitions);
  const resolve = (location: string): unknown => {
    let node: unknown = schema;
    for (const raw of location.replace(/^#/, "").split("/").slice(1)) {
      if (!isRecord(node) && !Array.isArray(node)) return undefined;
      const seg = decodePart(decodeURIComponent(raw));
      if (seg === "$ref" && isRecord(node) && typeof node.$ref === "string")
        node = (schema.definitions as Record<string, unknown>)[node.$ref.replace("#/definitions/", "")];
      else node = Array.isArray(node) ? node[Number(seg)] : (node as Record<string, unknown>)[seg];
    }
    return node;
  };
  const suggest = (name: string, location: string) => {
    const parent = resolve(location.slice(0, location.lastIndexOf("/")));
    const words = isRecord(parent) && isRecord(parent.properties) ? Object.keys(parent.properties) : [...vocabulary];
    let best = "",
      score = 3;
    for (const word of words) {
      const d = editDistance(name.toLowerCase(), word.toLowerCase());
      if (d < score) {
        score = d;
        best = word;
      }
    }
    return score <= 2 && best !== name ? best : "";
  };

  return function check(spec: unknown): SpecIssue[] {
    const result = validator.validate(spec);
    if (result.valid) return [];
    const leaves: Leaf[] = [];
    for (const unit of result.errors) {
      if (STRUCTURAL.has(unit.keyword)) continue;
      let pointer = instancePointer(unit.instanceLocation);
      if (unit.keyword === "additionalProperties") {
        const name = /^Property "(.*)" does not match/.exec(unit.error)?.[1];
        if (name === undefined) continue;
        // 已在 properties 中声明但取值不合法的属性也会报 additionalProperties，这类不是未知属性。
        const parent = resolve(unit.keywordLocation.slice(0, unit.keywordLocation.lastIndexOf("/")));
        if (isRecord(parent) && isRecord(parent.properties) && name in parent.properties) continue;
        pointer += "/" + name.replace(/~/g, "~0").replace(/\//g, "~1");
      }
      const cuts: Leaf["cuts"] = [];
      const pattern = /\/(?:anyOf|oneOf)\/\d+/g;
      for (let m = pattern.exec(unit.keywordLocation); m; m = pattern.exec(unit.keywordLocation))
        cuts.push({ start: m.index, end: m.index + m[0].length });
      leaves.push({ unit, pointer, depth: pointerDepth(pointer), cuts });
    }
    if (!leaves.length)
      return [{ pointer: "", message: "规格不符合 Vega-Lite schema。", atKey: false }];
    const chosen = choose(leaves, 0);
    const groups = new Map<string, Leaf[]>();
    for (const leaf of chosen) groups.set(problemKey(leaf), [...(groups.get(problemKey(leaf)) ?? []), leaf]);
    const issues: (SpecIssue & { depth: number })[] = [];
    for (const group of groups.values()) {
      const { pointer, depth } = group[0];
      const keyword = group[0].unit.keyword;
      const actual = valueAt(spec, pointer);
      const name = decodePart(pointer.slice(pointer.lastIndexOf("/") + 1));
      let message: string;
      let atKey = false;
      if (keyword === "required") {
        const props = group.map((leaf) => /"([^"]+)"/.exec(leaf.unit.error)?.[1] ?? "?");
        message = `缺少必需属性 ${quoteList(props.map((p) => `"${p}"`), 6)}。`;
        atKey = true;
      } else if (keyword === "additionalProperties") {
        const hint = suggest(name, group[0].unit.keywordLocation);
        message = `不支持的属性 "${name}"。` + (hint ? `是否想写 "${hint}"？` : "请检查拼写或所在层级。");
        atKey = true;
      } else if (keyword === "const" || keyword === "enum" || keyword === "type") {
        const allowed: string[] = [];
        const types: string[] = [];
        for (const leaf of group) {
          if (leaf.unit.keyword === "const") {
            const m = /match (.+)\.$/.exec(leaf.unit.error);
            if (m) allowed.push(m[1]);
          } else if (leaf.unit.keyword === "enum") {
            const m = /any of (\[.*\])\.?$/.exec(leaf.unit.error);
            try {
              const list: unknown = m ? JSON.parse(m[1]) : [];
              if (Array.isArray(list)) allowed.push(...list.map((x) => JSON.stringify(x)));
            } catch {
              /* 保留其它信息 */
            }
          } else {
            const m = /Expected "([^"]+)"/.exec(leaf.unit.error);
            if (m) types.push(...m[1].split(/",\s*"/));
          }
        }
        const allowedTypes = [...new Set(types)].filter((t) => t !== "null" || types.length === 1);
        if (allowed.length && allowedTypes.length <= 1 && (allowedTypes[0] ?? "string") === actualType(actual))
          message = `取值 ${show(actual)} 无效，可选：${quoteList(allowed)}。`;
        else if (allowed.length)
          message = `取值 ${show(actual)} 无效。可选：${quoteList(allowed)}${allowedTypes.length ? `；或${allowedTypes.map((t) => typeName[t] ?? t).join("/")}` : ""}。`;
        else
          message = `类型应为${allowedTypes.map((t) => typeName[t] ?? t).join("或")}，实际是${typeName[actualType(actual)] ?? actualType(actual)}。`;
      } else if (keyword === "minimum" || keyword === "exclusiveMinimum") {
        message = `数值过小：${group[0].unit.error.replace(/^Instance /, "")}`;
      } else if (keyword === "maximum" || keyword === "exclusiveMaximum") {
        message = `数值过大：${group[0].unit.error.replace(/^Instance /, "")}`;
      } else if (keyword === "minItems" || keyword === "maxItems") {
        message = `数组长度不符合要求：${group[0].unit.error}`;
      } else message = group[0].unit.error;
      issues.push({ pointer, message, atKey, depth });
    }
    issues.sort((a, b) => b.depth - a.depth);
    return issues.slice(0, 8).map(({ pointer, message, atKey }) => ({ pointer, message, atKey }));
  };
}
export type SpecChecker = ReturnType<typeof createSpecChecker>;
