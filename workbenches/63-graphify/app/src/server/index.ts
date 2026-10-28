import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes.ts";
import { registerExtraction } from "./extraction.ts";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app);
registerExtraction(app);
await app.listen();
