import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord } from "../contracts/project";
import { createStore, StoreError } from "./store";
export function registerRoutes<T>(
  app: WorkbenchServer,
  validate: (value: unknown) => T,
  instructions: string,
  validateGenerated: (value: unknown) => T = validate,
) {
  const store = createStore(app.database, validate);
  const fail = (error: unknown) =>
    Response.json(
      {
        error: {
          message:
            error instanceof WorkbenchHostError
              ? "模型服务暂不可用，请打开 Floatboat 并检查登录和模型设置。"
              : error instanceof Error
                ? error.message
                : "操作失败，请重试。",
        },
      },
      {
        status:
          error instanceof StoreError
            ? error.status
            : error instanceof WorkbenchHostError
              ? 503
              : 400,
      },
    );
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (error) {
      return fail(error);
    }
  });
  app.route("POST", "/api/projects", ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return Response.json(store.create(body.title, body.data), {
        status: 201,
      });
    } catch (error) {
      return fail(error);
    }
  });
  app.route("PUT", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.update(params.id, body.title, body.data, body.revision);
    } catch (error) {
      return fail(error);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.remove(params.id, body.revision);
    } catch (error) {
      return fail(error);
    }
  });
  app.route("POST", "/api/generate", async ({ body }) => {
    try {
      if (
        !isRecord(body) ||
        typeof body.prompt !== "string" ||
        !body.prompt.trim() ||
        body.prompt.length > 12000
      )
        throw new Error("请输入 1–12000 个字符的要求。");
      const result = await app.host.llm.generateText(
        {
          prompt: body.prompt,
          system:
            instructions +
            " 只返回一个完整 JSON 对象，不要附加 Markdown 围栏或解释文字。",
          maxOutputTokens: 6000,
        },
        { timeoutMs: 90000 },
      );
      const text = result.text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "");
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error("模型返回的内容不是完整 JSON，请调整要求重试。");
      }
      return validateGenerated(value);
    } catch (error) {
      return fail(error);
    }
  });
}
