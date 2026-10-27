import { registerAutosaveRoutes } from "./autosave";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project";
import { validateCollection } from "../contracts/folio";
import { createStore, StoreError } from "./store";
import { createImages, imageManifest } from "./images";
export function registerRoutes(app: WorkbenchServer) {
  const images = createImages(app.database, app.resources);
  const validate = (value: unknown) => {
    const data = validateCollection(value);
    for (const page of data.pages) images.get(page.assetId);
    return data;
  };
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
      { status: error instanceof StoreError ? error.status : 400 },
    );
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/projects", ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("项目格式无效。");
      return Response.json(store.create(body.title, body.data), {
        status: 201,
      });
    } catch (e) {
      return fail(e);
    }
  });
  app.route("PUT", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("项目格式无效。");
      return store.update(params.id, body.title, body.data, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("项目格式无效。");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/images", async ({ body }) => {
    try {
      return Response.json(await images.put(body), { status: 201 });
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/images/:id", async ({ params }) => {
    try {
      const { meta, bytes } = await images.read(params.id);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": meta.mime,
          "x-content-type-options": "nosniff",
          "cache-control": "private, max-age=3600",
        },
      });
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/images/:id/export", async ({ params }) => {
    try {
      const { meta, bytes } = await images.read(params.id);
      return meta.id.startsWith("demo-")
        ? { id: meta.id, name: meta.name, sample: true }
        : { id: meta.id, name: meta.name, base64: bytes.toString("base64") };
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/iiif/:id/manifest", ({ params, url }) => {
    try {
      return imageManifest(images.get(params.id), url.origin);
    } catch (e) {
      return fail(e);
    }
  });
}
