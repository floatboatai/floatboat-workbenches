// ABOUTME: 组装服务入口：项目、自动保存、二进制资源与可选的模型生成路由。
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAutosaveRoutes } from "./autosave";
import { registerRoutes } from "./routes";
import { createAssetStore, registerAssetRoutes } from "./assets";
import { validatePdf } from "../contracts/domain";

const app = await createWorkbenchServer(import.meta.url);
const assets = createAssetStore(app.database);
registerRoutes(
  app,
  validatePdf,
  "生成 pdfme 单据模板 JSON，格式为 {template:{basePdf:{width:210,height:297,padding:[10,10,10,10]},schemas:[[字段]]},values:{}}。字段 type 可用 text、multiVariableText、table、image、qrcode、code128、ean13、date、time、dateTime、select、checkbox、radioGroup、line、rectangle、ellipse、svg；每个字段包含中文 name、type、content、position:{x,y}、width、height（毫米）。固定文字设置 readOnly:true。",
);
registerAutosaveRoutes(app, validatePdf, undefined, { verify: (data) => assets.verify(data) });
registerAssetRoutes(app, assets);
await app.listen();
