import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { validateProject } from "../contracts/editor.ts";
import { isRecord } from "../contracts/project.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { imageStore, inspectImage } from "./images.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateProject),
    images = imageStore(app);
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message: e instanceof Error ? e.message : "操作失败，请重试。",
        },
      },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  registerAutosaveRoutes(app, validateProject, undefined, {
    verify: async (data) => images.verify(data.source),
  });
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
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/images", async ({ body }) => {
    try {
      return await images.put(body);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/images/:id", async ({ params }) => {
    try {
      const bytes = await images.read(params.id);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": inspectImage(bytes).mime,
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (e) {
      return fail(e);
    }
  });
}
