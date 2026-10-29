// Source grounding in the same spirit as LangExtract's resolver: every extraction is
// mapped back to a half-open interval of Python Unicode codepoints in the source.
// Order: exact codepoint match (after the previous match first), then a normalized
// match (NFKC, case and whitespace), then a token-level fuzzy match with ratio >= 0.75.
// Nothing is invented: when no candidate reaches the threshold the record stays unaligned.

export type AlignmentStatus = "match_exact" | "match_fuzzy";
export interface Alignment {
  start: number;
  end: number;
  status: AlignmentStatus;
  ratio: number;
}
export const FUZZY_THRESHOLD = 0.75;

interface Token {
  norm: string;
  start: number;
  end: number;
}
const CJK =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD = /[\p{L}\p{N}\p{M}_]/u;
const SPACE = /\s/u;
const norm = (c: string) => c.normalize("NFKC").toLowerCase();

/** Tokens over codepoints: CJK characters stand alone, other letters/digits form words, punctuation is one token. */
export function tokenize(chars: string[]): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (SPACE.test(c)) {
      i++;
      continue;
    }
    if (CJK.test(c) || !WORD.test(c)) {
      out.push({ norm: norm(c), start: i, end: i + 1 });
      i++;
      continue;
    }
    let j = i;
    let word = "";
    while (j < chars.length && WORD.test(chars[j]) && !CJK.test(chars[j])) {
      word += chars[j];
      j++;
    }
    out.push({ norm: norm(word), start: i, end: j });
    i = j;
  }
  return out;
}

function findSequence(
  hay: string[],
  needle: string[],
  from: number,
): number {
  const n = needle.length;
  outer: for (let i = Math.max(0, from); i + n <= hay.length; i++) {
    for (let k = 0; k < n; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

/** Characters with whitespace removed and NFKC/case folded, keeping a map back to codepoints. */
function folded(chars: string[]) {
  const folded: string[] = [],
    map: number[] = [];
  chars.forEach((c, i) => {
    if (SPACE.test(c)) return;
    for (const f of Array.from(norm(c))) {
      folded.push(f);
      map.push(i);
    }
  });
  return { folded, map };
}

function lcs(a: string[], b: string[]): number {
  const row = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(row[j], row[j - 1]);
      prev = temp;
    }
  }
  return row[b.length];
}

export interface AlignContext {
  chars: string[];
  tokens: Token[];
  fold: { folded: string[]; map: number[] };
  byToken: Map<string, number[]>;
}
export function alignContext(source: string): AlignContext {
  const chars = Array.from(source),
    tokens = tokenize(chars),
    byToken = new Map<string, number[]>();
  tokens.forEach((t, i) => {
    const list = byToken.get(t.norm);
    if (list) list.push(i);
    else byToken.set(t.norm, [i]);
  });
  return { chars, tokens, fold: folded(chars), byToken };
}

/** Align one extraction text inside the source. `cursor` prefers occurrences after the previous record. */
export function alignExtraction(
  source: string | AlignContext,
  text: string,
  cursor = 0,
): Alignment | null {
  const ctx = typeof source === "string" ? alignContext(source) : source;
  const needle = Array.from(text.trim());
  if (!needle.length || needle.length > ctx.chars.length) return null;
  let at = findSequence(ctx.chars, needle, cursor);
  if (at < 0) at = findSequence(ctx.chars, needle, 0);
  if (at >= 0)
    return { start: at, end: at + needle.length, status: "match_exact", ratio: 1 };
  const q = folded(needle).folded;
  if (q.length) {
    const startCursor = ctx.fold.map.findIndex((i) => i >= cursor);
    let f = startCursor < 0 ? -1 : findSequence(ctx.fold.folded, q, startCursor);
    if (f < 0) f = findSequence(ctx.fold.folded, q, 0);
    if (f >= 0)
      return {
        start: ctx.fold.map[f],
        end: ctx.fold.map[f + q.length - 1] + 1,
        status: "match_exact",
        ratio: 1,
      };
  }
  const qt = tokenize(needle).map((t) => t.norm);
  if (qt.length < 2) return null;
  const starts = new Set<number>();
  for (const t of qt)
    for (const i of ctx.byToken.get(t) ?? []) starts.add(Math.max(0, i - qt.length + 1)), starts.add(i);
  let best: { start: number; end: number; ratio: number; distance: number } | null =
    null;
  const lengths = [qt.length - 1, qt.length, qt.length + 1].filter((l) => l > 0);
  for (const s of starts) {
    for (const len of lengths) {
      if (s + len > ctx.tokens.length) continue;
      const window = ctx.tokens.slice(s, s + len);
      // Window must start and end on a matching token, otherwise it is padding.
      if (!qt.includes(window[0].norm) || !qt.includes(window[len - 1].norm)) continue;
      const ratio = (2 * lcs(qt, window.map((w) => w.norm))) / (qt.length + len);
      const distance = Math.abs(window[0].start - cursor);
      if (
        ratio >= FUZZY_THRESHOLD &&
        (!best ||
          ratio > best.ratio + 1e-9 ||
          (Math.abs(ratio - best.ratio) < 1e-9 &&
            (window[0].start >= cursor) &&
            distance < best.distance))
      )
        best = { start: window[0].start, end: window[len - 1].end, ratio, distance };
    }
  }
  return best
    ? { start: best.start, end: best.end, status: "match_fuzzy", ratio: Math.round(best.ratio * 1000) / 1000 }
    : null;
}

/** Codepoint offsets for a UTF-16 index pair, used for browser selections. */
export function codepointRange(text: string, a16: number, b16: number) {
  const start = Array.from(text.slice(0, Math.min(a16, b16))).length,
    end = start + Array.from(text.slice(Math.min(a16, b16), Math.max(a16, b16))).length;
  return { start, end };
}
export function sliceCodepoints(text: string, start: number, end: number) {
  return Array.from(text).slice(start, end).join("");
}
