import { readFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateProject } from "../contracts/evaluation.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createRunner, jobId } from "./runner.ts";
import { createRuns, createTasks, migrateLegacyProjects } from "./runs.ts";
import { createSandbox } from "./sandbox.ts";
import type { HostModel } from "./evaluator.ts";

export const HOST_MODEL_HINT = "gemini-3.8-flash";

export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateProject);
  const runs = createRuns(app.database);
  migrateLegacyProjects(app.database, runs);
  const sandbox = createSandbox();
  const host: HostModel = {
    generateText: (input, options) => app.host.llm.generateText(input, options),
  };
  const tasks = createTasks(app.database, runs, {
    sandbox,
    host: () => host,
    track: (work) => app.trackTask(work, "evaluation"),
  });
  const runner = createRunner(app.database, runs);
  registerAutosaveRoutes(app, validateProject);
  const fail = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "操作未完成，请重试。" } },
      { status: e instanceof StoreError ? e.status : isRecord(e) && e.status === 404 ? 404 : 400 },
    );
  const guard =
    <T,>(fn: (ctx: { params: Record<string, string>; body: unknown }) => T | Promise<T>) =>
    async (ctx: { params: Record<string, string>; body: unknown }) => {
      try {
        return await fn(ctx);
      } catch (e) {
        return fail(e);
      }
    };
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", guard(({ params }) => store.get(params.id)));
  app.route(
    "DELETE",
    "/api/projects/:id",
    guard(({ params, body }) => {
      if (!isRecord(body)) throw new Error("请求无效。");
      return store.remove(params.id, body.revision);
    }),
  );

  app.route(
    "GET",
    "/api/runs/:id",
    guard(({ params }) => new Response(runs.raw(params.id), { headers: { "content-type": "application/json; charset=utf-8" } })),
  );
  app.route("POST", "/api/runs/import", guard(({ body }) => runs.importPart(body)));

  /** 示例评测集：配置原文 + 示例录制运行（每次以调用方给的 ID 入库，便于多次载入）。 */
  app.route(
    "POST",
    "/api/sample",
    guard(async ({ body }) => {
      if (!isRecord(body) || typeof body.runId !== "string" || !/^smp-[0-9a-f-]{36}$/.test(body.runId)) throw new StoreError(400, "示例标识无效。");
      const [config, recorded] = await Promise.all([
        readFile(await app.resources.path("sample-config"), "utf8"),
        readFile(await app.resources.path("sample-recording"), "utf8"),
      ]);
      const run = runs.store(body.runId, "示例录制 · 2026-10-20", "sample", JSON.parse(recorded));
      return { config, run };
    }),
  );

  app.route("POST", "/api/evaluations", guard(({ body }) => tasks.start(body)));
  app.route("GET", "/api/evaluations/:id", guard(({ params }) => tasks.view(params.id)));
  app.route("POST", "/api/evaluations/:id/cancel", guard(({ params }) => tasks.cancel(params.id)));

  app.route("GET", "/api/host-status", async () => {
    try {
      const r = await app.host.capabilities.list({ domain: "llm" });
      const cap = r.capabilities.find((x) => x.operation === "generateText");
      return {
        available: cap?.status === "available",
        status: cap?.status ?? "missing",
        model: HOST_MODEL_HINT,
        message:
          cap?.status === "available"
            ? "Floatboat 模型可用：带 floatboat:<模型> 的列会在确认后真实调用。"
            : "Floatboat 模型未授权或未声明，模型列无法运行。",
      };
    } catch {
      return {
        available: false,
        status: "offline",
        model: HOST_MODEL_HINT,
        message: "未连接 Floatboat：启动并登录 Floatboat 客户端后点“重新检查”。回放、echo 与脚本列不受影响。",
      };
    }
  });

  app.route("GET", "/api/runner", () => runner.health());
  app.route("POST", "/api/official-jobs", guard(({ body }) => runner.start(body)));
  app.route("GET", "/api/official-jobs/:id", guard(({ params }) => runner.poll(jobId(params.id))));
}
