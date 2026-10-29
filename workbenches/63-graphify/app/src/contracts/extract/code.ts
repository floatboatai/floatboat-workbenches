// ABOUTME: 代码符号抽取：定义、方法、导入、调用、继承与注释中的设计理由；只解析不执行。

import {
  GraphBuilder, scanSource, bracePairs, lineIndex, slug, RATIONALE, COMMON_CALLS,
  type GNode, type NodeKind, type Scanned,
} from "./builder.ts";

export type Def = {
  node: GNode;
  name: string;
  kind: NodeKind;
  start: number;
  end: number;
  parent: Def | null;
  bases: string[];
  topLevel: boolean;
};
export type ImportBinding = { module: string; path: string | null; name: string };
export type CodeFile = {
  path: string;
  language: string;
  text: string;
  fileNode: GNode;
  defs: Def[];
  imports: Map<string, ImportBinding>;
  importedFiles: { path: string | null; module: string; line: number }[];
  scanned: Scanned;
  lineOf: (offset: number) => number;
};

const stem = (path: string) => path.replace(/\.[^./]+$/, "");
const dirOf = (path: string) => path.split("/").slice(0, -1).join("/");
const base = (path: string) => path.split("/").pop() ?? path;

function joinPath(dir: string, rel: string) {
  const parts = dir ? dir.split("/") : [];
  for (const p of rel.split("/")) {
    if (!p || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return parts.join("/");
}

function addDef(
  b: GraphBuilder, file: CodeFile, name: string, kind: NodeKind, start: number, end: number,
  parent: Def | null, bases: string[] = [],
) {
  const qual = parent && (parent.kind === "class" || parent.kind === "interface") ? `${parent.name}_${name}` : name;
  const label =
    kind === "method" ? `.${name}()` : kind === "function" ? `${name}()` : name;
  const startLine = file.lineOf(start), endLine = file.lineOf(Math.max(start, end));
  const node = b.addNode(`${slug(stem(file.path))}_${slug(qual)}`, {
    label,
    kind,
    file_type: "code",
    language: file.language,
    source_file: file.path,
    source_location: `L${startLine}`,
    source_end: endLine,
    ...(kind === "function" || kind === "method" ? { _callable: true } : {}),
    ...(kind === "class" ? { _callable: true, _callable_class: true } : {}),
  });
  const def: Def = { node, name, kind, start, end, parent, bases, topLevel: !parent };
  file.defs.push(def);
  const container = parent ? parent.node.id : file.fileNode.id;
  b.addLink(container, node.id, parent && parent.kind === "class" && kind === "method" ? "method" : "contains",
    "EXTRACTED", 1, { source_file: file.path, line: startLine });
  return def;
}

// ---------- Python ----------
function parsePython(b: GraphBuilder, file: CodeFile) {
  const { code } = file.scanned;
  const rawLines = file.text.split("\n");
  const lines = code.split("\n");
  const offsets: number[] = [];
  let acc = 0;
  for (const l of lines) {
    offsets.push(acc);
    acc += l.length + 1;
  }
  const indentOf = (l: string) => {
    let n = 0;
    for (const c of l) {
      if (c === " ") n++;
      else if (c === "\t") n += 4;
      else break;
    }
    return n;
  };
  const stack: { indent: number; def: Def; lastLine: number }[] = [];
  const close = (indent: number) => {
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      const top = stack.pop()!;
      top.def.end = offsets[top.lastLine] + lines[top.lastLine].length;
      top.def.node.source_end = top.lastLine + 1;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    const indent = indentOf(l);
    close(indent);
    for (const s of stack) s.lastLine = i;
    const parent = stack.length ? stack[stack.length - 1].def : null;
    let m = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(l);
    let def: Def | null = null;
    if (m) {
      const kind: NodeKind = parent?.kind === "class" ? "method" : "function";
      def = addDef(b, file, m[1], kind, offsets[i] + l.indexOf(m[1]), offsets[i] + l.length, parent);
    } else if ((m = /^\s*class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*:/.exec(l))) {
      const bases = (m[2] ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x && !x.includes("="))
        .map((x) => x.replace(/\[.*$/, "").split(".").pop()!)
        .filter((x) => !["object", "ABC", "Protocol", "Generic", "Enum", "NamedTuple", "TypedDict"].includes(x));
      def = addDef(b, file, m[1], "class", offsets[i] + l.indexOf(m[1]), offsets[i] + l.length, parent, bases);
    }
    if (def) {
      // docstring：定义后的第一条语句
      let j = i + 1;
      while (j < rawLines.length && !rawLines[j].trim()) j++;
      const doc = /^\s*[rRuUbB]?("""|'''|"|')([\s\S]*)/.exec(rawLines[j] ?? "");
      if (doc) {
        let body = doc[2];
        const closing = body.indexOf(doc[1]);
        if (closing >= 0) body = body.slice(0, closing);
        else if (doc[1].length === 3) {
          let k = j + 1;
          while (k < rawLines.length && !rawLines[k].includes(doc[1]) && k < j + 30) {
            if (body.trim()) break;
            body = rawLines[k];
            k++;
          }
        }
        if (body.trim()) def.node.summary = body.trim().slice(0, 240);
      }
      stack.push({ indent, def, lastLine: i });
    }
  }
  close(-1);
  // imports
  const importRe = /^[ \t]*import[ \t]+([^\n]+)/gm;
  const fromRe = /^[ \t]*from[ \t]+(\.*[\w.]*)[ \t]+import[ \t]+(\([^)]*\)|[^\n]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(code))) {
    const line = file.lineOf(m.index);
    for (const part of m[1].split(",")) {
      const [mod, alias] = part.trim().split(/\s+as\s+/);
      if (!mod || !/^[\w.]+$/.test(mod)) continue;
      const target = resolvePythonModule(file.path, mod, 0);
      file.importedFiles.push({ path: target, module: mod, line });
      file.imports.set(alias ?? mod.split(".")[0], { module: mod, path: target, name: "" });
    }
  }
  while ((m = fromRe.exec(code))) {
    const line = file.lineOf(m.index);
    const dots = /^\.*/.exec(m[1])![0].length;
    const mod = m[1].slice(dots);
    const target = resolvePythonModule(file.path, mod, dots);
    const names = m[2].replace(/[()]/g, "").split(",").map((x) => x.trim()).filter(Boolean);
    let fileImported = false;
    for (const n of names) {
      const [name, alias] = n.split(/\s+as\s+/);
      if (!/^\w+$/.test(name)) continue;
      // `from pkg import module` 可能是子模块
      const sub = resolvePythonModule(file.path, mod ? `${mod}.${name}` : name, dots);
      if (sub && pythonExists(sub)) {
        file.importedFiles.push({ path: sub, module: `${"."
          .repeat(dots)}${mod ? mod + "." : ""}${name}`, line });
        file.imports.set(alias ?? name, { module: name, path: sub, name: "" });
      } else {
        if (!fileImported) {
          file.importedFiles.push({ path: target, module: "."
            .repeat(dots) + mod, line });
          fileImported = true;
        }
        file.imports.set(alias ?? name, { module: mod, path: target, name });
      }
    }
  }
}

let pythonFiles = new Set<string>();
const pythonExists = (p: string) => pythonFiles.has(p);
function resolvePythonModule(from: string, mod: string, dots: number): string | null {
  const rel = mod.replace(/\./g, "/");
  const candidates: string[] = [];
  if (dots > 0) {
    let dir = dirOf(from);
    for (let k = 1; k < dots; k++) dir = dirOf(dir);
    candidates.push(rel ? joinPath(dir, rel) : dir);
  } else {
    candidates.push(rel);
    // 同目录与上层目录下的包
    let dir = dirOf(from);
    while (dir) {
      candidates.push(joinPath(dir, rel));
      dir = dirOf(dir);
    }
  }
  for (const c of candidates) {
    if (!c) continue;
    for (const p of [`${c}.py`, `${c}/__init__.py`, `${c}.pyi`]) if (pythonFiles.has(p)) return p;
  }
  if (dots === 0) {
    for (const p of pythonFiles) if (p.endsWith(`/${rel}.py`) || p.endsWith(`/${rel}/__init__.py`)) return p;
  }
  return null;
}

// ---------- JavaScript / TypeScript 与花括号语言 ----------
const JS_DEFS: { re: RegExp; kind: NodeKind; bases?: (m: RegExpExecArray) => string[] }[] = [
  { re: /(?:^|[;\s])(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)\s*(?:<[^>{]*>)?\s*(?:extends\s+([A-Za-z_$][\w$.]*)(?:<[^>{]*>)?)?\s*(?:implements\s+([\w$.,\s<>]+?))?\s*\{/g,
    kind: "class", bases: (m) => [m[2], ...(m[3] ?? "").split(",")].filter(Boolean).map((x) => x.trim().replace(/<.*$/, "").split(".").pop()!) },
  { re: /(?:^|[;\s])(?:export\s+(?:default\s+)?)?(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)\s*(?:<[^>{]*>)?\s*(?:extends\s+([\w$.,\s<>]+?))?\s*\{/g,
    kind: "interface", bases: (m) => (m[2] ?? "").split(",").map((x) => x.trim().replace(/<.*$/, "")).filter(Boolean) },
  { re: /(?:^|[;\s])(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>(]*>)?\s*\(/g, kind: "function" },
  { re: /(?:^|[;\s])(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(?:async\s+)?(?:function\b|(?:<[^>]*>\s*)?\([^)]*\)\s*(?::[^=;{]+)?=>|[A-Za-z_$][\w$]*\s*=>)/g, kind: "function" },
  { re: /(?:^|[;\s])(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<[^>=]*>)?\s*=/g, kind: "type" },
  { re: /(?:^|[;\s])(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)\s*\{/g, kind: "enum" },
];
const GENERIC_DEFS: Record<string, { re: RegExp; kind: NodeKind; bases?: (m: RegExpExecArray) => string[] }[]> = {
  go: [
    { re: /^func\s+\(\s*\w+\s+\*?([A-Za-z_]\w*)\s*\)\s*([A-Za-z_]\w*)\s*\(/gm, kind: "method" },
    { re: /^func\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*\(/gm, kind: "function" },
    { re: /^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b/gm, kind: "class" },
  ],
  rust: [
    { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/gm, kind: "function" },
    { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)/gm, kind: "class" },
  ],
  java: [
    { re: /(?:^|\s)(?:public|private|protected|abstract|final|static|\s)*\s*(?:class|interface|enum|record)\s+([A-Za-z_]\w*)(?:<[^>{]*>)?(?:\s+extends\s+([\w.]+))?/g, kind: "class", bases: (m) => (m[2] ? [m[2].split(".").pop()!] : []) },
    { re: /^\s*(?:@\w+\s+)*(?:public|private|protected|static|final|synchronized|abstract|\s)+[\w<>\[\],\s]+\s+([a-z_]\w*)\s*\([^;{)]*\)\s*(?:throws\s+[\w.,\s]+)?\{/gm, kind: "method" },
  ],
  csharp: [
    { re: /(?:^|\s)(?:public|private|internal|protected|abstract|sealed|static|partial|\s)*\s*(?:class|interface|struct|record|enum)\s+([A-Za-z_]\w*)(?:<[^>{]*>)?(?:\s*:\s*([\w.]+))?/g, kind: "class", bases: (m) => (m[2] ? [m[2].split(".").pop()!] : []) },
    { re: /^\s*(?:\[[^\]]*\]\s*)*(?:public|private|protected|internal|static|async|override|virtual|\s)+[\w<>\[\],?\s]+\s+([A-Z]\w*)\s*\([^;{)]*\)\s*\{/gm, kind: "method" },
  ],
  kotlin: [
    { re: /(?:^|\s)(?:data\s+|sealed\s+|open\s+|abstract\s+)?(?:class|interface|object)\s+([A-Za-z_]\w*)/g, kind: "class" },
    { re: /(?:^|\s)fun\s+(?:<[^>]*>\s*)?(?:[\w.]+\.)?([A-Za-z_]\w*)\s*\(/g, kind: "function" },
  ],
  swift: [
    { re: /(?:^|\s)(?:class|struct|protocol|enum|actor)\s+([A-Za-z_]\w*)/g, kind: "class" },
    { re: /(?:^|\s)func\s+([A-Za-z_]\w*)/g, kind: "function" },
  ],
  scala: [
    { re: /(?:^|\s)(?:case\s+)?(?:class|trait|object)\s+([A-Za-z_]\w*)/g, kind: "class" },
    { re: /(?:^|\s)def\s+([A-Za-z_]\w*)/g, kind: "function" },
  ],
  c: [{ re: /^[A-Za-z_][\w\s\*]*?\b([A-Za-z_]\w*)\s*\([^;{)]*\)\s*\{/gm, kind: "function" }, { re: /^\s*(?:typedef\s+)?struct\s+([A-Za-z_]\w*)\s*\{/gm, kind: "class" }],
  cpp: [{ re: /^\s*(?:class|struct)\s+([A-Za-z_]\w*)[^;{]*\{/gm, kind: "class" }, { re: /^[A-Za-z_][\w\s\*&:<>,]*?\b([A-Za-z_]\w*)\s*\([^;{)]*\)\s*(?:const\s*)?\{/gm, kind: "function" }],
  php: [{ re: /(?:^|\s)(?:abstract\s+|final\s+)?(?:class|interface|trait)\s+([A-Za-z_]\w*)(?:\s+extends\s+(\w+))?/g, kind: "class", bases: (m) => (m[2] ? [m[2]] : []) }, { re: /(?:^|\s)function\s+([A-Za-z_]\w*)\s*\(/g, kind: "function" }],
  dart: [{ re: /(?:^|\s)(?:abstract\s+)?class\s+([A-Za-z_]\w*)(?:\s+extends\s+(\w+))?/g, kind: "class", bases: (m) => (m[2] ? [m[2]] : []) }],
  lua: [{ re: /(?:^|\s)(?:local\s+)?function\s+([\w.:]+)\s*\(/g, kind: "function" }],
  shell: [{ re: /^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\)\s*\{/gm, kind: "function" }],
  ruby: [{ re: /^\s*class\s+([A-Z]\w*)(?:\s*<\s*([\w:]+))?/gm, kind: "class", bases: (m) => (m[2] ? [m[2].split("::").pop()!] : []) }, { re: /^\s*def\s+(?:self\.)?([a-z_]\w*[?!]?)/gm, kind: "function" }],
  sql: [{ re: /create\s+(?:or\s+replace\s+)?(?:table|view|function|procedure)\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi, kind: "type" }],
};
const METHOD_RE = /(?:^|[;{}\n])\s*(?:(?:public|private|protected|static|readonly|async|override|abstract|get|set|declare)\s+)*\*?\s*(#?[A-Za-z_$][\w$]*)\s*(?:<[^>(]*>)?\s*\([^)]*\)\s*(?::\s*[^{;=]+)?\{/g;
const ARROW_PROP_RE = /(?:^|[;{}\n])\s*(?:(?:public|private|protected|static|readonly)\s+)*([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(?:async\s+)?\([^)]*\)\s*(?::[^=;{]+)?=>/g;
const NOT_METHODS = new Set(["if", "for", "while", "switch", "catch", "function", "return", "with", "else", "do", "try"]);

function parseBraced(b: GraphBuilder, file: CodeFile) {
  const { code } = file.scanned;
  const pairs = bracePairs(code);
  const nextBrace = (from: number) => {
    // 函数签名之后的第一个 {（跳过括号内容）
    let depth = 0;
    for (let i = from; i < code.length && i < from + 2000; i++) {
      const c = code[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "{" && depth <= 0) return i;
      else if (c === ";" && depth <= 0) return -1;
      else if (c === "=" && code[i + 1] === ">" && depth <= 0) {
        let k = i + 2;
        while (/\s/.test(code[k] ?? "")) k++;
        if (code[k] === "{") return k;
        return -(k + 1);
      }
    }
    return -1;
  };
  const statementEnd = (from: number) => {
    let depth = 0;
    for (let i = from; i < code.length; i++) {
      const c = code[i];
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) {
        if (depth === 0) return i;
        depth--;
      } else if ((c === ";" || c === "\n") && depth === 0 && c === ";") return i;
      else if (c === "\n" && depth === 0 && !/[,(+\-*&|?:.]\s*$/.test(code.slice(Math.max(from, i - 3), i))) return i;
    }
    return code.length;
  };
  const table = file.language === "javascript" || file.language === "typescript" ? JS_DEFS : GENERIC_DEFS[file.language] ?? [];
  type Raw = { name: string; kind: NodeKind; start: number; end: number; bases: string[]; receiver?: string };
  const raw: Raw[] = [];
  for (const def of table) {
    def.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = def.re.exec(code))) {
      let name = m[1], receiver: string | undefined;
      if (file.language === "go" && def.kind === "method") {
        receiver = m[1];
        name = m[2];
      }
      const nameAt = m.index + m[0].lastIndexOf(name, m[0].length);
      const at = code.indexOf(name, m.index) >= 0 ? code.indexOf(name, m.index) : nameAt;
      const brace = def.kind === "type" ? -1 : nextBrace(at + name.length);
      let end: number;
      if (brace >= 0) end = pairs.get(brace) ?? code.length;
      else if (brace < -1) end = statementEnd(-brace - 1);
      else end = statementEnd(at);
      raw.push({ name, kind: def.kind, start: at, end, bases: def.bases?.(m) ?? [], receiver });
    }
  }
  raw.sort((a, b2) => a.start - b2.start || b2.end - a.end);
  const seen = new Set<number>();
  const defs: Def[] = [];
  const parentOf = (start: number, end: number) => {
    let best: Def | null = null;
    for (const d of defs) if (d.start < start && d.end >= end && (!best || d.start > best.start)) best = d;
    return best;
  };
  for (const r of raw) {
    if (seen.has(r.start)) continue;
    seen.add(r.start);
    let parent = parentOf(r.start, r.end);
    if (r.receiver) parent = defs.find((d) => d.name === r.receiver && d.kind === "class") ?? null;
    // 方法嵌在函数里的局部函数仍标为 function；类体内的直接函数为 method
    const kind: NodeKind = r.kind === "function" && parent?.kind === "class" ? "method" : r.kind;
    defs.push(addDef(b, file, r.name, kind, r.start, r.end, parent, r.bases));
  }
  // 类方法
  if (file.language === "javascript" || file.language === "typescript") {
    for (const cls of defs.filter((d) => d.kind === "class")) {
      const open = code.indexOf("{", cls.start);
      if (open < 0) continue;
      const close = pairs.get(open) ?? cls.end;
      const body = code.slice(open + 1, close);
      for (const re of [METHOD_RE, ARROW_PROP_RE]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(body))) {
          const name = m[1];
          if (NOT_METHODS.has(name)) continue;
          const at = open + 1 + m.index + m[0].indexOf(name);
          // 只要类体第一层
          let depth = 0;
          for (let i = open + 1; i < at; i++) {
            if (code[i] === "{") depth++;
            else if (code[i] === "}") depth--;
          }
          if (depth !== 0 || seen.has(at)) continue;
          seen.add(at);
          const brace = nextBrace(at + name.length);
          const end = brace >= 0 ? pairs.get(brace) ?? close : brace < -1 ? statementEnd(-brace - 1) : at + name.length;
          defs.push(addDef(b, file, name.replace(/^#/, ""), "method", at, end, cls));
        }
      }
    }
  }
  // JSDoc / 前置注释摘要
  const commentsByLine = new Map(file.scanned.comments.map((c) => [c.line, c.text]));
  for (const d of file.defs) {
    const line = file.lineOf(d.start);
    const parts: string[] = [];
    for (let k = line - 1; k > 0 && k > line - 12; k--) {
      const t = commentsByLine.get(k);
      if (t === undefined) break;
      if (t && !t.startsWith("@") && !t.startsWith("eslint")) parts.unshift(t);
    }
    const summary = parts.join(" ").replace(/^\/?\*+\s*/, "").trim();
    if (summary) d.node.summary = summary.slice(0, 240);
  }
  // imports
  if (file.language === "javascript" || file.language === "typescript") {
    const text = file.scanned.noComments;
    const importRe = /\bimport\s+(?:type\s+)?([\w$*{}\s,]+?)\s+from\s+["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)|\bimport\(\s*["']([^"']+)["']\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(text))) {
      const spec = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6];
      const target = resolveJsModule(file.path, spec);
      file.importedFiles.push({ path: target, module: spec, line: file.lineOf(m.index) });
      const bindings = m[1];
      if (!bindings) continue;
      const named = /\{([^}]*)\}/.exec(bindings);
      const rest = bindings.replace(/\{[^}]*\}/, "").split(",").map((x) => x.trim()).filter(Boolean);
      for (const r of rest) {
        const ns = /^\*\s+as\s+([\w$]+)$/.exec(r);
        if (ns) file.imports.set(ns[1], { module: spec, path: target, name: "" });
        else if (/^[\w$]+$/.test(r)) file.imports.set(r, { module: spec, path: target, name: "default" });
      }
      for (const part of (named?.[1] ?? "").split(",")) {
        const [name, alias] = part.replace(/^\s*type\s+/, "").trim().split(/\s+as\s+/);
        if (name && /^[\w$]+$/.test(name)) file.imports.set(alias ?? name, { module: spec, path: target, name });
      }
    }
  } else {
    const text = file.scanned.noComments;
    const res: RegExp[] = {
      go: [/^\s*import\s+(?:\w+\s+)?"([^"]+)"/gm, /^\s+(?:\w+\s+)?"([^"]+)"\s*$/gm],
      java: [/^\s*import\s+(?:static\s+)?([\w.]+)(?:\.\*)?\s*;/gm],
      kotlin: [/^\s*import\s+([\w.]+)/gm],
      scala: [/^\s*import\s+([\w.]+)/gm],
      csharp: [/^\s*using\s+(?:static\s+)?([\w.]+)\s*;/gm],
      rust: [/^\s*(?:pub\s+)?use\s+([\w:]+)/gm],
      c: [/^\s*#include\s+["<]([^">]+)[">]/gm],
      cpp: [/^\s*#include\s+["<]([^">]+)[">]/gm],
      php: [/^\s*use\s+([\w\\]+)/gm, /\b(?:require|include)(?:_once)?\s*\(?\s*["']([^"']+)["']/g],
      ruby: [/^\s*require(?:_relative)?\s+["']([^"']+)["']/gm],
      dart: [/^\s*import\s+["']([^"']+)["']/gm],
      swift: [/^\s*import\s+(\w+)/gm],
      lua: [/require\s*\(?\s*["']([^"']+)["']/g],
    }[file.language] ?? [];
    for (const re of res) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const spec = m[1];
        let target: string | null = null;
        if (["c", "cpp", "ruby", "php", "dart"].includes(file.language) && /[./]/.test(spec)) {
          const candidate = joinPath(dirOf(file.path), spec.replace(/^\.\//, ""));
          for (const p of [candidate, `${candidate}.rb`]) if (allPaths.has(p)) target = p;
        }
        if (["java", "kotlin", "scala", "csharp"].includes(file.language)) {
          const cls = spec.split(".").pop()!;
          for (const p of allPaths) if (base(p).replace(/\.[^.]+$/, "") === cls) target = p;
        }
        file.importedFiles.push({ path: target, module: spec, line: file.lineOf(m.index) });
      }
    }
  }
}

let allPaths = new Set<string>();
function resolveJsModule(from: string, spec: string): string | null {
  if (!spec.startsWith(".") && !spec.startsWith("/")) {
    // 路径别名 @/x 与 ~/x
    const alias = /^[@~]\/(.+)$/.exec(spec);
    if (!alias) return null;
    for (const p of allPaths) {
      const s = p.replace(/\.[^./]+$/, "");
      if (s.endsWith(`/${alias[1]}`) || s.endsWith(`/${alias[1]}/index`)) return p;
    }
    return null;
  }
  const raw = spec.startsWith("/") ? spec.slice(1) : joinPath(dirOf(from), spec);
  const noExt = raw.replace(/\.(m|c)?js$/, "");
  const exts = ["", ".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".d.ts"];
  for (const stemCandidate of [raw, noExt]) {
    for (const e of exts) if (allPaths.has(stemCandidate + e)) return stemCandidate + e;
    for (const e of exts.slice(1)) if (allPaths.has(`${stemCandidate}/index${e}`)) return `${stemCandidate}/index${e}`;
  }
  return null;
}

export function externalName(module: string, language: string) {
  if (language === "javascript" || language === "typescript") {
    if (module.startsWith("node:")) return module;
    const parts = module.split("/");
    return module.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  }
  if (language === "python") return module.replace(/^\.+/, "").split(".")[0];
  if (language === "go") return module;
  if (language === "rust") return module.split("::")[0];
  return module.split(/[.\\/]/).slice(0, 2).join(".");
}

const STYLE: Record<string, "c" | "python" | "hash" | "sql"> = {
  python: "python", ruby: "hash", shell: "hash", sql: "sql", lua: "sql",
};

/** 第一遍：每个代码文件的定义与导入。 */
export function parseCodeFiles(
  b: GraphBuilder,
  files: { path: string; text: string; language: string; fileNode: GNode }[],
  everyPath: Set<string>,
): CodeFile[] {
  allPaths = everyPath;
  pythonFiles = new Set([...everyPath].filter((p) => /\.pyi?$/.test(p)));
  const out: CodeFile[] = [];
  for (const f of files) {
    const scanned = scanSource(f.text, STYLE[f.language] ?? "c");
    const file: CodeFile = {
      path: f.path, language: f.language, text: f.text, fileNode: f.fileNode, defs: [],
      imports: new Map(), importedFiles: [], scanned, lineOf: lineIndex(f.text),
    };
    if (f.language === "python") parsePython(b, file);
    else parseBraced(b, file);
    // 设计理由注释
    for (const c of scanned.comments) {
      const m = RATIONALE.exec(c.text);
      if (!m) continue;
      const host = innermostAtLine(file, c.line) ?? null;
      const label = `${m[1].toUpperCase()}: ${m[2]}`.slice(0, 90);
      const node = b.addNode(`${slug(stem(file.path))}_rationale_${c.line}`, {
        label, kind: "rationale", file_type: "rationale", source_file: file.path,
        source_location: `L${c.line}`, source_end: c.line, summary: `${m[1].toUpperCase()}: ${m[2]}`.slice(0, 240),
      });
      b.addLink(node.id, host ? host.node.id : file.fileNode.id, "rationale_for", "EXTRACTED", 1, { source_file: file.path, line: c.line });
    }
    out.push(file);
  }
  return out;
}

function innermostAtLine(file: CodeFile, line: number) {
  let best: Def | null = null;
  for (const d of file.defs) {
    const s = file.lineOf(d.start), e = Number(d.node.source_end ?? s);
    if (s <= line + 1 && e >= line && (!best || d.start > best.start)) best = d;
  }
  return best;
}

function innermostAt(file: CodeFile, offset: number) {
  let best: Def | null = null;
  for (const d of file.defs)
    if (d.start <= offset && d.end >= offset && (d.kind === "function" || d.kind === "method" || d.kind === "class") && (!best || d.start > best.start)) best = d;
  return best;
}

/** 第二遍：跨文件解析导入、继承与调用。 */
export function linkCode(b: GraphBuilder, files: CodeFile[], fileNodes: Map<string, GNode>) {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const topByName = new Map<string, Def[]>();
  const family = (language: string) => (language === "typescript" ? "javascript" : language === "cpp" ? "c" : language);
  const methodsByName = new Map<string, Def[]>();
  for (const f of files)
    for (const d of f.defs) {
      const map = d.kind === "method" ? methodsByName : d.topLevel ? topByName : null;
      if (!map) continue;
      const key = `${family(f.language)}:${d.name}`;
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
  const externals = new Map<string, GNode>();
  const external = (name: string, language: string) => {
    const key = `${language}:${name}`;
    let n = externals.get(key);
    if (!n) {
      n = b.addNode(`ext_${slug(name)}`, { label: name, kind: "module", file_type: "code", language, external: true });
      externals.set(key, n);
    }
    return n;
  };
  const lookupIn = (path: string | null, name: string) => {
    if (!path) return null;
    const f = byPath.get(path);
    if (!f) return null;
    if (name === "default") return f.defs.find((d) => d.topLevel && /export\s+default/.test(f.scanned.code.slice(Math.max(0, d.start - 40), d.start))) ?? null;
    return f.defs.find((d) => d.topLevel && d.name === name) ?? null;
  };
  for (const f of files) {
    for (const imp of f.importedFiles) {
      if (imp.path && imp.path !== f.path) {
        const target = fileNodes.get(imp.path);
        if (target) b.addLink(f.fileNode.id, target.id, "imports", "EXTRACTED", 1, { source_file: f.path, line: imp.line });
      } else if (!imp.path && !imp.module.startsWith(".")) {
        const name = externalName(imp.module, f.language);
        if (!name || name === "typing" || name === "__future__") continue;
        b.addLink(f.fileNode.id, external(name, f.language).id, "imports", "EXTRACTED", 1, { source_file: f.path, line: imp.line });
      }
    }
    const resolve = (name: string): { def: Def; confidence: "EXTRACTED" | "INFERRED"; score: number } | null => {
      const local = f.defs.find((d) => d.topLevel && d.name === name);
      if (local) return { def: local, confidence: "EXTRACTED", score: 1 };
      const imp = f.imports.get(name);
      if (imp) {
        const hit = lookupIn(imp.path, imp.name || name);
        if (hit) return { def: hit, confidence: "EXTRACTED", score: 1 };
      }
      const global = topByName.get(`${family(f.language)}:${name}`);
      if (global && global.length === 1 && !COMMON_CALLS.has(name)) return { def: global[0], confidence: "INFERRED", score: 0.6 };
      return null;
    };
    // 继承
    for (const d of f.defs) {
      for (const baseName of d.bases) {
        const hit = resolve(baseName);
        if (hit) b.addLink(d.node.id, hit.def.node.id, d.kind === "interface" || /implements/.test(f.scanned.code.slice(d.start, d.start + 300)) && hit.def.kind === "interface" ? "implements" : "inherits",
          hit.confidence, hit.score, { source_file: f.path, line: f.lineOf(d.start) });
      }
    }
    // 调用
    const code = f.scanned.code;
    const callRe = /(?<![\w$.])(?:new\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^<>()]*>)?\s*\(|(?:\b(self|this)|[\w$\])])\s*\.\s*([A-Za-z_$][\w$]*)\s*\(|<([A-Z][\w$]*)[\s/>]/g;
    let m: RegExpExecArray | null;
    while ((m = callRe.exec(code))) {
      const caller = innermostAt(f, m.index);
      const line = f.lineOf(m.index);
      const from = caller ? caller.node.id : f.fileNode.id;
      if (m[1] || m[4]) {
        const name = m[1] ?? m[4];
        if (COMMON_CALLS.has(name) && !f.defs.some((d) => d.name === name) && !f.imports.has(name)) continue;
        if (caller && caller.name === name && caller.start === m.index + m[0].indexOf(name)) continue;
        const hit = resolve(name);
        if (hit && hit.def !== caller && !(caller && hit.def.start === m.index + m[0].indexOf(name) && hit.def.node.source_file === f.path))
          b.addLink(from, hit.def.node.id, m[4] ? "renders" : "calls", hit.confidence, hit.score, { source_file: f.path, line, context: m[4] ? "jsx" : "call" });
      } else if (m[3]) {
        const name = m[3];
        if (m[2] && caller) {
          // self.x() / this.x()：同类或基类方法
          let cls: Def | null = caller;
          while (cls && cls.kind !== "class") cls = cls.parent;
          const own = cls ? f.defs.find((d) => d.parent === cls && d.name === name) : null;
          if (own && own !== caller) {
            b.addLink(from, own.node.id, "calls", "EXTRACTED", 1, { source_file: f.path, line, context: "call" });
            continue;
          }
        }
        if (COMMON_CALLS.has(name)) continue;
        const candidates = methodsByName.get(`${family(f.language)}:${name}`) ?? [];
        if (candidates.length === 1 && candidates[0] !== caller)
          b.addLink(from, candidates[0].node.id, "calls", "INFERRED", 0.85, { source_file: f.path, line, context: "call" });
        else if (candidates.length > 1 && candidates.length <= 3)
          for (const c of candidates) if (c !== caller) b.addLink(from, c.node.id, "calls", "AMBIGUOUS", 0.3, { source_file: f.path, line, context: "call" });
      }
    }
  }
}

export type SymbolIndex = Map<string, GNode[]>;
/** 可在文档中被提及的符号名（类、函数、方法名）。 */
export function symbolIndex(files: CodeFile[]): SymbolIndex {
  const index: SymbolIndex = new Map();
  for (const f of files)
    for (const d of f.defs) {
      if (d.name.length < 3) continue;
      const list = index.get(d.name) ?? [];
      list.push(d.node);
      index.set(d.name, list);
      if (d.parent && d.kind === "method") {
        const q = `${d.parent.name}.${d.name}`;
        index.set(q, [...(index.get(q) ?? []), d.node]);
      }
    }
  return index;
}
