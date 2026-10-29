// ABOUTME: 字幕校对的纯变换：逐词时间重对齐、按词/播放头拆分、合并、入出点微调、查找替换。
import {
  clock,
  round3,
  seconds,
  trySeconds,
  type Cue,
  type Segment,
  type Word,
} from "./transcript.ts";

const CJK =
  /[⺀-⿿　-〿぀-ヿ㄀-ㇿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/u;
const PUNCT = /[\p{P}\p{S}]/u;
const OPENING = /[\p{Ps}\p{Pi}]/u;
export const isCjk = (ch: string) => CJK.test(ch);
const visible = (text: string) => Array.from(text).filter((c) => !/\s/u.test(c));
/** Canonical comparison form: case-folded, full-width ASCII folded, whitespace removed. */
function fold(ch: string) {
  const code = ch.codePointAt(0)!;
  const half =
    code >= 0xff01 && code <= 0xff5e ? String.fromCodePoint(code - 0xfee0) : ch;
  return half === "、" ? "," : half === "。" ? "." : half.toLowerCase();
}

export function joinText(a: string, b: string) {
  const left = a.trimEnd(),
    right = b.trimStart();
  if (!left || !right) return left + right;
  const last = Array.from(left).at(-1)!,
    first = Array.from(right)[0];
  return isCjk(last) || isCjk(first) ? left + right : `${left} ${right}`;
}
export const wordsText = (words: Word[]) => words.map((w) => w.w).join("");
export function wordsAligned(cue: Pick<Cue, "text" | "words">) {
  if (!cue.words.length) return false;
  const a = visible(wordsText(cue.words)).map(fold).join(""),
    b = visible(cue.text).map(fold).join("");
  return a === b;
}
export const lowConfidence = (w: Word, threshold = 0.5) => w.p >= 0 && w.p < threshold;

interface CharTime {
  s: number;
  e: number;
  p: number;
  word: number;
}
function charTimes(words: Word[]): { ch: string; t: CharTime }[] {
  const out: { ch: string; t: CharTime }[] = [];
  words.forEach((w, word) => {
    const chars = visible(w.w),
      span = (w.e - w.s) / Math.max(1, chars.length);
    chars.forEach((ch, i) =>
      out.push({
        ch: fold(ch),
        t: { s: w.s + span * i, e: w.s + span * (i + 1), p: w.p, word },
      }),
    );
  });
  return out;
}

/**
 * Re-time edited text from the cue's existing word timings. Characters that survive the edit keep
 * their recognised time; inserted characters are interpolated between their neighbours and marked
 * as hand edited (probability -1). Without previous words, timings are spread over the cue.
 */
export function realign(text: string, words: Word[], start: number, end: number): Word[] {
  const next = Array.from(text);
  const chars = next
    .map((ch, index) => ({ ch, index }))
    .filter(({ ch }) => !/\s/u.test(ch));
  if (!chars.length) return [];
  const old = charTimes(words);
  const n = old.length,
    m = chars.length;
  const map: (CharTime | null)[] = new Array(m).fill(null);
  if (n && n * m <= 4_000_000) {
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] =
          old[i].ch === fold(chars[j].ch)
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0,
      j = 0;
    while (i < n && j < m) {
      if (old[i].ch === fold(chars[j].ch)) {
        map[j] = old[i].t;
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
  }
  // Interpolate unmatched runs between the surrounding matched characters (or the cue bounds).
  const times: CharTime[] = [];
  let k = 0;
  while (k < m) {
    if (map[k]) {
      times.push(map[k]!);
      k++;
      continue;
    }
    let r = k;
    while (r < m && !map[r]) r++;
    const from = k > 0 ? times[k - 1].e : start,
      to = r < m ? map[r]!.s : end,
      lo = Math.min(from, to),
      step = Math.max(0, to - lo) / (r - k);
    for (let x = k; x < r; x++)
      times.push({ s: lo + step * (x - k), e: lo + step * (x - k + 1), p: -1, word: -1 });
    k = r;
  }
  // Group characters into Whisper-like word tokens.
  const tokens: { text: string; first: number; last: number; p: number; word: number; open: boolean }[] = [];
  chars.forEach(({ ch, index }, j) => {
    const pendingSpace = index > 0 && /\s/u.test(next[index - 1]);
    const t = times[j],
      current = tokens.at(-1),
      last = current ? Array.from(current.text).at(-1)! : "";
    const opening = OPENING.test(ch);
    const glue =
      !!current &&
      !pendingSpace &&
      !opening &&
      (current.open ||
        PUNCT.test(ch) ||
        (!isCjk(ch) && !isCjk(last) && !PUNCT.test(last)) ||
        (t.word >= 0 && t.word === current.word));
    if (current && glue) {
      current.text += ch;
      current.last = j;
      if (current.open) {
        current.open = false;
        current.p = t.p;
        current.word = t.word;
      } else if (!PUNCT.test(ch)) current.p = current.p < 0 || t.p < 0 ? -1 : Math.min(current.p, t.p);
    } else
      tokens.push({
        text: (pendingSpace && tokens.length ? " " : "") + ch,
        first: j,
        last: j,
        p: t.p,
        word: t.word,
        open: opening,
      });
  });
  return tokens.map((tok) => {
    const s = round3(times[tok.first].s),
      e = round3(Math.max(times[tok.last].e, times[tok.first].s));
    return { s, e: Math.max(s, e), w: tok.text, p: tok.p < 0 ? -1 : round3(tok.p) };
  });
}

/** Apply new text to a cue, keeping word timing aligned and clearing the review mark. */
export function retext(cue: Cue, text: string): Cue {
  if (text === cue.text) return cue;
  const start = trySeconds(cue.start),
    end = trySeconds(cue.end);
  const words =
    cue.words.length && Number.isFinite(start) && Number.isFinite(end)
      ? realign(text, cue.words, start, Math.max(start, end))
      : cue.words.length
        ? realign(text, cue.words, cue.words[0].s, cue.words.at(-1)!.e)
        : [];
  return { ...cue, text, words, reviewed: false };
}

export function segmentCues(segments: Segment[], speakerIds: Map<string, string> = new Map()): Cue[] {
  return segments.map((s, i) => {
    const words = (s.words ?? []).map((w) => ({
      s: round3(w.start),
      e: round3(Math.max(w.start, w.end)),
      w: w.word,
      p: w.probability < 0 ? -1 : round3(Math.min(1, w.probability)),
    }));
    return {
      id: `cue-${i + 1}`,
      start: clock(s.start),
      end: clock(s.end),
      text: s.text.trim(),
      reviewed: false,
      speaker: s.speaker ? (speakerIds.get(s.speaker) ?? "") : "",
      words,
    };
  });
}

/** Index in `text` after the n-th visible character. */
function textOffset(text: string, visibleCount: number) {
  const chars = Array.from(text);
  let seen = 0;
  for (let i = 0; i < chars.length; i++) {
    if (seen === visibleCount) return chars.slice(0, i).join("").length;
    if (!/\s/u.test(chars[i])) seen++;
  }
  return text.length;
}

/**
 * Split a cue. With aligned word timings the cut lands on the word boundary nearest to `at`
 * (default: the middle word), otherwise text is divided in proportion to time.
 */
export function splitCue(cue: Cue, at?: number, newId = crypto.randomUUID()): [Cue, Cue] {
  const start = seconds(cue.start),
    end = seconds(cue.end);
  if (end - start < 0.02) throw new Error("片段太短，无法拆分。");
  let time: number, cut: number, wordCut: number;
  if (wordsAligned(cue) && cue.words.length > 1) {
    const ws = cue.words;
    let k =
      at === undefined
        ? Math.ceil(ws.length / 2)
        : ws.findIndex((w) => (w.s + w.e) / 2 >= at);
    if (k < 0) k = ws.length - 1;
    k = Math.min(ws.length - 1, Math.max(1, k));
    time = at ?? (ws[k - 1].e + ws[k].s) / 2;
    if (at === undefined || Math.abs(at - ws[k].s) < 0.25) time = Math.max(ws[k - 1].e, Math.min(ws[k].s, time));
    cut = textOffset(cue.text, visible(wordsText(ws.slice(0, k))).length);
    wordCut = k;
  } else {
    time = at ?? (start + end) / 2;
    const chars = Array.from(cue.text),
      ratio = (time - start) / (end - start);
    cut = chars.slice(0, Math.round(chars.length * ratio)).join("").length;
    wordCut = cue.words.findIndex((w) => (w.s + w.e) / 2 >= time);
    if (wordCut < 0) wordCut = cue.words.length;
  }
  time = Math.min(end - 0.01, Math.max(start + 0.01, time));
  const t = clock(time);
  return [
    {
      ...cue,
      end: t,
      text: cue.text.slice(0, cut).trimEnd(),
      words: cue.words.slice(0, wordCut),
      reviewed: false,
    },
    {
      ...cue,
      id: newId,
      start: t,
      text: cue.text.slice(cut).trimStart(),
      words: cue.words.slice(wordCut),
      reviewed: false,
    },
  ];
}

export function mergeCues(first: Cue, next: Cue): Cue {
  return {
    ...first,
    end: clock(Math.max(seconds(first.end), seconds(next.end))),
    text: joinText(first.text, next.text),
    words: [
      ...first.words,
      ...next.words.map((w, i) =>
        i === 0 && first.words.length && !isCjk(Array.from(w.w.trim())[0] ?? "") && !w.w.startsWith(" ")
          ? { ...w, w: " " + w.w }
          : w,
      ),
    ],
    speaker: first.speaker || next.speaker,
    reviewed: false,
  };
}

/** Move an in or out point by `delta` seconds, never past the opposite point. */
export function nudge(cue: Cue, edge: "start" | "end", delta: number): Cue {
  const start = seconds(cue.start),
    end = seconds(cue.end);
  if (edge === "start")
    return { ...cue, start: clock(Math.max(0, Math.min(end - 0.01, start + delta))) };
  return { ...cue, end: clock(Math.max(start + 0.01, end + delta)) };
}
export function setEdge(cue: Cue, edge: "start" | "end", at: number): Cue {
  const start = trySeconds(cue.start),
    end = trySeconds(cue.end);
  if (edge === "start") {
    if (Number.isFinite(end) && at >= end) throw new Error("入点必须早于出点。");
    return { ...cue, start: clock(Math.max(0, at)) };
  }
  if (Number.isFinite(start) && at <= start) throw new Error("出点必须晚于入点。");
  return { ...cue, end: clock(at) };
}

export interface FindOptions {
  matchCase: boolean;
  regex: boolean;
}
export interface Match {
  cue: string;
  index: number;
  length: number;
}
export function pattern(query: string, o: FindOptions): RegExp | null {
  if (!query) return null;
  const source = o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(source, o.matchCase ? "gu" : "giu");
  } catch {
    throw new Error("正则表达式无效。");
  }
}
export function findMatches(cues: Cue[], query: string, o: FindOptions, limit = 5000): Match[] {
  const re = pattern(query, o);
  if (!re) return [];
  const out: Match[] = [];
  for (const cue of cues) {
    re.lastIndex = 0;
    for (const m of cue.text.matchAll(re)) {
      if (!m[0].length) continue;
      out.push({ cue: cue.id, index: m.index!, length: m[0].length });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
/** Replace one match (when `only` is given) or all matches in a cue. */
export function replaceInCue(cue: Cue, query: string, replacement: string, o: FindOptions, only?: Match): Cue {
  const re = pattern(query, o);
  if (!re) return cue;
  const sub = (value: string, expression: RegExp) =>
    o.regex ? value.replace(expression, replacement) : value.replace(expression, () => replacement);
  let text: string;
  if (only) {
    const piece = cue.text.slice(only.index, only.index + only.length);
    text = cue.text.slice(0, only.index) + sub(piece, new RegExp(re.source, re.flags.replace("g", ""))) + cue.text.slice(only.index + only.length);
  } else text = sub(cue.text, re);
  return retext(cue, text);
}

/** Give re-transcribed cues the speaker of the previous cue they overlap most (same audio only). */
export function carrySpeakers(next: Cue[], previous: Cue[]): Cue[] {
  const spans = previous
    .filter((c) => c.speaker)
    .map((c) => ({ s: trySeconds(c.start), e: trySeconds(c.end), speaker: c.speaker }))
    .filter((c) => c.e > c.s);
  if (!spans.length) return next;
  return next.map((c) => {
    const s = trySeconds(c.start),
      e = trySeconds(c.end);
    let best = "",
      most = 0;
    for (const p of spans) {
      const overlap = Math.min(e, p.e) - Math.max(s, p.s);
      if (overlap > most) {
        most = overlap;
        best = p.speaker;
      }
    }
    return best ? { ...c, speaker: best } : c;
  });
}
