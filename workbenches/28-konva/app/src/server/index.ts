import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createStore } from "./store.ts";
import { validateBoard } from "../contracts/board.ts";
import { imageStore } from "./images.ts";
import { isRecord } from "../contracts/project.ts";
const app = await createWorkbenchServer(import.meta.url);
const images = imageStore(app),
  store = createStore(app.database, validateBoard);
registerAutosaveRoutes(app, validateBoard, undefined, {
  verify: async (board) => {
    await Promise.all(
      board.items.filter((i) => i.source).map((i) => images.verify(i.source)),
    );
  },
});
const failure = (e: unknown) =>
  Response.json(
    { error: { message: e instanceof Error ? e.message : "操作失败" } },
    { status: 400 },
  );
app.route("GET", "/api/projects", () => store.list());
app.route("GET", "/api/projects/:id", ({ params }) => {
  try {
    return store.get(params.id);
  } catch (e) {
    return failure(e);
  }
});
app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
  try {
    if (!isRecord(body)) throw new Error("请求无效");
    return store.remove(params.id, body.revision);
  } catch (e) {
    return failure(e);
  }
});
app.route("POST", "/api/originals", async ({ body }) => {
  try {
    return await images.put(body);
  } catch (e) {
    return failure(e);
  }
});
app.route("GET", "/api/originals/:id", async ({ params }) => {
  try {
    const bytes = await images.read(params.id);
    return { base64: bytes.toString("base64") };
  } catch (e) {
    return failure(e);
  }
});
await app.listen();
