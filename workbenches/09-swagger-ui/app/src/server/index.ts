import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validate, instructions } from "../contracts/model";
import { registerSwaggerView } from "./swagger-view";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validate, instructions);
registerSwaggerView(app);
app.route("GET", "/api/demo/health", () => ({
  status: "ok",
  service: "API 参考台",
  time: new Date().toISOString(),
}));
await app.listen();
