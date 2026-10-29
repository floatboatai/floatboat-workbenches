// ABOUTME: 浏览器端内容库客户端：图谱与原文按内容地址缓存，上传按 2MB 请求上限分片。

import { request } from "./requests.ts";
import { graphValue, type Graph } from "../contracts/graph.ts";
import { sha256 } from "../contracts/hash.ts";
import { EMPTY_GRAPH, graphText } from "../contracts/map.ts";
import { sample } from "../contracts/sample/index.ts";
import { isRecord } from "../contracts/project.ts";

const graphs = new Map<string, Graph>();
const texts = new Map<string, string>();
const inflight = new Map<string, Promise<unknown>>();

function seedCaches() {
  if (graphs.size) return;
  graphs.set(sha256(graphText(EMPTY_GRAPH)), EMPTY_GRAPH);
  const s = sample();
  graphs.set(s.project.graph.hash, s.graph);
  for (const [h, t] of s.texts) texts.set(h, t);
}

export function cachedGraph(hash: string) {
  seedCaches();
  return graphs.get(hash) ?? null;
}
export function rememberGraph(hash: string, graph: Graph) {
  graphs.set(hash, graph);
}
export function rememberText(hash: string, text: string) {
  texts.set(hash, text);
}

export async function loadGraph(hash: string): Promise<Graph> {
  const hit = cachedGraph(hash);
  if (hit) return hit;
  const key = `graph:${hash}`;
  let p = inflight.get(key) as Promise<Graph> | undefined;
  if (!p) {
    p = request(`/api/blobs/${hash}?as=graph`).then((raw) => {
      const g = graphValue(raw);
      graphs.set(hash, g);
      return g;
    });
    inflight.set(key, p);
    p.finally(() => inflight.delete(key)).catch(() => {});
  }
  return p;
}

export async function loadText(hash: string): Promise<string> {
  seedCaches();
  const hit = texts.get(hash);
  if (hit !== undefined) return hit;
  const key = `text:${hash}`;
  let p = inflight.get(key) as Promise<string> | undefined;
  if (!p) {
    p = request(`/api/blobs/${hash}?as=text`).then((raw) => {
      if (!isRecord(raw) || typeof raw.text !== "string") throw new Error("原文格式无效");
      texts.set(hash, raw.text);
      return raw.text;
    });
    inflight.set(key, p);
    p.finally(() => inflight.delete(key)).catch(() => {});
  }
  return p;
}

/** 每个请求的文本量上限：最坏情况下每字符 3 字节 UTF-8，JSON 转义后仍低于 2MB。 */
const PART_CHARS = 280_000;

export type UploadItem = { hash: string; text: string; kind: "source" | "upload" };
/** 只上传服务器缺少的内容；小文件合并成一次请求，大文件分片。 */
export async function uploadTexts(items: UploadItem[], onProgress?: (done: number, total: number) => void) {
  const unique = new Map(items.map((i) => [i.hash, i]));
  const raw = await request("/api/blobs/missing", { method: "POST", body: JSON.stringify({ hashes: [...unique.keys()] }) });
  const missing = new Set(isRecord(raw) && Array.isArray(raw.missing) ? (raw.missing as string[]) : [...unique.keys()]);
  const parts: { hash: string; kind: string; index: number; total: number; text: string }[] = [];
  for (const item of unique.values()) {
    texts.set(item.hash, item.text);
    if (!missing.has(item.hash)) continue;
    const total = Math.max(1, Math.ceil(item.text.length / PART_CHARS));
    for (let i = 0; i < total; i++) parts.push({ hash: item.hash, kind: item.kind, index: i, total, text: item.text.slice(i * PART_CHARS, (i + 1) * PART_CHARS) });
  }
  let batch: typeof parts = [], size = 0, done = 0;
  const flush = async () => {
    if (!batch.length) return;
    await request("/api/blobs", { method: "POST", body: JSON.stringify({ items: batch }) });
    done += batch.length;
    onProgress?.(done, parts.length);
    batch = [];
    size = 0;
  };
  for (const p of parts) {
    if (size + p.text.length > PART_CHARS || batch.length >= 400) await flush();
    batch.push(p);
    size += p.text.length;
  }
  await flush();
  return { uploaded: parts.length, skipped: unique.size - missing.size };
}
