import { createHash } from "node:crypto";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { graphValue } from "../contracts/graph.ts";
function service() {
  const u = new URL(
    process.env.GRAPHIFY_SERVICE_URL ?? "http://127.0.0.1:8781",
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
    throw new Error("Graphify服务地址无效");
  return u;
}
async function call(path: string, body?: unknown) {
  const response = await fetch(new URL(path, service()), {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  if (!response.body) throw new Error("Graphify服务未返回数据");
  const reader = response.body.getReader();
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 800000) {
      await reader.cancel();
      throw new Error("Graphify响应超过容量限制");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  const raw: unknown = JSON.parse(text);
  if (!response.ok)
    throw new Error(
      isRecord(raw) && typeof raw.error === "string"
        ? raw.error
        : "Graphify提取失败",
    );
  return raw;
}
export function registerExtraction(app: WorkbenchServer) {
  app.route("GET", "/api/engine", async () => {
    try {
      const raw = await call("/health");
      if (!isRecord(raw) || raw.engine !== "graphifyy" || raw.ready !== true)
        throw new Error("服务身份不匹配");
      return { available: true, engine: `Graphify ${String(raw.version)}` };
    } catch {
      return {
        available: false,
        engine: "Graphify服务未连接，请启动项目内的提取服务",
      };
    }
  });
  app.route("POST", "/api/extract", async ({ body }) => {
    try {
      if (
        !isRecord(body) ||
        typeof body.name !== "string" ||
        !/^[-A-Za-z0-9_]{1,80}\.(py|js|ts)$/.test(body.name) ||
        typeof body.code !== "string" ||
        !body.code.trim() ||
        body.code.length > 80000
      )
        throw new Error("请输入有效的.py/.js/.ts文件名及1–80000字符源码。");
      const raw = await call("/extract", { name: body.name, code: body.code });
      const hash = createHash("sha256")
        .update(body.name + "\n" + body.code)
        .digest("hex");
      if (
        !isRecord(raw) ||
        raw.inputHash !== hash ||
        typeof raw.engine !== "string"
      )
        throw new Error("提取结果与当前请求不匹配。");
      return {
        graph: graphValue(raw.graph),
        engine: raw.engine,
        name: body.name,
        code: body.code,
      };
    } catch (e) {
      return Response.json(
        { error: { message: e instanceof Error ? e.message : "无法完成提取" } },
        { status: 400 },
      );
    }
  });
}
