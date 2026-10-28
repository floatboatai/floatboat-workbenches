import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { readerValue } from "../contracts/reader.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createDocuments } from "./documents.ts";
import { createQuestions } from "./questions.ts";
export function registerRoutes(app: WorkbenchServer) {
  const docs = createDocuments(app),
    store = createStore(app.database, readerValue),
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
    const [parser, host] = await Promise.allSettled([
      docs.health(),
      app.host.capabilities.list({ domain: "llm" }),
    ]);
    return {
      parser: parser.status === "fulfilled",
      parserMessage:
        parser.status === "fulfilled"
          ? `PageIndex ${String(parser.value.version)}`
          : "解析服务未连接",
      model:
        host.status === "fulfilled" &&
        host.value.capabilities.some(
          (c) => c.operation === "generateText" && c.status === "available",
        ),
    };
  });
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
  route(
    "GET",
    "/api/documents/:id/pages/:page",
    async ({ params }) =>
      new Response(
        new Uint8Array(await docs.render(params.id, Number(params.page))),
        {
          headers: {
            "content-type": "image/png",
            "cache-control": "private, max-age=3600",
          },
        },
      ),
  );
  route("POST", "/api/documents/:id/chunks/:index", ({ params, body }) =>
    docs.chunk(
      params.id,
      Number(params.index),
      isRecord(body) ? body.data : null,
    ),
  );
  route("POST", "/api/documents/:id/finish", ({ params, body }) =>
    docs.finish(params.id, body),
  );
  route("POST", "/api/sample", () => docs.sample());
  route("POST", "/api/questions", ({ body }) => questions.start(body));
  route("GET", "/api/questions/:id", ({ params }) => questions.get(params.id));
  route("GET", "/api/projects/:id/questions", ({ params }) =>
    questions.list(params.id),
  );
}
