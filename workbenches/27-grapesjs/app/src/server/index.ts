import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validatePage } from "../contracts/page";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validatePage);
await app.listen();
