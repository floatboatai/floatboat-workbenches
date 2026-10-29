import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { parseGenerated } from "../contracts/generation.ts";
import { createGenerations } from "./generations.ts";
import { strictBank } from "./practice.ts";
import { StoreError } from "./store.ts";
import {
  MODEL,
  generationPrompt,
  tutorPrompt,
  tutorRequestValue,
} from "./prompts.ts";

function hostFailure(e: unknown, what: string): never {
  if (e instanceof WorkbenchHostError) {
    const code = /^[A-Z0-9_]{1,80}$/.test(e.code) ? e.code : "HOST_ERROR";
    throw new Error(
      code === "HOST_NOT_CONNECTED"
        ? `${what}需要Floatboat客户端：请启动并登录Floatboat，然后点“重新检查”。输入已保留。`
        : `模型请求未完成（${code}）。输入已保留，请检查Floatboat连接和模型设置。`,
    );
  }
  throw e;
}

export function registerGeneration(app: WorkbenchServer) {
  const tasks = createGenerations(app.database, async (input, id) => {
    try {
      const options = generationPrompt(input);
      const r = await app.host.llm.generateText(options, {
        requestId: id,
        timeoutMs: 150000,
      });
      const raw = parseGenerated(r.text, r.finishReason, input.options.count);
      return strictBank(raw);
    } catch (e) {
      hostFailure(e, "出题");
    }
  });
  const fail = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "生成失败" } },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  app.route("GET", "/api/model-status", async () => {
    try {
      const r = await app.host.capabilities.list({ domain: "llm" });
      return {
        available: r.capabilities.some(
          (x) => x.operation === "generateText" && x.status === "available",
        ),
        model: MODEL,
      };
    } catch {
      return { available: false, model: MODEL };
    }
  });
  app.route("POST", "/api/generations", ({ body }) => {
    try {
      return tasks.start(body);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/generations/:id", ({ params }) => {
    try {
      return tasks.view(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/tutor", async ({ body }) => {
    try {
      const request = tutorRequestValue(body);
      try {
        const r = await app.host.llm.generateText(tutorPrompt(request), {
          requestId: request.id,
          timeoutMs: 90000,
        });
        if (r.finishReason !== "STOP" || !r.text.trim())
          throw new Error("导师回答没有完整结束，请重试。");
        return {
          id: request.id,
          text: r.text.trim().slice(0, 8000),
          model: r.model || MODEL,
          at: Date.now() / 1000,
        };
      } catch (e) {
        hostFailure(e, "导师讲解");
      }
    } catch (e) {
      return fail(e);
    }
  });
}
