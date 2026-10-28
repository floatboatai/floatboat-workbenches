import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
import { kitValue } from "../contracts/domain";
import { isRecord, titleValue } from "../contracts/project";
import { buildNative, importAssets } from "./penpot";
const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(app, kitValue);
app.route("POST", "/api/native-export", async ({ body }) => {
  try {
    if (!isRecord(body)) throw new Error("请求无效。");
    const bytes = await buildNative(body.data, titleValue(body.title));
    return { data: Buffer.from(bytes).toString("base64") };
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "导出失败" } },
      { status: 400 },
    );
  }
});
app.route("POST", "/api/native-import", ({ body }) => {
  try {
    if (!isRecord(body) || typeof body.data !== "string")
      throw new Error("请求无效。");
    return importAssets(body.data);
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "导入失败" } },
      { status: 400 },
    );
  }
});
await app.listen();
