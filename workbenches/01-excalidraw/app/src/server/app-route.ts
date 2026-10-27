import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { record, diagramValue } from "../contracts/boards";
import { boardStore, BoardError } from "./board-store";

function failure(error: unknown) {
  const status =
    error instanceof BoardError
      ? error.status
      : error instanceof WorkbenchHostError
        ? 503
        : 400;
  const message =
    error instanceof WorkbenchHostError
      ? error.code === "HOST_NOT_CONNECTED"
        ? "请打开并登录 Floatboat 后使用生成图形。手动编辑和保存仍然可用。"
        : "模型服务暂不可用，请检查 Floatboat 的模型设置后重试。"
      : error instanceof Error
        ? error.message
        : "操作失败，请重试。";
  return Response.json(
    {
      error: {
        message,
        code: error instanceof WorkbenchHostError ? error.code : undefined,
      },
    },
    { status },
  );
}
const diagramSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "nodes", "edges"],
  properties: {
    title: { type: "string", maxLength: 120 },
    nodes: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: {
          id: { type: "string" },
          label: { type: "string", maxLength: 120 },
        },
      },
    },
    edges: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "label"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string", maxLength: 60 },
        },
      },
    },
  },
};
export function registerAppRoute(app: WorkbenchServer): void {
  const store = boardStore(app.database);
  app.route("GET", "/api/app", async () => {
    let platform: "connected" | "not-connected" | "unavailable" = "connected";
    let llmAvailable = false;
    try {
      const result = await app.host.capabilities.list({ domain: "llm" });
      llmAvailable = result.capabilities.some(
        (cap) => cap.operation === "generateText" && cap.status === "available",
      );
    } catch (error) {
      platform =
        error instanceof WorkbenchHostError &&
        error.code === "HOST_NOT_CONNECTED"
          ? "not-connected"
          : "unavailable";
    }
    return {
      name: app.manifest.name,
      version: app.manifest.version,
      platform,
      llmAvailable,
    };
  });
  app.route("GET", "/api/boards", () => store.list());
  app.route("GET", "/api/boards/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (error) {
      return failure(error);
    }
  });
  app.route("POST", "/api/boards", ({ body }) => {
    try {
      if (!record(body)) throw new Error("无效请求。");
      return Response.json(store.create(body.title, body.scene), {
        status: 201,
      });
    } catch (error) {
      return failure(error);
    }
  });
  app.route("PUT", "/api/boards/:id", ({ params, body }) => {
    try {
      if (!record(body)) throw new Error("无效请求。");
      return store.update(params.id, body.title, body.scene, body.revision);
    } catch (error) {
      return failure(error);
    }
  });
  app.route("DELETE", "/api/boards/:id", ({ params, body }) => {
    try {
      if (!record(body)) throw new Error("无效请求。");
      store.remove(params.id, body.revision);
      return { deleted: true };
    } catch (error) {
      return failure(error);
    }
  });
  app.route("POST", "/api/generate", async ({ body }) => {
    try {
      if (
        !record(body) ||
        typeof body.prompt !== "string" ||
        !body.prompt.trim() ||
        body.prompt.length > 4000
      )
        throw new Error("请输入 1–4000 个字符的图形描述。");
      const result = await app.host.llm.generateText(
        {
          prompt: body.prompt,
          system: `把用户的描述整理成清晰的流程图。只输出一个JSON对象，禁止Markdown代码块或说明文字。对象必须遵循这个JSON Schema：${JSON.stringify(diagramSchema)}。使用中文简短标签，节点id唯一，连接引用已有节点。`,
          maxOutputTokens: 6000,
        },
        { timeoutMs: 90000 },
      );
      const raw = result.text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "");
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new Error("模型没有返回完整的图形数据，请重试。");
      }
      return diagramValue(value);
    } catch (error) {
      return failure(error);
    }
  });
  const fontRoot = join(
    dirname(fileURLToPath(import.meta.resolve("@excalidraw/excalidraw"))),
    "fonts",
  );
  app.route(
    "GET",
    "/api/excalidraw-assets/fonts/:family/:file",
    async ({ params }) => {
      if (
        !/^[A-Za-z0-9_-]+$/.test(params.family) ||
        !/^[A-Za-z0-9_.-]+\.woff2?$/.test(params.file)
      )
        return new Response(null, { status: 404 });
      try {
        return new Response(
          new Uint8Array(
            await readFile(join(fontRoot, params.family, params.file)),
          ),
          {
            headers: {
              "content-type": params.file.endsWith(".woff2")
                ? "font/woff2"
                : "font/woff",
              "cache-control": "public, max-age=31536000, immutable",
            },
          },
        );
      } catch {
        return new Response(null, { status: 404 });
      }
    },
  );
}
