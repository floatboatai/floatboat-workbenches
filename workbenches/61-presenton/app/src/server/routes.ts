// ABOUTME: 本应用的业务路由：文稿列表/删除、可选 Floatboat 模型起草、可选 Presenton 服务状态与制作记录。
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { validateDeck } from "../contracts/deck.ts";
import { isRecord } from "../contracts/project.ts";
import { createStore, StoreError } from "./store.ts";
import { configFrom, createPresenton } from "./presenton.ts";
import { createJobs } from "./jobs.ts";
import { createModelChannel } from "./model.ts";

export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateDeck);
  const model = createModelChannel(app.host);
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
  app.route("GET", "/api/model-status", () => model.status());
  app.route("POST", "/api/outline/draft", ({ body }) => protect(() => model.draft(body)));
  // Presenton is optional: status never fails the page, it explains how to start the service.
  const presentonState = () => {
    try {
      const c = configFrom(process.env);
      return c
        ? { configured: true, origin: c.origin, message: `已配置 ${c.origin}，尚未检查连通性。` }
        : { configured: false, origin: "", message: "未配置 Presenton 服务。本地生成与导出不受影响。" };
    } catch (e) {
      return { configured: false, origin: "", message: `PRESENTON_URL 无效：${e instanceof Error ? e.message : "格式错误"}` };
    }
  };
  app.route("GET", "/api/presenton", () => ({ ...presentonState(), reachable: null }));
  app.route("POST", "/api/presenton/check", async () => {
    const state = presentonState();
    if (!state.configured) return { ...state, reachable: false };
    try {
      await service()!.health();
      return { ...state, reachable: true, message: `${state.origin} 可访问，已提供异步制作接口；模型质量需以实际任务为准。` };
    } catch (e) {
      return { ...state, reachable: false, message: `无法使用 ${state.origin}：${e instanceof Error ? e.message : "连接失败"}` };
    }
  });
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
