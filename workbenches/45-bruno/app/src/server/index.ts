import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { parse, compose, composeEnvironment, validateNativeCollection } from "./bru";
import { registerHttp } from "./http";
import { localEcho } from "./echo";
import { isRecord } from "../contracts/project";
import { restoreCollection } from "../contracts/bruno";

const app = await createWorkbenchServer(import.meta.url);
const dynamic = async (): Promise<Record<string, string>> => {
  const url = await localEcho();
  return url ? { $localEcho: url } : {};
};
registerRoutes(app, validateNativeCollection);
registerHttp(app, dynamic);
const failure = (e: unknown, fallback: string) =>
  ({ ok: false, message: e instanceof Error ? e.message : fallback });
app.route("POST", "/api/bru/parse", ({ body }) => {
  try {
    const v = restoreCollection({ files: [body], results: [], notes: "" });
    return parse(v.files[0]);
  } catch (e) {
    return failure(e, "解析失败。");
  }
});
app.route("POST", "/api/bru/compose", ({ body }) => {
  try {
    if (!isRecord(body)) throw new Error("格式无效。");
    const v = restoreCollection({ files: [body.file], results: [], notes: "" });
    const source = compose(v.files[0], body.model);
    return { source, parsed: parse({ ...v.files[0], source }) };
  } catch (e) {
    return failure(e, "序列化失败。");
  }
});
app.route("POST", "/api/bru/environment", ({ body }) => {
  try {
    if (!isRecord(body)) throw new Error("格式无效。");
    return { source: composeEnvironment(body.variables) };
  } catch (e) {
    return failure(e, "环境序列化失败。");
  }
});
app.route("GET", "/api/echo", async () => ({ url: await localEcho() }));
await app.listen();
