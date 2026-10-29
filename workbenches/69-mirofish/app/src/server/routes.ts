// ABOUTME: 推演工作台 HTTP 接口：项目与自动保存、本地推演、结果库与分片导入、可选 Host 模型、可选 MiroFish 后端。
import { createRunCommands } from "./run-commands.ts";
import { createMiroFishClient, DEFAULT_MIROFISH_URL } from "./mirofish-client.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { readFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { scenarioValue } from "../contracts/validate.ts";
import { createStore, StoreError } from "./store.ts";
import { createResults } from "./results.ts";
import { MODEL, deepenReport, generatePersonas } from "./host.ts";

export function registerRoutes(app: WorkbenchServer) {
  const validate = scenarioValue;
  const store = createStore(app.database, validate);
  registerAutosaveRoutes(app, validate);
  const fail = (error: unknown) =>
    Response.json(
      { error: { message: error instanceof Error ? error.message : "操作失败，请重试。" } },
      { status: error instanceof StoreError ? error.status : 400 },
    );
  const guard =
    <C>(handler: (context: C) => unknown) =>
    async (context: C) => {
      try {
        return await handler(context);
      } catch (e) {
        return fail(e);
      }
    };
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", guard(({ params }) => store.get(params.id)));
  app.route(
    "POST",
    "/api/projects",
    guard(({ body }) => {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return Response.json(store.create(body.title, body.data), { status: 201 });
    }),
  );
  app.route(
    "PUT",
    "/api/projects/:id",
    guard(({ params, body }) => {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.update(params.id, body.title, body.data, body.revision);
    }),
  );
  app.route(
    "DELETE",
    "/api/projects/:id",
    guard(({ params, body }) => {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.remove(params.id, body.revision);
    }),
  );

  const results = createResults(app.database);
  app.route("POST", "/api/simulate", guard(({ body }) => results.simulate(body)));
  app.route(
    "GET",
    "/api/results/:id",
    guard(({ params }) => new Response(results.raw(params.id), { headers: { "content-type": "application/json" } })),
  );
  app.route("POST", "/api/uploads", guard(({ body }) => results.begin(body)));
  app.route("POST", "/api/uploads/:id/chunks/:seq", guard(({ params, body }) => results.chunk(params.id, Number(params.seq), body)));
  app.route("POST", "/api/uploads/:id/commit", guard(({ params }) => results.commit(params.id)));

  app.route(
    "GET",
    "/api/pdfjs/cmaps/:file",
    guard(async ({ params }) => {
      if (!/^[A-Za-z0-9_.-]{1,120}$/.test(params.file) || params.file.includes("..")) throw new Error("资源路径无效。");
      return new Response(new Uint8Array(await readFile(await app.resources.path("pdfjs-assets", "cmaps/" + params.file))), {
        headers: { "content-type": "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" },
      });
    }),
  );
  app.route("GET", "/api/model-status", async () => {
    try {
      const r = await app.host.capabilities.list({ domain: "llm" });
      return {
        available: r.capabilities.some((x) => x.operation === "generateText" && x.status === "available"),
        model: MODEL,
      };
    } catch {
      return { available: false, model: MODEL };
    }
  });
  app.route("POST", "/api/host/personas", guard(({ body }) => generatePersonas(app.host.llm, body)));
  app.route("POST", "/api/host/report", guard(({ body }) => deepenReport(app.host.llm, body)));

  let client: ReturnType<typeof createMiroFishClient> | null = null;
  let configError = "";
  try {
    client = createMiroFishClient();
  } catch (e) {
    configError = e instanceof Error ? e.message : "MIROFISH_URL 无效";
  }
  const mirofish = () => {
    if (!client) throw new Error(configError);
    return client;
  };
  const runs = client ? createRunCommands(app.database, client) : null;
  const runner = () => {
    if (!runs) throw new Error(configError);
    return runs;
  };
  app.route("GET", "/api/service", async () =>
    client
      ? { ...(await client.health()), defaultUrl: DEFAULT_MIROFISH_URL, configured: Boolean(process.env.MIROFISH_URL) }
      : { available: false, url: process.env.MIROFISH_URL ?? "", message: configError, defaultUrl: DEFAULT_MIROFISH_URL, configured: true },
  );
  app.route("GET", "/api/simulations", guard(() => mirofish().list()));
  app.route("POST", "/api/run-commands", guard(({ body }) => runner().submit(body)));
  app.route("GET", "/api/run-commands/:id", guard(({ params }) => runner().refresh(params.id)));
  app.route("GET", "/api/simulations/:id/status", guard(({ params }) => runner().status(params.id)));
  const importResult = async (id: string, startedAt?: string) => {
    const r = await mirofish().result(id, startedAt);
    return { ...results.storeActions(r.actions), simulationId: r.simulationId, ignoredEvents: r.ignoredEvents, sourceName: "MiroFish 后端 · " + id };
  };
  app.route("GET", "/api/simulations/:id/runs/:stamp/result", guard(({ params }) => importResult(params.id, params.stamp)));
  app.route("GET", "/api/simulations/:id/result", guard(({ params }) => importResult(params.id)));
}
