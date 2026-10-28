import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createStore } from "./store.ts";
import { isRecord } from "../contracts/project.ts";
import { fileRef, editsValue, validateAsset } from "../contracts/asset.ts";
import { resourceStore } from "./resources.ts";
import { inspect, processAsset, sampleAsset } from "./native.ts";
const app = await createWorkbenchServer(import.meta.url),
  resources = resourceStore(app),
  store = createStore(app.database, validateAsset);
const fail = (e: unknown) =>
  Response.json(
    { error: { message: e instanceof Error ? e.message : "操作失败。" } },
    { status: 400 },
  );
registerAutosaveRoutes(app, validateAsset, undefined, {
  verify: async (d) => {
    await Promise.all([resources.verify(d.source), resources.verify(d.result)]);
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
    if (!isRecord(body)) throw Error("请求无效。");
    return store.remove(params.id, body.revision);
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/models", async ({ body }) => {
  try {
    return await resources.put(body);
  } catch (e) {
    return fail(e);
  }
});
app.route("GET", "/api/models/:id", async ({ params }) => {
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
app.route("GET", "/api/inspect/:id", async ({ params }) => {
  try {
    return await inspect(await resources.read(params.id));
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/sample", async () => {
  try {
    const bytes = await sampleAsset();
    return {
      ref: await resources.save(bytes, "material-study.glb"),
      inspection: await inspect(bytes),
    };
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/process", async ({ body }) => {
  try {
    if (!isRecord(body)) throw Error("请求无效。");
    const ref = fileRef(body.source),
      edits = editsValue(body.edits, true);
    await resources.verify(ref);
    const output = await processAsset(await resources.read(ref.id), edits);
    return {
      ref: await resources.save(
        output.bytes,
        ref.name.replace(/\.glb$/i, "") + "-reviewed.glb",
      ),
      inspection: output.inspection,
    };
  } catch (e) {
    return fail(e);
  }
});
await app.listen();
