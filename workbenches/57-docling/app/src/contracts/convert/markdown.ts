// ABOUTME: Markdown 本地后备解析（marked 词法）：ATX/Setext 标题、段落、嵌套列表、GFM 表格、代码块、引用与图片，记录原文行号。
import { Lexer, type Token, type Tokens } from "marked";
import { DocBuilder, Outline, baseName, binaryHash, cleanText, type CellInput } from "./builder.ts";
import type { Conversion, Segment } from "./segments.ts";
function plain(tokens: Token[] | undefined): string {
  let out = "";
  for (const t of tokens ?? []) {
    if (t.type === "br") out += "\n";
    else if (t.type === "image") out += (t as Tokens.Image).text;
    else if (t.type === "html") continue;
    else if ("tokens" in t && Array.isArray(t.tokens)) out += plain(t.tokens);
    else if ("text" in t && typeof t.text === "string") out += t.text;
  }
  return out;
}
const unescape = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e] ?? _);
const text = (tokens: Token[] | undefined) => cleanText(unescape(plain(tokens)));
export function convertMarkdown(source: string, filename: string, bytes?: Uint8Array): Conversion {
  const tokens = new Lexer({ gfm: true }).lex(source.replace(/\r\n?/g, "\n"));
  const b = new DocBuilder(baseName(filename), {
    mimetype: "text/markdown",
    filename,
    binary_hash: binaryHash(bytes ?? new TextEncoder().encode(source)),
  });
  const segments: Segment[] = [];
  const outline = new Outline();
  let line = 1,
    sawTitle = false;
  const span = (raw: string): [number, number] => {
    const start = line,
      breaks = (raw.match(/\n/g) ?? []).length;
    line += breaks;
    const trailing = (raw.match(/\n+$/)?.[0].length ?? 0);
    return [start, Math.max(start, start + breaks - trailing)];
  };
  function list(token: Tokens.List, parent: string, at: [number, number]) {
    const group = b.group(parent, "list", "list");
    let n = typeof token.start === "number" ? token.start : 1;
    let line = at[0];
    for (const item of token.items) {
      const breaks = (item.raw.match(/\n/g) ?? []).length,
        trailing = item.raw.match(/\n+$/)?.[0].length ?? 0;
      const own: [number, number] = [line, Math.max(line, line + breaks - trailing)];
      line += breaks;
      const inline = item.tokens.filter((t) => t.type !== "list");
      const value = text(inline.flatMap((t) => ("tokens" in t && Array.isArray(t.tokens) ? t.tokens : [t])));
      const marker = token.ordered ? `${n++}.` : "";
      const ref = b.listItem(group, (item.task ? (item.checked ? "[x] " : "[ ] ") : "") + value, token.ordered, marker);
      segments.push({ kind: "list", text: (marker || "•") + " " + value, ref, lines: own });
      // A parent item can contain continuation lines and blank paragraphs before its nested list.
      let offset = 0;
      for (const nested of item.tokens) {
        const start = item.text.indexOf(nested.raw, offset);
        if (start >= 0) offset = start + nested.raw.length;
        if (nested.type === "list") {
          const before = item.text.slice(0, Math.max(0, start));
          list(nested as Tokens.List, ref, [own[0] + (before.match(/\n/g) ?? []).length, own[1]]);
        }
      }
    }
  }
  function block(t: Token, parent: () => string, at: [number, number]) {
    switch (t.type) {
      case "heading": {
        const h = t as Tokens.Heading,
          value = text(h.tokens);
        if (!value) return;
        if (h.depth === 1 && !sawTitle) {
          sawTitle = true;
          const ref = b.text(outline.open(0), "title", value);
          outline.push(0, ref);
          segments.push({ kind: "title", text: value, ref, lines: at });
        } else {
          const level = Math.max(1, h.depth - 1);
          const ref = b.heading(outline.open(level), value, level);
          outline.push(level, ref);
          segments.push({ kind: "heading", text: value, ref, lines: at });
        }
        return;
      }
      case "paragraph": {
        const p = t as Tokens.Paragraph;
        const images = (p.tokens ?? []).filter((x) => x.type === "image");
        const value = text((p.tokens ?? []).filter((x) => x.type !== "image"));
        for (const img of images) {
          const ref = b.picture(parent());
          segments.push({ kind: "picture", text: (img as Tokens.Image).text || "［图像］", ref, lines: at });
        }
        if (!value) return;
        const caption = /^(表|图|table|figure|fig\.)\s*\d+/i.test(value);
        const ref = b.text(parent(), caption ? "caption" : "text", value);
        segments.push({ kind: caption ? "caption" : "text", text: value, ref, lines: at });
        return;
      }
      case "list":
        list(t as Tokens.List, parent(), at);
        return;
      case "table": {
        const tb = t as Tokens.Table;
        const cells: CellInput[] = tb.header.map((c, col) => ({ text: text(c.tokens), row: 0, col, header: true }));
        tb.rows.forEach((row, r) =>
          row.forEach((c, col) => cells.push({ text: text(c.tokens), row: r + 1, col })),
        );
        const prev = b.texts[b.texts.length - 1];
        const caption = prev && prev.label === "caption" && segments[segments.length - 1]?.ref === prev.self_ref ? [prev.self_ref] : [];
        const ref = b.table(parent(), cells, [], caption);
        const rows = [tb.header.map((c) => text(c.tokens)), ...tb.rows.map((r) => r.map((c) => text(c.tokens)))];
        segments.push({ kind: "table", text: rows.map((r) => r.join(" ")).join(" "), rows, ref, lines: at });
        return;
      }
      case "code": {
        const c = t as Tokens.Code;
        if (!c.text.trim()) return;
        const ref = b.text(parent(), "code", c.text, c.lang ? { code_language: "unknown" } : {});
        segments.push({ kind: "code", text: c.text, ref, lines: at });
        return;
      }
      case "blockquote":
        for (const inner of (t as Tokens.Blockquote).tokens) block(inner, parent, at);
        return;
      case "html": {
        const value = cleanText((t as Tokens.HTML).text.replace(/<[^>]*>/g, " "));
        if (!value) return;
        const ref = b.text(parent(), "text", value);
        segments.push({ kind: "text", text: value, ref, lines: at });
        return;
      }
      default:
        return;
    }
  }
  for (const t of tokens) {
    const at = span(t.raw);
    block(t, () => outline.parent(), at);
  }
  const warnings = b.texts.length || b.tables.length ? [] : ["Markdown 中没有可识别的正文内容。"];
  return { doc: b.build(), segments, warnings };
}
