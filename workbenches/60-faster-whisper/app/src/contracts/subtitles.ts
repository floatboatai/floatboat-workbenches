// ABOUTME: 字幕交换格式：SRT/VTT（含 <v> 说话人）、faster-whisper 分段/逐词 JSON 的导入，SRT/VTT/TXT/JSON 导出。
import { isRecord, boundedText } from "./project.ts";
import { joinText, segmentCues } from "./edit.ts";
import {
  clock,
  emptyTranscript,
  seconds,
  validateTranscript,
  MAX_CUES,
  MAX_SECONDS,
  type Cue,
  type Segment,
  type SegmentWord,
  type Speaker,
  type Transcript,
} from "./transcript.ts";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function validateSegments(v: unknown): Segment[] {
  if (!Array.isArray(v) || v.length > MAX_CUES) throw new Error("转写分段数量无效。");
  return v.map((s) => {
    if (
      !isRecord(s) ||
      !finite(s.start) ||
      !finite(s.end) ||
      s.start < 0 ||
      s.end <= s.start ||
      s.end > MAX_SECONDS
    )
      throw new Error("转写时间戳无效。");
    const out: Segment = { start: s.start, end: s.end, text: boundedText(s.text, 4000) };
    if (s.words !== undefined && s.words !== null) {
      if (!Array.isArray(s.words) || s.words.length > 1500) throw new Error("逐词时间戳无效。");
      out.words = s.words.map((w): SegmentWord => {
        if (
          !isRecord(w) ||
          !finite(w.start) ||
          !finite(w.end) ||
          w.start < 0 ||
          w.end < w.start ||
          w.end > MAX_SECONDS ||
          (w.probability !== undefined && w.probability !== null && !finite(w.probability))
        )
          throw new Error("逐词时间戳无效。");
        return {
          start: w.start,
          end: w.end,
          word: boundedText(w.word, 200),
          probability: finite(w.probability) ? Math.min(1, Math.max(0, w.probability)) : -1,
        };
      });
    }
    if (typeof s.speaker === "string" && s.speaker.trim()) out.speaker = boundedText(s.speaker.trim(), 40);
    return out;
  });
}

export interface Imported {
  cues: Cue[];
  speakers: Speaker[];
}
function speakersFor(names: (string | undefined)[], existing: Speaker[] = []) {
  const speakers = [...existing],
    ids = new Map(existing.map((s) => [s.name, s.id]));
  for (const name of names)
    if (name && !ids.has(name)) {
      const id = `spk-${speakers.length + 1}-${Math.random().toString(36).slice(2, 7)}`;
      speakers.push({ id, name });
      ids.set(name, id);
    }
  return { speakers, ids };
}

/** Parse SRT, WebVTT or faster-whisper segment JSON (with optional `words` and `speaker`). */
export function importSubtitles(text: string, name: string, existing: Speaker[] = []): Imported {
  if (new TextEncoder().encode(text).length > 8_000_000) throw new Error("字幕文件超过 8 MB。");
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (/\.json$/i.test(name) || clean.startsWith("{") || clean.startsWith("[")) {
    let raw: unknown;
    try {
      raw = JSON.parse(clean);
    } catch {
      throw new Error("JSON 无法解析。");
    }
    const segments = validateSegments(Array.isArray(raw) ? raw : isRecord(raw) ? raw.segments : undefined);
    const { speakers, ids } = speakersFor(segments.map((s) => s.speaker), existing);
    return checked(segmentCues(segments, ids), speakers);
  }
  const blocks = clean.replace(/^WEBVTT[^\n]*(?:\n[^\n]+)*?\n\n/, "").split(/\n\s*\n/);
  const rows: { start: string; end: string; text: string; speaker?: string }[] = [];
  for (const block of blocks) {
    if (!block.trim() || /^(WEBVTT|NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(block)) continue;
    const lines = block.split("\n"),
      index = lines.findIndex((l) => l.includes("-->"));
    if (index < 0) throw new Error("字幕缺少有效时间轴，请导入 SRT、VTT 或分段 JSON。");
    const pair = lines[index].match(
      /^\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})(?:\s+.*)?$/,
    );
    if (!pair) throw new Error(`字幕时间轴无法解析：${lines[index].slice(0, 60)}`);
    const normalize = (s: string) => clock(seconds((s.split(":").length === 2 ? "00:" : "") + s));
    let body = lines.slice(index + 1).join("\n");
    let speaker: string | undefined;
    const voice = /^<v(?:\.[^\s>]+)*\s+([^>]{1,40})>/.exec(body);
    if (voice) {
      speaker = voice[1].trim();
      body = body.replace(/<\/?v(?:[.\s][^>]*)?>/g, "");
    }
    rows.push({ start: normalize(pair[1]), end: normalize(pair[2]), text: body, speaker });
    if (rows.length > MAX_CUES) throw new Error(`最多支持 ${MAX_CUES} 行字幕。`);
  }
  if (!rows.length) throw new Error("没有找到字幕行。");
  const { speakers, ids } = speakersFor(rows.map((r) => r.speaker), existing);
  return checked(
    rows.map((r, i) => ({
      id: `cue-${i + 1}`,
      start: r.start,
      end: r.end,
      text: r.text,
      reviewed: false,
      speaker: r.speaker ? ids.get(r.speaker)! : "",
      words: [],
    })),
    speakers,
  );
}
function checked(cues: Cue[], speakers: Speaker[]): Imported {
  const data = validateTranscript({ ...emptyTranscript, cues, speakers });
  return { cues: data.cues, speakers: data.speakers };
}

export type ExportFormat = "srt" | "vtt" | "txt" | "json";
export interface ExportOptions {
  speakers: boolean;
  times: boolean;
}
export const exportMime: Record<ExportFormat, string> = {
  srt: "application/x-subrip;charset=utf-8",
  vtt: "text/vtt;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  json: "application/json",
};

export function exportSubtitles(
  input: Transcript,
  format: ExportFormat,
  o: ExportOptions = { speakers: true, times: false },
): string {
  const data = validateTranscript(input),
    names = new Map(data.speakers.map((s) => [s.id, s.name.trim()])),
    who = (c: Cue) => (o.speakers ? (names.get(c.speaker) ?? "") : "");
  const cues = data.cues;
  if (format === "json")
    return (
      JSON.stringify(
        {
          format: "floatboat-subtitle-segments",
          version: 1,
          language: data.language,
          origin: data.origin,
          speakers: data.speakers.map((s) => s.name),
          segments: cues.map((c, i) => ({
            id: i,
            start: seconds(c.start),
            end: seconds(c.end),
            text: c.text,
            speaker: names.get(c.speaker) ?? null,
            reviewed: c.reviewed,
            words: c.words.map((w) => ({
              start: w.s,
              end: w.e,
              word: w.w,
              probability: w.p < 0 ? null : w.p,
            })),
          })),
        },
        null,
        2,
      ) + "\n"
    );
  if (format === "txt") {
    if (!o.speakers && !o.times) return cues.map((c) => c.text).join("\n\n") + "\n";
    const paragraphs: string[] = [];
    let last: string | null = null;
    for (const c of cues) {
      const name = who(c),
        stamp = o.times ? `[${clock(seconds(c.start)).slice(0, 8)}] ` : "";
      if (o.speakers && name === last && !o.times) paragraphs[paragraphs.length - 1] = joinText(paragraphs[paragraphs.length - 1], c.text);
      else paragraphs.push(`${stamp}${name ? name + "：" : ""}${c.text}`);
      last = name;
    }
    return paragraphs.join("\n\n") + "\n";
  }
  const sep = format === "srt" ? "," : ".";
  return (
    (format === "vtt" ? "WEBVTT\n\n" : "") +
    cues
      .map((c, i) => {
        const name = who(c),
          body = c.text.replace(/\n\s*\n/g, "\n");
        const line =
          format === "vtt"
            ? name
              ? `<v ${name.replace(/[<>]/g, "")}>${body}`
              : body
            : name
              ? `${name}：${body}`
              : body;
        return `${i + 1}\n${clock(seconds(c.start), sep)} --> ${clock(seconds(c.end), sep)}\n${line}`;
      })
      .join("\n\n") +
    "\n"
  );
}
