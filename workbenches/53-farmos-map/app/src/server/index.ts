import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
import { validate } from "../contracts/model";
const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(app, validate);
await app.listen();
