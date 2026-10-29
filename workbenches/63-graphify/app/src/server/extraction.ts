// ABOUTME: 抽取路由：读取内容库中的原文，在 Node 内建图（可选上游 Graphify 处理代码），图谱写回内容库。

import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { isHash } from "../contracts/hash.ts";
import { classifyPath, corpusEntry, LIMITS, normalizePath, type CorpusFile } from "../contracts/corpus.ts";
import { extractCorpus, type UpstreamCode } from "../contracts/extract/index.ts";
import { graphValue } from "../contracts/graph.ts";
import { ensureCommunities } from "../contracts/analysis.ts";
import { graphText, refFor } from "../contracts/map.ts";
import type { BlobStore } from "./blobs.ts";
import { extractWithService, serviceStatus, SERVICE_LANGUAGES } from "./graphify-service.ts";

let running = 0;
const fail = (message: string, status = 400) => Response.json({ error: { message } }, { status });

export type ExtractRequest = { files: { path: string; hash: string }[]; engine: "node" | "graphify" };
export function extractRequestValue(body: unknown): ExtractRequest {
  if (!isRecord(body) || !Array.isArray(body.files) || !body.files.length) throw new Error("请先选择要抽取的文件。");
  if (body.files.length > LIMITS.files) throw new Error(`一次最多抽取 ${LIMITS.files} 个文件，请按目录拆分。`);
  const files = body.files.map((f) => {
    if (!isRecord(f) || typeof f.path !== "string" || !isHash(f.hash)) throw new Error("文件清单格式无效。");
    return { path: normalizePath(f.path), hash: f.hash };
  });
  return { files, engine: body.engine === "graphify" ? "graphify" : "node" };
}

export async function runExtraction(blobs: BlobStore, request: ExtractRequest, fetcher: typeof fetch = fetch) {
  const missing = request.files.filter((f) => !blobs.has(f.hash));
  if (missing.length) throw Object.assign(new Error(`有 ${missing.length} 个文件的原文不在本机内容库（例如 ${missing[0].path}），请重新选择这些文件。`), { status: 409 });
  let total = 0;
  const sources = request.files.map((f) => {
    const text = blobs.get(f.hash)!.body;
    total += Buffer.byteLength(text);
    return { path: f.path, text };
  });
  if (total > LIMITS.totalBytes) throw new Error(`资料共 ${(total / 1048576).toFixed(1)} MB，超过 ${LIMITS.totalBytes / 1048576} MB，请按目录拆分。`);
  let upstream: UpstreamCode | undefined;
  let engineNote = "";
  if (request.engine === "graphify") {
    const status = await serviceStatus(fetcher);
    if (!status.available) throw Object.assign(new Error(`Graphify Python 服务不可用：${status.message}`), { status: 503 });
    const code = sources.filter((s) => {
      const c = classifyPath(s.path);
      return !("skip" in c) && c.kind === "code" && SERVICE_LANGUAGES.has(c.language);
    });
    if (code.length) {
      upstream = await extractWithService(code.map((s) => ({ path: s.path, code: s.text })), fetcher);
      engineNote = upstream.engine;
    }
  }
  const { graph, stats } = extractCorpus(sources, { upstream });
  const text = graphText(graph);
  const hash = blobs.put("graph", text);
  const ref = { ...refFor(graph, new Date().toISOString()), hash };
  const included = new Set(sources.map((s) => s.path).filter((p) => !stats.skipped.some((x) => x.path === p)));
  const corpus: CorpusFile[] = [];
  for (const f of request.files) {
    if (!included.has(f.path)) continue;
    const entry = corpusEntry(f.path, blobs.get(f.hash)!.body);
    corpus.push({ ...entry, hash: f.hash });
  }
  return { ref, graph, corpus, stats, engine: engineNote || "内置抽取" };
}

export function registerExtraction(app: WorkbenchServer, blobs: BlobStore) {
  app.route("GET", "/api/engine", async () => ({ builtin: { available: true, engine: "内置抽取（Node）" }, graphify: await serviceStatus() }));
  app.route("POST", "/api/extract", async ({ body }) => {
    let input: ExtractRequest;
    try {
      input = extractRequestValue(body);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "抽取请求无效");
    }
    if (running >= 2) return fail("已有抽取正在进行，请等待完成。", 429);
    running++;
    try {
      return await runExtraction(blobs, input);
    } catch (e) {
      const status = isRecord(e) && typeof e.status === "number" ? e.status : 400;
      return fail(e instanceof Error ? e.message : "抽取失败", status);
    } finally {
      running--;
    }
  });
  /** 导入的 graph.json（已作为 upload 存入内容库）：校验、补齐社区、规范化存储。 */
  app.route("POST", "/api/graphs", ({ body }) => {
    try {
      if (!isRecord(body) || !isHash(body.upload)) throw new Error("请先上传图谱文件。");
      const blob = blobs.get(body.upload);
      if (!blob) return fail("图谱文件上传未完成，请重试。", 409);
      let raw: unknown;
      try {
        raw = JSON.parse(blob.body);
      } catch {
        throw new Error("文件不是有效的 JSON。");
      }
      const { graph, detected } = ensureCommunities(graphValue(raw));
      const hash = blobs.put("graph", graphText(graph));
      return { ref: { ...refFor(graph, new Date().toISOString()), hash }, graph, detected };
    } catch (e) {
      return fail(e instanceof Error ? e.message : "图谱无效");
    }
  });
  /** 在资料原文中逐行搜索。 */
  app.route("POST", "/api/search", ({ body }) => {
    if (!isRecord(body) || typeof body.query !== "string" || !body.query.trim() || body.query.length > 200 || !Array.isArray(body.files) || body.files.length > LIMITS.files)
      return fail("请输入要搜索的文字。");
    const q = body.query.trim().toLowerCase();
    const hits: { path: string; hash: string; line: number; text: string }[] = [];
    let total = 0;
    for (const f of body.files) {
      if (!isRecord(f) || !isHash(f.hash) || typeof f.path !== "string") continue;
      const blob = blobs.get(f.hash);
      if (!blob) continue;
      const lines = blob.body.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].toLowerCase().includes(q)) continue;
        total++;
        if (hits.length < 300) hits.push({ path: f.path, hash: f.hash, line: i + 1, text: lines[i].trim().slice(0, 240) });
      }
    }
    return { hits, total };
  });
}
