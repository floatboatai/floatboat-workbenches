import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { readyMontage, MAX_VIDEO_BYTES } from "../contracts/montage.ts";
import { timelineValue } from "../contracts/timeline.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { reconcileRender } from "./render-state.ts";
import { createMediaFiles } from "./files.ts";
export const SERVICE_START = "cd workbenches/67-openmontage/service && pnpm setup && pnpm start";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, timelineValue);
  const files = createMediaFiles(
    (p, w) => app.resources.path("media", p, w ? "write" : "read"),
    (p) => app.resources.path("samples", p, "read"),
  );
  // 素材文件在保存前核对；缺失时工作稿仍保存为草稿，界面提示补齐素材。
  registerAutosaveRoutes(app, timelineValue, undefined, {
    verify: async (data) => {
      await Promise.all([...data.assets, ...data.outputs].map((a) => files.verify(a)));
    },
  });
  const failure = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "操作失败。" } },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("POST", "/api/projects", ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("项目格式无效");
      return store.create(body.title, body.data);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("PUT", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("项目格式无效");
      return store.update(params.id, body.title, body.data, body.revision);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("项目格式无效");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return failure(e);
    }
  });
  const origin = process.env.OPENMONTAGE_SERVICE_URL ?? "http://127.0.0.1:8797";
  const parsed = new URL(origin);
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
    )
  )
    throw new Error("制作服务必须为本机HTTP或远程HTTPS。");
  async function upstream(path: string, init?: RequestInit) {
    return fetch(new URL(path, origin), {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        "content-type": "application/json",
        ...(process.env.OPENMONTAGE_SERVICE_TOKEN
          ? {
              authorization: `Bearer ${process.env.OPENMONTAGE_SERVICE_TOKEN}`,
            }
          : {}),
      },
    });
  }
  const get = (id: string) => {
    const r = app.database
      .prepare(
        "SELECT id,project_id AS projectId,state,created_at AS createdAt,error FROM renders WHERE id=?",
      )
      .get(id);
    if (!r) throw new StoreError(404, "任务不存在");
    return r;
  };
  app.route("GET", "/api/renderer", async () => {
    try {
      const r = await upstream("/health");
      if (!r.ok) throw new Error();
      const v: unknown = await r.json();
      const ready = isRecord(v) && v.ready === true && v.engine === "openmontage";
      return {
        available: ready,
        state: ready ? "ready" : "not-ready",
        message: ready
          ? "OpenMontage 服务已连接（固定提交 " + String(isRecord(v) ? v.version : "").slice(0, 8) + "）"
          : "服务已启动，但 Python、FFmpeg 或固定版本的 OpenMontage 源码尚未就绪。",
        command: SERVICE_START,
        url: origin,
      };
    } catch {
      return {
        available: false,
        state: "offline",
        message: "未连接 OpenMontage 服务（" + origin + "）。浏览器导出不受影响。",
        command: SERVICE_START,
        url: origin,
      };
    }
  });
  app.route("GET", "/api/projects/:id/renders", ({ params }) =>
    app.database
      .prepare(
        "SELECT id,project_id AS projectId,state,created_at AS createdAt,error FROM renders WHERE project_id=? ORDER BY created_at DESC LIMIT 20",
      )
      .all(params.id),
  );
  app.route("POST", "/api/renders", async ({ body }) => {
    try {
      if (
        !isRecord(body) ||
        typeof body.id !== "string" ||
        !/^[0-9a-f-]{36}$/.test(body.id) ||
        typeof body.projectId !== "string"
      )
        throw new Error("制作任务格式无效。");
      store.get(body.projectId);
      const snapshot = JSON.stringify(readyMontage(body.montage));
      const existing = app.database
        .prepare("SELECT snapshot,project_id FROM renders WHERE id=?")
        .get(body.id);
      if (
        existing &&
        (existing.snapshot !== snapshot ||
          existing.project_id !== body.projectId)
      )
        throw new StoreError(409, "任务编号对应另一份输入。");
      if (!existing)
        app.database
          .prepare(
            "INSERT INTO renders(id,project_id,snapshot,state,created_at) VALUES(?,?,?,?,?)",
          )
          .run(
            body.id,
            body.projectId,
            snapshot,
            "submitting",
            new Date().toISOString(),
          );
      try {
        const r = await upstream("/jobs", {
          method: "POST",
          body: await payload(body.id, snapshot),
        });
        if (!r.ok) throw new Error();
        const j: unknown = await r.json();
        reconcileRender(app.database, body.id, j);
      } catch {
        app.database
          .prepare(
            "UPDATE renders SET state=?,error=? WHERE id=? AND state IN ('submitting','unknown')",
          )
          .run(
            "unknown",
            "提交结果未确认，请刷新任务核对；不会自动重复制作。",
            body.id,
          );
      }
      return get(body.id);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("POST", "/api/renders/:id/retry", async ({ params }) => {
    try {
      const current = get(params.id);
      if (!["unknown", "submitting"].includes(String(current.state)))
        return current;
      const row = app.database
        .prepare("SELECT snapshot FROM renders WHERE id=?")
        .get(params.id)!;
      const r = await upstream("/jobs", {
        method: "POST",
        body: await payload(params.id, String(row.snapshot)),
      });
      if (!r.ok) throw new Error("尚未确认提交结果，请稍后按同一任务重试。");
      const j: unknown = await r.json();
      reconcileRender(app.database, params.id, j);
      return get(params.id);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("GET", "/api/renders/:id", async ({ params }) => {
    try {
      get(params.id);
      try {
        const r = await upstream("/jobs/" + encodeURIComponent(params.id));
        if (r.ok) {
          const j: unknown = await r.json();
          reconcileRender(app.database, params.id, j);
        }
      } catch {}
      return get(params.id);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("POST", "/api/renders/:id/cancel", async ({ params }) => {
    try {
      get(params.id);
      const r = await upstream(
        "/jobs/" + encodeURIComponent(params.id) + "/cancel",
        { method: "POST" },
      );
      if (!r.ok) throw new Error("未确认取消，请刷新任务。");
      const j: unknown = await r.json();
      reconcileRender(app.database, params.id, j);
      return get(params.id);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("GET", "/api/renders/:id/video", async ({ params }) => {
    try {
      const row = get(params.id);
      if (row.state !== "completed") throw new Error("视频尚未完成。");
      const r = await upstream(
        "/jobs/" + encodeURIComponent(params.id) + "/video",
      );
      if (!r.ok || Number(r.headers.get("content-length")) > 100000000)
        throw new Error("无法读取制作文件。");
      const b = await r.arrayBuffer();
      if (b.byteLength > 100000000) throw new Error("视频过大。");
      return new Response(b, {
        headers: {
          "content-type": "video/mp4",
          "content-disposition": 'attachment; filename="openmontage.mp4"',
        },
      });
    } catch (e) {
      return failure(e);
    }
  });
  app.route("PUT", "/api/uploads/:id/chunks/:index", async ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return await files.chunk(params.id, Number(params.index), body.base64);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("POST", "/api/uploads/:id/finish", async ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return await files.finish(params.id, { bytes: body.bytes, mime: body.mime });
    } catch (e) {
      return failure(e);
    }
  });
  app.route("GET", "/api/media/:id", async ({ params, request, url }) => {
    try {
      const name = url.searchParams.get("download");
      return await files.response(
        params.id,
        typeof request.headers.range === "string" ? request.headers.range : undefined,
        name ? name.slice(0, 200) : undefined,
      );
    } catch (e) {
      return Response.json(
        { error: { message: e instanceof Error ? e.message : "素材读取失败。" } },
        { status: isRecord(e) && e.status === 404 ? 404 : 400 },
      );
    }
  });
  async function payload(id: string, snapshot: string) {
    const plan = readyMontage(JSON.parse(snapshot));
    const sources = new Map(plan.shots.map((s) => [s.source!.id, s.source!]));
    const assets = await Promise.all(
      [...sources.values()].map(async (source) => {
        if (source.bytes > MAX_VIDEO_BYTES) throw new Error("服务只接收20MB以内的MP4。");
        await files.verify(source);
        return {
          id: source.id,
          base64: (await files.read(source.id)).toString("base64"),
        };
      }),
    );
    return JSON.stringify({ id, plan, assets });
  }
}
