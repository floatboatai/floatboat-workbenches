// ABOUTME: 带位置信息的 JSON 解析：给出语法错误的行列，并把 JSON Pointer 映射到源码区间，用于规格诊断定位。

export interface Span {
  from: number;
  to: number;
}
export interface PointerSpan {
  key?: Span;
  value: Span;
}
export type JsonParse =
  | { ok: true; value: unknown; pointers: Map<string, PointerSpan> }
  | { ok: false; message: string; from: number; to: number };

export function lineColumn(text: string, pos: number): { line: number; column: number } {
  let line = 1,
    last = -1;
  for (let i = 0; i < pos && i < text.length; i++)
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  return { line, column: pos - last };
}

const escapePointer = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");
export const pointerOf = (path: (string | number)[]) =>
  path.map((part) => "/" + escapePointer(String(part))).join("");

class Failure extends Error {
  from: number;
  to: number;
  constructor(message: string, from: number, to: number) {
    super(message);
    this.from = from;
    this.to = to;
  }
}

export function parseJsonSource(text: string): JsonParse {
  const pointers = new Map<string, PointerSpan>();
  let i = 0;
  const n = text.length;
  const ws = () => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
  };
  const fail = (message: string, from = i, to = Math.min(n, from + 1)): never => {
    throw new Failure(message, from, Math.max(to, from));
  };
  const describe = () => (i >= n ? "文件结尾" : `“${text[i]}”`);
  function string(): string {
    const start = i;
    i++;
    let out = "";
    let chunk = i;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) {
        out += text.slice(chunk, i);
        i++;
        return out;
      }
      if (c === 92) {
        out += text.slice(chunk, i);
        const e = text[i + 1];
        const map: Record<string, string> = {
          '"': '"',
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t",
        };
        if (e === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("无效的 \\u 转义。", i, i + 6);
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else if (e !== undefined && e in map) {
          out += map[e];
          i += 2;
        } else fail("无效的转义字符。", i, i + 2);
        chunk = i;
        continue;
      }
      if (c < 32) fail("字符串中不能直接换行，请补上右引号。", start, i);
      i++;
    }
    return fail("字符串缺少右引号。", start, n);
  }
  function value(path: (string | number)[], depth: number, key?: Span): unknown {
    if (depth > 200) fail("嵌套层级过深。");
    ws();
    const start = i;
    const c = text[i];
    let result: unknown;
    if (c === "{") {
      i++;
      const object: Record<string, unknown> = {};
      ws();
      if (text[i] === "}") i++;
      else
        for (;;) {
          ws();
          if (text[i] !== '"')
            fail(
              text[i] === "}"
                ? "最后一个属性后面多了逗号。"
                : `这里需要用双引号包住的属性名，实际是${describe()}。`,
              text[i] === "}" ? Math.max(0, i - 1) : i,
            );
          const keyStart = i;
          const name = string();
          const keySpan = { from: keyStart, to: i };
          ws();
          if (text[i] !== ":") fail(`属性 "${name}" 后面需要冒号，实际是${describe()}。`);
          i++;
          Object.defineProperty(object, name, {
            value: value([...path, name], depth + 1, keySpan),
            enumerable: true,
            writable: true,
            configurable: true,
          });
          ws();
          if (text[i] === ",") {
            i++;
            continue;
          }
          if (text[i] === "}") {
            i++;
            break;
          }
          fail(`属性之间需要逗号或右花括号，实际是${describe()}。`);
        }
      result = object;
    } else if (c === "[") {
      i++;
      const array: unknown[] = [];
      ws();
      if (text[i] === "]") i++;
      else
        for (;;) {
          ws();
          if (text[i] === "]") fail("最后一项后面多了逗号。", Math.max(0, i - 1));
          array.push(value([...path, array.length], depth + 1));
          ws();
          if (text[i] === ",") {
            i++;
            continue;
          }
          if (text[i] === "]") {
            i++;
            break;
          }
          fail(`数组项之间需要逗号或右方括号，实际是${describe()}。`);
        }
      result = array;
    } else if (c === '"') result = string();
    else if (c === "-" || (c >= "0" && c <= "9")) {
      const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?/.exec(text.slice(i, i + 64));
      if (!match) fail("数字格式无效。");
      i += match![0].length;
      result = Number(match![0]);
    } else if (text.startsWith("true", i)) {
      i += 4;
      result = true;
    } else if (text.startsWith("false", i)) {
      i += 5;
      result = false;
    } else if (text.startsWith("null", i)) {
      i += 4;
      result = null;
    } else if (c === "'") fail("JSON 字符串需要使用双引号。");
    else if (i >= n) fail("JSON 不完整，缺少值或右括号。", Math.max(0, n - 1), n);
    else fail(`这里需要一个值，实际是${describe()}。`);
    pointers.set(pointerOf(path), { key, value: { from: start, to: i } });
    return result;
  }
  try {
    ws();
    if (i >= n) fail("规格为空，请输入 JSON 对象。", 0, 0);
    const result = value([], 0);
    ws();
    if (i < n) fail(`JSON 结束后还有多余内容：${describe()}。`);
    return { ok: true, value: result, pointers };
  } catch (error) {
    if (error instanceof Failure)
      return { ok: false, message: error.message, from: error.from, to: error.to };
    throw error;
  }
}

/** 找到 Pointer 对应的源码区间；不存在时回退到最近的父级。 */
export function locatePointer(
  pointers: Map<string, PointerSpan>,
  pointer: string,
  preferKey = false,
): Span {
  let current = pointer;
  for (;;) {
    const hit = pointers.get(current);
    if (hit) return preferKey && hit.key ? hit.key : hit.key && current !== pointer ? hit.key : hit.value;
    if (!current) return { from: 0, to: 1 };
    current = current.slice(0, current.lastIndexOf("/"));
  }
}
