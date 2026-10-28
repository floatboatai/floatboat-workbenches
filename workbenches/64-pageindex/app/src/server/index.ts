// ABOUTME: 组装服务入口，业务路由在对应模块中维护。

import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";

const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app);
await app.listen();
