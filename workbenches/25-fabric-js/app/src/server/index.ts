// ABOUTME: 组装服务入口，业务路由在对应模块中维护。

import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validatePoster } from "../contracts/poster";

const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validatePoster);
await app.listen();
