// ABOUTME: faster-whisper transcribe() 参数：页面编辑值、保存校验与发给独立服务的 snake_case 线格式。
import { isRecord } from "./project.ts";

export const languages = [
  ["auto", "自动识别"],
  ["zh", "中文（普通话）"],
  ["yue", "粤语"],
  ["en", "英语"],
  ["ja", "日语"],
  ["ko", "韩语"],
  ["fr", "法语"],
  ["de", "德语"],
  ["es", "西班牙语"],
  ["pt", "葡萄牙语"],
  ["it", "意大利语"],
  ["ru", "俄语"],
  ["uk", "乌克兰语"],
  ["pl", "波兰语"],
  ["nl", "荷兰语"],
  ["sv", "瑞典语"],
  ["tr", "土耳其语"],
  ["ar", "阿拉伯语"],
  ["fa", "波斯语"],
  ["he", "希伯来语"],
  ["hi", "印地语"],
  ["bn", "孟加拉语"],
  ["ur", "乌尔都语"],
  ["th", "泰语"],
  ["vi", "越南语"],
  ["id", "印尼语"],
  ["ms", "马来语"],
  ["tl", "他加禄语"],
  ["el", "希腊语"],
  ["cs", "捷克语"],
  ["ro", "罗马尼亚语"],
  ["hu", "匈牙利语"],
  ["fi", "芬兰语"],
  ["da", "丹麦语"],
  ["no", "挪威语"],
] as const;

export const languageValue = (v: unknown): string => {
  if (typeof v !== "string" || !languages.some(([id]) => id === v))
    throw new Error("请选择支持的识别语言。");
  return v;
};

export interface TranscribeOptions {
  task: "transcribe" | "translate";
  wordTimestamps: boolean;
  vadFilter: boolean;
  vadMinSilenceMs: number;
  beamSize: number;
  initialPrompt: string;
  hotwords: string;
  conditionOnPrevious: boolean;
}

export const defaultOptions: TranscribeOptions = {
  task: "transcribe",
  wordTimestamps: true,
  vadFilter: true,
  vadMinSilenceMs: 500,
  beamSize: 5,
  initialPrompt: "",
  hotwords: "",
  conditionOnPrevious: true,
};

export const PROMPT_MAX = 800;
export const HOTWORDS_MAX = 400;

function integer(v: unknown, min: number, max: number, label: string) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max)
    throw new Error(`${label}应为 ${min}–${max} 的整数。`);
  return v;
}
function flag(v: unknown, label: string) {
  if (typeof v !== "boolean") throw new Error(`${label}参数无效。`);
  return v;
}
function text(v: unknown, max: number, label: string) {
  if (typeof v !== "string" || v.length > max)
    throw new Error(`${label}最多 ${max} 个字符。`);
  return v;
}

/** Missing fields fall back to defaults so 0.4 projects and job rows keep opening. */
export function optionsValue(v: unknown): TranscribeOptions {
  if (v === undefined) return { ...defaultOptions };
  if (!isRecord(v)) throw new Error("转写参数无效。");
  const pick = <K extends keyof TranscribeOptions>(key: K) =>
    v[key] === undefined ? defaultOptions[key] : v[key];
  const task = pick("task");
  if (task !== "transcribe" && task !== "translate")
    throw new Error("任务只能是转写或翻译为英语。");
  return {
    task,
    wordTimestamps: flag(pick("wordTimestamps"), "逐词时间戳"),
    vadFilter: flag(pick("vadFilter"), "静音过滤"),
    vadMinSilenceMs: integer(pick("vadMinSilenceMs"), 100, 5000, "最短静音"),
    beamSize: integer(pick("beamSize"), 1, 10, "beam_size "),
    initialPrompt: text(pick("initialPrompt"), PROMPT_MAX, "提示词"),
    hotwords: text(pick("hotwords"), HOTWORDS_MAX, "热词"),
    conditionOnPrevious: flag(pick("conditionOnPrevious"), "承接上文"),
  };
}

/** Exactly the keyword arguments the companion service passes to WhisperModel.transcribe(). */
export function wireOptions(o: TranscribeOptions) {
  return {
    task: o.task,
    word_timestamps: o.wordTimestamps,
    vad_filter: o.vadFilter,
    min_silence_duration_ms: o.vadMinSilenceMs,
    beam_size: o.beamSize,
    initial_prompt: o.initialPrompt.trim() || null,
    hotwords: o.hotwords.trim() || null,
    condition_on_previous_text: o.conditionOnPrevious,
  };
}

export function describeOptions(language: string, o: TranscribeOptions) {
  const name = languages.find(([id]) => id === language)?.[1] ?? language;
  return [
    o.task === "translate" ? "翻译为英语" : "转写",
    name,
    o.wordTimestamps ? "逐词时间戳" : "仅分段",
    o.vadFilter ? `VAD ${o.vadMinSilenceMs}ms` : "无 VAD",
    `beam ${o.beamSize}`,
    o.initialPrompt.trim() ? "含提示词" : "",
    o.hotwords.trim() ? "含热词" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
