// ABOUTME: DeerFlow 原生会话（ThreadStateResponse / 检查点历史）的解析、来源提取、答复读取与压缩。
import { isRecord, boundedText } from "./project.ts";

export const NATIVE_INPUT_MAX = 8_000_000;
export const NATIVE_STORED_MAX = 450_000;

export type NativeMessage = {
  id: string;
  role: string;
  text: string;
  name: string;
  hidden: boolean;
  toolCalls: number;
};
export type NativeView = {
  messages: NativeMessage[];
  todos: { content: string; status: string }[];
  artifacts: string[];
  title: string;
  checkpoint: string;
  sample: boolean;
  compacted: boolean;
};
export type NativeLink = { url: string; title: string; excerpt: string; origin: string };

export function safeUrl(v: string) {
  try {
    const u = new URL(v.trim());
    return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function threadValue(v: unknown) {
  const s = boundedText(v, 64);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(s)) throw new Error("请输入有效的DeerFlow会话编号。");
  return s;
}
function stateOf(raw: Record<string, unknown>) {
  let state: Record<string, unknown> = raw;
  if (Array.isArray(raw.checkpoints)) {
    if (raw.checkpoints.length > 1000) throw new Error("最多1000个检查点，请按阶段导出。");
    const last = raw.checkpoints.at(-1);
    if (last !== undefined && !isRecord(last)) throw new Error("检查点格式无效。");
    state = isRecord(last) ? last : { values: { messages: [] } };
  }
  const values = isRecord(state.values) ? state.values : Array.isArray(state.messages) ? state : null;
  if (!values) throw new Error("需要ThreadStateResponse或DeerFlowClient检查点历史。");
  return { state, values };
}
function messageText(m: Record<string, unknown>) {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    let text = "";
    for (const block of m.content) if (isRecord(block) && typeof block.text === "string") text += block.text + "\n";
    return text;
  }
  if (m.content !== undefined && m.content !== null) throw new Error("消息内容格式无效。");
  return "";
}
export function nativeValue(text: string): { raw: Record<string, unknown>; view: NativeView } {
  if (text.length > NATIVE_INPUT_MAX) throw new Error("原生会话超过8MB，请按阶段导出。");
  const raw: unknown = JSON.parse(text);
  if (!isRecord(raw)) throw new Error("原生会话应为JSON对象。");
  const { state, values } = stateOf(raw);
  const messages = values.messages ?? [];
  if (!Array.isArray(messages) || messages.length > 3000) throw new Error("会话最多3000条消息。");
  const decoded = messages.map((m, i): NativeMessage => {
    if (!isRecord(m)) throw new Error("原生消息格式无效。");
    return {
      id: typeof m.id === "string" ? m.id : String(i),
      role: typeof m.type === "string" ? m.type : typeof m.role === "string" ? m.role : "unknown",
      text: messageText(m),
      name: typeof m.name === "string" ? m.name : "",
      toolCalls: Array.isArray(m.tool_calls) ? m.tool_calls.length : 0,
      hidden: isRecord(m.additional_kwargs) && m.additional_kwargs.hide_from_ui === true,
    };
  });
  const todos = values.todos ?? [];
  if (!Array.isArray(todos) || todos.length > 500) throw new Error("研究任务格式或数量无效。");
  const tasks = todos.map((t) => {
    if (!isRecord(t) || typeof t.content !== "string" || typeof t.status !== "string")
      throw new Error("任务条目需要content和status。");
    return { content: t.content.slice(0, 5000), status: t.status.slice(0, 100) };
  });
  const artifacts = values.artifacts ?? [];
  if (!Array.isArray(artifacts) || artifacts.length > 500 || !artifacts.every((x) => typeof x === "string" && x.length < 2000))
    throw new Error("产物清单格式无效。");
  const metadata = isRecord(raw.metadata) ? raw.metadata : {};
  return {
    raw,
    view: {
      messages: decoded,
      todos: tasks,
      artifacts: artifacts as string[],
      title: typeof values.title === "string" ? values.title : "研究会话",
      checkpoint:
        typeof state.checkpoint_id === "string"
          ? state.checkpoint_id
          : isRecord(state.checkpoint) && typeof state.checkpoint.checkpoint_id === "string"
            ? state.checkpoint.checkpoint_id
            : "",
      sample: metadata.sample === true,
      compacted: metadata.floatboat_compacted === true,
    },
  };
}

/** HTTP(S) links found in visible tool results and message text. */
export function nativeLinks(native: string, max = 150): NativeLink[] {
  const { view } = nativeValue(native),
    found = new Map<string, NativeLink>();
  function add(url: string, title = "", excerpt = "", origin = "会话链接") {
    url = safeUrl(url);
    if (!url || found.has(url) || found.size >= max) return;
    found.set(url, { url, title: title.slice(0, 200) || new URL(url).hostname, excerpt: excerpt.slice(0, 1200), origin });
  }
  function walk(v: unknown, depth = 0) {
    if (depth > 12) return;
    if (Array.isArray(v)) for (const x of v.slice(0, 300)) walk(x, depth + 1);
    else if (isRecord(v)) {
      if (typeof v.url === "string")
        add(
          v.url,
          typeof v.title === "string" ? v.title : "",
          typeof v.content === "string" ? v.content : typeof v.snippet === "string" ? v.snippet : "",
          "工具结果",
        );
      for (const x of Object.values(v)) walk(x, depth + 1);
    }
  }
  for (const m of view.messages.filter((m) => !m.hidden)) {
    if (m.role === "tool")
      try {
        walk(JSON.parse(m.text));
      } catch {
        /* plain-text tool output */
      }
    for (const match of m.text.matchAll(/\[([^\]]{1,200})\]\((https?:\/\/[^\s)]+)\)/g))
      add(match[2], match[1], "", m.role === "tool" ? "工具结果" : "报告链接");
  }
  return [...found.values()];
}

/** Latest visible assistant answer without pending tool calls. */
export function lastReport(native: string) {
  const latest = nativeValue(native)
    .view.messages.filter((m) => !m.hidden && ["ai", "assistant"].includes(m.role))
    .at(-1);
  return latest && latest.toolCalls === 0 ? latest.text : "";
}

function shorten(value: unknown, limit: number): unknown {
  if (typeof value === "string")
    return value.length > limit ? value.slice(0, limit) + `\n…［已截断 ${value.length - limit} 字］` : value;
  if (Array.isArray(value)) return value.map((x) => shorten(x, limit));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shorten(v, limit)]));
  return value;
}
/**
 * Keep a session within the project budget. Small sessions are kept byte for
 * byte; larger ones keep the latest checkpoint with long strings shortened and
 * are marked `metadata.floatboat_compacted`.
 */
export function compactNative(text: string, budget = NATIVE_STORED_MAX): string {
  const { raw } = nativeValue(text);
  if (text.length <= budget) return text;
  const { state } = stateOf(raw);
  const base: Record<string, unknown> = Array.isArray(raw.checkpoints) ? { ...state } : { ...raw };
  base.metadata = { ...(isRecord(base.metadata) ? base.metadata : {}), floatboat_compacted: true, floatboat_original_chars: text.length };
  for (const limit of [6000, 2000, 600]) {
    const next = JSON.stringify(shorten(base, limit));
    if (next.length <= budget) return next;
  }
  const values = isRecord(base.values) ? base.values : base;
  const messages = Array.isArray(values.messages) ? values.messages : [];
  const trimmed = { ...base, values: { ...values, messages: messages.slice(-80) } };
  const next = JSON.stringify(shorten(trimmed, 600));
  if (next.length > budget) throw new Error("会话过大，压缩后仍超过项目容量，请在DeerFlow按阶段导出。");
  return next;
}
