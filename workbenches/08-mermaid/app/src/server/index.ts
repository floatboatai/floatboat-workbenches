import { registerAutosaveRoutes } from "./autosave";
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { registerAppRoute } from "./app-route";
import { validate, instructions } from "../contracts/model";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validate, instructions);
registerAppRoute(app);

registerAutosaveRoutes(app, validate);
await app.listen();
