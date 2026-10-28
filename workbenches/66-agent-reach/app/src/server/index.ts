import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes.ts";
import { registerCollector } from "./collector.ts";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app);
registerCollector(app);
await app.listen();
