import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord } from "../contracts/project";
import { createStore, StoreError } from "./store";
export function registerRoutes<T>(
  app: WorkbenchServer,
  validate: (value: unknown) => T,
  generation: { instructions: string; parse: (text: string) => T },
) {
  const store = createStore(app.database, validate);
  const fail = (error: unknown) =>
    Response.json(
      {
        error: {
          message:
            error instanceof WorkbenchHostError
              ? error.code === "HOST_NOT_CONNECTED"
                ? "Floatboat 未连接，写作助手暂不可用。启动并登录 Floatboat 后点「重新检测」；正文编辑与导出不受影响。"
                : "模型服务暂不可用，请在 Floatboat 中检查登录和模型设置后重试。"
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
      if (
        body.context !== undefined &&
        (typeof body.context !== "string" || body.context.length > 40000)
      )
        throw new Error("参考正文过长，请取消勾选「参考当前正文」或缩短文稿。");
      const prompt = body.context
        ? `当前文稿（Markdown）：\n<<<\n${body.context}\n>>>\n\n写作要求：${body.prompt}`
        : body.prompt;
      const result = await app.host.llm.generateText(
        { prompt, system: generation.instructions, maxOutputTokens: 6000 },
        { timeoutMs: 90000 },
      );
      const text = result.text
        .trim()
        .replace(/^```(?:markdown|md)?\s*\n/i, "")
        .replace(/\n```\s*$/, "");
      if (!text.trim()) throw new Error("模型没有返回内容，请调整要求重试。");
      return generation.parse(text);
    } catch (error) {
      return fail(error);
    }
  });
}
