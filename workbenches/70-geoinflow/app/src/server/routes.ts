import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { observationValue as projectValue } from "../contracts/observation.ts";
import { parseInput } from "./parser.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, projectValue);
  registerAutosaveRoutes(app, projectValue);
  const fail = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "操作失败" } },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  app.route("POST", "/api/parse", ({ body }) => {
    try {
      return parseInput(body);
    } catch (error) {
      return fail(error);
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
  app.route("POST", "/api/projects", ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return Response.json(store.create(body.title, body.data), {
        status: 201,
      });
    } catch (e) {
      return fail(e);
    }
  });
  app.route("PUT", "/api/projects/:id", ({ body, params }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return store.update(params.id, body.title, body.data, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ body, params }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
}
