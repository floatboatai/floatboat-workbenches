// ABOUTME: 组装服务入口：自动保存、文稿列表、ComfyUI 会话路由。

import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateDoc } from "../contracts/document.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { registerComfyRoutes } from "./comfy-routes.ts";
import { createSession } from "./comfy-session.ts";
import { createRunStore } from "./runs.ts";
import { createStore, StoreError } from "./store.ts";

const app = await createWorkbenchServer(import.meta.url);
const documents = createStore(app.database, validateDoc);
const runs = createRunStore(app.database);
const session = createSession(runs);

const fail = (error: unknown) =>
  Response.json(
    { error: { message: error instanceof Error ? error.message : "操作失败，请重试。" } },
    { status: error instanceof StoreError ? error.status : 400 },
  );

registerAutosaveRoutes(app, validateDoc);
app.route("GET", "/api/app", () => ({ name: app.manifest.name, version: app.manifest.version, platform: "not-used" }));
app.route("GET", "/api/projects", () => documents.list());
app.route("GET", "/api/projects/:id", ({ params }) => {
  try {
    return documents.get(params.id);
  } catch (error) {
    return fail(error);
  }
});
app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
  try {
    if (!isRecord(body)) throw new Error("请求格式无效。");
    const result = documents.remove(params.id, body.revision);
    runs.removeProject(params.id);
    return result;
  } catch (error) {
    return fail(error);
  }
});
registerComfyRoutes(app, session, runs);
void session.reconcile();
await app.listen();
