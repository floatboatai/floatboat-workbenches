import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateTranscript } from "../contracts/transcript.ts";
import { jobId, jobInput } from "../contracts/job.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createAudioFiles, detectMime } from "./files.ts";
import { createJobs } from "./jobs.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateTranscript),
    files = createAudioFiles((p, w) =>
      app.resources.path("audio-originals", p, w ? "write" : "read"),
    ),
    jobs = createJobs(app.database, files.read);
  registerAutosaveRoutes(app, validateTranscript, undefined, {
    verify: (data) => files.verify(data.source),
  });
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message:
            e instanceof Error && "code" in e
              ? "音频原件暂不可用，请重新上传后重试。"
              : e instanceof Error
                ? e.message
                : "操作失败，请重试。",
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
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效。");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("PUT", "/api/audio/:id/chunks/:index", async ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效。");
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
      const bytes = await files.read(params.id);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": detectMime(bytes),
          "cache-control": "private,max-age=31536000,immutable",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/service", () => jobs.health());
  app.route("GET", "/api/jobs", () => jobs.list());
  app.route("GET", "/api/jobs/:id", async ({ params }) => {
    try {
      return await jobs.reconcile(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/jobs", async ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效。");
      const input = jobInput(body.input);
      await files.verify(input.source);
      return await jobs.create(jobId(body.id), jobId(body.projectId), input);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/jobs/:id/retry", async ({ params }) => {
    try {
      return await jobs.retry(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/jobs/:id/cancel", async ({ params }) => {
    try {
      return await jobs.cancel(params.id);
    } catch (e) {
      return fail(e);
    }
  });
}
