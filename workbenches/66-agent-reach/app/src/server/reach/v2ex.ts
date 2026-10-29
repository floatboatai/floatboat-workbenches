// ABOUTME: V2EX渠道（channels/v2ex.py）公开API移植：今日热门、节点最新主题、主题与回复。

import { isRecord } from "../../contracts/project.ts";
import { ReachError, BAD_INPUT, NOT_FOUND, makeItem, unixToIso, type ReachItem } from "./result.ts";
import { expectOk, json } from "./net.ts";
import type { Get } from "./github.ts";

const BASE = "https://www.v2ex.com";
const TOPIC = /^(?:https?:\/\/)?(?:www\.)?v2ex\.com\/t\/(\d+)/;
const obj = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});

async function getJson(get: Get, path: string, params: Record<string, string> = {}): Promise<unknown> {
  const q = new URLSearchParams(params).toString();
  const r = await get(`${BASE}${path}${q ? "?" + q : ""}`, {
    headers: { accept: "application/json" },
    timeoutMs: 12000,
    maxBytes: 1024 * 1024,
  });
  return json(expectOk(r, "V2EX 来源"));
}

export function parseTopicId(target: string): number {
  const t = String(target).trim();
  if (/^\d+$/.test(t)) return Number(t);
  const m = TOPIC.exec(t);
  if (m) return Number(m[1]);
  throw new ReachError(BAD_INPUT, "请输入 V2EX 主题链接（https://www.v2ex.com/t/编号）或主题编号");
}

export function topicItem(topic: Record<string, unknown>, text?: string, raw?: unknown): ReachItem {
  return makeItem({
    title: topic.title,
    url: topic.url,
    author: obj(topic.member).username,
    published_at: unixToIso(topic.created),
    text: text ?? topic.content,
    raw: raw ?? topic,
  });
}

export async function v2exHot(get: Get, limit = 5): Promise<ReachItem[]> {
  const data = await getJson(get, "/api/topics/hot.json");
  return (Array.isArray(data) ? data : []).slice(0, limit).map((t) => topicItem(obj(t)));
}

export async function v2exNode(get: Get, node: string, limit = 5): Promise<ReachItem[]> {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(node)) throw new ReachError(BAD_INPUT, "节点名称只允许字母、数字、连字符和下划线");
  const data = await getJson(get, "/api/topics/show.json", { node_name: node, page: "1" });
  if (!Array.isArray(data)) throw new ReachError(NOT_FOUND, `V2EX 节点不存在：${node}`);
  return data.slice(0, limit).map((t) => topicItem(obj(t)));
}

export function topicWithReplies(topic: Record<string, unknown>, replies: unknown[]): ReachItem {
  const lines = [typeof topic.content === "string" ? topic.content : ""];
  for (const r of replies) lines.push(`\n@${String(obj(obj(r).member).username ?? "")}: ${String(obj(r).content ?? "")}`);
  return topicItem(topic, lines.join("\n").trim(), { topic, replies });
}

export async function v2exRead(get: Get, target: string): Promise<ReachItem[]> {
  const id = parseTopicId(target);
  const data = await getJson(get, "/api/topics/show.json", { id: String(id) });
  const topic = obj(Array.isArray(data) ? data[0] : data);
  if (!topic.id) throw new ReachError(NOT_FOUND, `V2EX 主题不存在：${id}`);
  const replies = await getJson(get, "/api/replies/show.json", { topic_id: String(id), page: "1" });
  return [topicWithReplies(topic, Array.isArray(replies) ? replies : [])];
}
