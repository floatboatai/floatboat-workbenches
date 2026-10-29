import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes.ts";
const app = await createWorkbenchServer(import.meta.url);
await registerRoutes(app);
await app.listen();
