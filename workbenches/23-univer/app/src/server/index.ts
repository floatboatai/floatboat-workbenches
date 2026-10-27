import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validate } from "../contracts/workbook";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validate);
await app.listen();
