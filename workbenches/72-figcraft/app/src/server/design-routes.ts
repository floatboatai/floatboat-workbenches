// ABOUTME: 内置（无引擎）校样路由：读取 .figcraft、列出画板、直接修改 document.json 并重新打包。
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { designValue, viewValue } from "../contracts/design.ts";
import { editFile, outline, parseAction, readFile, FigDocError } from "../contracts/figdoc.ts";
import { callEngine, engineStatus, EngineUnavailable } from "./engine.ts";

const failure = (error: unknown, fallback: string) =>
  Response.json(
    {
      error: {
        message: error instanceof Error ? error.message : fallback,
        ...(error instanceof EngineUnavailable ? { code: "ENGINE_UNAVAILABLE" } : {}),
      },
    },
    { status: error instanceof EngineUnavailable ? 503 : error instanceof FigDocError ? 422 : 400 },
  );

export async function verifyDesign(data: { file: string }): Promise<void> {
  readFile(data.file);
}

export function registerDesignRoutes(app: WorkbenchServer) {
  app.route("POST", "/api/design/inspect", ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效。");
      const { file } = designValue({ file: body.file, notes: {} });
      return outline(readFile(file).doc);
    } catch (e) {
      return failure(e, "无法读取设计文件。");
    }
  });
  app.route("POST", "/api/design/edit", ({ body }) => {
    try {
      if (!isRecord(body) || !Array.isArray(body.actions) || !body.actions.length || body.actions.length > 200)
        throw new Error("编辑请求需要 1–200 个操作。");
      const { file } = designValue({ file: body.file, notes: {} });
      const result = editFile(file, body.actions.map(parseAction));
      return { file: result.file, outline: outline(result.doc), engine: "builtin" };
    } catch (e) {
      return failure(e, "修改未完成，原稿未变。");
    }
  });
  app.route("GET", "/api/engine-status", () => engineStatus());
  app.route("POST", "/api/engine", async ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效。");
      designValue({ file: body.file, notes: {} });
      if (body.action !== undefined) parseAction(body.action);
      return viewValue(await callEngine("/render", body));
    } catch (e) {
      return failure(e, "原生引擎不可用，设计和草稿仍保留。");
    }
  });
}
