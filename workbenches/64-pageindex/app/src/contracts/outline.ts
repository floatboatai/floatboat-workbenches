// ABOUTME: 纯函数：从PDF书签或版面字号建立章节树、页文本拼接、引用定位、全文检索与证据页排序。
import { MAX_NODES, type IndexNode } from "./reader.ts";

/** One positioned text run as reported by PDF.js getTextContent. */
export type TextRun = {
  str: string;
  x: number;
  y: number;
  size: number;
  eol: boolean;
};
export type Line = { text: string; size: number; y: number };
export type OutlineEntry = {
  title: string;
  page: number;
  level: number;
  /** The heading starts at the top of its page, so the previous section ends one page earlier. */
  top?: boolean;
};

/** Page text exactly as stored and searched: runs joined, PDF.js line ends kept as newlines. */
export function pageText(runs: TextRun[]): string {
  return runs
    .map((r) => r.str + (r.eol ? "\n" : ""))
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .trimEnd();
}

export function linesFromRuns(runs: TextRun[]): Line[] {
  const lines: Line[] = [];
  let text = "",
    size = 0,
    y = Number.NaN,
    previousY = Number.NaN,
    previousSize = 0,
    broken = true;
  const flush = () => {
    const value = text.replace(/\s+/g, " ").trim();
    if (value) lines.push({ text: value, size, y });
    text = "";
    size = 0;
    y = Number.NaN;
  };
  for (const run of runs) {
    const moved =
      !Number.isNaN(previousY) &&
      Math.abs(run.y - previousY) > Math.max(2, previousSize * 0.5);
    if ((broken || moved) && text) flush();
    if (Number.isNaN(y)) y = run.y;
    text += run.str;
    if (run.str.trim()) size = Math.max(size, Math.round(run.size * 10) / 10);
    previousY = run.y;
    if (run.str.trim()) previousSize = run.size;
    broken = run.eol;
  }
  flush();
  return lines;
}

const numbered = /^(?:(\d{1,2}(?:\.\d{1,2}){0,3})\.?\s+\S|(?:chapter|section|part|appendix)\s+[\dA-Z]+\b|第[一二三四五六七八九十百\d]+[章节部分篇])/i;
function numberingDepth(text: string): number | null {
  const match = /^(\d{1,2}(?:\.\d{1,2}){0,3})\.?\s/.exec(text);
  return match ? match[1].split(".").length - 1 : null;
}
const leader = /(?:\.{3,}|…{2,}|\s{3,})\s*\d{1,4}$/;

/**
 * Builds heading entries from page lines when a PDF has no bookmarks: lines set clearly larger than
 * body text (or numbered and slightly larger) become headings; repeated running heads are ignored.
 */
export function detectHeadings(
  pages: { page: number; lines: Line[] }[],
): { entries: OutlineEntry[]; title: string } {
  const weight = new Map<number, number>();
  for (const p of pages)
    for (const l of p.lines) {
      const key = Math.round(l.size * 2) / 2;
      weight.set(key, (weight.get(key) ?? 0) + l.text.length);
    }
  if (!weight.size) return { entries: [], title: "" };
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const normal = (t: string) => t.replace(/\d+/g, "#").toLowerCase();
  const repeated = new Map<string, number>();
  for (const p of pages) {
    const seen = new Set(p.lines.map((l) => normal(l.text)));
    for (const key of seen) repeated.set(key, (repeated.get(key) ?? 0) + 1);
  }
  const runningLimit = Math.max(3, Math.ceil(pages.length * 0.3));
  type Candidate = { text: string; size: number; page: number; top: boolean };
  const candidates: Candidate[] = [];
  for (const p of pages) {
    p.lines.forEach((line, i) => {
      const text = line.text.trim();
      if (
        text.length < 2 ||
        text.length > 140 ||
        !/[\p{L}]/u.test(text) ||
        leader.test(text) ||
        (repeated.get(normal(text)) ?? 0) >= runningLimit
      )
        return;
      const larger = line.size >= body * 1.18;
      const marked = numbered.test(text) && line.size >= body * 1.05;
      if (!larger && !marked) return;
      const before = p.lines
        .slice(0, i)
        .filter((l) => (repeated.get(normal(l.text)) ?? 0) < runningLimit);
      candidates.push({ text, size: line.size, page: p.page, top: !before.length });
    });
  }
  if (!candidates.length) return { entries: [], title: "" };
  const classes: { size: number; count: number }[] = [];
  for (const c of [...candidates].sort((a, b) => b.size - a.size)) {
    const known = classes.find((k) => Math.abs(k.size - c.size) <= 0.75);
    if (known) known.count++;
    else classes.push({ size: c.size, count: 1 });
  }
  let title = "";
  while (classes.length > 1 && classes[0].count === 1) {
    const size = classes.shift()!.size;
    const index = candidates.findIndex((c) => Math.abs(c.size - size) <= 0.75);
    title ||= candidates[index].text;
    candidates.splice(index, 1);
  }
  const levels = classes.slice(0, 3);
  const levelOf = (size: number) => {
    const i = levels.findIndex((k) => Math.abs(k.size - size) <= 0.75);
    return i < 0 ? levels.length : i;
  };
  let kept = candidates.filter((c) => levelOf(c.size) < levels.length);
  if (kept.length > MAX_NODES / 2) kept = kept.filter((c) => levelOf(c.size) === 0);
  const entries = kept.slice(0, MAX_NODES).map((c) => {
    const depth = numberingDepth(c.text);
    return {
      title: c.text,
      page: c.page,
      level: depth ?? levelOf(c.size),
      top: c.top,
    };
  });
  return { entries, title };
}

/** Nests ordered entries into a PageIndex-shaped tree with page ranges. */
export function buildTree(entries: OutlineEntry[], pageCount: number): IndexNode[] {
  const list = entries
    .filter((e) => e.title.trim() && e.page >= 1 && e.page <= pageCount)
    .slice(0, MAX_NODES)
    .map((e) => ({ ...e, level: Math.max(0, Math.min(10, Math.floor(e.level))) }));
  const roots: IndexNode[] = [],
    stack: { level: number; node: IndexNode }[] = [];
  list.forEach((entry, i) => {
    let end = pageCount;
    for (let j = i + 1; j < list.length; j++)
      if (list[j].level <= entry.level) {
        end = list[j].top === false ? list[j].page : list[j].page - 1;
        break;
      }
    const node: IndexNode = {
      node_id: String(i + 1).padStart(4, "0"),
      title: entry.title.replace(/\s+/g, " ").trim().slice(0, 500),
      start_index: entry.page,
      end_index: Math.min(pageCount, Math.max(entry.page, end)),
    };
    while (stack.length && stack[stack.length - 1].level >= entry.level) stack.pop();
    const parent = stack[stack.length - 1]?.node;
    if (parent) {
      (parent.nodes ??= []).push(node);
      parent.end_index = Math.max(parent.end_index, node.end_index);
    } else roots.push(node);
    stack.push({ level: entry.level, node });
  });
  return roots;
}

/** Last-resort navigation for documents without bookmarks or detectable headings. */
export function pageRanges(pageCount: number, size = 10): IndexNode[] {
  const nodes: IndexNode[] = [];
  for (let start = 1; start <= pageCount; start += size) {
    const end = Math.min(pageCount, start + size - 1);
    nodes.push({
      node_id: String(nodes.length + 1).padStart(4, "0"),
      title: start === end ? `第${start}页` : `第${start}–${end}页`,
      start_index: start,
      end_index: end,
    });
  }
  return nodes;
}

const fold = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/­/g, "");

export type RunSpan = { run: number; from: number; to: number };
/**
 * Locates a quote inside text runs, ignoring whitespace differences. Long quotes that do not match
 * exactly are anchored by their first and last 24 characters. Returns, per covered run, the character
 * range [from, to) in that run's original string.
 */
export function quoteSpans(runs: string[], quote: string): RunSpan[] {
  const owner: { run: number; at: number }[] = [];
  let joined = "";
  runs.forEach((run, i) => {
    for (let at = 0; at < run.length; at++) {
      const ch = fold(run[at]);
      if (ch && !/\s/.test(ch)) {
        joined += ch;
        owner.push({ run: i, at });
      }
    }
  });
  const q = fold(quote).replace(/\s+/g, "");
  if (q.length < 2 || !joined) return [];
  let start = joined.indexOf(q),
    end = start + q.length;
  if (start < 0 && q.length > 48) {
    const head = joined.indexOf(q.slice(0, 24)),
      tail = head < 0 ? -1 : joined.indexOf(q.slice(-24), head);
    if (head < 0 || tail < 0 || tail + 24 - head > q.length * 1.5) return [];
    start = head;
    end = tail + 24;
  }
  if (start < 0) return [];
  const spans: RunSpan[] = [];
  for (const { run, at } of owner.slice(start, end)) {
    const last = spans[spans.length - 1];
    if (last?.run === run) last.to = at + 1;
    else spans.push({ run, from: at, to: at + 1 });
  }
  return spans;
}
/** Run indices covered by a quote (see quoteSpans). */
export function quoteRuns(runs: string[], quote: string): number[] {
  return quoteSpans(runs, quote).map((s) => s.run);
}

export type SearchHit = { page: number; snippet: string; offset: number };
/** Case-insensitive literal search across page texts with short context snippets. */
export function searchPages(
  pages: { number: number; text: string }[],
  query: string,
  limit = 200,
): SearchHit[] {
  const needle = query.replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " "),
      lower = text.toLowerCase();
    for (
      let at = lower.indexOf(needle);
      at >= 0 && hits.length < limit;
      at = lower.indexOf(needle, at + needle.length)
    ) {
      const from = Math.max(0, at - 36),
        to = Math.min(text.length, at + needle.length + 48);
      hits.push({
        page: page.number,
        offset: at,
        snippet:
          (from ? "…" : "") + text.slice(from, to).trim() + (to < text.length ? "…" : ""),
      });
    }
    if (hits.length >= limit) break;
  }
  return hits;
}

const stop = new Set(
  "the and for are was were with that this from what which when where who how why does did have has had into about their there them they then than your our its can could should would will shall may might any all per not but use used".split(
    " ",
  ),
);
export function terms(text: string): string[] {
  const lower = text.toLowerCase();
  const words = (lower.match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !stop.has(w));
  const han = lower.match(/[\p{Script=Han}]+/gu) ?? [];
  const pairs = han.flatMap((run) =>
    run.length === 1
      ? [run]
      : Array.from({ length: run.length - 1 }, (_, i) => run.slice(i, i + 2)),
  );
  return [...words, ...pairs];
}

/**
 * Picks the most relevant pages of the selected chapters within the evidence budget, so long chapters
 * narrow to their best pages instead of failing. Returned in reading order.
 */
export function rankEvidence(
  question: string,
  pages: { number: number; text: string }[],
  budget: { maxPages: number; maxChars: number; matchOnly?: boolean },
): number[] {
  const query = [...new Set(terms(question))];
  const docs = pages.map((p) => {
    const counts = new Map<string, number>();
    for (const t of terms(p.text)) counts.set(t, (counts.get(t) ?? 0) + 1);
    return { page: p, counts };
  });
  const idf = new Map(
    query.map((t) => {
      const n = docs.filter((d) => d.counts.has(t)).length;
      return [t, Math.log(1 + docs.length / (1 + n))];
    }),
  );
  const scored = docs
    .map((d) => ({
      number: d.page.number,
      length: d.page.text.length,
      score: query.reduce(
        (sum, t) => sum + Math.log(1 + (d.counts.get(t) ?? 0)) * (idf.get(t) ?? 0),
        0,
      ),
    }))
    .filter((d) => d.length > 0 && (!budget.matchOnly || d.score > 0))
    .sort((a, b) => b.score - a.score || a.number - b.number);
  const chosen: number[] = [];
  let chars = 0;
  for (const d of scored) {
    if (chosen.length >= budget.maxPages) break;
    if (chars + d.length > budget.maxChars) continue;
    chosen.push(d.number);
    chars += d.length;
  }
  return chosen.sort((a, b) => a - b);
}
