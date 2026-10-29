import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateProject, runInput, serviceInput, DEFAULT_MODEL } from "../contracts/evidence.ts";
import { createHostRuns } from "./host-runs.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import {
  jobStore,
  serviceConfig,
  callService,
  serviceResult,
  jobId,
} from "./jobs.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateProject),
    jobs = jobStore(app.database),
    hostRuns = createHostRuns(app);
  registerAutosaveRoutes(app, validateProject);
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message: e instanceof Error ? e.message : "操作失败，请重试。",
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
      if (!isRecord(body)) throw Error("请求无效。");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/service", async () => {
    try {
      const config = serviceConfig();
      if (!config)
        return {
          connected: false,
          message: "尚未配置抽取服务。可先导入 JSONL 或复核资料。",
        };
      const info = await callService(config, "health");
      if (
        !isRecord(info) ||
        info.engine !== "langextract" ||
        info.version !== "1.7.1"
      )
        throw Error("服务版本不匹配，需要 LangExtract 1.7.1 适配服务。");
      return {
        connected: true,
        message:
          info.ready === true
            ? "LangExtract 服务已连接，可提交抽取。"
            : "服务已连接，尚未配置模型。",
        ready: info.ready === true,
      };
    } catch {
      return {
        connected: false,
        message: "抽取服务不可达或配置不匹配，请检查服务端配置。",
      };
    }
  });
  app.route("GET", "/api/host-status", async () => {
    try {
      const r = await app.host.capabilities.list({ domain: "llm" });
      const available = r.capabilities.some(
        (c) => c.operation === "generateText" && c.status === "available",
      );
      return {
        available,
        defaultModel: DEFAULT_MODEL,
        message: available
          ? "Floatboat 模型可用。"
          : "Floatboat 已连接，但本工作台的模型权限不可用，请在 Floatboat 中检查工作台授权。",
      };
    } catch {
      return {
        available: false,
        defaultModel: DEFAULT_MODEL,
        message: "未连接 Floatboat。启动并登录 Floatboat 客户端后点“重新检查”。",
      };
    }
  });
  app.route("GET", "/api/host-runs", () => hostRuns.list());
  app.route("GET", "/api/host-runs/:id", ({ params }) => {
    try {
      return hostRuns.get(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/host-runs", ({ body }) => {
    try {
      return hostRuns.start(body, (id) => store.get(id));
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/jobs", () => jobs.list());
  app.route("POST", "/api/jobs", async ({ body }) => {
    try {
      if (!isRecord(body) || typeof body.projectId !== "string")
        throw Error("任务输入无效。");
      const id = jobId(body.id),
        input = serviceInput(runInput(body.input));
      store.get(body.projectId);
      const config = serviceConfig();
      if (!config)
        throw new StoreError(503, "请先配置抽取服务，资料和修订已保留。");
      const { job, created } = jobs.create(id, body.projectId, input);
      if (!created) return job;
      try {
        const result = serviceResult(
          await callService(config, `jobs/${id}`, "PUT", { input }),
          id,
        );
        return jobs.update(id, result.status, result.message, result.result);
      } catch {
        return jobs.update(
          id,
          "unknown",
          "提交结果尚未确认。请查询原任务，避免重复生成。",
        );
      }
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/jobs/:id", async ({ params }) => {
    try {
      const job = jobs.get(params.id);
      if (
        ["succeeded", "failed", "cancelled", "interrupted"].includes(job.status)
      )
        return job;
      const config = serviceConfig();
      if (!config) return job;
      try {
        const remote = serviceResult(
          await callService(config, `jobs/${job.id}`),
          job.id,
        );
        return jobs.update(
          job.id,
          remote.status,
          remote.message,
          remote.result,
        );
      } catch {
        return { ...job, message: "暂时无法查询服务，已保留原任务标识。" };
      }
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/jobs/:id/cancel", async ({ params }) => {
    try {
      const job = jobs.get(params.id);
      if (
        ["succeeded", "failed", "cancelled", "interrupted"].includes(job.status)
      )
        return job;
      const config = serviceConfig();
      if (!config) throw Error("服务未连接，无法确认停止接收结果。");
      const remote = serviceResult(
        await callService(config, `jobs/${job.id}/cancel`, "POST", {}),
        job.id,
      );
      return jobs.update(job.id, remote.status, remote.message, remote.result);
    } catch (e) {
      return fail(e);
    }
  });
}
