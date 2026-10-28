import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
import { designValue, viewValue } from "../contracts/design";
import { isRecord } from "../contracts/project";
import { callEngine } from "./engine";
const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(app, designValue);
app.route("GET", "/api/engine-status", async () => {
  try {
    return await callEngine("/health");
  } catch {
    return { available: false, error: "请启动FigCraft本地引擎服务。" };
  }
});
app.route("POST", "/api/engine", async ({ body }) => {
  try {
    if (!isRecord(body)) throw new Error("请求无效。");
    designValue({ file: body.file, notes: {} });
    return viewValue(await callEngine("/render", body));
  } catch (e) {
    return Response.json(
      {
        error: {
          message:
            e instanceof Error
              ? e.message
              : "原生引擎不可用，设计和草稿仍保留。",
        },
      },
      { status: 400 },
    );
  }
});
await app.listen();
