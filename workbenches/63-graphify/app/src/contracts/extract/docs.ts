// ABOUTME: Markdown 与纯文本抽取：标题层级、文件链接、代码符号提及、术语与段落共现。

import { GraphBuilder, slug, type GNode } from "./builder.ts";
import type { SymbolIndex } from "./code.ts";

export type Section = {
  node: GNode;
  file: string;
  startLine: number;
  /** 正文段落（不含代码块），每段带起始行 */
  paragraphs: { line: number; text: string }[];
  /** 代码块与行内代码 */
  code: { line: number; text: string; inline: boolean }[];
  /** 显式标记的术语：粗体、「」、“”、《》 */
  marked: { term: string; line: number }[];
  links: { target: string; line: number; wiki: boolean }[];
};

const stem = (path: string) => path.replace(/\.[^./]+$/, "");
const dirOf = (path: string) => path.split("/").slice(0, -1).join("/");
const stripInline = (s: string) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, a, b) => b ?? a)
    .replace(/[*_`~]+/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();

function collectInline(section: Section, line: number, text: string) {
  let m: RegExpExecArray | null;
  const code = /`([^`\n]{1,120})`/g;
  while ((m = code.exec(text))) section.code.push({ line, text: m[1], inline: true });
  const bold = /(\*\*|__)([^*_\n]{2,40}?)\1/g;
  while ((m = bold.exec(text))) section.marked.push({ term: m[2].trim(), line });
  const cjk = /[「『《“]([^」』》”\n]{2,24})[」』》”]/g;
  while ((m = cjk.exec(text))) section.marked.push({ term: m[1].trim(), line });
  const link = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  while ((m = link.exec(text))) section.links.push({ target: m[1], line, wiki: false });
  const wiki = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;
  while ((m = wiki.exec(text))) section.links.push({ target: m[1].trim(), line, wiki: true });
}

function newSection(node: GNode, file: string, line: number): Section {
  return { node, file, startLine: line, paragraphs: [], code: [], marked: [], links: [] };
}

function pushParagraph(section: Section, buffer: { line: number; text: string[] }) {
  const text = buffer.text.join(" ").trim();
  if (text) section.paragraphs.push({ line: buffer.line, text });
  buffer.text = [];
}

/** 解析一个文档为若干节，标题节点挂在文件节点或上级标题下。 */
export function parseDocument(
  b: GraphBuilder,
  path: string,
  text: string,
  language: string,
  fileNode: GNode,
): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  const root = newSection(fileNode, path, 1);
  sections.push(root);
  const stack: { level: number; section: Section }[] = [];
  let current = root;
  const buffer = { line: 1, text: [] as string[] };
  const openHeading = (level: number, title: string, line: number) => {
    const label = stripInline(title).slice(0, 120);
    if (!label) return;
    pushParagraph(current, buffer);
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack.length ? stack[stack.length - 1].section.node : fileNode;
    const node = b.addNode(`${slug(stem(path))}_${slug(label)}`, {
      label,
      kind: "section",
      file_type: "document",
      language,
      source_file: path,
      source_location: `L${line}`,
      source_end: line,
      heading_level: level,
    });
    b.addLink(parent.id, node.id, "contains", "EXTRACTED", 1, { source_file: path, line });
    current = newSection(node, path, line);
    sections.push(current);
    stack.push({ level, section: current });
  };
  let fence: string | null = null;
  let fenceStart = 0, fenceBody: string[] = [];
  let i = 0;
  if (language === "markdown" && lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, k) => k > 0 && l.trim() === "---");
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    if (fence) {
      if (line.trim().startsWith(fence)) {
        current.code.push({ line: fenceStart, text: fenceBody.join("\n"), inline: false });
        fence = null;
      } else fenceBody.push(line);
      continue;
    }
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f && (language === "markdown" || language === "text")) {
      pushParagraph(current, buffer);
      fence = f[1];
      fenceStart = n + 1;
      fenceBody = [];
      continue;
    }
    let heading: [number, string] | null = null;
    let m: RegExpExecArray | null;
    if (language === "markdown") {
      if ((m = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line))) heading = [m[1].length, m[2]];
      else if (line.trim() && /^\s{0,3}(=+|-+)\s*$/.test(lines[i + 1] ?? "") && !/^\s*[-*+]\s/.test(line) && buffer.text.length === 0)
        heading = [/=/.test(lines[i + 1]) ? 1 : 2, line.trim()];
    } else if (language === "rst" || language === "text") {
      const next = lines[i + 1] ?? "";
      if (line.trim() && /^([=\-~^"#*+])\1{2,}\s*$/.test(next) && next.trim().length >= Math.min(line.trim().length, 3)) heading = [next.trim()[0] === "=" ? 1 : 2, line.trim()];
      else if ((m = /^\s*((?:第[一二三四五六七八九十百\d]+[章节部分])|(?:[一二三四五六七八九十]+、)|(?:\d+(?:\.\d+)*[.、)]?))\s*(\S.{0,40})$/.exec(line)) && !/[。；;，,：:]$/.test(line.trim()) && line.trim().length <= 44 && !(lines[i - 1] ?? "").trim())
        heading = [m[1].split(".").length + (m[1].startsWith("第") ? 0 : 1), line.trim()];
      else if (/^[A-Z][A-Z0-9 &/-]{3,40}$/.test(line.trim()) && !(lines[i - 1] ?? "").trim()) heading = [1, line.trim()];
    } else if (language === "org" && (m = /^(\*+)\s+(.+)$/.exec(line))) heading = [m[1].length, m[2]];
    else if (language === "asciidoc" && (m = /^(=+)\s+(.+)$/.exec(line))) heading = [m[1].length, m[2]];
    else if (language === "latex" && (m = /^\\(sub)*section\*?\{([^}]+)\}/.exec(line))) heading = [(m[1] ? m[0].split("sub").length : 1), m[2]];
    if (heading) {
      openHeading(heading[0], heading[1], n);
      if (language === "markdown" && /^\s{0,3}(=+|-+)\s*$/.test(lines[i + 1] ?? "") && !line.trimStart().startsWith("#")) i++;
      else if ((language === "rst" || language === "text") && /^([=\-~^"#*+])\1{2,}\s*$/.test(lines[i + 1] ?? "")) i++;
      continue;
    }
    if (!line.trim()) {
      pushParagraph(current, buffer);
      continue;
    }
    if (!buffer.text.length) buffer.line = n;
    buffer.text.push(line.trim());
    collectInline(current, n, line);
  }
  if (fence) current.code.push({ line: fenceStart, text: fenceBody.join("\n"), inline: false });
  pushParagraph(current, buffer);
  // 节的结束行
  for (let k = 1; k < sections.length; k++) {
    const s = sections[k];
    const level = Number(s.node.heading_level);
    const next = sections.slice(k + 1).find((x) => Number(x.node.heading_level) <= level);
    s.node.source_end = next ? next.startLine - 1 : lines.length;
    const first = s.paragraphs[0]?.text;
    if (first) s.node.summary = stripInline(first).slice(0, 240);
  }
  if (!fileNode.summary) {
    const first = sections.flatMap((s) => s.paragraphs)[0]?.text;
    if (first) fileNode.summary = stripInline(first).slice(0, 240);
  }
  return sections;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isCjk = (s: string) => /[㐀-鿿]/.test(s);
function termRegex(terms: string[], flags: string) {
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const latin = sorted.filter((t) => !isCjk(t)).map(escape);
  const cjk = sorted.filter(isCjk).map(escape);
  const parts: string[] = [];
  if (latin.length) parts.push(`(?<![\\p{L}\\p{N}_])(?:${latin.join("|")})(?![\\p{L}\\p{N}_])`);
  if (cjk.length) parts.push(`(?:${cjk.join("|")})`);
  return parts.length ? new RegExp(parts.join("|"), flags + "u") : null;
}
const normTerm = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
const goodTerm = (t: string) =>
  t.length >= 2 && t.length <= 32 && !/^[\d\s.,:%-]+$/.test(t) && !/[。！？!?；;，,]/.test(t) && t.split(" ").length <= 4;

export type DocContext = {
  sections: Section[];
  symbols: SymbolIndex;
  fileNodes: Map<string, GNode>;
  everyPath: Set<string>;
  codeSummaries: { node: GNode; text: string }[];
};

/** 文档之间与文档到代码的关系，以及术语节点和共现。 */
export function linkDocuments(b: GraphBuilder, ctx: DocContext) {
  const { sections, symbols, fileNodes, everyPath } = ctx;
  const byBase = new Map<string, string[]>();
  for (const p of everyPath) {
    const key = (p.split("/").pop() ?? p).toLowerCase();
    byBase.set(key, [...(byBase.get(key) ?? []), p]);
    const noExt = key.replace(/\.[^.]+$/, "");
    if (noExt !== key) byBase.set(noExt, [...(byBase.get(noExt) ?? []), p]);
  }
  const headingIndex = new Map<string, GNode>();
  for (const s of sections) if (s.node.kind === "section") headingIndex.set(`${s.file}#${slug(String(s.node.label))}`, s.node);
  // 1. 显式链接
  for (const s of sections) {
    for (const l of s.links) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(l.target) || l.target.startsWith("#")) {
        if (l.target.startsWith("#")) {
          const h = headingIndex.get(`${s.file}#${slug(decodeURIComponent(l.target.slice(1)))}`);
          if (h) b.addLink(s.node.id, h.id, "references", "EXTRACTED", 1, { source_file: s.file, line: l.line, context: "link" });
        }
        continue;
      }
      let target: string | null = null, anchor = "";
      if (l.wiki) {
        const hits = byBase.get(l.target.toLowerCase()) ?? byBase.get(`${l.target.toLowerCase()}.md`);
        target = hits?.[0] ?? null;
      } else {
        const [rawPath, hash = ""] = l.target.split("#");
        anchor = hash;
        let p: string;
        try {
          p = decodeURIComponent(rawPath);
        } catch {
          p = rawPath;
        }
        const parts = (rawPath.startsWith("/") ? [] : dirOf(s.file).split("/").filter(Boolean));
        for (const seg of p.split("/")) {
          if (!seg || seg === ".") continue;
          if (seg === "..") parts.pop();
          else parts.push(seg);
        }
        const joined = parts.join("/");
        for (const cand of [joined, `${joined}.md`, `${joined}/README.md`, `${joined}/index.md`])
          if (everyPath.has(cand)) {
            target = cand;
            break;
          }
      }
      if (!target) continue;
      const node = (anchor && headingIndex.get(`${target}#${slug(decodeURIComponent(anchor))}`)) || fileNodes.get(target);
      if (node) b.addLink(s.node.id, node.id, "references", "EXTRACTED", 1, { source_file: s.file, line: l.line, context: l.wiki ? "wikilink" : "link" });
    }
  }
  // 2. 术语：至少一处被显式标记，且在两个以上节/摘要中出现
  const symbolNames = new Set([...symbols.keys()].map((k) => k.toLowerCase()));
  const marked = new Map<string, { label: string; file: string; line: number }>();
  for (const s of sections)
    for (const t of s.marked) {
      const key = normTerm(t.term);
      if (!goodTerm(key) || symbolNames.has(key) || symbolNames.has(key.replace(/\(\)$/, ""))) continue;
      if (!marked.has(key)) marked.set(key, { label: t.term.trim(), file: s.file, line: t.line });
    }
  const conceptRe = termRegex([...marked.keys()], "gi");
  const units: { section: Section | null; owner: GNode; file: string; line: number; text: string; markedHere: Set<string> }[] = [];
  for (const s of sections) {
    const here = new Set(s.marked.map((t) => normTerm(t.term)));
    for (const p of s.paragraphs) units.push({ section: s, owner: s.node, file: s.file, line: p.line, text: stripInline(p.text.replace(/`[^`]*`/g, " ").replace(/\]\([^)]*\)/g, "]")), markedHere: here });
  }
  for (const c of ctx.codeSummaries) units.push({ section: null, owner: c.node, file: String(c.node.source_file ?? ""), line: Number(String(c.node.source_location ?? "L1").slice(1)), text: c.text, markedHere: new Set() });
  const occurrences = new Map<string, Set<string>>();
  const unitTerms: Set<string>[] = units.map((u) => {
    const found = new Set<string>();
    if (!conceptRe) return found;
    conceptRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = conceptRe.exec(u.text))) found.add(normTerm(m[0]));
    for (const t of found) {
      const set = occurrences.get(t) ?? new Set<string>();
      set.add(u.owner.id);
      occurrences.set(t, set);
    }
    return found;
  });
  const concepts = new Map<string, GNode>();
  for (const [key, info] of [...marked.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if ((occurrences.get(key)?.size ?? 0) < 2) continue;
    concepts.set(key, b.addNode(`concept_${slug(key)}`, {
      label: info.label,
      kind: "concept",
      file_type: "concept",
      source_file: info.file,
      source_location: `L${info.line}`,
      source_end: info.line,
      mentions: occurrences.get(key)!.size,
    }));
  }
  // 3. 提及：术语、代码符号、文件名
  const distinctive = [...symbols.keys()].filter((n) => n.includes(".") || /_/.test(n) || /[a-z][A-Z]/.test(n) || /^[A-Z][a-z]+[A-Z]/.test(n));
  const symbolRe = termRegex(distinctive, "g");
  const fileRe = termRegex([...byBase.keys()].filter((k) => /\.[a-z0-9]+$/.test(k) && k.length >= 6), "gi");
  const pairCounts = new Map<string, number>();
  units.forEach((u, idx) => {
    for (const t of unitTerms[idx]) {
      const c = concepts.get(t);
      if (c) b.addLink(u.owner.id, c.id, "mentions", u.markedHere.has(t) ? "EXTRACTED" : "INFERRED", u.markedHere.has(t) ? 1 : 0.75, { source_file: u.file, line: u.line, context: u.section ? "text" : "docstring" });
    }
    if (!u.section) return;
    if (symbolRe) {
      symbolRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = symbolRe.exec(u.text))) {
        const targets = symbols.get(m[0]) ?? [];
        if (targets.length && targets.length <= 2)
          for (const t of targets) b.addLink(u.owner.id, t.id, "mentions", "INFERRED", targets.length === 1 ? 0.7 : 0.4, { source_file: u.file, line: u.line, context: "text" });
      }
    }
    if (fileRe) {
      fileRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = fileRe.exec(u.text))) {
        const hits = byBase.get(m[0].toLowerCase()) ?? [];
        if (hits.length === 1 && hits[0] !== u.file) {
          const fn = fileNodes.get(hits[0]);
          if (fn) b.addLink(u.owner.id, fn.id, "references", "INFERRED", 0.8, { source_file: u.file, line: u.line, context: "filename" });
        }
      }
    }
    const list = [...unitTerms[idx]].filter((t) => concepts.has(t)).sort();
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const k = `${list[i]}\u0000${list[j]}`;
        pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
      }
  });
  // 代码块与行内代码：显式指向符号
  for (const s of sections)
    for (const c of s.code) {
      if (c.inline && everyPath.has(c.text.trim().replace(/^\.\//, ""))) {
        const fn = fileNodes.get(c.text.trim().replace(/^\.\//, ""));
        if (fn && fn.source_file !== s.file) b.addLink(s.node.id, fn.id, "references", "EXTRACTED", 1, { source_file: s.file, line: c.line, context: "inline_code" });
        continue;
      }
      const names = c.inline ? [c.text.replace(/\(\)$/, "").replace(/^\./, "").trim()] : [...new Set(c.text.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)?/g) ?? [])];
      for (const name of names) {
        const targets = symbols.get(name) ?? symbols.get(name.split(".").pop() ?? "") ?? [];
        if (!targets.length || targets.length > 3) continue;
        for (const t of targets) b.addLink(s.node.id, t.id, "mentions", c.inline ? "EXTRACTED" : "INFERRED", c.inline ? (targets.length === 1 ? 0.95 : 0.5) : 0.6, { source_file: s.file, line: c.line, context: c.inline ? "inline_code" : "code_block" });
      }
    }
  // 4. 共现：同一段落中至少出现两次的术语对，每个术语最多保留 6 条
  const pairs = [...pairCounts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const perTerm = new Map<string, number>();
  for (const [key, n] of pairs) {
    const [a, c] = key.split("\u0000");
    if ((perTerm.get(a) ?? 0) >= 6 || (perTerm.get(c) ?? 0) >= 6) continue;
    perTerm.set(a, (perTerm.get(a) ?? 0) + 1);
    perTerm.set(c, (perTerm.get(c) ?? 0) + 1);
    const link = b.addLink(concepts.get(a)!.id, concepts.get(c)!.id, "related_to", "INFERRED", Math.min(0.9, 0.45 + 0.1 * n), { context: "co_occurrence" });
    if (link) link.weight = n;
  }
}
