// ABOUTME: 原文件/结构文档上传与读取路由、内置示例、PDF.js 字体与 CMap 资源。
import { readFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { EXAMPLES } from "../contracts/examples.ts";
import { createBlobs, digest, type Blobs } from "./blobs.ts";
import { StoreError } from "./store.ts";
/** Registers bundled examples under their content hashes after checking the files still match. */
async function exampleFiles(app: WorkbenchServer): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const e of EXAMPLES) {
    for (const [file, id] of [
      [e.sourceFile, e.document.source.id],
      [e.documentFile, e.document.id],
    ] as const) {
      const path = await app.resources.path("examples", "examples/" + file);
      try {
        if (digest(await readFile(path)) === id) map.set(id, path);
      } catch {
        /* A missing example simply is not offered. */
      }
    }
  }
  return map;
}
export async function registerSources(app: WorkbenchServer): Promise<Blobs> {
  const blobs = createBlobs(
    app.database,
    (name, write) => app.resources.path("documents", name, write ? "write" : "read"),
    await exampleFiles(app),
  );
  type Handler = Parameters<WorkbenchServer["route"]>[2];
  const wrap =
    (fn: Handler): Handler =>
    async (context) => {
      try {
        return await fn(context);
      } catch (e) {
        return Response.json(
          { error: { message: e instanceof Error ? e.message : "文件操作失败。" } },
          { status: e instanceof StoreError ? e.status : 400 },
        );
      }
    };
  app.route("GET", "/api/examples", () => EXAMPLES.filter((e) => blobs.stored(e.document.id) && blobs.stored(e.document.source.id)));
  app.route("POST", "/api/blobs", wrap(({ body }) => blobs.begin(body)));
  app.route("POST", "/api/blobs/:id/chunks/:n", wrap(({ params, body }) => blobs.chunk(params.id, Number(params.n), body)));
  app.route("POST", "/api/blobs/:id/complete", wrap(({ params }) => blobs.complete(params.id)));
  app.route("GET", "/api/blobs/:id/stored", wrap(({ params }) => ({ stored: blobs.stored(params.id) })));
  app.route(
    "GET",
    "/api/blobs/:id/source",
    wrap(async ({ params }) =>
      new Response(new Uint8Array(await blobs.read(params.id, "source")), {
        headers: { "content-type": "application/octet-stream", "cache-control": "private, max-age=31536000, immutable" },
      }),
    ),
  );
  app.route(
    "GET",
    "/api/blobs/:id/document",
    wrap(async ({ params }) =>
      new Response(new Uint8Array(await blobs.read(params.id, "docling")), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=31536000, immutable" },
      }),
    ),
  );
  app.route(
    "GET",
    "/api/pdfjs/:group/:file",
    wrap(async ({ params }) => {
      if (!["cmaps", "standard_fonts"].includes(params.group) || !/^[A-Za-z0-9_.-]{1,120}$/.test(params.file) || params.file.includes(".."))
        throw new StoreError(404, "资源路径无效。");
      return new Response(new Uint8Array(await readFile(await app.resources.path("pdfjs-assets", `${params.group}/${params.file}`))), {
        headers: { "content-type": "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" },
      });
    }),
  );
  return blobs;
}
