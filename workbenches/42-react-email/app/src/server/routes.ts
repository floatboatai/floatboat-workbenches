import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateEmail } from "../contracts/email.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { renderEmail } from "./render-email.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateEmail);
  registerAutosaveRoutes(app, validateEmail);
  const fail = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "渲染失败。" } },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/render", async ({ body }) => {
    try {
      if (!isRecord(body)) throw Error("请求无效。");
      return await renderEmail(validateEmail(body.data));
    } catch (e) {
      return fail(e);
    }
  });
}
