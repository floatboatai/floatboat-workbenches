// ABOUTME: 原文对照片段：无页面几何的格式（Word/HTML/Markdown）按原文件顺序列出，并按文本对齐到结构项。
import type { Document } from "../docling.ts";
import { allItems } from "../docling.ts";
export type SegmentKind = "title" | "heading" | "text" | "list" | "table" | "picture" | "code" | "furniture" | "caption";
export interface Segment {
  kind: SegmentKind;
  text: string;
  rows?: string[][];
  /** Item created from this segment, when the same local reader produced the document. */
  ref?: string;
  /** 1-based source line range (Markdown and HTML sources). */
  lines?: [number, number];
}
export interface Conversion {
  doc: Document;
  segments: Segment[];
  warnings: string[];
}
const normal = (s: string) => s.replace(/\s+/g, "").toLowerCase();
/**
 * Maps segments onto a document produced elsewhere (e.g. Docling Serve) by normalized text.
 * Each item is used once, in reading order, so repeated phrases align in sequence.
 */
export function alignSegments(segments: Segment[], doc: Document): Segment[] {
  const pool = allItems(doc).map((item) => ({
    ref: item.self_ref,
    key: normal(
      item.data
        ? item.data.table_cells.map((c) => c.text).join("")
        : String(item.text ?? ""),
    ),
    used: false,
  }));
  return segments.map((s) => {
    const key = normal(s.rows ? s.rows.flat().join("") : s.text);
    if (!key) return { ...s, ref: undefined };
    const hit =
      pool.find((p) => !p.used && p.key && p.key === key) ??
      pool.find((p) => !p.used && p.key.length > 3 && (key.includes(p.key) || p.key.includes(key)));
    if (hit) hit.used = true;
    return { ...s, ref: hit?.ref };
  });
}
