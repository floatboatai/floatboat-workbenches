import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { validateDocument } from "../contracts/document.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateDocument);
  const fail = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "操作失败。" } },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  const original = async (hash: string) => {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw Error("原件标识无效。");
    const b = await readFile(
      await app.resources.path("originals", hash + ".docx"),
    );
    if (createHash("sha256").update(b).digest("hex") !== hash)
      throw Error("原件校验失败。");
    return b;
  };
  registerAutosaveRoutes(app, validateDocument, undefined, {
    verify: async (d) => {
      if (d.source) {
        const b = await original(d.source.hash);
        if (b.length !== d.source.bytes) throw Error("原件长度不符。");
      }
    },
  });
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
  app.route("POST", "/api/originals", async ({ body }) => {
    try {
      if (
        !isRecord(body) ||
        typeof body.base64 !== "string" ||
        body.base64.length > 1600000 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)
      )
        throw Error("原件超过1.2MB或编码无效。");
      const b = Buffer.from(body.base64, "base64");
      if (b.length < 4 || b[0] !== 80 || b[1] !== 75)
        throw Error("需要真正的DOCX包。");
      const hash = createHash("sha256").update(b).digest("hex");
      await writeFile(
        await app.resources.path("originals", hash + ".docx", "write"),
        b,
        { flag: "wx" },
      ).catch((e) => {
        if (!isRecord(e) || e.code !== "EEXIST") throw e;
      });
      return { hash, bytes: b.length };
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/originals/:hash", async ({ params }) => {
    try {
      return { base64: (await original(params.hash)).toString("base64") };
    } catch (e) {
      return fail(e);
    }
  });
}
