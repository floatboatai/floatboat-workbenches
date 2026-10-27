import { createWorkbenchServer } from '../../sdk/runtime.mjs';
import { registerRoutes } from './routes.ts';
const app=await createWorkbenchServer(import.meta.url);
registerRoutes(app);
await app.listen();
