import { readFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { readerValue } from "../contracts/reader.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createDocuments } from "./documents.ts";
import { createOutlines } from "./outlines.ts";
import { createQuestions } from "./questions.ts";
export function registerRoutes(app: WorkbenchServer) {
  const docs = createDocuments(app),
    store = createStore(app.database, readerValue),
    outlines = createOutlines(app, docs.get, docs.read),
    questions = createQuestions(app, docs.get);
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message: e instanceof Error ? e.message : "操作失败，请重试。",
        },
      },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  const route = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    fn: Parameters<WorkbenchServer["route"]>[2],
  ) =>
    app.route(method, path, async (ctx) => {
      try {
        return await fn(ctx);
      } catch (e) {
        return fail(e);
      }
    });
  registerAutosaveRoutes(app, readerValue, undefined, {
    verify: async (data) => docs.verify(data.document),
  });
  route("GET", "/api/projects", () => store.list());
  route("GET", "/api/projects/:id", ({ params }) => store.get(params.id));
  route("PUT", "/api/projects/:id", async ({ params, body }) => {
    if (!isRecord(body)) throw new Error("项目格式无效。");
    const data = readerValue(body.data);
    await docs.verify(data.document);
    return store.update(params.id, body.title, data, body.revision);
  });
  route("POST", "/api/projects", async ({ body }) => {
    if (!isRecord(body)) throw new Error("项目格式无效。");
    const data = readerValue(body.data);
    await docs.verify(data.document);
    return store.create(body.title, data);
  });
  route("DELETE", "/api/projects/:id", ({ params, body }) => {
    if (!isRecord(body)) throw new Error("版本无效。");
    return store.remove(params.id, body.revision);
  });
  route("GET", "/api/status", async () => {
    const [service, host] = await Promise.all([
      outlines.health(),
      app.host.capabilities
        .list({ domain: "llm" })
        .then((r) =>
          r.capabilities.some(
            (c) => c.operation === "generateText" && c.status === "available",
          ),
        )
        .catch(() => false),
    ]);
    return { service, model: host };
  });
  route("GET", "/api/samples/:key", async ({ params }) => {
    const sample = await docs.sample(params.key);
    return new Response(new Uint8Array(sample.bytes), {
      headers: {
        "content-type": "application/pdf",
        "x-document-name": encodeURIComponent(sample.name),
      },
    });
  });
  route("GET", "/api/pdfjs/:group/:file", async ({ params }) => {
    if (
      !["cmaps", "standard_fonts"].includes(params.group) ||
      !/^[A-Za-z0-9_.-]{1,120}$/.test(params.file) ||
      params.file.includes("..")
    )
      throw new Error("资源路径无效。");
    return new Response(
      new Uint8Array(
        await readFile(
          await app.resources.path("pdfjs-assets", `${params.group}/${params.file}`),
        ),
      ),
      {
        headers: {
          "content-type": "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        },
      },
    );
  });
  route("GET", "/api/documents/:id/stored", ({ params }) => docs.stored(params.id));
  route("GET", "/api/documents/:id", ({ params }) => docs.get(params.id));
  route(
    "GET",
    "/api/documents/:id/pdf",
    async ({ params }) =>
      new Response(new Uint8Array(await docs.read(params.id)), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="document.pdf"',
        },
      }),
  );
  route("POST", "/api/documents/:id/chunks/:index", ({ params, body }) =>
    docs.chunk("pdf", params.id, Number(params.index), isRecord(body) ? body.data : null),
  );
  route("POST", "/api/documents/:id/text/:index", ({ params, body }) =>
    docs.chunk("text", params.id, Number(params.index), isRecord(body) ? body.data : null),
  );
  route("POST", "/api/documents/:id/finish", ({ params, body }) =>
    docs.finish(params.id, body),
  );
  route("POST", "/api/documents/:id/outlines", ({ params, body }) =>
    outlines.startOutline(params.id, isRecord(body) ? body.mode : null),
  );
  route("GET", "/api/documents/:id/outlines/job", ({ params }) => ({
    job: outlines.outlineJob(params.id),
  }));
  route("POST", "/api/documents/:id/outlines/import", ({ params, body }) =>
    outlines.importOutline(params.id, isRecord(body) ? body.tree : null),
  );
  route("POST", "/api/questions", ({ body }) => questions.start(body));
  route("GET", "/api/questions/:id", ({ params }) => questions.get(params.id));
  route("GET", "/api/projects/:id/questions", ({ params }) =>
    questions.list(params.id),
  );
}
