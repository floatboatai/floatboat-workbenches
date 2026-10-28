import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes.ts";
import { registerPractice } from "./practice.ts";
import { registerGeneration } from "./generation-routes.ts";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app);
registerPractice(app);
registerGeneration(app);
await app.listen();
