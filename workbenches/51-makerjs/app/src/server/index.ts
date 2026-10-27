import { registerAutosaveRoutes } from "./autosave";
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateDrawing } from "../contracts/drawing";
import { makeDrawing } from "./geometry";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(app, validateDrawing);
app.route("POST", "/api/render", ({ body }) => {
  try {
    return makeDrawing(body);
  } catch (error) {
    return Response.json(
      {
        error: {
          message: error instanceof Error ? error.message : "图纸生成失败。",
        },
      },
      { status: 400 },
    );
  }
});
registerAutosaveRoutes(app, validateDrawing);
await app.listen();
