// ABOUTME: /api/comfy/* 路由：连接、运行、队列、产物与上传；仅代理到用户配置的 ComfyUI 地址。

import { randomUUID } from "node:crypto";
import { isRecord } from "../contracts/project.ts";
import { checkPrompt } from "../contracts/convert.ts";
import { checkWorkflow } from "../contracts/workflow.ts";
import { asciiJson, embedPngText, isPng, readPngText } from "../contracts/png.ts";
import { ComfyError, type ComfySession } from "./comfy-session.ts";
import type { RunStore } from "./runs.ts";

export interface RouteContextLike {
  params: Record<string, string>;
  body: unknown;
  url: URL;
}
export interface RouteHost {
  route(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    handler: (context: RouteContextLike) => unknown | Promise<unknown>,
  ): void;
}

const MAX_UPLOAD = 25 * 1024 * 1024;
const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ error: { message }, ...extra }, { status });

const guard =
  (fn: (ctx: RouteContextLike) => unknown | Promise<unknown>) =>
  async (ctx: RouteContextLike) => {
    try {
      return await fn(ctx);
    } catch (error) {
      if (error instanceof ComfyError) return fail(error.message, error.status === 502 ? 502 : error.status);
      return fail(error instanceof Error ? error.message : "操作失败。");
    }
  };

const idOf = (value: unknown, label: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new Error(`${label}无效。`);
  return value;
};

export function registerComfyRoutes(app: RouteHost, session: ComfySession, store: RunStore): void {
  const uploads = new Map<string, { name: string; chunks: Buffer[]; bytes: number; touched: number }>();

  app.route("GET", "/api/comfy/config", guard(() => session.publicConfig()));
  app.route("PUT", "/api/comfy/config", guard(({ body }) => session.setConfig(body)));
  app.route(
    "POST",
    "/api/comfy/connect",
    guard(async () => {
      const { status, objectInfo } = await session.connect();
      return { status, objectInfo };
    }),
  );
  app.route("GET", "/api/comfy/state", guard(({ url }) => session.state(url.searchParams.get("project"))));
  app.route(
    "GET",
    "/api/comfy/queue",
    guard(async () => ({ entries: await session.queue() })),
  );
  app.route(
    "POST",
    "/api/comfy/run",
    guard(async ({ body }) => {
      if (!isRecord(body)) throw new Error("请求无效。");
      const prompt = checkPrompt(body.prompt);
      const workflow = checkWorkflow(body.workflow);
      const projectId = idOf(body.projectId, "文稿标识");
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "未命名工作流";
      const result = await session.submit({ projectId, title, prompt, workflow });
      if (!result.ok)
        return Response.json(
          { ok: false, status: result.status, message: result.message, error: isRecord(result.body) ? result.body.error ?? null : null, node_errors: isRecord(result.body) ? result.body.node_errors ?? {} : {} },
          { status: 200 },
        );
      return { ok: true, run: result.run };
    }),
  );
  app.route(
    "POST",
    "/api/comfy/runs/:id/cancel",
    guard(async ({ params }) => ({ run: await session.cancel(idOf(params.id, "运行")) })),
  );
  app.route("POST", "/api/comfy/interrupt", guard(async () => { await session.interrupt(); return { ok: true }; }));
  app.route(
    "POST",
    "/api/comfy/queue/delete",
    guard(async ({ body }) => {
      if (!isRecord(body)) throw new Error("请求无效。");
      await session.deleteQueued(String(body.promptId ?? ""));
      return { ok: true };
    }),
  );
  app.route(
    "GET",
    "/api/comfy/runs",
    guard(({ url }) => ({ runs: store.list(idOf(url.searchParams.get("project"), "文稿标识")) })),
  );
  app.route(
    "GET",
    "/api/comfy/runs/:id",
    guard(({ params }) => {
      const run = store.detail(idOf(params.id, "运行"));
      if (!run) throw new ComfyError("运行记录不存在。", 404);
      return run;
    }),
  );
  app.route(
    "DELETE",
    "/api/comfy/runs/:id",
    guard(({ params }) => ({ deleted: store.remove(idOf(params.id, "运行")) })),
  );
  app.route(
    "GET",
    "/api/comfy/runs/:id/preview",
    guard(({ params }) => {
      const preview = session.preview(idOf(params.id, "运行"));
      if (!preview) throw new ComfyError("没有预览。", 404);
      return new Response(preview.bytes.slice(), { headers: { "content-type": preview.mime, "cache-control": "no-store" } });
    }),
  );
  app.route(
    "GET",
    "/api/comfy/outputs/:id",
    guard(async ({ params, url }) => {
      const output = store.output(idOf(params.id, "产物"));
      if (!output) throw new ComfyError("产物不存在。", 404);
      let bytes = output.data;
      if (url.searchParams.get("embed") === "1" && isPng(bytes)) {
        const row = store.outputRun(params.id);
        const detail = row ? store.detail(row) : null;
        if (detail) {
          const text = await readPngText(bytes);
          const entries: Record<string, string> = {};
          if (!text.prompt) entries.prompt = asciiJson(detail.prompt);
          if (!text.workflow) entries.workflow = asciiJson(detail.workflow);
          if (Object.keys(entries).length) bytes = embedPngText(bytes, entries);
        }
      }
      const headers: Record<string, string> = {
        "content-type": output.mime,
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      };
      if (url.searchParams.get("download") === "1")
        headers["content-disposition"] = `attachment; filename="${output.filename.replace(/[^\w.-]/g, "_")}"`;
      return new Response(bytes.slice(), { headers });
    }),
  );
  app.route(
    "GET",
    "/api/comfy/view",
    guard(async ({ url }) => {
      const result = await session.view(url.searchParams);
      if (result.status !== 200) throw new ComfyError("服务端没有这个文件。", result.status === 404 ? 404 : 502);
      return new Response(result.bytes.slice(), { headers: { "content-type": result.mime, "cache-control": "private, max-age=60", "x-content-type-options": "nosniff" } });
    }),
  );
  app.route(
    "POST",
    "/api/comfy/upload",
    guard(async ({ body }) => {
      if (!isRecord(body) || typeof body.data !== "string" || typeof body.name !== "string") throw new Error("上传请求无效。");
      const name = body.name.replace(/[\\/\0]/g, "_").slice(0, 200);
      if (!/\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) throw new Error("只支持 PNG、JPEG、WebP、GIF、BMP 图片。");
      const id = typeof body.uploadId === "string" && /^[0-9a-f-]{36}$/.test(body.uploadId) ? body.uploadId : randomUUID();
      const total = Number(body.total ?? 1),
        index = Number(body.index ?? 0);
      if (!Number.isInteger(total) || total < 1 || total > 40 || !Number.isInteger(index) || index < 0 || index >= total)
        throw new Error("分片编号无效。");
      const entry = uploads.get(id) ?? { name, chunks: [], bytes: 0, touched: Date.now() };
      const chunk = Buffer.from(body.data, "base64");
      entry.chunks[index] = chunk;
      entry.bytes += chunk.length;
      entry.touched = Date.now();
      if (entry.bytes > MAX_UPLOAD) {
        uploads.delete(id);
        throw new Error("图片超过 25 MB。");
      }
      uploads.set(id, entry);
      for (const [key, value] of uploads) if (Date.now() - value.touched > 10 * 60_000) uploads.delete(key);
      if (index < total - 1 || entry.chunks.filter(Boolean).length < total) return { uploadId: id, complete: false };
      uploads.delete(id);
      const all = new Uint8Array(Buffer.concat(entry.chunks));
      const sent = await session.upload(name, all);
      return { uploadId: id, complete: true, file: sent };
    }),
  );
}
