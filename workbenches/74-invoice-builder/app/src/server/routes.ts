import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { createHash } from "node:crypto";
import { isRecord } from "../contracts/project.ts";
import { validateDocument } from "../contracts/native.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { renderInvoice, verifyImages } from "./pdf.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateDocument);
  registerAutosaveRoutes(app, validateDocument, undefined, {
    verify: verifyImages,
  });
  let active = 0;
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
      if (!isRecord(body)) throw Error("请求无效。");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/pdf", async ({ body }) => {
    try {
      if (!isRecord(body)) throw Error("请求无效。");
      if (active >= 2)
        throw new StoreError(429, "已有校样正在生成，请稍后重试。");
      const data = validateDocument(body.data);
      active++;
      try {
        const buffer = await renderInvoice(data, (name) =>
          app.resources.path("fonts", name),
        );
        return {
          base64: buffer.toString("base64"),
          sha256: createHash("sha256").update(buffer).digest("hex"),
          bytes: buffer.length,
          filename: data.number.replace(/[^\p{L}\p{N}._-]/gu, "_") + ".pdf",
        };
      } finally {
        active--;
      }
    } catch (e) {
      return fail(e);
    }
  });
}
