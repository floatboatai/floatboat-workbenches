import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateMindmap } from "../contracts/mindmap";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(
  app,
  validateMindmap,
  "把材料梳理为层级清晰的中文Markdown思维导图。返回{markdown:string}，主标题一个，二级标题分组，列表列要点。最多100行，不添加图片、HTML、脚本或外部资源。",
);
await app.listen();
