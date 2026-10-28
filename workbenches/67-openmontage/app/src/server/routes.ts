import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { montageValue, readyMontage } from "../contracts/montage.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { reconcileRender } from "./render-state.ts";
import { createVideoFiles, detectMime } from "./files.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, montageValue);
  const files = createVideoFiles((p, w) =>
    app.resources.path("media", p, w ? "write" : "read"),
  );
  registerAutosaveRoutes(app, montageValue, undefined, {
    verify: async (data) => {
      await Promise.all(data.shots.map((s) => files.verify(s.source)));
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
      return {
        available:
          isRecord(v) && v.ready === true && v.engine === "openmontage",
        message:
          isRecord(v) && v.ready === true && v.engine === "openmontage"
            ? "制作服务已连接"
            : "制作服务尚未就绪",
      };
    } catch {
      return {
        available: false,
        message: "未连接制作服务；启动项目 service 后重新检查。",
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
  app.route("PUT", "/api/media/:id/chunks/:index", async ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return await files.chunk(params.id, Number(params.index), body.base64);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("POST", "/api/media", async ({ body }) => {
    try {
      return await files.finish(body);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("GET", "/api/media/:id", async ({ params }) => {
    try {
      return new Response(new Uint8Array(await files.read(params.id)), {
        headers: {
          "content-type": "video/mp4",
          "cache-control": "private,max-age=31536000,immutable",
        },
      });
    } catch (e) {
      return failure(e);
    }
  });
  async function payload(id: string, snapshot: string) {
    const plan = readyMontage(JSON.parse(snapshot));
    const sources = new Map(plan.shots.map((s) => [s.source!.id, s.source!]));
    const assets = await Promise.all(
      [...sources.values()].map(async (source) => {
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
