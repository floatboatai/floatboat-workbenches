import { registerAutosaveRoutes } from "./autosave.ts";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project";
import { createStore, StoreError } from "./store";
export function registerRoutes<T>(
  app: WorkbenchServer,
  validate: (value: unknown) => T,
  verify?: (data: T) => Promise<void>,
) {
  const store = createStore(app.database, validate);
  registerAutosaveRoutes(app, validate, undefined, verify ? { verify } : {});
  const fail = (error: unknown) =>
    Response.json(
      {
        error: {
          message:
            error instanceof Error ? error.message : "操作失败，请重试。",
        },
      },
      {
        status: error instanceof StoreError ? error.status : 400,
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
