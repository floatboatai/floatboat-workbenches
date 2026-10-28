import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { parse, compose, validateNativeCollection } from "./bru";
import { registerHttp } from "./http";
import { isRecord } from "../contracts/project";
import { restoreCollection } from "../contracts/bruno";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validateNativeCollection);
registerHttp(app);
app.route("POST", "/api/bru/parse", ({ body }) => {
  try {
    const v = restoreCollection({ files: [body], results: [], notes: "" });
    return parse(v.files[0]);
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "解析失败。" } },
      { status: 400 },
    );
  }
});
app.route("POST", "/api/bru/compose", ({ body }) => {
  try {
    if (!isRecord(body)) throw new Error("格式无效。");
    const v = restoreCollection({ files: [body.file], results: [], notes: "" });
    return { source: compose(v.files[0], body.fields) };
  } catch (e) {
    return Response.json(
      { error: { message: e instanceof Error ? e.message : "序列化失败。" } },
      { status: 400 },
    );
  }
});
await app.listen();
