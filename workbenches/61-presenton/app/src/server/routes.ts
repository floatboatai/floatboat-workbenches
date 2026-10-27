import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAutosaveRoutes } from "./autosave.ts";
import { validateDeck } from "../contracts/deck.ts";
import { isRecord } from "../contracts/project.ts";
import { createStore, StoreError } from "./store.ts";
import { configFrom, createPresenton } from "./presenton.ts";
import { createJobs } from "./jobs.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateDeck);
  registerAutosaveRoutes(app, validateDeck);
  const service = () => {
    const c = configFrom(process.env);
    return c ? createPresenton(c) : null;
  };
  const jobs = createJobs(app.database, service, (name, write) =>
    app.resources.path("generated-files", name, write ? "write" : "read"),
  );
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message: e instanceof Error ? e.message : "操作失败，请重试。",
        },
      },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  const protect = (fn: () => unknown | Promise<unknown>) =>
    Promise.resolve().then(fn).catch(fail);
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) =>
    protect(() => store.get(params.id)),
  );
  app.route("DELETE", "/api/projects/:id", ({ params, body }) =>
    protect(() => {
      if (!isRecord(body)) throw new Error("请求无效。");
      return store.remove(params.id, body.revision);
    }),
  );
  app.route("GET", "/api/presenton", () =>
    protect(() => {
      const configured = Boolean(service());
      return {
        configured,
        message: configured
          ? "Presenton 已配置；连接将在查询或制作时验证。"
          : "尚未连接 Presenton。可继续编排大纲、导入和复核已有文稿。",
      };
    }),
  );
  app.route("POST", "/api/presenton/check", () =>
    protect(async () => {
      const client = service();
      if (!client) throw new Error("尚未配置 Presenton 服务。");
      await client.health();
      return {
        configured: true,
        message: "Presenton 服务可访问；模型生成尚未验证。",
      };
    }),
  );
  app.route("GET", "/api/jobs", () => jobs.list());
  app.route("POST", "/api/jobs", ({ body }) =>
    protect(() => jobs.submit(body)),
  );
  app.route("GET", "/api/jobs/:id", ({ params }) =>
    protect(() => jobs.get(params.id)),
  );
  app.route("GET", "/api/jobs/:id/snapshot", ({ params }) =>
    protect(() => jobs.snapshot(params.id)),
  );
  app.route("POST", "/api/jobs/:id/refresh", ({ params }) =>
    protect(() => jobs.refresh(params.id)),
  );
  app.route("POST", "/api/jobs/:id/adopt", ({ params, body }) =>
    protect(() =>
      jobs.adopt(params.id, isRecord(body) ? body.taskId : undefined),
    ),
  );
  app.route("POST", "/api/jobs/:id/stop", ({ params }) =>
    protect(() => jobs.stop(params.id)),
  );
  app.route("GET", "/api/jobs/:id/presentation", ({ params }) =>
    protect(() => jobs.presentation(params.id)),
  );
  app.route("GET", "/api/presentations/:id", ({ params }) =>
    protect(() => jobs.fetchPresentation(params.id)),
  );
  app.route("POST", "/api/jobs/import", ({ body }) =>
    protect(() => jobs.importResult(body)),
  );
  app.route("POST", "/api/jobs/:id/artifact", ({ params }) =>
    protect(() => jobs.cacheArtifact(params.id)),
  );
  app.route("GET", "/api/jobs/:id/chunks/:index", ({ params }) =>
    protect(() => jobs.chunk(params.id, Number(params.index))),
  );
}
