import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import {
  questionsValue,
  questionValue,
  reviewValue,
  scheduleValue,
  idValue,
} from "../contracts/tutor.ts";
const commit = "a31d82624c27d75f4e771d4fcb78dce16470b383";
function service() {
  const u = new URL(
    process.env.DEEPTUTOR_PRACTICE_URL ?? "http://127.0.0.1:8786",
  );
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    (u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
      ))
  )
    throw new Error("练习服务地址无效");
  return u;
}
export async function practice(path: string, body?: unknown) {
  const response = await fetch(new URL(path, service()), {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.body) throw new Error("练习服务没有返回数据");
  const reader = response.body.getReader();
  let bytes = 0,
    text = "";
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 1100000) {
      await reader.cancel();
      throw new Error("练习响应超限");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  const raw: unknown = JSON.parse(text);
  if (!response.ok)
    throw new Error(
      isRecord(raw) && typeof raw.error === "string"
        ? raw.error.slice(0, 1000)
        : "练习服务未完成请求",
    );
  return raw;
}
export async function normalizeBank(text: string, format: string) {
  const raw = await practice("/normalize", { text, format });
  if (
    !isRecord(raw) ||
    raw.commit !== commit ||
    raw.engine !== "DeepTutor practice"
  )
    throw new Error("练习服务版本不匹配");
  return questionsValue(raw.questions);
}
export function registerPractice(app: WorkbenchServer) {
  const fail = (e: unknown) =>
    Response.json(
      {
        error: { message: e instanceof Error ? e.message : "练习服务暂不可用" },
      },
      { status: 400 },
    );
  app.route("GET", "/api/practice/status", async () => {
    try {
      const r = await practice("/health");
      const available = isRecord(r) && r.ready === true && r.commit === commit;
      return {
        available,
        message: available ? "DeepTutor练习服务已连接" : "练习服务版本不匹配，请按项目说明启动",
      };
    } catch {
      return {
        available: false,
        message: "练习服务未连接，请启动项目内的Python服务",
      };
    }
  });
  app.route("POST", "/api/practice/import", async ({ body }) => {
    try {
      if (
        !isRecord(body) ||
        typeof body.text !== "string" ||
        body.text.length > 350000 ||
        !["json", "csv", "tsv"].includes(String(body.format))
      )
        throw new Error("题库输入无效");
      return { questions: await normalizeBank(body.text, String(body.format)) };
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/practice/check", async ({ body }) => {
    try {
      if (
        !isRecord(body) ||
        typeof body.answer !== "string" ||
        body.answer.length > 5000
      )
        throw new Error("答案无效");
      const question = questionValue(body.question);
      const r = await practice("/check", { question, answer: body.answer });
      if (
        !isRecord(r) ||
        r.questionId !== question.question_id ||
        r.answer !== body.answer ||
        (r.correct !== null && typeof r.correct !== "boolean")
      )
        throw new Error("答案检查结果不匹配");
      return r;
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/practice/review", async ({ body }) => {
    try {
      if (
        !isRecord(body) ||
        !isRecord(body.state) ||
        typeof body.answer !== "string" ||
        body.answer.length > 5000 ||
        typeof body.at !== "number" ||
        !Number.isFinite(body.at)
      )
        throw new Error("复习提交无效");
      const question = questionValue(body.question),
        id = idValue(body.id);
      if (Object.keys(body.state).length) scheduleValue(body.state);
      const r = reviewValue(
        await practice("/review", { ...body, question, id }),
      );
      if (
        r.id !== id ||
        r.questionId !== question.question_id ||
        r.answer !== body.answer ||
        r.at !== body.at ||
        r.rating !== body.rating
      )
        throw new Error("复习结果与请求不一致");
      return r;
    } catch (e) {
      return fail(e);
    }
  });
}
