import type { EditorDocument } from "oasis-editor";

/** Structural aliases derived from the public EditorDocument type. */
export type Section = NonNullable<EditorDocument["sections"]>[number];
export type Block = Section["blocks"][number];
export type Paragraph = Extract<Block, { type: "paragraph" }>;
export type Run = Paragraph["runs"][number];
export type PageSettings = Section["pageSettings"];
export type Position = { paragraphId: string; runId: string; offset: number };
export type Selection = { anchor: Position; focus: Position };
export type Comments = NonNullable<EditorDocument["comments"]>;
export type Comment = Comments["items"][string];

/** Page geometry in CSS px (96/in) derived from exact OOXML twips (1 px = 15 twips). */
const tw = (twips: number) => twips / 15;
export const PAGE_SIZES = [
  { id: "A4", label: "A4", detail: "21 × 29.7 厘米", width: tw(11906), height: tw(16838) },
  { id: "A5", label: "A5", detail: "14.8 × 21 厘米", width: tw(8391), height: tw(11906) },
  { id: "B5", label: "B5 (JIS)", detail: "18.2 × 25.7 厘米", width: tw(10319), height: tw(14571) },
  { id: "Letter", label: "Letter", detail: "21.59 × 27.94 厘米", width: tw(12240), height: tw(15840) },
] as const;
export const MARGIN_PRESETS = [
  { id: "normal", label: "普通", detail: "上下 2.54 · 左右 3.18 厘米", top: tw(1440), bottom: tw(1440), left: tw(1800), right: tw(1800) },
  { id: "narrow", label: "窄", detail: "四边 1.27 厘米", top: tw(720), bottom: tw(720), left: tw(720), right: tw(720) },
  { id: "moderate", label: "适中", detail: "上下 2.54 · 左右 1.91 厘米", top: tw(1440), bottom: tw(1440), left: tw(1080), right: tw(1080) },
  { id: "wide", label: "宽", detail: "上下 2.54 · 左右 5.08 厘米", top: tw(1440), bottom: tw(1440), left: tw(2880), right: tw(2880) },
] as const;
export const A4_PORTRAIT: PageSettings = {
  width: PAGE_SIZES[0].width,
  height: PAGE_SIZES[0].height,
  orientation: "portrait",
  margins: { top: tw(1440), right: tw(1800), bottom: tw(1440), left: tw(1800), header: tw(851), footer: tw(992), gutter: 0 },
};

export function sectionsOf(doc: EditorDocument): Section[] {
  return doc.sections ?? [];
}
export function firstPage(doc: EditorDocument): PageSettings | undefined {
  return sectionsOf(doc)[0]?.pageSettings ?? doc.pageSettings;
}
/** Which named page size (if any) matches regardless of orientation. */
export function pageSizeId(page: PageSettings | undefined): string | null {
  if (!page) return null;
  const short = Math.min(page.width, page.height),
    long = Math.max(page.width, page.height);
  return PAGE_SIZES.find((s) => Math.abs(s.width - short) <= 2 && Math.abs(s.height - long) <= 2)?.id ?? null;
}
export function marginPresetId(page: PageSettings | undefined): string | null {
  if (!page) return null;
  const m = page.margins;
  return (
    MARGIN_PRESETS.find(
      (p) =>
        Math.abs(p.top - m.top) <= 1 &&
        Math.abs(p.bottom - m.bottom) <= 1 &&
        Math.abs(p.left - m.left) <= 1 &&
        Math.abs(p.right - m.right) <= 1,
    )?.id ?? null
  );
}
/** Apply a page size to every section, keeping each section's orientation. */
export function withPageSize(doc: EditorDocument, sizeId: string): EditorDocument {
  const size = PAGE_SIZES.find((s) => s.id === sizeId);
  if (!size) throw Error("未知纸张大小。");
  const apply = (page: PageSettings): PageSettings => {
    const landscape = page.orientation === "landscape" || page.width > page.height;
    return {
      ...page,
      width: landscape ? size.height : size.width,
      height: landscape ? size.width : size.height,
    };
  };
  return {
    ...doc,
    ...(doc.pageSettings ? { pageSettings: apply(doc.pageSettings) } : {}),
    sections: sectionsOf(doc).map((section) => ({ ...section, pageSettings: apply(section.pageSettings) })),
  };
}

/** Visit every paragraph of the main story (including table cells) in document order. */
export function bodyParagraphs(doc: EditorDocument): Paragraph[] {
  const out: Paragraph[] = [];
  const visit = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.type === "paragraph") out.push(block);
      else for (const row of block.rows) for (const cell of row.cells) visit(cell.blocks);
    }
  };
  for (const section of sectionsOf(doc)) visit(section.blocks);
  return out;
}

export type RevisionMark = {
  id: string;
  type: "insert" | "delete";
  author: string;
  date: number;
  text: string;
  order: number;
  selection: Selection;
};
/** Group runs sharing one revision id into a navigable, selectable range. */
export function listRevisions(doc: EditorDocument): RevisionMark[] {
  const marks: RevisionMark[] = [];
  bodyParagraphs(doc).forEach((paragraph, paragraphIndex) => {
    let current: RevisionMark | null = null;
    paragraph.runs.forEach((run, runIndex) => {
      const revision = run.revision;
      if (!revision) {
        current = null;
        return;
      }
      if (current && current.id === revision.id) {
        current.text += run.text;
        current.selection.focus = { paragraphId: paragraph.id, runId: run.id, offset: run.text.length };
        return;
      }
      current = {
        id: revision.id,
        type: revision.type,
        author: revision.author || "未署名",
        date: revision.date,
        text: run.text,
        order: paragraphIndex * 100000 + runIndex,
        selection: {
          anchor: { paragraphId: paragraph.id, runId: run.id, offset: 0 },
          focus: { paragraphId: paragraph.id, runId: run.id, offset: run.text.length },
        },
      };
      marks.push(current);
    });
  });
  return marks;
}
/** Document order of a caret position; unknown positions sort first. */
export function positionOrder(doc: EditorDocument, position: Position): number {
  const paragraphs = bodyParagraphs(doc);
  const paragraphIndex = paragraphs.findIndex((p) => p.id === position.paragraphId);
  if (paragraphIndex < 0) return -1;
  const runIndex = Math.max(0, paragraphs[paragraphIndex].runs.findIndex((r) => r.id === position.runId));
  return paragraphIndex * 100000 + runIndex + Math.min(position.offset, 99999) / 100000;
}
/** Next/previous revision relative to the caret, wrapping around the document. */
export function adjacentRevision(
  doc: EditorDocument,
  marks: RevisionMark[],
  from: Position,
  direction: 1 | -1,
): RevisionMark | null {
  if (!marks.length) return null;
  const here = positionOrder(doc, from);
  if (direction === 1) return marks.find((m) => m.order > Math.floor(here)) ?? marks[0];
  return [...marks].reverse().find((m) => m.order < Math.floor(here)) ?? marks[marks.length - 1];
}

/** Offset into the paragraph's flattened text stream for a run-relative position. */
export function paragraphOffset(paragraph: Paragraph, position: Position): number {
  let offset = 0;
  for (const run of paragraph.runs) {
    if (run.id === position.runId) return offset + Math.min(position.offset, run.text.length);
    offset += run.text.length;
  }
  return offset;
}
export function positionAt(paragraph: Paragraph, offset: number): Position {
  let seen = 0;
  for (const run of paragraph.runs) {
    if (offset <= seen + run.text.length) return { paragraphId: paragraph.id, runId: run.id, offset: offset - seen };
    seen += run.text.length;
  }
  const last = paragraph.runs.at(-1);
  return { paragraphId: paragraph.id, runId: last?.id ?? "", offset: last?.text.length ?? 0 };
}
export function listComments(doc: EditorDocument): Comment[] {
  const comments = doc.comments;
  if (!comments) return [];
  return comments.order.map((id) => comments.items[id]).filter((c): c is Comment => !!c);
}
/** Anchor a new comment to the (non-empty) selection. */
export function addComment(
  doc: EditorDocument,
  selection: Selection,
  body: string,
  author: string,
  now = Date.now(),
  newId = `comment:${now.toString(36)}`,
): EditorDocument {
  const text = body.trim();
  if (!text) throw Error("批注内容不能为空。");
  if (text.length > 2000) throw Error("批注不超过 2000 字。");
  const paragraphs = bodyParagraphs(doc);
  const find = (p: Position) => paragraphs.find((x) => x.id === p.paragraphId);
  const a = find(selection.anchor),
    f = find(selection.focus);
  if (!a || !f) throw Error("请在正文中选中要批注的文字。");
  let start = { paragraphId: a.id, offset: paragraphOffset(a, selection.anchor) };
  let end = { paragraphId: f.id, offset: paragraphOffset(f, selection.focus) };
  if (positionOrder(doc, selection.anchor) > positionOrder(doc, selection.focus)) [start, end] = [end, start];
  if (start.paragraphId === end.paragraphId && start.offset === end.offset)
    throw Error("请先选中要批注的文字。");
  const name = author.trim().slice(0, 80) || "编辑者";
  const comment: Comment = { id: newId, author: name, initials: name.slice(0, 1), date: now, text, start, end };
  const previous = doc.comments ?? { items: {}, order: [] };
  return {
    ...doc,
    comments: { items: { ...previous.items, [newId]: comment }, order: [...previous.order, newId] },
  };
}
export function updateComment(
  doc: EditorDocument,
  commentId: string,
  patch: { resolved?: boolean; remove?: boolean },
): EditorDocument {
  const previous = doc.comments;
  if (!previous?.items[commentId]) return doc;
  const items = { ...previous.items };
  let order = previous.order;
  if (patch.remove) {
    const doomed = new Set([commentId, ...order.filter((id) => items[id]?.parentId === commentId)]);
    for (const id of doomed) delete items[id];
    order = order.filter((id) => !doomed.has(id));
  } else items[commentId] = { ...items[commentId], resolved: !!patch.resolved };
  return { ...doc, comments: { items, order } };
}
export function commentSelection(doc: EditorDocument, comment: Comment): Selection | null {
  const paragraphs = bodyParagraphs(doc);
  const start = comment.start && paragraphs.find((p) => p.id === comment.start!.paragraphId);
  const end = comment.end && paragraphs.find((p) => p.id === comment.end!.paragraphId);
  if (!start || !end || !comment.start || !comment.end) return null;
  return { anchor: positionAt(start, comment.start.offset), focus: positionAt(end, comment.end.offset) };
}

/** Caret position in the main story to return to from a footnote (after its reference) or header. */
export function bodyReturnPosition(doc: EditorDocument, footnoteId: string | null): Position | null {
  const paragraphs = bodyParagraphs(doc);
  if (footnoteId)
    for (const paragraph of paragraphs)
      for (const run of paragraph.runs)
        if (run.kind === "footnoteReference" && run.footnoteReference.footnoteId === footnoteId)
          return { paragraphId: paragraph.id, runId: run.id, offset: run.text.length };
  const first = paragraphs[0];
  return first?.runs[0] ? { paragraphId: first.id, runId: first.runs[0].id, offset: 0 } : null;
}
