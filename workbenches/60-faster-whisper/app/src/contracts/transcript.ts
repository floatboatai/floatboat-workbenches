import { boundedText, isRecord } from "./project.ts";

export const CHUNK_BYTES = 384 * 1024;
export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
export const MAX_CUES = 1200;
export interface AudioSource {
  id: string;
  name: string;
  bytes: number;
  mime: string;
}
export interface Cue {
  id: string;
  start: string;
  end: string;
  text: string;
  reviewed: boolean;
}
export interface Transcript {
  source: AudioSource | null;
  cues: Cue[];
  language: string;
  notes: string;
  origin: string;
}
export interface Segment {
  start: number;
  end: number;
  text: string;
}
export const languages = [
  ["auto", "自动识别"],
  ["zh", "中文"],
  ["en", "英语"],
  ["ja", "日语"],
  ["ko", "韩语"],
  ["fr", "法语"],
  ["de", "德语"],
  ["es", "西班牙语"],
] as const;
export const languageValue = (v: unknown): string => {
  if (typeof v !== "string" || !languages.some(([id]) => id === v))
    throw new Error("请选择支持的识别语言。");
  return v;
};
export function audioSource(v: unknown): AudioSource {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.id) ||
    typeof v.bytes !== "number" ||
    !Number.isInteger(v.bytes) ||
    v.bytes < 12 ||
    v.bytes > MAX_AUDIO_BYTES ||
    ![
      "audio/wav",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/webm",
      "audio/flac",
    ].includes(String(v.mime))
  )
    throw new Error(
      "音频资源无效，支持最大 40 MB 的 WAV、MP3、M4A、OGG、WebM、FLAC。",
    );
  return {
    id: v.id,
    name: boundedText(v.name, 180),
    bytes: v.bytes,
    mime: String(v.mime),
  };
}
export function clock(seconds: number, separator = "."): string {
  const ms = Math.round(Math.max(0, seconds) * 1000),
    h = Math.floor(ms / 3600000),
    m = Math.floor(ms / 60000) % 60,
    s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`;
}
export function seconds(value: string): number {
  const match = /^(\d{1,2}):([0-5]\d):([0-5]\d)[.,](\d{3})$/.exec(value.trim());
  if (!match) throw new Error("时间格式应为 00:00:00.000。");
  const result =
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000;
  if (result > 21600) throw new Error("时间不能超过 6 小时。");
  return result;
}
function decode(v: unknown, strict: boolean): Transcript {
  if (!isRecord(v) || !Array.isArray(v.cues) || v.cues.length > MAX_CUES)
    throw new Error(`最多支持 ${MAX_CUES} 行字幕。`);
  const ids = new Set<string>();
  const cues = v.cues.map((raw): Cue => {
    if (
      !isRecord(raw) ||
      typeof raw.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(raw.id) ||
      ids.has(raw.id) ||
      typeof raw.reviewed !== "boolean"
    )
      throw new Error("字幕行格式无效或编号重复。");
    ids.add(raw.id);
    const cue = {
      id: raw.id,
      start: boundedText(raw.start, 24),
      end: boundedText(raw.end, 24),
      text: boundedText(raw.text, strict ? 4000 : 8000),
      reviewed: raw.reviewed,
    };
    if (strict && seconds(cue.end) <= seconds(cue.start))
      throw new Error("字幕出点必须晚于入点。");
    return cue;
  });
  const data = {
    source: v.source === null ? null : audioSource(v.source),
    cues,
    language: languageValue(v.language),
    notes: boundedText(v.notes, 20000),
    origin: boundedText(v.origin, 240),
  };
  if (
    new TextEncoder().encode(JSON.stringify(data)).length >
    (strict ? 750000 : 1250000)
  )
    throw new Error(
      strict
        ? "字幕内容超过 750 KB，工作稿仍会保留，请拆分项目。"
        : "工作稿超过 1.25 MB，请先导出并拆分内容。",
    );
  return data;
}
export const validateTranscript = (v: unknown) => decode(v, true);
export const restoreTranscript = (v: unknown) => decode(v, false);
export function transcriptDraft(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) return {};
  return {
    selected: typeof v.selected === "string" ? boundedText(v.selected, 80) : "",
    onlyPending: v.onlyPending === true,
    importText:
      typeof v.importText === "string" ? boundedText(v.importText, 100000) : "",
  };
}
export const emptyTranscript: Transcript = {
  source: null,
  cues: [],
  language: "auto",
  notes: "",
  origin: "",
};
export function validateSegments(v: unknown): Segment[] {
  if (!Array.isArray(v) || v.length > MAX_CUES)
    throw new Error("转写分段数量无效。");
  return v.map((s) => {
    if (
      !isRecord(s) ||
      typeof s.start !== "number" ||
      typeof s.end !== "number" ||
      !Number.isFinite(s.start) ||
      !Number.isFinite(s.end) ||
      s.start < 0 ||
      s.end <= s.start ||
      s.end > 21600
    )
      throw new Error("转写时间戳无效。");
    return { start: s.start, end: s.end, text: boundedText(s.text, 4000) };
  });
}
export function segmentCues(segments: Segment[]): Cue[] {
  return segments.map((s, i) => ({
    id: `cue-${i + 1}`,
    start: clock(s.start),
    end: clock(s.end),
    text: s.text.trim(),
    reviewed: false,
  }));
}
export function importTranscript(text: string, name: string): Cue[] {
  if (new TextEncoder().encode(text).length > 750000)
    throw new Error("字幕文件超过 750 KB。");
  const clean = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (/\.json$/i.test(name) || clean.startsWith("{") || clean.startsWith("[")) {
    const raw: unknown = JSON.parse(clean);
    return segmentCues(
      validateSegments(
        Array.isArray(raw) ? raw : isRecord(raw) ? raw.segments : undefined,
      ),
    );
  }
  const blocks = clean
    .replace(/^WEBVTT[^\n]*(?:\n[^\n]+)*?\n\n/, "")
    .split(/\n\s*\n/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    if (
      !block.trim() ||
      /^(WEBVTT|NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(block)
    )
      continue;
    const lines = block.split("\n"),
      index = lines.findIndex((l) => l.includes("-->"));
    if (index < 0)
      throw new Error("字幕缺少有效时间轴，请导入 SRT、VTT 或分段 JSON。");
    const pair = lines[index].match(
      /^\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})(?:\s+.*)?$/,
    );
    if (!pair) throw new Error("字幕时间轴无法解析。");
    const normalize = (s: string) =>
      clock(seconds((s.split(":").length === 2 ? "00:" : "") + s));
    cues.push({
      id: `cue-${cues.length + 1}`,
      start: normalize(pair[1]),
      end: normalize(pair[2]),
      text: lines.slice(index + 1).join("\n"),
      reviewed: false,
    });
  }
  return validateTranscript({ ...emptyTranscript, cues }).cues;
}
export function exportSubtitles(
  data: Transcript,
  format: "srt" | "vtt" | "txt",
): string {
  const cues = validateTranscript(data).cues;
  if (format === "txt") return cues.map((c) => c.text).join("\n\n") + "\n";
  return (
    (format === "vtt" ? "WEBVTT\n\n" : "") +
    cues
      .map(
        (c, i) =>
          `${i + 1}\n${clock(seconds(c.start), format === "srt" ? "," : ".")} --> ${clock(seconds(c.end), format === "srt" ? "," : ".")}\n${c.text.replace(/\n\s*\n/g, "\n")}`,
      )
      .join("\n\n") +
    "\n"
  );
}
export function splitCue(cue: Cue): [Cue, Cue] {
  const start = seconds(cue.start),
    end = seconds(cue.end);
  if (end - start < 0.004) throw new Error("片段太短，无法拆分。");
  const words = Array.from(cue.text),
    middle = Math.ceil(words.length / 2),
    time = clock((start + end) / 2);
  return [
    {
      ...cue,
      end: time,
      text: words.slice(0, middle).join(""),
      reviewed: false,
    },
    {
      ...cue,
      id: crypto.randomUUID(),
      start: time,
      text: words.slice(middle).join(""),
      reviewed: false,
    },
  ];
}
export const exampleTranscript: Transcript = {
  ...emptyTranscript,
  origin: "示例字幕 · 未运行模型",
  cues: [
    {
      id: "example-1",
      start: "00:00:00.000",
      end: "00:00:04.200",
      text: "今天，我们聊聊如何为一段访谈制作清晰的字幕。",
      reviewed: true,
    },
    {
      id: "example-2",
      start: "00:00:04.200",
      end: "00:00:09.600",
      text: "先听完整段录音，再检查专有名词、停顿与语气。",
      reviewed: false,
    },
    {
      id: "example-3",
      start: "00:00:09.600",
      end: "00:00:14.500",
      text: "每一次修订都保留下来，交付时就能更从容。",
      reviewed: false,
    },
  ],
};
