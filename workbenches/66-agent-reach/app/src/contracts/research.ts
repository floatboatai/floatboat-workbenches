import { boundedText, isRecord } from "./project.ts";
export type Item = Record<string, unknown> & {
  title: string | null;
  url: string | null;
  author: string | null;
  published_at: string | null;
  text: string | null;
  raw: unknown;
};
export type Envelope = Record<string, unknown> & {
  schema_version: 1;
  ok: boolean;
  channel: string | null;
  action: string | null;
  backend: string | null;
  items: Item[];
  meta: Record<string, unknown>;
  error: (Record<string, unknown> & { code: string; message: string }) | null;
};
export type Query = { channel: string; action: string; query: string };
export type Capture = {
  id: string;
  input: Query;
  at: string;
  envelope: Envelope;
};
export type Clip = { id: string; text: string; note: string };
export type Source = {
  id: string;
  captureId: string;
  index: number;
  note: string;
  status: "unreviewed" | "verified" | "followup";
  clips: Clip[];
};
export type Collection = {
  input: Query;
  captures: Capture[];
  sources: Source[];
  selected: string;
  brief: string;
};
function size(v: unknown) {
  return new TextEncoder().encode(JSON.stringify(v)).length;
}
export function idValue(v: unknown) {
  const id = boundedText(v, 40);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new Error("记录编号无效");
  return id;
}
function nullable(v: unknown, max: number) {
  if (v === null) return null;
  return boundedText(v, max);
}
export function safeURL(v: string) {
  const u = new URL(v);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error("来源链接只允许不含登录信息的http(s)地址");
  return u;
}
export function envelopeValue(v: unknown): Envelope {
  if (
    !isRecord(v) ||
    v.schema_version !== 1 ||
    typeof v.ok !== "boolean" ||
    !Array.isArray(v.items) ||
    v.items.length > 100 ||
    !isRecord(v.meta) ||
    size(v) > 500000
  )
    throw new Error("请选择500KB内的Agent-Reach原生结果（schema_version:1）");
  const items = v.items.map((item) => {
    if (!isRecord(item)) throw new Error("来源条目格式无效");
    const url = nullable(item.url, 4000);
    if (url) safeURL(url);
    return {
      ...item,
      title: nullable(item.title, 2000),
      url,
      author: nullable(item.author, 500),
      published_at: nullable(item.published_at, 100),
      text: nullable(item.text, 150000),
      raw: item.raw,
    };
  });
  let error: Envelope["error"] = null;
  if (v.error !== null) {
    if (!isRecord(v.error)) throw new Error("平台错误格式无效");
    error = {
      ...v.error,
      code: boundedText(v.error.code, 80),
      message: boundedText(v.error.message, 2000),
    };
  }
  if ((v.ok && error) || (!v.ok && (!error || items.length)))
    throw new Error("结果状态与条目不一致");
  return {
    ...v,
    schema_version: 1,
    ok: v.ok,
    channel: nullable(v.channel, 80),
    action: nullable(v.action, 80),
    backend: nullable(v.backend, 100),
    items,
    meta: v.meta,
    error,
  };
}
export function queryValue(v: unknown): Query {
  if (!isRecord(v)) throw new Error("查询格式无效");
  return {
    channel: boundedText(v.channel, 80),
    action: boundedText(v.action, 80),
    query: boundedText(v.query, 2000),
  };
}
export function captureValue(v: unknown): Capture {
  if (!isRecord(v)) throw new Error("采集记录格式无效");
  const at = boundedText(v.at, 40);
  if (!Number.isFinite(Date.parse(at))) throw new Error("采集时间无效");
  return {
    id: idValue(v.id),
    input: queryValue(v.input),
    at,
    envelope: envelopeValue(v.envelope),
  };
}
export function sourceItem(data: Collection, source: Source): Item {
  const c = data.captures.find((c) => c.id === source.captureId),
    item = c?.envelope.items[source.index];
  if (!item) throw new Error("资料来源已缺失");
  return item;
}
export function canonical(item: Item): string {
  if (!item.url) return "item:" + JSON.stringify(item);
  const u = safeURL(item.url);
  u.hash = "";
  for (const k of [...u.searchParams.keys()])
    if (k.startsWith("utm_") || k === "fbclid") u.searchParams.delete(k);
  return u.toString();
}
function decodeProject(v: unknown, working: boolean): Collection {
  if (
    !isRecord(v) ||
    !Array.isArray(v.captures) ||
    v.captures.length > 50 ||
    !Array.isArray(v.sources) ||
    v.sources.length > 100 ||
    size(v) > (working ? 1500000 : 700000)
  )
    throw new Error("资料项目格式无效，或超过100来源/700KB");
  const captures = v.captures.map(captureValue),
    byId = new Map(captures.map((c) => [c.id, c]));
  if (byId.size !== captures.length) throw new Error("采集编号重复");
  const sources = v.sources.map((s) => {
    if (
      !isRecord(s) ||
      typeof s.index !== "number" ||
      !Number.isInteger(s.index) ||
      s.index < 0 ||
      !["unreviewed", "verified", "followup"].includes(String(s.status)) ||
      !Array.isArray(s.clips) ||
      s.clips.length > 20
    )
      throw new Error("资料记录无效");
    const id = idValue(s.id),
      captureId = idValue(s.captureId),
      capture = byId.get(captureId),
      item = capture?.envelope.items[s.index];
    if (!capture?.envelope.ok || !item)
      throw new Error("资料引用不存在或失败的采集记录");
    const clips = s.clips.map((c) => {
      if (!isRecord(c)) throw new Error("摘录格式无效");
      const text = boundedText(c.text, 4000);
      if (!text.trim() || !item.text?.includes(text))
        throw new Error("摘录必须来自保存的来源正文");
      return { id: idValue(c.id), text, note: boundedText(c.note, 2000) };
    });
    if (new Set(clips.map((c) => c.id)).size !== clips.length)
      throw new Error("摘录编号重复");
    return {
      id,
      captureId,
      index: s.index,
      note: boundedText(s.note, 5000),
      status: s.status as Source["status"],
      clips,
    };
  });
  if (new Set(sources.map((s) => s.id)).size !== sources.length)
    throw new Error("资料编号重复");
  const selected = boundedText(v.selected, 40);
  if (selected && !sources.some((s) => s.id === selected))
    throw new Error("选择的资料不存在");
  return {
    input: queryValue(v.input),
    captures,
    sources,
    selected,
    brief: boundedText(v.brief, 20000),
  };
}
export const seed: Collection = {
  input: { channel: "github", action: "read", query: "octocat/Hello-World" },
  captures: [],
  sources: [],
  selected: "",
  brief: "",
};
export function mergeCapture(
  data: Collection,
  capture: Capture,
  indices: number[],
) {
  const known = new Set(
    data.sources.map((s) => canonical(sourceItem(data, s))),
  );
  const added: Source[] = [];
  let skipped = 0;
  for (const index of new Set(indices)) {
    const item = capture.envelope.items[index];
    if (!item || !capture.envelope.ok)
      throw new Error("只能收藏成功采集的来源");
    const key = canonical(item);
    if (known.has(key)) {
      skipped++;
      continue;
    }
    known.add(key);
    added.push({
      id: crypto.randomUUID(),
      captureId: capture.id,
      index,
      note: "",
      status: "unreviewed",
      clips: [],
    });
  }
  if (!added.length) return { data, added: 0, skipped };
  const existing = data.captures.find((c) => c.id === capture.id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(capture))
    throw new Error("同一采集编号的数据不一致");
  const next = projectValue({
    ...data,
    captures: existing ? data.captures : [...data.captures, capture],
    sources: [...data.sources, ...added],
    selected: added[0].id,
  });
  return { data: next, added: added.length, skipped };
}
export function report(data: Collection, title: string) {
  return (
    "# " +
    title +
    "\n\n" +
    data.brief +
    "\n\n" +
    data.sources
      .map((s, i) => {
        const item = sourceItem(data, s),
          capture = data.captures.find((c) => c.id === s.captureId)!;
        return `## ${i + 1}. ${(item.title ?? item.url ?? "未命名来源").replace(/\n/g, " ")}\n\n来源：${item.url ?? "未提供链接"}\n渠道：${capture.envelope.channel ?? "导入"} · 采集：${capture.at}\n审阅：${{ unreviewed: "未核对", verified: "已核对", followup: "待跟进" }[s.status]}\n\n${s.note}\n\n${s.clips
          .map(
            (c) =>
              c.text
                .split("\n")
                .map((line) => "> " + line)
                .join("\n") +
              "\n\n备注：" +
              c.note,
          )
          .join("\n\n")}\n`;
      })
      .join("\n")
  );
}

export const projectValue = (value: unknown): Collection =>
  decodeProject(value, false);
export const restoreDraftData = (value: unknown): Collection =>
  decodeProject(value, true);
