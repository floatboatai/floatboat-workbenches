// ABOUTME: 组装服务入口，业务路由在对应模块中维护。

import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validatePdf } from "../contracts/domain";

const app = await createWorkbenchServer(import.meta.url);
registerRoutes(
  app,
  validatePdf,
  "生成 JSON 单据模板，格式为 {template:{basePdf:{width:210,height:297,padding:[16,16,16,16]},schemas:[[字段]]},values:{}}。字段仅支持 text 或 rectangle。文本字段使用 fontName NotoSansSC，包含 name,type,content,position:{x,y},width,height。",
);
await app.listen();
