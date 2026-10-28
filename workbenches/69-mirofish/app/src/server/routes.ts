import { createRunCommands } from "./run-commands.ts";
import { createMiroFishClient } from "./mirofish-client.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project";
import { createStore, StoreError } from "./store";
import {
  reviewValue,
  parseNative,
  fromNative,
} from "../contracts/simulation.ts";
export function registerRoutes(app: WorkbenchServer) {
  const validate = reviewValue;
  const store = createStore(app.database, validate);
  registerAutosaveRoutes(app, validate);
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
  const client = createMiroFishClient();
  const runs = createRunCommands(app.database, client);
  app.route("POST", "/api/run-commands", async ({ body }) => {
    try {
      return await runs.submit(body);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/run-commands/:id", async ({ params }) => {
    try {
      return await runs.refresh(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/simulations/:id/status", async ({ params }) => {
    try {
      return await runs.status(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route(
    "GET",
    "/api/simulations/:id/runs/:stamp/result",
    async ({ params }) => {
      try {
        return await client.result(params.id, params.stamp);
      } catch (e) {
        return fail(e);
      }
    },
  );
  app.route("GET", "/api/service", () => client.health());
  app.route("GET", "/api/simulations", async () => {
    try {
      return await client.list();
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/simulations/:id/result", async ({ params }) => {
    try {
      return await client.result(params.id);
    } catch (e) {
      return fail(e);
    }
  });
}
