import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createStore } from "./store.ts";
import { validateMap } from "../contracts/mindmap.ts";
import { isRecord } from "../contracts/project.ts";
const app = await createWorkbenchServer(import.meta.url),
  store = createStore(app.database, validateMap);
registerAutosaveRoutes(app, validateMap);
const fail = (e: unknown) =>
  Response.json(
    { error: { message: e instanceof Error ? e.message : "操作失败" } },
    { status: 400 },
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
    if (!isRecord(body)) throw new Error("请求无效");
    return store.remove(params.id, body.revision);
  } catch (e) {
    return fail(e);
  }
});
await app.listen();
