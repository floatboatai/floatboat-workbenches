// ABOUTME: 把常见资料文件转成 Markdown 简报：.md/.txt 原样、.docx 读取标题样式/列表/表格、.html 转标题与列表、.csv/.tsv 转表格。浏览器与 Node 共用。
import { readZip } from "../shared/zip.ts";
import { LIMITS } from "./model.ts";

export const BRIEF_FILE_MAX = 40 * 1024 * 1024;
export const BRIEF_ACCEPT = ".md,.markdown,.txt,.text,.docx,.html,.htm,.csv,.tsv,text/plain,text/markdown,text/html,text/csv";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
  );

/** Decodes UTF-8 (with or without BOM); falls back to GB18030 for legacy Chinese text files. */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    try {
      return new TextDecoder("gb18030").decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

const row = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, "／").replace(/\s+/g, " ").trim()).join(" | ")} |`;
export function tableMarkdown(rows: string[][]): string {
  const width = Math.max(...rows.map((r) => r.length));
  const filled = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  return [row(filled[0]), `|${" --- |".repeat(width)}`, ...filled.slice(1).map(row)].join("\n");
}

export function csvToMarkdown(text: string, name: string): string {
  const sep = name.toLowerCase().endsWith(".tsv") || (text.split("\n")[0].includes("\t") && !text.split("\n")[0].includes(",")) ? "\t" : ",";
  const rows: string[][] = [];
  let cell = "",
    cur: string[] = [],
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      cur.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(cell);
      if (cur.some((c) => c.trim())) rows.push(cur);
      cur = [];
      cell = "";
    } else cell += ch;
  }
  cur.push(cell);
  if (cur.some((c) => c.trim())) rows.push(cur);
  if (!rows.length) return "";
  const title = name.replace(/\.[^.]+$/, "");
  return `# ${title}\n\n## ${title}\n\n${tableMarkdown(rows.slice(0, 200))}\n`;
}

/** HTML → Markdown for headings, paragraphs, lists, quotes and tables; scripts/styles are dropped, nothing is executed. */
export function htmlToMarkdown(html: string): string {
  let s = html
    .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<table\b[\s\S]*?<\/table>/gi, (t) => {
    const rows = [...t.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((r) =>
      [...r[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => decodeEntities(c[1].replace(/<[^>]+>/g, " ")).trim()),
    );
    return rows.length ? `\n\n${tableMarkdown(rows.filter((r) => r.length))}\n\n` : "";
  });
  s = s
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(Number(n))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${t.replace(/<[^>]+>/g, " ").trim()}`)
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n\n> ${t.replace(/<[^>]+>/g, " ").trim()}\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|ul|ol|header|footer|main)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(s)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function runText(paragraph: string): string {
  return [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br[^>]*\/>/g)]
    .map((m) => (m[1] !== undefined ? decodeEntities(m[1]) : m[0].startsWith("<w:tab") ? " " : "\n"))
    .join("")
    .trim();
}
/** Top-level body elements in document order; tables are kept whole even when they contain paragraphs. */
function bodyElements(xml: string): string[] {
  const out: string[] = [];
  const re = /<w:tbl>|<w:tbl\s|<w:p>|<w:p\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith("<w:tbl")) {
      let depth = 0,
        i = m.index;
      const tag = /<w:tbl[\s>]|<\/w:tbl>/g;
      tag.lastIndex = i;
      let t: RegExpExecArray | null;
      while ((t = tag.exec(xml))) {
        depth += t[0].startsWith("</") ? -1 : 1;
        if (!depth) {
          i = t.index + t[0].length;
          break;
        }
      }
      out.push(xml.slice(m.index, i));
      re.lastIndex = i;
    } else {
      const end = xml.indexOf("</w:p>", m.index);
      const selfClose = xml.slice(m.index, xml.indexOf(">", m.index) + 1).endsWith("/>");
      const stop = selfClose ? xml.indexOf(">", m.index) + 1 : end < 0 ? xml.length : end + 6;
      out.push(xml.slice(m.index, stop));
      re.lastIndex = stop;
    }
  }
  return out;
}

/** Reads paragraphs, heading styles, numbered/bulleted lists and tables from a .docx. */
export async function docxToMarkdown(bytes: Uint8Array): Promise<string> {
  const entries = await readZip(bytes, (n) => n === "word/document.xml" || n === "word/styles.xml");
  const doc = entries.find((e) => e.name === "word/document.xml");
  if (!doc) throw new Error("这个 .docx 文件缺少正文（word/document.xml）。");
  const dec = new TextDecoder();
  const styles = new Map<string, string>();
  const stylesXml = entries.find((e) => e.name === "word/styles.xml");
  if (stylesXml)
    for (const m of dec.decode(stylesXml.data).matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>[\s\S]*?<w:name w:val="([^"]+)"/g)) styles.set(m[1], m[2]);
  const xml = dec.decode(doc.data);
  const body = xml.slice(Math.max(0, xml.indexOf("<w:body")));
  const lines: string[] = [];
  for (const el of bodyElements(body)) {
    if (el.startsWith("<w:tbl")) {
      const rows = [...el.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((r) => [...r[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((c) => runText(c[0]).replace(/\n/g, " ")));
      if (rows.length) lines.push("", tableMarkdown(rows), "");
      continue;
    }
    const text = runText(el);
    if (!text) {
      lines.push("");
      continue;
    }
    const styleId = el.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? "";
    const name = (styles.get(styleId) ?? styleId).toLowerCase().replace(/\s+/g, " ");
    const level = name === "title" ? 1 : Number(name.match(/^(?:heading|标题)\s*(\d)$/)?.[1] ?? 0);
    if (level) lines.push("", `${"#".repeat(Math.min(level, 6))} ${text.replace(/\n/g, " ")}`, "");
    else if (/<w:numPr>/.test(el) || /list/.test(name)) lines.push(`- ${text.replace(/\n/g, " ")}`);
    else if (/quote|引用/.test(name)) lines.push("", `> ${text}`, "");
    else lines.push("", text, "");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** File → Markdown brief text. Throws a readable error for unsupported or oversized files. */
export async function briefFromFile(name: string, bytes: Uint8Array): Promise<string> {
  if (bytes.length > BRIEF_FILE_MAX) throw new Error(`资料文件超过 ${BRIEF_FILE_MAX / 1024 / 1024} MB。`);
  const lower = name.toLowerCase();
  let text: string;
  if (lower.endsWith(".docx")) text = await docxToMarkdown(bytes);
  else if (/\.(html?|xhtml)$/.test(lower)) text = htmlToMarkdown(decodeText(bytes));
  else if (/\.(csv|tsv)$/.test(lower)) text = csvToMarkdown(decodeText(bytes), name);
  else if (/\.(pdf|pptx|doc|xls|xlsx|key|pages)$/.test(lower))
    throw new Error("暂不能直接读取这种文件。请在原软件中另存为 .docx、.md 或 .txt，或复制正文粘贴到资料区。");
  else text = decodeText(bytes);
  if (!text.trim()) throw new Error("文件里没有可读的文字。");
  if (text.length > LIMITS.source) throw new Error(`资料超过 ${LIMITS.source.toLocaleString()} 个字符，请先拆分或摘取需要演示的部分。`);
  return text;
}
