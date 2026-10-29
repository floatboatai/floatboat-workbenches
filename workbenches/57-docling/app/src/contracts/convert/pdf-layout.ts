// ABOUTME: PDF 本地后备版面分析：从 pdf.js 文字片段重建行、段落、标题层级、列表、对齐表格（含跨页续表）、图片与页眉页脚，并保留原页坐标。
import { DocBuilder, baseName, binaryHash, box, cleanText, type CellInput, type Prov } from "./builder.ts";
import type { Conversion } from "./segments.ts";
/** One text run in PDF user space (points, origin bottom-left of the page box), baseline at y. */
export interface PdfRun {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
}
export interface PdfImage {
  l: number;
  b: number;
  r: number;
  t: number;
}
export interface PdfPageInput {
  number: number;
  width: number;
  height: number;
  runs: PdfRun[];
  images: PdfImage[];
}
interface Seg {
  x0: number;
  x1: number;
  text: string;
  /** Source runs, kept so a segment that straddles table columns can be split at run boundaries. */
  runs: { x0: number; x1: number; text: string }[];
}
interface Line {
  y: number;
  size: number;
  x0: number;
  x1: number;
  segs: Seg[];
  text: string;
}
type Kind = "text" | "heading" | "title" | "list" | "caption" | "footnote";
interface Block {
  page: number;
  kind: Kind;
  lines: Line[];
  text: string;
  size: number;
  level?: number;
  marker?: string;
  enumerated?: boolean;
}
interface TableBlock {
  page: number;
  kind: "table";
  rows: CellInput[][];
  numCols: number;
  starts: number[];
  lines: Line[];
}
interface PictureBlock {
  page: number;
  kind: "picture";
  image: PdfImage;
}
type Element = Block | TableBlock | PictureBlock;
const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;
export function joinText(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  if (CJK.test(a[a.length - 1]!) || CJK.test(b[0]!) || /\s$/.test(a) || /^\s/.test(b)) return a + b;
  return a + " " + b;
}
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};
function mode(values: number[], weights: number[]): number {
  const m = new Map<number, number>();
  values.forEach((v, i) => m.set(Math.round(v * 2) / 2, (m.get(Math.round(v * 2) / 2) ?? 0) + weights[i]!));
  let best = 0,
    bestW = -1;
  for (const [v, w] of m) if (w > bestW) [best, bestW] = [v, w];
  return best;
}
function buildLines(runs: PdfRun[]): Line[] {
  const clean = runs
    .map((r) => ({ ...r, str: r.str.replace(/[\u0000-\u001f]/g, " ") }))
    .filter((r) => r.size > 0.5 && r.str.trim() !== "")
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: PdfRun[][] = [];
  for (const r of clean) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g[0]!.y - r.y) < Math.max(g[0]!.size, r.size) * 0.45) g.push(r);
    else groups.push([r]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    const size = Math.max(...g.map((r) => r.size));
    const segs: Seg[] = [];
    let cur: Seg | null = null;
    for (const r of g) {
      const gap = cur ? r.x - cur.x1 : 0;
      if (cur && gap < Math.max(size * 0.9, 4)) {
        cur.text += gap > size * 0.18 && !/\s$/.test(cur.text) && !/^\s/.test(r.str) && !(CJK.test(cur.text.slice(-1)) && CJK.test(r.str[0]!)) ? " " + r.str : r.str;
        cur.x1 = Math.max(cur.x1, r.x + r.w);
        cur.runs.push({ x0: r.x, x1: r.x + r.w, text: r.str });
      } else {
        cur = { x0: r.x, x1: r.x + r.w, text: r.str, runs: [{ x0: r.x, x1: r.x + r.w, text: r.str }] };
        segs.push(cur);
      }
    }
    for (const s of segs) s.text = cleanText(s.text);
    const kept = segs.filter((s) => s.text);
    return {
      y: median(g.map((r) => r.y)),
      size,
      x0: kept[0]?.x0 ?? 0,
      x1: kept[kept.length - 1]?.x1 ?? 0,
      segs: kept,
      text: kept.map((s) => s.text).join(" "),
    };
  }).filter((l) => l.segs.length);
}
const pageNumber = /^(第\s*\d+\s*页(\s*[,，/]?\s*共\s*\d+\s*页)?|\d{1,4}|[-–—]\s*\d{1,4}\s*[-–—]|page\s+\d+(\s+of\s+\d+)?|\d+\s*\/\s*\d+)$/i;
const furnitureKey = (s: string) => s.replace(/\d+/g, "#").replace(/\s+/g, "");
function lineBox(lines: Line[]): Prov["bbox"] {
  const l = Math.min(...lines.map((x) => x.x0)),
    r = Math.max(...lines.map((x) => x.x1)),
    b = Math.min(...lines.map((x) => x.y - x.size * 0.22)),
    t = Math.max(...lines.map((x) => x.y + x.size * 0.8));
  return box(l, t, r, b);
}
export function clusterStarts(xs: number[], tol: number): { x: number; n: number }[] {
  const sorted = [...xs].sort((a, b) => a - b);
  const out: { x: number; n: number; sum: number }[] = [];
  for (const x of sorted) {
    const last = out[out.length - 1];
    if (last && x - last.sum / last.n <= tol) {
      last.n++;
      last.sum += x;
    } else out.push({ x, n: 1, sum: x });
  }
  return out.map((c) => ({ x: c.sum / c.n, n: c.n }));
}
/** A category column left empty under a filled cell, with the rest of the row filled, is a row span. */
function inferRowSpans(rows: CellInput[][], numCols: number) {
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    if (row.some((c) => c.col === 0) || row.length < Math.ceil((numCols - 1) / 2)) continue;
    for (let up = r - 1; up >= 1; up--) {
      const head = rows[up]!.find((c) => c.col === 0);
      if (head) {
        head.rowSpan = r - up + 1;
        break;
      }
    }
  }
}
/** Splits a segment that crosses column gutters: at run boundaries, else at the space nearest each gutter. */
function splitAtColumns(seg: Seg, gutters: number[]): Seg[] {
  const inside = gutters.filter((g) => g > seg.x0 + 8 && g < seg.x1 - 8);
  if (!inside.length) return [seg];
  // Character positions estimated proportionally within each run.
  const chars: { c: string; x0: number; x1: number }[] = [];
  for (const run of seg.runs) {
    const t = run.text,
      w = (run.x1 - run.x0) / Math.max(1, t.length);
    [...t].forEach((c, i) => chars.push({ c, x0: run.x0 + i * w, x1: run.x0 + (i + 1) * w }));
  }
  const cuts: number[] = [];
  for (const g of inside) {
    let best = -1,
      dist = Infinity;
    chars.forEach((ch, i) => {
      const gapAfter = i + 1 < chars.length ? chars[i + 1]!.x0 - ch.x1 : 0;
      // Prefer a break whose left part still ends before the gutter; then the widest gap.
      const score = Math.abs(ch.x1 - g) + (ch.x1 > g + 2 ? 30 : 0) - gapAfter * 2;
      if ((/\s/.test(ch.c) || gapAfter > 2) && score < dist) {
        dist = score;
        best = i;
      }
    });
    if (best >= 0 && dist < 60) cuts.push(best);
  }
  if (!cuts.length) return [seg];
  const parts: Seg[] = [];
  let from = 0;
  for (const cut of [...new Set(cuts)].sort((a, b) => a - b).concat(chars.length - 1)) {
    const slice = chars.slice(from, cut + 1);
    const text = cleanText(slice.map((c) => c.c).join(""));
    if (text) parts.push({ x0: slice[0]!.x0, x1: slice[slice.length - 1]!.x1, text, runs: [{ x0: slice[0]!.x0, x1: slice[slice.length - 1]!.x1, text }] });
    from = cut + 1;
  }
  return parts.length > 1 ? parts : [seg];
}
/** Aligned multi-segment lines become a table; returns null when the alignment is not table-like. */
function makeTable(page: number, lines: Line[]): TableBlock | null {
  const multi = lines.filter((l) => l.segs.length >= 2);
  if (multi.length < 2) return null;
  const tol = 5;
  // Column gutters: x ranges that (almost) no line covers. Works for left, right and centred alignment.
  const left = Math.floor(Math.min(...lines.map((l) => l.x0))),
    right = Math.ceil(Math.max(...lines.map((l) => l.x1)));
  const cover = new Array<number>(Math.max(1, right - left + 1)).fill(0);
  // Header rows often span gutters; measure gutters on the body rows when there are enough.
  const measured = multi.length >= 3 ? multi.slice(1) : multi;
  for (const l of measured)
    for (const sg of l.segs)
      for (let x = Math.max(left, Math.floor(sg.x0)); x <= Math.min(right, Math.ceil(sg.x1)); x++) cover[x - left]!++;
  const allowed = Math.floor(measured.length * 0.2);
  const gutters: number[] = [];
  for (let x = 0, run = -1; x <= cover.length; x++) {
    const open = x < cover.length && cover[x]! <= allowed;
    if (open && run < 0) run = x;
    if (!open && run >= 0) {
      if (x - run >= 4 && run > 0 && x < cover.length) gutters.push(left + (run + x) / 2);
      run = -1;
    }
  }
  if (!gutters.length) return null;
  const bounds = [left - 1, ...gutters, right + 1];
  const starts = bounds.slice(0, -1).map((b, i) => (i === 0 ? left : b));
  const colOf = (x: number) => Math.max(0, bounds.findIndex((b, i) => i > 0 && x < b) - 1);
  const segsAll = multi.flatMap((l) => l.segs);
  const fitting = segsAll.filter((sg) => !gutters.some((g) => g > sg.x0 + 1 && g < sg.x1 - 1)).length;
  if (fitting / segsAll.length < 0.7) return null;
  // Rows: when line pitch varies, the tighter pitch marks wrapped text inside a cell.
  const deltas = lines.slice(1).map((l, i) => lines[i]!.y - l.y);
  const minD = Math.min(...deltas),
    maxD = Math.max(...deltas);
  const split = maxD > minD * 1.3 ? (minD + maxD) / 2 : 0;
  const rowLines: Line[][] = [];
  lines.forEach((l, i) => {
    if (i > 0 && split && deltas[i - 1]! < split) rowLines[rowLines.length - 1]!.push(l);
    else rowLines.push([l]);
  });
  const rows: CellInput[][] = [];
  rowLines.forEach((group, r) => {
    const cells = new Map<number, CellInput>();
    for (const l of group)
      for (const s of l.segs.flatMap((seg) => splitAtColumns(seg, gutters))) {
        const ends = gutters.filter((g) => g > s.x0 + 8 && g < s.x1 - 8).length;
        const col = colOf(ends ? s.x0 + 1 : (s.x0 + s.x1) / 2);
        const cell = cells.get(col);
        if (cell) cell.text = joinText(cell.text, s.text);
        else cells.set(col, { text: s.text, row: r, col, colSpan: 1 + ends, header: r === 0 });
      }
    rows.push([...cells.values()].sort((a, b) => a.col - b.col));
  });
  return { page, kind: "table", rows, numCols: starts.length, starts, lines };
}
const listMarker = /^([•·▪◦‣●○■□➢►✓\-–—*]|[(（]?\d{1,3}[.)）、](?!\d)|[①-⑳]|[(（]?[a-zA-Z][.)）]|[(（][一二三四五六七八九十]+[)）])\s*/;
const numberedHeading = /^(\d+(\.\d+){0,4}|[一二三四五六七八九十]+、|第[一二三四五六七八九十百\d]+[章节部分篇])\s*\S/;
const captionPattern = /^(表|图|table|figure|fig\.?)\s*[\d一二三四五六七八九十]+/i;
function paragraphs(page: number, lines: Line[], pitchFor: (size: number) => number, textRight: number, left: number): Block[] {
  const blocks: Block[] = [];
  let cur: Line[] = [];
  const flush = () => {
    if (!cur.length) return;
    blocks.push({ page, kind: "text", lines: cur, text: cur.map((l) => l.text).reduce(joinText, ""), size: median(cur.map((l) => l.size)) });
    cur = [];
  };
  for (const l of lines) {
    const prev = cur[cur.length - 1];
    if (prev) {
      const delta = prev.y - l.y,
        sameSize = Math.abs(prev.size - l.size) < 0.6;
      const startsItem = listMarker.test(l.text) || captionPattern.test(l.text);
      const prevEndedShort = prev.x1 < textRight - prev.size * 2.5;
      const indented = l.x0 > left + l.size * 1.2 && l.x0 > cur[0]!.x0 + l.size * 0.8;
      const prevIsHeadingLike = captionPattern.test(cur[0]!.text);
      if (!sameSize || delta > pitchFor(l.size) * 1.3 || delta < 0 || startsItem || prevIsHeadingLike || (prevEndedShort && (indented || /[。．.!?！？:：;；]$/.test(prev.text))))
        flush();
    }
    cur.push(l);
  }
  flush();
  return blocks;
}
export function layoutPdf(pages: PdfPageInput[], filename: string, bytes?: Uint8Array, name?: string): Conversion {
  const b = new DocBuilder(name || baseName(filename), {
    mimetype: "application/pdf",
    filename,
    binary_hash: binaryHash(bytes ?? new TextEncoder().encode(filename)),
  });
  const warnings: string[] = [];
  const pageLines = pages.map((p) => buildLines(p.runs));
  // Furniture: margin-band lines that repeat across pages or look like page numbers.
  const bandKeys = new Map<string, number>();
  pages.forEach((p, i) => {
    const seen = new Set<string>();
    for (const l of pageLines[i]!)
      if (l.y > p.height * 0.92 || l.y < p.height * 0.075) seen.add(furnitureKey(l.text));
    for (const k of seen) bandKeys.set(k, (bandKeys.get(k) ?? 0) + 1);
  });
  const isFurniture = (p: PdfPageInput, l: Line) =>
    (l.y > p.height * 0.92 || l.y < p.height * 0.075) &&
    (pageNumber.test(l.text.trim()) || (pages.length > 1 && (bandKeys.get(furnitureKey(l.text)) ?? 0) >= 2));
  const content = pages.map((p, i) => pageLines[i]!.filter((l) => !isFurniture(p, l)));
  const allLines = content.flat();
  const bodySize = mode(allLines.map((l) => l.size), allLines.map((l) => l.text.length)) || 10;
  const pitches = new Map<number, number[]>();
  for (const lines of content)
    lines.slice(1).forEach((l, i) => {
      const prev = lines[i]!,
        d = prev.y - l.y;
      if (Math.abs(prev.size - l.size) < 0.6 && d > 0 && d < l.size * 2.2) {
        const k = Math.round(l.size * 2) / 2;
        pitches.set(k, [...(pitches.get(k) ?? []), d]);
      }
    });
  const pitchFor = (size: number) => {
    const list = pitches.get(Math.round(size * 2) / 2);
    return list && list.length >= 2 ? median(list) : size * 1.45;
  };
  const elements: Element[] = [];
  pages.forEach((p, i) => {
    b.page(p.number, p.width, p.height);
    const lines = content[i]!;
    const left = mode(lines.map((l) => l.x0), lines.map((l) => l.text.length));
    const textRight = Math.max(0, ...lines.filter((l) => l.size <= bodySize + 0.6).map((l) => l.x1));
    const pageElements: Element[] = [];
    let k = 0;
    while (k < lines.length) {
      const l = lines[k]!;
      if (l.segs.length >= 2 && !captionPattern.test(l.text)) {
        let end = k + 1;
        while (end < lines.length) {
          const prev = lines[end - 1]!,
            next = lines[end]!;
          const gap = prev.y - next.y;
          if (next.segs.length >= 2 && gap < Math.max(prev.size, next.size) * 2.6 && Math.abs(prev.size - next.size) < 1) end++;
          else if (next.segs.length === 1 && gap < next.size * 1.7 && lines.slice(k, end).some((x) => x.segs.length >= 2 && x.segs.some((s) => Math.abs(s.x0 - next.x0) < 5)) && Math.abs(prev.size - next.size) < 1) end++;
          else break;
        }
        const table = end - k >= 2 ? makeTable(p.number, lines.slice(k, end)) : null;
        if (table) {
          pageElements.push(table);
          k = end;
          continue;
        }
      }
      // Paragraph run up to the next table candidate.
      let end = k + 1;
      while (end < lines.length && !(lines[end]!.segs.length >= 2 && !captionPattern.test(lines[end]!.text) && (lines[end + 1]?.segs.length ?? 0) >= 2)) end++;
      pageElements.push(...paragraphs(p.number, lines.slice(k, end), pitchFor, textRight, left));
      k = end;
    }
    for (const img of p.images) {
      if (img.r - img.l < 24 || img.t - img.b < 24) continue;
      pageElements.push({ page: p.number, kind: "picture", image: img });
    }
    const top = (e: Element) => (e.kind === "picture" ? e.image.t : e.lines[0]!.y + e.lines[0]!.size);
    pageElements.sort((a, c) => top(c) - top(a));
    // Classification needs page context (left margin, indentation of neighbours).
    pageElements.forEach((e, idx) => {
      if (e.kind === "picture" || e.kind === "table") return;
      const text = e.text;
      if (e.size >= bodySize * 1.1 && e.lines.length <= 3 && text.length <= 160) e.kind = "heading";
      else if (captionPattern.test(text) && text.length <= 160) e.kind = "caption";
      else if (listMarker.test(text)) {
        const m = listMarker.exec(text)!;
        e.kind = "list";
        e.marker = m[1]!;
        e.enumerated = /\d|[a-zA-Z]|[①-⑳一二三四五六七八九十]/.test(m[1]!);
        e.text = text.slice(m[0].length);
      } else if (e.size <= bodySize * 0.86 && (e.lines[0]!.y < p.height * 0.2 || idx === pageElements.length - 1)) e.kind = "footnote";
      else if (e.lines.length <= 1 && text.length <= 40 && numberedHeading.test(text) && !/[。．.,，;；:：]$/.test(text)) {
        e.kind = "heading";
        e.level = (/^\d+((\.\d+)*)/.exec(text)?.[1]?.split(".").length ?? 0) + 1;
      } else if (e.lines.every((l) => l.x0 > left + 8)) {
        // Indented runs of short items whose bullets are drawn as graphics.
        const near = [pageElements[idx - 1], pageElements[idx + 1]].filter(
          (x): x is Block => !!x && x.kind !== "picture" && x.kind !== "table" && x.lines.every((l) => l.x0 > left + 8),
        );
        if (near.length) {
          e.kind = "list";
          e.marker = "";
          e.enumerated = false;
        }
      }
    });
    elements.push(...pageElements);
  });
  // Merge tables that continue on the next page with the same column grid.
  for (let i = elements.length - 1; i > 0; i--) {
    const cur = elements[i]!,
      prev = elements[i - 1]!;
    if (cur.kind !== "table" || prev.kind !== "table" || cur.page !== prev.page + 1 || cur.numCols !== prev.numCols) continue;
    if (cur.starts.some((x, k) => Math.abs(x - prev.starts[k]!) > 24)) continue;
    const head = prev.rows[0]!.map((c) => c.text).join("|");
    const rows = cur.rows[0]!.map((c) => c.text).join("|") === head ? cur.rows.slice(1) : cur.rows;
    const offset = prev.rows.length;
    for (const row of rows)
      prev.rows.push(row.map((c) => ({ ...c, row: c.row - (rows === cur.rows ? 0 : 1) + offset, header: false })));
    (prev as TableBlock & { more?: TableBlock[] }).more = [...((cur as TableBlock & { more?: TableBlock[] }).more ?? []), cur].sort((a, c) => a.page - c.page);
    elements.splice(i, 1);
  }
  for (const e of elements) if (e.kind === "table") inferRowSpans(e.rows, e.numCols);
  // Heading levels from distinct sizes; the largest heading on the first page is the title.
  const headings = elements.filter((e): e is Block => e.kind === "heading");
  const sizes = [...new Set(headings.filter((h) => h.level === undefined).map((h) => Math.round(h.size * 2) / 2))].sort((a, c) => c - a);
  const firstPage = Math.min(...pages.map((p) => p.number));
  const titleCandidate = headings.find((h) => h.page === firstPage && h.level === undefined && Math.round(h.size * 2) / 2 === sizes[0] && h.size >= bodySize * 1.4);
  if (titleCandidate) titleCandidate.kind = "title";
  const levelSizes = sizes.filter((s) => !titleCandidate || s !== Math.round(titleCandidate.size * 2) / 2 || headings.filter((h) => Math.round(h.size * 2) / 2 === s).length > 1);
  for (const h of headings) if (h.kind === "heading" && h.level === undefined) h.level = Math.max(1, levelSizes.indexOf(Math.round(h.size * 2) / 2) + 1);
  // Emit in reading order with Docling-style flat body, list groups and caption links.
  let group: string | null = null;
  let pendingCaption: { ref: string; page: number } | null = null;
  let lastFigure: string | null = null;
  const prov = (page: number, bbox: Prov["bbox"], len: number): Prov => ({ page_no: page, bbox, charspan: [0, len] });
  for (const e of elements) {
    if (e.kind !== "list") group = null;
    if (e.kind === "table") {
      const parts = [e, ...((e as TableBlock & { more?: TableBlock[] }).more ?? [])];
      const cells = e.rows.flat();
      const ref = b.table("#/body", cells, parts.map((t) => prov(t.page, lineBox(t.lines), 0)), pendingCaption ? [pendingCaption.ref] : []);
      pendingCaption = null;
      lastFigure = ref;
      continue;
    }
    if (e.kind === "picture") {
      const ref = b.picture("#/body", [prov(e.page, box(e.image.l, e.image.t, e.image.r, e.image.b), 0)], pendingCaption ? [pendingCaption.ref] : []);
      pendingCaption = null;
      lastFigure = ref;
      continue;
    }
    const p = [prov(e.page, lineBox(e.lines), e.text.length)];
    if (e.kind === "title") b.text("#/body", "title", e.text, {}, p);
    else if (e.kind === "heading") b.heading("#/body", e.text, e.level ?? 1, p);
    else if (e.kind === "list") {
      group ??= b.group("#/body", "list", "list");
      b.listItem(group, e.text, e.enumerated ?? false, e.marker ?? "", p);
    } else if (e.kind === "caption") {
      const ref = b.text("#/body", "caption", e.text, {}, p);
      // A caption directly after a figure or table describes it; otherwise it introduces the next one.
      if (lastFigure && /^(图|figure|fig)/i.test(e.text)) {
        const node = b.get(lastFigure);
        if (node && Array.isArray(node.captions) && !node.captions.length) b.setCaptions(lastFigure, [ref]);
        else pendingCaption = { ref, page: e.page };
      } else pendingCaption = { ref, page: e.page };
    } else b.text("#/body", e.kind === "footnote" ? "footnote" : "text", e.text, {}, p);
    if (e.kind !== "caption") lastFigure = null;
  }
  // Furniture keeps its own layer and coordinates.
  pages.forEach((p, i) => {
    for (const l of pageLines[i]!)
      if (isFurniture(p, l))
        b.text("#/furniture", l.y > p.height / 2 ? "page_header" : "page_footer", l.text, {}, [prov(p.number, lineBox([l]), l.text.length)]);
  });
  const chars = pages.reduce((n, p) => n + p.runs.reduce((m, r) => m + r.str.trim().length, 0), 0);
  if (chars < pages.length * 20)
    warnings.push("此 PDF 几乎没有文字层（可能是扫描件）。本地解析不做 OCR；请连接 Docling Serve 并开启 OCR 后转换。");
  return { doc: b.build(), segments: [], warnings };
}
