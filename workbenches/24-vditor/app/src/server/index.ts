import { createWorkbenchServer } from '../../sdk/runtime.mjs';
import { registerRoutes } from './routes';
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app);
await app.listen();
