import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateOptics } from "../contracts/optics";
import { registerAppRoute } from "./app-route";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app,validateOptics);
registerAppRoute(app);
await app.listen();
