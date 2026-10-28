import { readFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
export function registerAssets(app: WorkbenchServer) {
  for (const name of [
    "oasis-editor.js",
    "index-K-7FcXvb.js",
    "OasisEditorApp-CQRNpkya.js",
    "mountController-D2srsZ5t.js",
    "oasis-editor.css",
    "assets/importDocxWorker-D5fxy-0f.js",
  ])
    app.route(
      "GET",
      "/api/native/" + name,
      async () =>
        new Response(await readFile(await app.resources.path("native", name)), {
          headers: {
            "content-type": name.endsWith(".css")
              ? "text/css"
              : "text/javascript",
          },
        }),
    );
  for (const name of [
    "WorkbenchSansSC-Regular.ttf",
    "WorkbenchSansSC-Bold.ttf",
  ])
    app.route(
      "GET",
      "/api/fonts/" + name,
      async () =>
        new Response(await readFile(await app.resources.path("fonts", name)), {
          headers: { "content-type": "font/ttf" },
        }),
    );
}
