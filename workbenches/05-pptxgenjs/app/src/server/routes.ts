// ABOUTME: 项目读写接口与 AI 大纲生成；模型调用只在服务端，Host 不可用时返回可读的状态说明。
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateDeck, type Deck } from "../contracts/domain.ts";
import { OUTLINE_INSTRUCTIONS, outlineToDeck, parseOutline } from "../contracts/outline.ts";
import { createStore, StoreError } from "./store.ts";

export function registerRoutes(app: WorkbenchServer) {
  const store = createStore<Deck>(app.database, validateDeck);
  const fail = (error: unknown) =>
    Response.json(
      {
        error: {
          code: error instanceof WorkbenchHostError ? error.code : undefined,
          message:
            error instanceof WorkbenchHostError
              ? error.code === "HOST_NOT_CONNECTED"
                ? "未连接 Floatboat：请打开 Floatboat 桌面端并登录，然后点「重新检测」。"
                : `模型服务暂不可用（${error.code}${error.message && error.message !== error.code ? "：" + error.message.slice(0, 160) : ""}），请在 Floatboat 中检查登录和模型设置后重试。`
              : error instanceof Error
                ? error.message
                : "操作失败，请重试。",
        },
      },
      { status: error instanceof StoreError ? error.status : error instanceof WorkbenchHostError ? 503 : 400 },
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
      return Response.json(store.create(body.title, body.data), { status: 201 });
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
      if (!isRecord(body) || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 12000)
        throw new Error("请输入 1–12000 个字符的要求。");
      const theme = validateDeck({ version: 2, theme: body.theme, slides: [{ id: "probe", layout: "blank", elements: [], notes: "", hidden: false }] }).theme;
      const result = await app.host.llm.generateText(
        { prompt: body.prompt, system: OUTLINE_INSTRUCTIONS, maxOutputTokens: 6000 },
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
      const outline = parseOutline(value);
      return { title: outline.title, deck: outlineToDeck(outline, theme) };
    } catch (error) {
      return fail(error);
    }
  });
}
