import { readFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { sourceValue, validateProject } from "../contracts/pdf.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createPdfFiles } from "./files.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateProject);
  const files = createPdfFiles((relative, write) =>
    app.resources.path("pdf-originals", relative, write ? "write" : "read"),
  );
  registerAutosaveRoutes(app, validateProject, undefined, {
    verify: (data) => files.verify(data.source),
  });
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message: e instanceof Error ? e.message : "操作失败，请重试。",
        },
      },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  app.route(
    "GET",
    "/api/sample",
    async () =>
      new Response(await readFile(await app.resources.path("sample-pdf")), {
        headers: { "content-type": "application/pdf" },
      }),
  );
  app.route("GET", "/api/pdfjs/:group/:file", async ({ params }) => {
    try {
      if (
        !["cmaps", "standard_fonts", "wasm"].includes(params.group) ||
        !/^[A-Za-z0-9_.-]{1,120}$/.test(params.file) ||
        params.file.includes("..")
      )
        throw new Error("资源路径无效。");
      return new Response(
        await readFile(
          await app.resources.path(
            "pdfjs-assets",
            `${params.group}/${params.file}`,
          ),
        ),
        {
          headers: {
            "content-type": params.file.endsWith(".wasm")
              ? "application/wasm"
              : "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        },
      );
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效。");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("PUT", "/api/pdfs/:id/chunks/:index", async ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效。");
      return await files.chunk(params.id, Number(params.index), body.base64);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/pdfs", async ({ body }) => {
    try {
      return await files.finish(sourceValue(body));
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/pdfs/:id", async ({ params }) => {
    try {
      return new Response(await files.read(params.id), {
        headers: {
          "content-type": "application/pdf",
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (e) {
      return fail(e);
    }
  });
}
