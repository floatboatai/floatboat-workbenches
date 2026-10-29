// ABOUTME: 组装研究工作台服务：项目与自动保存、本地检索、模型协助、DeerFlow 配置/同步/研究运行与事件流。
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
import { researchValue } from "../contracts/research";
import { isRecord } from "../contracts/project";
import { DEFAULT_GATEWAY, checkService, configSource, configuration, fetchNative, loadSettings, saveServiceUrl } from "./deerflow";
import { StoreError } from "./store";
import { createResearchRuns } from "./research-runs";
import { createSyncs } from "./syncs";
import { registerRetrieval } from "./retrieval/index";
import { registerAssist } from "./assist";
import { registerRunEvents } from "./run-events";

const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(app, researchValue);
registerRetrieval(app);
registerAssist(app);
loadSettings(app.database);
const syncs = createSyncs(app.database, fetchNative);
const researchRuns = createResearchRuns(app.database);
const fail = (e: unknown) =>
  Response.json({ error: { message: e instanceof Error ? e.message : "操作失败。" } }, { status: e instanceof StoreError ? e.status : 400 });

function serviceStatus() {
  let url = "";
  try {
    url = configuration()?.origin ?? "";
  } catch {
    url = "";
  }
  return { configured: Boolean(url), source: configSource(), url, suggested: DEFAULT_GATEWAY, tokenConfigured: Boolean(process.env.DEERFLOW_TOKEN) };
}
app.route("GET", "/api/service-status", () => ({ ...serviceStatus(), checked: false, reachable: false, models: [], message: "" }));
app.route("POST", "/api/service-status/check", async () => {
  try {
    return { ...serviceStatus(), checked: true, ...(await checkService()) };
  } catch (e) {
    return fail(e);
  }
});
app.route("PUT", "/api/service-settings", async ({ body }) => {
  try {
    if (!isRecord(body) || typeof body.url !== "string") throw new Error("请输入服务地址。");
    if (process.env.DEERFLOW_URL) throw new Error("服务地址由启动环境 DEERFLOW_URL 指定，不能在页面修改。");
    saveServiceUrl(app.database, body.url);
    return { ...serviceStatus(), checked: true, ...(await checkService()) };
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/syncs", async ({ body }) => {
  try {
    if (!isRecord(body) || typeof body.projectId !== "string" || typeof body.id !== "string" || typeof body.threadId !== "string") throw new Error("同步请求无效。");
    return await syncs.start(body.projectId, body.id, body.threadId);
  } catch (e) {
    return fail(e);
  }
});
app.route("GET", "/api/projects/:id/syncs", ({ params }) => syncs.list(params.id));
app.route("GET", "/api/syncs/:id", ({ params }) => {
  try {
    return syncs.read(params.id);
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/research", ({ body }) => {
  try {
    if (!isRecord(body) || typeof body.id !== "string" || typeof body.projectId !== "string") throw new Error("研究命令无效。");
    return researchRuns.start(body.projectId, body.id, body.prompt, body.model);
  } catch (e) {
    return fail(e);
  }
});
app.route("GET", "/api/projects/:id/research", ({ params }) => researchRuns.list(params.id));
app.route("GET", "/api/research/:id", ({ params }) => {
  try {
    return researchRuns.read(params.id);
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/research/:id/refresh", async ({ params }) => {
  try {
    return await researchRuns.refresh(params.id);
  } catch (e) {
    return fail(e);
  }
});
registerRunEvents(app, researchRuns, fail);
try {
  if (configuration()) researchRuns.resume();
} catch {
  /* an invalid DEERFLOW_URL is reported by the status route */
}
await app.listen();
