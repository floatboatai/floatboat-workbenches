import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateScore } from "../contracts/domain";
import { verifySource } from "../contracts/archive";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validateScore, verifySource);
await app.listen();
