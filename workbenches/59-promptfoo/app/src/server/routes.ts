import { readFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateProject } from "../contracts/evaluation.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createRunner, jobId } from "./runner.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateProject),
    runner = createRunner(app.database);
  registerAutosaveRoutes(app, validateProject);
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message: e instanceof Error ? e.message : "操作未完成，请重试。",
        },
      },
      {
        status:
          e instanceof StoreError
            ? e.status
            : isRecord(e) && e.status === 404
              ? 404
              : 400,
      },
    );
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效。");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route(
    "GET",
    "/api/example",
    async () =>
      new Response(
        await readFile(await app.resources.path("evaluation-example")),
        { headers: { "content-type": "application/json" } },
      ),
  );
  app.route("GET", "/api/runner", () => runner.health());
  app.route("POST", "/api/jobs", async ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("任务请求无效。");
      return await runner.start(jobId(body.id), body.suite);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/jobs/:id", async ({ params }) => {
    try {
      return await runner.poll(jobId(params.id));
    } catch (e) {
      return fail(e);
    }
  });
}
