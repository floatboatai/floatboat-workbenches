import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { parseGenerated } from "../contracts/tutor.ts";
import { createGenerations } from "./generations.ts";
import { normalizeBank } from "./practice.ts";
import { StoreError } from "./store.ts";
export function registerGeneration(app: WorkbenchServer) {
  const tasks = createGenerations(app.database, async (lesson, goal, id) => {
    try {
      const r = await app.host.llm.generateText(
        {
          model: "gemini-3.8-flash",
          system:
            '你是课程练习题编辑。仅根据讲义生成3道题，不添加讲义外事实。仅返回JSON数组，每项字段为question(题干)、question_type(single_choice或short_answer)、options(选项对象如{"A":"...","B":"..."}，简答为空对象)、correct_answer(单选为选项字母，简答为参考答案)、explanation(依据讲义的解释)、difficulty(基础/理解/应用)、tags(字符串数组)、user_answer(空字符串)。问题不重复，正确答案必须在选项中。',
          prompt: `学习目标：${goal}\n\n讲义：\n${lesson}`,
          maxOutputTokens: 6000,
        },
        { requestId: id, timeoutMs: 90000 },
      );
      const raw = parseGenerated(r.text, r.finishReason);
      return await normalizeBank(JSON.stringify(raw), "json");
    } catch (e) {
      if (e instanceof WorkbenchHostError) {
        const code = /^[A-Z0-9_]{1,80}$/.test(e.code) ? e.code : "HOST_ERROR";
        throw new Error(
          `模型请求未完成（${code}）。输入与任务已保留，请检查Floatboat连接和模型设置。`,
        );
      }
      throw e;
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
        model: "gemini-3.8-flash",
      };
    } catch {
      return { available: false, model: "gemini-3.8-flash" };
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
}
