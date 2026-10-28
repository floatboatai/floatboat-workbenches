import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateReview } from "../contracts/review.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createAudioFiles, detectMime } from "./files.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateReview),
    files = createAudioFiles((p, w) =>
      app.resources.path("audio-originals", p, w ? "write" : "read"),
    );
  registerAutosaveRoutes(app, validateReview, undefined, {
    verify: (data) => files.verify(data.source),
  });
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message:
            e instanceof Error && "code" in e
              ? "音频原件缺失，请重附匹配原件。"
              : e instanceof Error
                ? e.message
                : "操作失败。",
        },
      },
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
  app.route("PUT", "/api/audio/:id/chunks/:index", async ({ params, body }) => {
    try {
      if (!isRecord(body)) throw Error("请求无效。");
      return await files.chunk(params.id, Number(params.index), body.base64);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/audio", async ({ body }) => {
    try {
      return await files.finish(body);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/audio/:id", async ({ params }) => {
    try {
      const b = await files.read(params.id);
      return new Response(new Uint8Array(b), {
        headers: {
          "content-type": detectMime(b),
          "x-content-type-options": "nosniff",
        },
      });
    } catch (e) {
      return fail(e);
    }
  });
}
