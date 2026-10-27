// ABOUTME: 组装服务入口，业务路由在对应模块中维护。

import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateWriting } from "../contracts/domain";

const app = await createWorkbenchServer(import.meta.url);
registerRoutes(
  app,
  validateWriting,
  '生成中文文档，返回 {"content":{"type":"doc","content":[节点]}}。节点仅支持 paragraph、heading(level=1/2/3)、bulletList、orderedList、listItem、blockquote、text、hardBreak。text节点有text字符串；段落/标题/列表节点用content数组。可使用bold、italic文字marks。写出可直接使用的清晰短文，不添加任意HTML或脚本。',
);
await app.listen();
