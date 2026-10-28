import { registerAutosaveRoutes } from "./autosave.ts";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord } from "../contracts/project";
import { createStore, StoreError } from "./store";
export function registerRoutes<T>(
  app: WorkbenchServer,
  validate: (value: unknown) => T,
) {
  const store = createStore(app.database, validate);
  registerAutosaveRoutes(app, validate);
  const fail = (error: unknown) =>
    Response.json(
      {
        error: {
          message:
            error instanceof WorkbenchHostError
              ? "模型服务暂不可用，请打开 Floatboat 并检查登录和模型设置。"
              : error instanceof Error
                ? error.message
                : "操作失败，请重试。",
        },
      },
      {
        status:
          error instanceof StoreError
            ? error.status
            : error instanceof WorkbenchHostError
              ? 503
              : 400,
      },
    );
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (error) {
      return fail(error);
    }
  });
  app.route("POST", "/api/projects", ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return Response.json(store.create(body.title, body.data), {
        status: 201,
      });
    } catch (error) {
      return fail(error);
    }
  });
  app.route("PUT", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.update(params.id, body.title, body.data, body.revision);
    } catch (error) {
      return fail(error);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.remove(params.id, body.revision);
    } catch (error) {
      return fail(error);
    }
  });
}
