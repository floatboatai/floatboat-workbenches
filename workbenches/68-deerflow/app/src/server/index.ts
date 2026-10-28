import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
import { researchValue } from "../contracts/research";
import { isRecord } from "../contracts/project";
import { configuration, fetchNative } from "./deerflow";
import { StoreError } from "./store";
import { createResearchRuns } from "./research-runs";
import { createSyncs } from "./syncs";
const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(app, researchValue);
const syncs = createSyncs(app.database, fetchNative);
const researchRuns = createResearchRuns(app.database);
const fail = (e: unknown) =>
  Response.json(
    { error: { message: e instanceof Error ? e.message : "无法读取会话。" } },
    { status: e instanceof StoreError ? e.status : 400 },
  );
app.route("GET", "/api/service-status", () => {
  try {
    return {
      configured: configuration() !== null,
      message: configuration()
        ? "已配置上游地址，读取时核验连接与权限。"
        : "未连接DeerFlow，可导入原生会话。",
    };
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/syncs", ({ body }) => {
  try {
    if (
      !isRecord(body) ||
      typeof body.projectId !== "string" ||
      typeof body.id !== "string" ||
      typeof body.threadId !== "string"
    )
      throw new Error("同步请求无效。");
    return syncs.start(body.projectId, body.id, body.threadId);
  } catch (e) {
    return fail(e);
  }
});
app.route("GET", "/api/projects/:id/syncs", ({ params }) =>
  syncs.list(params.id),
);
app.route("GET", "/api/syncs/:id", ({ params }) => {
  try {
    return syncs.read(params.id);
  } catch (e) {
    return fail(e);
  }
});
app.route("POST", "/api/research", ({ body }) => {
  try {
    if (
      !isRecord(body) ||
      typeof body.id !== "string" ||
      typeof body.projectId !== "string"
    )
      throw new Error("研究命令无效。");
    return researchRuns.start(body.projectId, body.id, body.prompt, body.model);
  } catch (e) {
    return fail(e);
  }
});
app.route("GET", "/api/projects/:id/research", ({ params }) =>
  researchRuns.list(params.id),
);
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
await app.listen();
