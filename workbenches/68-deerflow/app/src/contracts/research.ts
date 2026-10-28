import { isRecord, boundedText } from "./project.ts";
import sample from "./native-sample.json" with { type: "json" };
export type Source = {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  note: string;
  checked: boolean;
  origin: string;
};
export type Research = {
  native: string;
  brief: string;
  report: string;
  sources: Source[];
  stage: "draft" | "reviewing" | "ready";
  threadId: string;
};
export type NativeView = {
  messages: {
    id: string;
    role: string;
    text: string;
    name: string;
    hidden: boolean;
    toolCalls: number;
  }[];
  todos: { content: string; status: string }[];
  artifacts: string[];
  title: string;
  checkpoint: string;
  sample: boolean;
};
export function safeUrl(v: string) {
  try {
    const u = new URL(v);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function threadValue(v: unknown) {
  const s = boundedText(v, 64);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(s))
    throw new Error("请输入有效的DeerFlow会话编号。");
  return s;
}
export function nativeValue(text: string): {
  raw: Record<string, unknown>;
  view: NativeView;
} {
  if (text.length > 650000)
    throw new Error("原生会话最多650KB，请按阶段拆分。");
  const raw: unknown = JSON.parse(text);
  if (!isRecord(raw)) throw new Error("原生会话应为JSON对象。");
  let state: Record<string, unknown> = raw;
  if (Array.isArray(raw.checkpoints)) {
    if (raw.checkpoints.length > 100) throw new Error("最多100个检查点。");
    const last = raw.checkpoints.at(-1);
    if (last !== undefined && !isRecord(last))
      throw new Error("检查点格式无效。");
    state = isRecord(last) ? last : { values: { messages: [] } };
  }
  const values = isRecord(state.values)
    ? state.values
    : Array.isArray(state.messages)
      ? state
      : null;
  if (!values)
    throw new Error("需要ThreadStateResponse或DeerFlowClient检查点历史。");
  const messages = values.messages ?? [];
  if (!Array.isArray(messages) || messages.length > 300)
    throw new Error("会话最多300条消息。");
  const decoded = messages.map((m, i) => {
    if (!isRecord(m)) throw new Error("原生消息格式无效。");
    let text = "";
    if (typeof m.content === "string") text = m.content;
    else if (Array.isArray(m.content)) {
      for (const block of m.content)
        if (isRecord(block) && typeof block.text === "string")
          text += block.text + "\n";
    } else if (m.content !== undefined && m.content !== null)
      throw new Error("消息内容格式无效。");
    if (text.length > 150000) throw new Error("单条消息过长，请拆分会话。");
    return {
      id: typeof m.id === "string" ? m.id : String(i),
      role:
        typeof m.type === "string"
          ? m.type
          : typeof m.role === "string"
            ? m.role
            : "unknown",
      text,
      name: typeof m.name === "string" ? m.name : "",
      toolCalls: Array.isArray(m.tool_calls) ? m.tool_calls.length : 0,
      hidden:
        isRecord(m.additional_kwargs) &&
        m.additional_kwargs.hide_from_ui === true,
    };
  });
  const todos = values.todos ?? [];
  if (!Array.isArray(todos) || todos.length > 100)
    throw new Error("研究任务格式或数量无效。");
  const tasks = todos.map((t) => {
    if (
      !isRecord(t) ||
      typeof t.content !== "string" ||
      typeof t.status !== "string"
    )
      throw new Error("任务条目需要content和status。");
    return {
      content: boundedText(t.content, 5000),
      status: boundedText(t.status, 100),
    };
  });
  const artifacts = values.artifacts ?? [];
  if (
    !Array.isArray(artifacts) ||
    artifacts.length > 100 ||
    !artifacts.every((x) => typeof x === "string" && x.length < 2000)
  )
    throw new Error("产物清单格式无效。");
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
          : isRecord(state.checkpoint) &&
              typeof state.checkpoint.checkpoint_id === "string"
            ? state.checkpoint.checkpoint_id
            : "",
      sample: isRecord(raw.metadata) && raw.metadata.sample === true,
    },
  };
}
export function extractSources(native: string): Source[] {
  const { raw, view } = nativeValue(native),
    found = new Map<string, Source>();
  function add(url: string, title = "", excerpt = "", origin = "会话链接") {
    url = safeUrl(url);
    if (!url || found.has(url) || found.size >= 100) return;
    found.set(url, {
      id: "source-" + (found.size + 1),
      url,
      title: title.slice(0, 200) || new URL(url).hostname,
      excerpt: excerpt.slice(0, 3000),
      note: "",
      checked: false,
      origin,
    });
  }
  function walk(v: unknown, depth = 0) {
    if (depth > 12) return;
    if (Array.isArray(v)) {
      for (const x of v.slice(0, 300)) walk(x, depth + 1);
    } else if (isRecord(v)) {
      if (typeof v.url === "string")
        add(
          v.url,
          typeof v.title === "string" ? v.title : "",
          typeof v.content === "string"
            ? v.content
            : typeof v.snippet === "string"
              ? v.snippet
              : "",
          "工具结果",
        );
      for (const x of Object.values(v)) walk(x, depth + 1);
    }
  }
  for (const m of view.messages.filter((m) => !m.hidden)) {
    if (m.role === "tool")
      try {
        walk(JSON.parse(m.text));
      } catch {}
    for (const match of m.text.matchAll(
      /\[([^\]]{1,200})\]\((https?:\/\/[^\s)]+)\)/g,
    ))
      add(match[2], match[1], "", m.role === "tool" ? "工具结果" : "报告链接");
  }
  return [...found.values()];
}
function decode(value: unknown, working = false): Research {
  if (
    !isRecord(value) ||
    !Array.isArray(value.sources) ||
    value.sources.length > 100 ||
    !["draft", "reviewing", "ready"].includes(String(value.stage))
  )
    throw new Error("研究项目格式无效。");
  const native = boundedText(value.native, 650000);
  nativeValue(native);
  const sources = value.sources.map((s) => {
    if (!isRecord(s) || typeof s.checked !== "boolean")
      throw new Error("来源记录无效。");
    const out = {
      id: boundedText(s.id, 100),
      url: boundedText(s.url, 3000),
      title: boundedText(s.title, 200),
      excerpt: boundedText(s.excerpt, 3000),
      note: boundedText(s.note, 5000),
      checked: s.checked,
      origin: boundedText(s.origin, 100),
    };
    if (!out.id || (!working && (!safeUrl(out.url) || !out.title.trim())))
      throw new Error("请补全来源名称和HTTP(S)地址。");
    return out;
  });
  if (new Set(sources.map((s) => s.id)).size !== sources.length)
    throw new Error("来源编号重复。");
  const result: Research = {
    native,
    brief: boundedText(value.brief, 30000),
    report: boundedText(value.report, 150000),
    sources,
    stage: value.stage as Research["stage"],
    threadId: boundedText(value.threadId, 100),
  };
  if (
    !working &&
    new TextEncoder().encode(JSON.stringify(result)).length > 850000
  )
    throw new Error("研究项目超过850KB，草稿仍可导出。");
  if (
    result.stage === "ready" &&
    (!result.report.trim() ||
      !result.sources.length ||
      result.sources.some((s) => !s.checked))
  )
    throw new Error("可交付状态需要完整报告和已核验来源。");
  return result;
}
export const researchValue = (v: unknown) => decode(v, false),
  restoreResearch = (v: unknown) => decode(v, true);
export function fromNative(text: string, threadId = ""): Research {
  const { view } = nativeValue(text);
  return {
    native: text,
    brief:
      view.messages.find((m) => ["human", "user"].includes(m.role) && !m.hidden)
        ?.text ?? "",
    report: "",
    sources: extractSources(text),
    stage: "draft",
    threadId,
  };
}
export function lastReport(native: string) {
  const latest = nativeValue(native)
    .view.messages.filter(
      (m) => !m.hidden && ["ai", "assistant"].includes(m.role),
    )
    .at(-1);
  return latest && latest.toolCalls === 0 ? latest.text : "";
}
export function assertReady(data: Research) {
  researchValue(data);
  if (!data.report.trim()) throw new Error("请先整理交付报告。");
  if (!data.sources.length || data.sources.some((s) => !s.checked))
    throw new Error("请逐项核验至少一项来源，再标记可交付。");
}
export function exportReport(data: Research, title: string) {
  researchValue(data);
  return (
    `# ${title}\n\n${data.report}\n\n---\n\n## 来源复核\n\n` +
    data.sources
      .map(
        (s) =>
          `- [${s.title.replace(/[\[\]]/g, "")}](${safeUrl(s.url)}) · ${s.checked ? "人工已核验" : "待核验"}${s.note ? "\n  " + s.note : ""}`,
      )
      .join("\n") +
    "\n"
  );
}
export const seed = fromNative(JSON.stringify(sample, null, 2));
