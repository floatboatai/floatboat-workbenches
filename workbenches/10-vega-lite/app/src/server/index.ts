import { registerAutosaveRoutes } from "./autosave";
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { registerAppRoute } from "./app-route";
import { verifyModel } from "./schema";
import { validate } from "../contracts/model";
const app = await createWorkbenchServer(import.meta.url);
const datasets = registerRoutes(app);
registerAppRoute(app);
registerAutosaveRoutes(app, validate, undefined, {
  verify: async (model) => verifyModel(model, datasets),
});
await app.listen();
