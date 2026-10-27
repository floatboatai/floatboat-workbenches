import { registerAutosaveRoutes } from "./autosave";
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateScore } from "../contracts/domain";
import { verifySource } from "../contracts/archive";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validateScore, verifySource);
registerAutosaveRoutes(app, validateScore, undefined, {verify: async (data) => { await verifySource(data); }});
await app.listen();
