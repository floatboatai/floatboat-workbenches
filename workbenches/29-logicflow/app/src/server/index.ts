import { createWorkbenchServer } from '../../sdk/runtime.mjs';
import { registerRoutes } from './routes';
import { validateFlow } from '../contracts/flow';
const app=await createWorkbenchServer(import.meta.url);
registerRoutes(app,validateFlow);
await app.listen();
