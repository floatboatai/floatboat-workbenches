import { readFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAutosaveRoutes } from "./autosave.ts";
import { createStore, StoreError } from "./store.ts";
import { validateDeck } from "../contracts/deck.ts";
import { isRecord } from "../contracts/project.ts";
import { standaloneHtml } from "./export.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateDeck);
  registerAutosaveRoutes(app, validateDeck);
  const fail = (e: unknown) =>
    Response.json(
      {
        error: {
          message: e instanceof Error ? e.message : "操作失败，请重试。",
        },
      },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/export/html", async ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("导出请求无效。");
      const data = validateDeck(body.data);
      const [script, css, license] = await Promise.all(
        ["runtime/reveal.js", "runtime/reveal.css", "LICENSE"].map(
          async (file) =>
            readFile(await app.resources.path("reveal-runtime", file), "utf8"),
        ),
      );
      return { html: standaloneHtml(data, body.title, script, css, license) };
    } catch (e) {
      return fail(e);
    }
  });
}
