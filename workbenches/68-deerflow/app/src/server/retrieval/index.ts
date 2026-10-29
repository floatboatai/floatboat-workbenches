// ABOUTME: 执行一个检索步骤并注册检索路由；只在用户发起时访问公网，结果写入工作稿由页面完成。
import type { WorkbenchServer } from "../../../sdk/runtime.mjs";
import { retrieveRequestValue, type RetrieveRequest, type RetrieveResult } from "../../contracts/retrieval.ts";
import { classify, fetchPublic, proxyFor, type Get } from "./net.ts";
import { endpoints, exaSearch, githubSearch, readUrl } from "./channels.ts";

export async function executeRetrieval(input: RetrieveRequest, get: Get = fetchPublic): Promise<RetrieveResult> {
  const result: RetrieveResult = { items: [], failures: [], attempts: [] };
  if (input.kind === "read") {
    const outcomes = await Promise.all(
      input.urls.map(async (url) => {
        try {
          return { url, item: await readUrl(get, url, result.attempts) };
        } catch (e) {
          return { url, error: classify(e) };
        }
      }),
    );
    for (const o of outcomes)
      if ("item" in o && o.item) result.items.push(o.item);
      else if ("error" in o && o.error) result.failures.push({ target: o.url, code: o.error.code, message: o.error.message });
    return result;
  }
  try {
    result.attempts.push(input.kind + ":" + input.query);
    result.items = input.kind === "github" ? await githubSearch(get, input.query) : await exaSearch(get, input.query);
  } catch (e) {
    const err = classify(e);
    result.failures.push({ target: input.query, code: err.code, message: err.message });
  }
  return result;
}

const MAX_IN_FLIGHT = 4;
export function registerRetrieval(app: WorkbenchServer, get: Get = fetchPublic) {
  let inFlight = 0;
  app.route("GET", "/api/retrieval/status", () => {
    const e = endpoints();
    return {
      available: true,
      fixture: e.fixture,
      proxy: proxyFor(new URL("https://example.com")) ? "environment" : "none",
      github: process.env.GITHUB_TOKEN ? "token" : "anonymous",
      channels: ["web-search", "github", "read"],
      message: e.fixture
        ? "离线验收夹具：检索只访问本机 " + e.fixture
        : "检索在本机 Node 内运行：网页直读（失败时经 Jina 阅读）、Exa 网页搜索、GitHub 公开 API。",
    };
  });
  app.route("POST", "/api/retrieve", async ({ body }) => {
    let input: RetrieveRequest;
    try {
      input = retrieveRequestValue(body);
    } catch (e) {
      return Response.json({ error: { message: e instanceof Error ? e.message : "检索请求无效" } }, { status: 400 });
    }
    if (inFlight >= MAX_IN_FLIGHT) return Response.json({ error: { message: "已有多个检索正在进行，请稍候再试。" } }, { status: 429 });
    inFlight++;
    try {
      return await executeRetrieval(input, get);
    } finally {
      inFlight--;
    }
  });
}
