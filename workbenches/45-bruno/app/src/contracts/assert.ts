// Declarative Bruno `assert` evaluation. Expressions are parsed as a property
// path on `res`; nothing is evaluated as JavaScript.
import type { AssertionResult, Row } from "./bruno.ts";

export interface ResponseView {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  responseTime: number;
}

export const UNARY = [
  "isEmpty",
  "isNotEmpty",
  "isNull",
  "isUndefined",
  "isDefined",
  "isTruthy",
  "isFalsy",
  "isJson",
  "isNumber",
  "isString",
  "isBoolean",
  "isArray",
] as const;
export const BINARY = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "notIn",
  "contains",
  "notContains",
  "length",
  "matches",
  "notMatches",
  "startsWith",
  "endsWith",
  "between",
] as const;

export function parseOperator(raw: string): { operator: string; value: string } {
  const text = raw.trim();
  const space = text.indexOf(" ");
  const head = space < 0 ? text : text.slice(0, space);
  const rest = space < 0 ? "" : text.slice(space + 1).trim();
  if ((UNARY as readonly string[]).includes(head)) return { operator: head, value: "" };
  if ((BINARY as readonly string[]).includes(head)) return { operator: head, value: rest };
  return { operator: "eq", value: text };
}

function pathTokens(expr: string): (string | number)[] {
  const text = expr.trim();
  if (!/^res(\b|$)/.test(text)) throw new Error("表达式需以 res 开头，例如 res.status 或 res.body.items[0].id");
  const tokens: (string | number)[] = [];
  let i = 3;
  while (i < text.length) {
    const c = text[i];
    if (c === ".") {
      const m = /^[A-Za-z_$][\w$-]*/.exec(text.slice(i + 1));
      if (!m) throw new Error(`无法解析表达式：${expr}`);
      tokens.push(m[0]);
      i += 1 + m[0].length;
    } else if (c === "[") {
      const m = /^\[\s*(?:(\d+)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\]/.exec(text.slice(i));
      if (!m) throw new Error(`无法解析表达式：${expr}`);
      tokens.push(m[1] !== undefined ? Number(m[1]) : (m[2] ?? m[3]));
      i += m[0].length;
    } else throw new Error(`不支持的表达式：${expr}（只支持属性路径，不执行 JavaScript）`);
  }
  return tokens;
}

export function evaluatePath(expr: string, res: ResponseView): unknown {
  const tokens = pathTokens(expr);
  let current: unknown = res;
  for (const [index, token] of tokens.entries()) {
    if (current === null || current === undefined) return undefined;
    if (index === 1 && tokens[0] === "headers" && typeof token === "string") {
      current = (current as Record<string, unknown>)[token.toLowerCase()];
      continue;
    }
    if (typeof current === "string" || Array.isArray(current)) {
      if (token === "length") current = current.length;
      else if (typeof token === "number") current = current[token];
      else return undefined;
      continue;
    }
    if (typeof current !== "object") return undefined;
    const record = current as Record<string, unknown>;
    current = Object.prototype.hasOwnProperty.call(record, token) ? record[token] : undefined;
  }
  return current;
}

export function literal(raw: string): unknown {
  const v = raw.trim();
  if (/^"(?:[^"\\]|\\.)*"$/.test(v)) return JSON.parse(v);
  if (/^'.*'$/.test(v)) return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (v === "undefined") return undefined;
  if (v !== "" && /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(v)) return Number(v);
  if (/^[[{]/.test(v))
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  return v;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a),
    kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

const show = (v: unknown) => {
  if (v === undefined) return "undefined";
  const s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v);
  return s.length > 240 ? s.slice(0, 237) + "…" : s;
};
const list = (v: string) =>
  v
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((x) => literal(x));

export function compare(operator: string, actual: unknown, rawExpected: string): boolean {
  const expected = literal(rawExpected);
  const num = (x: unknown) => (typeof x === "number" ? x : Number(x));
  switch (operator) {
    case "eq":
      return deepEqual(actual, expected);
    case "neq":
      return !deepEqual(actual, expected);
    case "gt":
      return num(actual) > num(expected);
    case "gte":
      return num(actual) >= num(expected);
    case "lt":
      return num(actual) < num(expected);
    case "lte":
      return num(actual) <= num(expected);
    case "in":
      return list(rawExpected).some((x) => deepEqual(actual, x));
    case "notIn":
      return !list(rawExpected).some((x) => deepEqual(actual, x));
    case "contains":
    case "notContains": {
      const has =
        typeof actual === "string"
          ? actual.includes(String(expected))
          : Array.isArray(actual)
            ? actual.some((x) => deepEqual(x, expected))
            : false;
      return operator === "contains" ? has : !has;
    }
    case "length":
      return (
        (typeof actual === "string" || Array.isArray(actual)) &&
        actual.length === num(expected)
      );
    case "matches":
    case "notMatches": {
      const pattern = new RegExp(rawExpected.trim().replace(/^\/(.*)\/$/, "$1"));
      const ok = pattern.test(typeof actual === "string" ? actual : JSON.stringify(actual));
      return operator === "matches" ? ok : !ok;
    }
    case "startsWith":
      return typeof actual === "string" && actual.startsWith(String(expected));
    case "endsWith":
      return typeof actual === "string" && actual.endsWith(String(expected));
    case "between": {
      const [lo, hi] = list(rawExpected).map(num);
      return num(actual) >= lo && num(actual) <= hi;
    }
    case "isEmpty":
    case "isNotEmpty": {
      const empty =
        actual === "" ||
        actual === null ||
        actual === undefined ||
        (Array.isArray(actual) && actual.length === 0) ||
        (typeof actual === "object" && actual !== null && Object.keys(actual).length === 0);
      return operator === "isEmpty" ? empty : !empty;
    }
    case "isNull":
      return actual === null;
    case "isUndefined":
      return actual === undefined;
    case "isDefined":
      return actual !== undefined;
    case "isTruthy":
      return Boolean(actual);
    case "isFalsy":
      return !actual;
    case "isJson":
      return typeof actual === "object" && actual !== null;
    case "isNumber":
      return typeof actual === "number" && Number.isFinite(actual);
    case "isString":
      return typeof actual === "string";
    case "isBoolean":
      return typeof actual === "boolean";
    case "isArray":
      return Array.isArray(actual);
    default:
      throw new Error(`未知断言操作符 ${operator}`);
  }
}

export function runAssertions(
  rows: Row[],
  res: ResponseView,
  interpolate: (text: string) => string = (t) => t,
): AssertionResult[] {
  return rows
    .filter((r) => r.enabled && r.name.trim())
    .map((row) => {
      const { operator, value } = parseOperator(row.value);
      const expected = interpolate(value);
      try {
        const actual = evaluatePath(row.name, res);
        return {
          name: row.name,
          operator,
          expected,
          actual: show(actual),
          passed: compare(operator, actual, expected),
        };
      } catch (e) {
        return {
          name: row.name,
          operator,
          expected,
          actual: "—",
          passed: false,
          error: e instanceof Error ? e.message : "无法评估",
        };
      }
    });
}
