// ABOUTME: 组装服务入口，业务路由在对应模块中维护。

import { createWorkbenchServer } from '../../sdk/runtime.mjs';
import { registerAppRoute } from './app-route';

const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
await app.listen();
