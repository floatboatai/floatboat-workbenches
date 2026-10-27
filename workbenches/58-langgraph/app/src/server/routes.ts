import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord, titleValue } from "../contracts/project.ts";
import {
  projectValue,
  recordValue,
  recordSchema,
  idValue,
} from "../contracts/review.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createRunService } from "./runs.ts";

export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, projectValue);
  const runs = createRunService(
    app.database,
    async (source, signal, operationId) => {
      try {
        const result = await app.host.llm.generateObject(
          {
            prompt: source,
            schema: recordSchema,
            system:
              "从用户资料中整理交付事项。只依据原文，缺少的日期留空；负责人未知时写待确认，不编造事实。checklist 是需人工检查的事项。",
            maxOutputTokens: 3000,
          },
          { timeoutMs: 90000, signal, requestId: operationId },
        );
        return recordValue(result.object);
      } catch (error) {
        if (error instanceof WorkbenchHostError)
          throw new Error(
            "模型整理未完成，请打开 Floatboat 并检查模型连接。输入和运行记录已保留；也可使用填写资料模式。",
          );
        throw error;
      }
    },
  );
  registerAutosaveRoutes(app, projectValue);
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
  const guarded = async (work: () => unknown | Promise<unknown>) => {
    try {
      return await work();
    } catch (error) {
      return fail(error);
    }
  };
  const command = (body: unknown) => {
    if (!isRecord(body)) throw new Error("请求格式无效。");
    return body;
  };
  const version = (body: Record<string, unknown>) => {
    if (
      typeof body.version !== "number" ||
      !Number.isInteger(body.version) ||
      body.version < 1
    )
      throw new Error("运行版本无效。");
    return body.version;
  };
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) =>
    guarded(() => store.get(params.id)),
  );
  app.route("GET", "/api/projects/:id/runs", ({ params }) =>
    guarded(() => runs.list(params.id)),
  );
  app.route("GET", "/api/runs/:id", ({ params }) =>
    guarded(() => runs.view(params.id)),
  );
  app.route("POST", "/api/runs", ({ body }) =>
    guarded(() => {
      const input = command(body);
      return runs.start(
        idValue(input.operationId),
        idValue(input.projectId),
        titleValue(input.title),
        input.input,
      );
    }),
  );
  app.route("POST", "/api/runs/:id/review", ({ params, body }) =>
    guarded(() => {
      const input = command(body);
      return runs.resume(
        params.id,
        idValue(input.operationId),
        version(input),
        input.review,
      );
    }),
  );
  app.route("POST", "/api/runs/:id/recover", ({ params, body }) =>
    guarded(() => runs.recover(params.id, version(command(body)))),
  );
  app.route("POST", "/api/runs/:id/cancel", ({ params, body }) =>
    guarded(() => runs.cancel(params.id, version(command(body)))),
  );
  app.route("GET", "/api/model-status", async () => {
    try {
      const status = await app.host.capabilities.list({ domain: "llm" });
      return {
        available: status.capabilities.some(
          (entry) =>
            entry.operation === "generateObject" &&
            entry.status === "available",
        ),
        message: "Floatboat 模型服务已连接",
      };
    } catch {
      return {
        available: false,
        message: "模型服务未连接；填写资料与人工复核可正常使用",
      };
    }
  });
}
