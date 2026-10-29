import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createStore } from "./store.ts";
import { isRecord } from "../contracts/project.ts";
import {
  editsValue,
  fileRef,
  stagesValue,
  validateAsset,
} from "../contracts/asset.ts";
import { passesValue } from "../contracts/pipeline.ts";
import { resourceStore } from "./resources.ts";
import { inspectBytes, readDocument } from "./model.ts";
import { compressModel, runPipeline } from "./pipeline.ts";
import { importModel } from "./importer.ts";
import { uploadSessions } from "./uploads.ts";
import { sampleAsset } from "./sample.ts";
import { sniffImage } from "./images.ts";

const app = await createWorkbenchServer(import.meta.url),
  resources = resourceStore(app),
  uploads = uploadSessions(),
  store = createStore(app.database, validateAsset);
const documents = new Map<string, Promise<Awaited<ReturnType<typeof readDocument>>>>();
/** Texture previews reuse the last parsed models instead of re-reading per image. */
function cachedDocument(id: string) {
  let pending = documents.get(id);
  if (!pending) {
    pending = resources.read(id).then((bytes) => readDocument(bytes));
    documents.set(id, pending);
    pending.catch(() => documents.delete(id));
    while (documents.size > 2) documents.delete(documents.keys().next().value!);
  }
  return pending;
}
const fail = (e: unknown) =>
  Response.json(
    { error: { message: e instanceof Error ? e.message : "操作失败。" } },
    { status: 400 },
  );
const guard =
  <T>(fn: (ctx: T) => unknown) =>
  async (ctx: T) => {
    try {
      return await fn(ctx);
    } catch (e) {
      return fail(e);
    }
  };
registerAutosaveRoutes(app, validateAsset, undefined, {
  verify: (d) => resources.verifyDocument(d),
});
app.route("GET", "/api/app", () => ({
  name: app.manifest.name,
  version: app.manifest.version,
  platform: "not-used",
}));
app.route("GET", "/api/projects", () => store.list());
app.route(
  "GET",
  "/api/projects/:id",
  guard(({ params }) => store.get(params.id)),
);
app.route(
  "DELETE",
  "/api/projects/:id",
  guard(({ params, body }) => {
    if (!isRecord(body)) throw Error("请求无效。");
    return store.remove(params.id, body.revision);
  }),
);

// Chunked uploads: the SDK limits each JSON body to 2,000,000 bytes.
app.route("POST", "/api/uploads", guard(({ body }) => uploads.create(body)));
app.route(
  "POST",
  "/api/uploads/:id/chunk",
  guard(({ params, body }) => uploads.chunk(params.id, body)),
);
app.route(
  "DELETE",
  "/api/uploads/:id",
  guard(({ params }) => uploads.drop(params.id)),
);
app.route(
  "POST",
  "/api/uploads/:id/import",
  guard(async ({ params }) => {
    const model = await importModel(uploads.take(params.id, "import")),
      ref = await resources.save(model.bytes, model.name);
    return {
      ref,
      inspection: await inspectBytes(model.bytes, ref.id),
      notes: model.notes,
      files: model.files,
    };
  }),
);
app.route(
  "POST",
  "/api/uploads/:id/resource",
  guard(async ({ params, body }) => {
    if (!isRecord(body) || !["model", "image"].includes(String(body.kind)))
      throw Error("资源类型无效。");
    const [file] = uploads.take(params.id, "resource");
    const name = typeof body.name === "string" ? body.name.slice(0, 160) : file.name;
    return body.kind === "image"
      ? { ref: await resources.saveImage(file.bytes, name) }
      : { ref: await resources.saveModel(file.bytes, name) };
  }),
);
app.route(
  "POST",
  "/api/resources/missing",
  guard(async ({ body }) => ({
    missing: await resources.missing(isRecord(body) ? body.ids : null),
  })),
);
app.route(
  "GET",
  "/api/models/:id",
  guard(async ({ params }) => {
    const bytes = await resources.read(params.id).catch(() => {
      throw Error("模型资源缺失，请补齐同一文件。");
    });
    return new Response(bytes, {
      headers: {
        "content-type": sniffImage(bytes) ?? "model/gltf-binary",
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  }),
);
app.route(
  "GET",
  "/api/inspect/:id",
  guard(async ({ params }) => {
    const bytes = await resources.read(params.id).catch(() => {
      throw Error("模型资源缺失，请补齐同一文件或导入完整工程。");
    });
    return inspectBytes(bytes, params.id);
  }),
);
app.route(
  "GET",
  "/api/models/:id/textures/:index",
  guard(async ({ params }) => {
    const doc = await cachedDocument(params.id),
      texture = doc.getRoot().listTextures()[Number(params.index)],
      image = texture?.getImage();
    if (!texture || !image) throw Error("贴图不存在。");
    return new Response(image, {
      headers: {
        "content-type": texture.getMimeType() || "application/octet-stream",
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  }),
);
app.route(
  "POST",
  "/api/sample",
  guard(async () => {
    const bytes = await sampleAsset(),
      ref = await resources.save(bytes, "wind-turbine-t07.glb");
    return { ref, inspection: await inspectBytes(bytes, ref.id), notes: [] };
  }),
);
app.route(
  "POST",
  "/api/process",
  guard(async ({ body }) => {
    if (!isRecord(body)) throw Error("请求无效。");
    const source = fileRef(body.source),
      edits = editsValue(body.edits, true),
      passes = passesValue(body.passes ?? []),
      cached = body.stages === undefined ? [] : stagesValue(body.stages);
    if (!(await resources.exists(source)))
      throw Error("模型资源缺失，请补齐同一文件或导入完整工程。");
    return runPipeline(
      {
        source,
        edits,
        passes,
        cached,
        images: await resources.images({ edits }),
      },
      resources,
    );
  }),
);
app.route(
  "POST",
  "/api/export",
  guard(async ({ body }) => {
    if (!isRecord(body) || !["none", "meshopt", "draco"].includes(String(body.compression)))
      throw Error("导出请求无效。");
    const ref = fileRef(body.ref);
    if (!(await resources.exists(ref))) throw Error("结果资源缺失，请重新生成。");
    const output = await compressModel(
      await resources.read(ref.id),
      body.compression as "none" | "meshopt" | "draco",
    );
    return new Response(output.slice(), {
      headers: { "content-type": "model/gltf-binary" },
    });
  }),
);
await app.listen();
