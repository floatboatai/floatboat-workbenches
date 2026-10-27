import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(app);
await app.listen();
