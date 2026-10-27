import { createWorkbenchServer } from '../../sdk/runtime.mjs';
import { registerRoutes } from './routes';
import { validateDocument } from '../contracts/review';
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validateDocument);
await app.listen();
