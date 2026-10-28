import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { readFile } from "node:fs/promises";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createStore } from "./store.ts";
import { isRecord } from "../contracts/project.ts";
import { validateModel } from "../contracts/model.ts";
import { resourceStore } from "./resources.ts";
const app = await createWorkbenchServer(import.meta.url),
  resources = resourceStore(app),
  store = createStore(app.database, validateModel);
const fail = (e: unknown) =>
  Response.json(
    { error: { message: e instanceof Error ? e.message : "操作失败。" } },
    { status: 400 },
  );
registerAutosaveRoutes(app, validateModel, undefined, {
  verify: async (d) => {
    await Promise.all([resources.verify(d.source), resources.verify(d.bound)]);
  },
});
app.route("GET", "/api/app", () => ({
  name: app.manifest.name,
  version: app.manifest.version,
  platform: "not-used",
}));
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
    if (!isRecord(body)) throw Error("请求格式无效");
    return store.remove(params.id, body.revision);
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/originals", async ({ body }) => {
  try {
    return await resources.put(body);
  } catch (e) {
    return fail(e);
  }
});
app.route("GET", "/api/originals/:id", async ({ params }) => {
  try {
    return new Response(new Uint8Array(await resources.read(params.id)), {
      headers: {
        "content-type": "model/gltf-binary",
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return fail(e);
  }
});
app.route("GET", "/api/assets/:name", async ({ params }) => {
  try {
    if (
      !["mannequin.glb", "human-rig.glb", "human-animations.glb"].includes(
        params.name,
      )
    )
      throw Error("资源不存在。");
    return new Response(
      new Uint8Array(
        await readFile(await app.resources.path("engine-assets", params.name)),
      ),
      {
        headers: {
          "content-type": "model/gltf-binary",
          "cache-control": "private, max-age=31536000",
        },
      },
    );
  } catch (e) {
    return fail(e);
  }
});
await app.listen();
