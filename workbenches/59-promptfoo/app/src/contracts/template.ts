// ABOUTME: Promptfoo 提示模板的安全子集渲染（Nunjucks 语法）：变量、点路径、常用过滤器、if/for。
// 不执行任意代码；只读取普通对象/数组/字符串的自有属性，不支持的语法明确报错。

export class TemplateError extends Error {}

type Value = unknown;
type Node =
  | { t: "text"; v: string }
  | { t: "out"; e: Expr }
  | { t: "if"; branches: { cond: Expr | null; body: Node[] }[] }
  | { t: "for"; names: string[]; e: Expr; body: Node[]; empty: Node[] };
type Expr =
  | { k: "lit"; v: Value }
  | { k: "var"; name: string }
  | { k: "get"; obj: Expr; key: Expr }
  | { k: "filter"; e: Expr; name: string; args: Expr[] }
  | { k: "not"; e: Expr }
  | { k: "bin"; op: string; a: Expr; b: Expr }
  | { k: "list"; items: Expr[] };

const blocked = new Set(["__proto__", "constructor", "prototype", "__defineGetter__", "__lookupGetter__"]);
const MAX_OUTPUT = 400_000;

function lex(src: string) {
  const parts: { kind: "text" | "out" | "tag"; v: string; at: number }[] = [];
  let i = 0;
  while (i < src.length) {
    const next = src.slice(i).search(/\{[{%#]/);
    if (next === -1) {
      parts.push({ kind: "text", v: src.slice(i), at: i });
      break;
    }
    if (next > 0) parts.push({ kind: "text", v: src.slice(i, i + next), at: i });
    const start = i + next,
      open = src[start + 1],
      close = open === "{" ? "}}" : open === "%" ? "%}" : "#}";
    const end = src.indexOf(close, start + 2);
    if (end === -1) throw new TemplateError(`模板第 ${lineOf(src, start)} 行的 {${open} 没有闭合。`);
    let inner = src.slice(start + 2, end);
    let trimLeft = false,
      trimRight = false;
    if (inner.startsWith("-")) {
      trimLeft = true;
      inner = inner.slice(1);
    }
    if (inner.endsWith("-")) {
      trimRight = true;
      inner = inner.slice(0, -1);
    }
    if (trimLeft && parts.length && parts[parts.length - 1].kind === "text")
      parts[parts.length - 1].v = parts[parts.length - 1].v.replace(/\s+$/, "");
    if (open !== "#") parts.push({ kind: open === "{" ? "out" : "tag", v: inner.trim(), at: start });
    i = end + 2;
    if (trimRight) while (i < src.length && /\s/.test(src[i])) i++;
  }
  return parts;
}
function lineOf(src: string, at: number) {
  return src.slice(0, at).split("\n").length;
}

const tokenRe =
  /\s*(?:(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(==|!=|<=|>=|[<>|.()[\],])|([A-Za-z_][A-Za-z0-9_]*))/y;
function tokens(src: string) {
  const out: string[] = [];
  tokenRe.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    tokenRe.lastIndex = pos;
    const m = tokenRe.exec(src);
    if (!m) throw new TemplateError(`无法解析模板表达式“${src}”。`);
    out.push(m[0].trim());
    pos = tokenRe.lastIndex;
  }
  return out;
}

class Parser {
  i = 0;
  t: string[];
  src: string;
  constructor(t: string[], src: string) {
    this.t = t;
    this.src = src;
  }
  peek() {
    return this.t[this.i];
  }
  eat(v?: string) {
    const x = this.t[this.i];
    if (v !== undefined && x !== v) throw new TemplateError(`模板表达式“${this.src}”需要“${v}”。`);
    this.i++;
    return x;
  }
  done() {
    return this.i >= this.t.length;
  }
  expr(): Expr {
    return this.or();
  }
  or(): Expr {
    let a = this.and();
    while (this.peek() === "or") {
      this.eat();
      a = { k: "bin", op: "or", a, b: this.and() };
    }
    return a;
  }
  and(): Expr {
    let a = this.not();
    while (this.peek() === "and") {
      this.eat();
      a = { k: "bin", op: "and", a, b: this.not() };
    }
    return a;
  }
  not(): Expr {
    if (this.peek() === "not") {
      this.eat();
      return { k: "not", e: this.not() };
    }
    return this.cmp();
  }
  cmp(): Expr {
    const a = this.postfix();
    const op = this.peek();
    if (["==", "!=", "<", ">", "<=", ">=", "in"].includes(op ?? "")) {
      this.eat();
      return { k: "bin", op: op!, a, b: this.postfix() };
    }
    if (op === "not" && this.t[this.i + 1] === "in") {
      this.eat();
      this.eat();
      return { k: "not", e: { k: "bin", op: "in", a, b: this.postfix() } };
    }
    return a;
  }
  postfix(): Expr {
    let e = this.primary();
    for (;;) {
      const p = this.peek();
      if (p === ".") {
        this.eat();
        const name = this.eat();
        if (!name || !/^[A-Za-z_0-9]+$/.test(name)) throw new TemplateError(`模板路径“${this.src}”无效。`);
        e = { k: "get", obj: e, key: { k: "lit", v: name } };
      } else if (p === "[") {
        this.eat();
        const key = this.expr();
        this.eat("]");
        e = { k: "get", obj: e, key };
      } else if (p === "|") {
        this.eat();
        const name = this.eat();
        const args: Expr[] = [];
        if (this.peek() === "(") {
          this.eat();
          while (this.peek() !== ")") {
            args.push(this.expr());
            if (this.peek() === ",") this.eat();
            else break;
          }
          this.eat(")");
        }
        e = { k: "filter", e, name, args };
      } else return e;
    }
  }
  primary(): Expr {
    const x = this.eat();
    if (x === undefined) throw new TemplateError(`模板表达式“${this.src}”不完整。`);
    if (/^\d/.test(x)) return { k: "lit", v: Number(x) };
    if (x[0] === '"' || x[0] === "'")
      return { k: "lit", v: x.slice(1, -1).replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c)) };
    if (x === "(") {
      const e = this.expr();
      this.eat(")");
      return e;
    }
    if (x === "[") {
      const items: Expr[] = [];
      while (this.peek() !== "]") {
        items.push(this.expr());
        if (this.peek() === ",") this.eat();
        else break;
      }
      this.eat("]");
      return { k: "list", items };
    }
    if (x === "true" || x === "True") return { k: "lit", v: true };
    if (x === "false" || x === "False") return { k: "lit", v: false };
    if (x === "none" || x === "None" || x === "null") return { k: "lit", v: null };
    if (/^[A-Za-z_]/.test(x)) return { k: "var", name: x };
    throw new TemplateError(`模板表达式“${this.src}”含有不支持的符号“${x}”。`);
  }
}
function parseExpr(src: string): Expr {
  const p = new Parser(tokens(src), src);
  const e = p.expr();
  if (!p.done()) throw new TemplateError(`模板表达式“${src}”含有多余内容。`);
  return e;
}

function parse(src: string): Node[] {
  const parts = lex(src);
  let i = 0;
  function block(ends: string[]): { nodes: Node[]; end: string } {
    const nodes: Node[] = [];
    while (i < parts.length) {
      const p = parts[i++];
      if (p.kind === "text") nodes.push({ t: "text", v: p.v });
      else if (p.kind === "out") nodes.push({ t: "out", e: parseExpr(p.v) });
      else {
        const [word] = p.v.split(/\s+/, 1);
        if (ends.includes(word)) return { nodes, end: p.v };
        if (word === "if") {
          const branches: { cond: Expr | null; body: Node[] }[] = [];
          let cond: Expr | null = parseExpr(p.v.slice(2));
          for (;;) {
            const r = block(["elif", "else", "endif"]);
            branches.push({ cond, body: r.nodes });
            const w = r.end.split(/\s+/, 1)[0];
            if (w === "endif") break;
            if (w === "elif") cond = parseExpr(r.end.slice(4));
            else {
              const tail = block(["endif"]);
              branches.push({ cond: null, body: tail.nodes });
              if (!tail.end.startsWith("endif")) throw new TemplateError("if 缺少 endif。");
              break;
            }
          }
          nodes.push({ t: "if", branches });
        } else if (word === "for") {
          const m = /^for\s+([A-Za-z_]\w*)(?:\s*,\s*([A-Za-z_]\w*))?\s+in\s+(.+)$/s.exec(p.v);
          if (!m) throw new TemplateError(`无法解析“{% ${p.v} %}”。`);
          const r = block(["else", "endfor"]);
          let empty: Node[] = [];
          if (r.end.startsWith("else")) {
            const tail = block(["endfor"]);
            empty = tail.nodes;
          }
          nodes.push({ t: "for", names: m[2] ? [m[1], m[2]] : [m[1]], e: parseExpr(m[3]), body: r.nodes, empty });
        } else if (word === "raw") {
          let text = "";
          while (i < parts.length && !(parts[i].kind === "tag" && parts[i].v === "endraw")) {
            const q = parts[i++];
            text += q.kind === "text" ? q.v : q.kind === "out" ? `{{ ${q.v} }}` : `{% ${q.v} %}`;
          }
          i++;
          nodes.push({ t: "text", v: text });
        } else throw new TemplateError(`不支持模板标签“{% ${word} %}”；可用 if/elif/else/for/raw。`);
      }
    }
    if (ends.length) throw new TemplateError(`模板缺少 {% ${ends[ends.length - 1]} %}。`);
    return { nodes, end: "" };
  }
  return block([]).nodes;
}

function own(obj: Value, key: Value): Value {
  if (obj === null || obj === undefined) return undefined;
  if (typeof key !== "string" && typeof key !== "number") return undefined;
  const k = String(key);
  if (blocked.has(k)) throw new TemplateError(`模板不能访问“${k}”。`);
  if (typeof obj === "string") return k === "length" ? obj.length : /^\d+$/.test(k) ? obj[Number(k)] : undefined;
  if (Array.isArray(obj)) return k === "length" ? obj.length : /^-?\d+$/.test(k) ? obj[Number(k)] : undefined;
  if (typeof obj === "object" && Object.hasOwn(obj as object, k)) return (obj as Record<string, Value>)[k];
  return undefined;
}
function truthy(v: Value) {
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}
export function display(v: Value): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(display).join(",");
  return "[object Object]";
}
const filters: Record<string, (v: Value, ...a: Value[]) => Value> = {
  upper: (v) => display(v).toUpperCase(),
  lower: (v) => display(v).toLowerCase(),
  capitalize: (v) => {
    const s = display(v);
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  },
  trim: (v) => display(v).trim(),
  dump: (v, indent) => JSON.stringify(v, null, typeof indent === "number" ? indent : undefined) ?? "",
  json: (v) => JSON.stringify(v) ?? "",
  tojson: (v) => JSON.stringify(v) ?? "",
  default: (v, d, boolean) => (boolean ? (truthy(v) ? v : d) : v === undefined || v === null ? d : v),
  d: (v, d) => (v === undefined || v === null ? d : v),
  join: (v, sep) => (Array.isArray(v) ? v.map(display).join(sep === undefined ? "" : display(sep)) : display(v)),
  length: (v) => (typeof v === "string" || Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0),
  first: (v) => (Array.isArray(v) ? v[0] : typeof v === "string" ? v[0] : undefined),
  last: (v) => (Array.isArray(v) ? v[v.length - 1] : typeof v === "string" ? v[v.length - 1] : undefined),
  replace: (v, a, b) => display(v).split(display(a)).join(display(b)),
  safe: (v) => v,
  string: (v) => display(v),
  int: (v) => Math.trunc(Number(v)) || 0,
  float: (v) => Number(v) || 0,
  round: (v, p) => {
    const f = 10 ** (typeof p === "number" ? p : 0);
    return Math.round(Number(v) * f) / f;
  },
  abs: (v) => Math.abs(Number(v)),
  escape: (v) =>
    display(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!),
  e: (v) => filters.escape(v),
  truncate: (v, n) => {
    const s = display(v),
      len = typeof n === "number" ? n : 255;
    return s.length > len ? s.slice(0, len) + "..." : s;
  },
  wordcount: (v) => display(v).trim().split(/\s+/).filter(Boolean).length,
  list: (v) => (Array.isArray(v) ? v : typeof v === "string" ? [...v] : []),
  sort: (v) => (Array.isArray(v) ? [...v].sort() : v),
  reverse: (v) => (Array.isArray(v) ? [...v].reverse() : [...display(v)].reverse().join("")),
  title: (v) => display(v).replace(/\b\w/g, (c) => c.toUpperCase()),
  nl2br: (v) => display(v).replace(/\n/g, "<br />\n"),
};
export const supportedFilters = Object.keys(filters);

function evaluate(e: Expr, scope: Record<string, Value>[]): Value {
  switch (e.k) {
    case "lit":
      return e.v;
    case "list":
      return e.items.map((x) => evaluate(x, scope));
    case "var": {
      if (blocked.has(e.name)) throw new TemplateError(`模板不能访问“${e.name}”。`);
      for (let i = scope.length - 1; i >= 0; i--) if (Object.hasOwn(scope[i], e.name)) return scope[i][e.name];
      return undefined;
    }
    case "get":
      return own(evaluate(e.obj, scope), evaluate(e.key, scope));
    case "not":
      return !truthy(evaluate(e.e, scope));
    case "filter": {
      const f = Object.hasOwn(filters, e.name) ? filters[e.name] : undefined;
      if (!f) throw new TemplateError(`不支持模板过滤器“${e.name}”。`);
      return f(evaluate(e.e, scope), ...e.args.map((a) => evaluate(a, scope)));
    }
    case "bin": {
      if (e.op === "and") return truthy(evaluate(e.a, scope)) && truthy(evaluate(e.b, scope));
      if (e.op === "or") {
        const a = evaluate(e.a, scope);
        return truthy(a) ? a : evaluate(e.b, scope);
      }
      const a = evaluate(e.a, scope),
        b = evaluate(e.b, scope);
      switch (e.op) {
        case "==":
          return a === b;
        case "!=":
          return a !== b;
        case "<":
          return (a as number) < (b as number);
        case ">":
          return (a as number) > (b as number);
        case "<=":
          return (a as number) <= (b as number);
        case ">=":
          return (a as number) >= (b as number);
        case "in":
          return Array.isArray(b)
            ? b.includes(a)
            : typeof b === "string"
              ? b.includes(display(a))
              : b && typeof b === "object"
                ? Object.hasOwn(b, display(a))
                : false;
      }
    }
  }
  throw new TemplateError("模板表达式无效。");
}

function run(nodes: Node[], scope: Record<string, Value>[], out: string[], size: { n: number }) {
  for (const n of nodes) {
    if (n.t === "text") push(out, n.v, size);
    else if (n.t === "out") push(out, display(evaluate(n.e, scope)), size);
    else if (n.t === "if") {
      for (const b of n.branches)
        if (b.cond === null || truthy(evaluate(b.cond, scope))) {
          run(b.body, scope, out, size);
          break;
        }
    } else {
      const src = evaluate(n.e, scope);
      const entries: Value[][] = Array.isArray(src)
        ? src.map((v) => [v])
        : src && typeof src === "object"
          ? Object.entries(src as object).map(([k, v]) => [k, v])
          : [];
      if (!entries.length) run(n.empty, scope, out, size);
      entries.slice(0, 5000).forEach((item, index) => {
        const frame: Record<string, Value> = {
          loop: { index: index + 1, index0: index, first: index === 0, last: index === entries.length - 1, length: entries.length },
        };
        if (n.names.length === 2) {
          frame[n.names[0]] = item.length === 2 ? item[0] : own(item[0], 0);
          frame[n.names[1]] = item.length === 2 ? item[1] : own(item[0], 1);
        } else frame[n.names[0]] = item.length === 2 ? [item[0], item[1]] : item[0];
        run(n.body, [...scope, frame], out, size);
      });
    }
  }
}
function push(out: string[], text: string, size: { n: number }) {
  size.n += text.length;
  if (size.n > MAX_OUTPUT) throw new TemplateError("渲染结果超过 400K 字符。");
  out.push(text);
}

const cache = new Map<string, Node[]>();
export function compileTemplate(src: string): Node[] {
  let nodes = cache.get(src);
  if (!nodes) {
    nodes = parse(src);
    if (cache.size > 500) cache.clear();
    cache.set(src, nodes);
  }
  return nodes;
}
export function renderTemplate(src: string, vars: Record<string, Value>): string {
  if (!/\{[{%#]/.test(src)) return src;
  const out: string[] = [];
  run(compileTemplate(src), [vars], out, { n: 0 });
  return out.join("");
}
/** 模板中引用的顶层变量名（用于检查用例是否提供）。 */
export function templateVariables(src: string): string[] {
  const names = new Set<string>();
  const locals = new Set<string>(["loop"]);
  const visitExpr = (e: Expr) => {
    if (e.k === "var") {
      if (!locals.has(e.name)) names.add(e.name);
    } else if (e.k === "get") {
      visitExpr(e.obj);
      visitExpr(e.key);
    } else if (e.k === "filter") {
      visitExpr(e.e);
      e.args.forEach(visitExpr);
    } else if (e.k === "not") visitExpr(e.e);
    else if (e.k === "bin") {
      visitExpr(e.a);
      visitExpr(e.b);
    } else if (e.k === "list") e.items.forEach(visitExpr);
  };
  const visit = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.t === "out") visitExpr(n.e);
      else if (n.t === "if")
        n.branches.forEach((b) => {
          if (b.cond) visitExpr(b.cond);
          visit(b.body);
        });
      else if (n.t === "for") {
        visitExpr(n.e);
        n.names.forEach((x) => locals.add(x));
        visit(n.body);
        visit(n.empty);
      }
    }
  };
  visit(compileTemplate(src));
  return [...names];
}
