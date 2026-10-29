// ABOUTME: 项目、自动保存、内容库、抽取与模型增强路由的注册入口。

import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { createStore, StoreError } from "./store.ts";
import { registerAutosaveRoutes } from "./autosave.ts";
import { projectValue, EMPTY_GRAPH, graphText } from "../contracts/map.ts";
import { sample } from "../contracts/sample/index.ts";
import { createBlobStore, registerBlobRoutes } from "./blobs.ts";
import { registerExtraction } from "./extraction.ts";
import { registerEnhance } from "./enhance.ts";
import { migrateLegacy } from "./legacy.ts";

export function registerRoutes(app: WorkbenchServer) {
  const blobs = createBlobStore(app.database);
  // 空图谱与示例资料集始终在内容库中
  blobs.put("graph", graphText(EMPTY_GRAPH));
  const demo = sample();
  blobs.put("graph", graphText(demo.graph));
  for (const text of demo.texts.values()) blobs.put("source", text);
  migrateLegacy(app.database, blobs);

  const store = createStore(app.database, projectValue);
  registerAutosaveRoutes(app, projectValue, undefined, {
    verify: async (data) => {
      if (!blobs.has(data.graph.hash)) throw new Error("图谱内容不在本机内容库中，请重新抽取或导入完整项目。");
    },
  });
  registerBlobRoutes(app, blobs);
  registerExtraction(app, blobs);
  registerEnhance(app);
  const fail = (e: unknown) =>
    Response.json({ error: { message: e instanceof Error ? e.message : "操作失败" } }, { status: e instanceof StoreError ? e.status : 400 });
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return store.get(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("POST", "/api/projects", ({ body }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return Response.json(store.create(body.title, body.data), { status: 201 });
    } catch (e) {
      return fail(e);
    }
  });
  app.route("PUT", "/api/projects/:id", ({ body, params }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return store.update(params.id, body.title, body.data, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ body, params }) => {
    try {
      if (!isRecord(body)) throw new Error("请求无效");
      return store.remove(params.id, body.revision);
    } catch (e) {
      return fail(e);
    }
  });
}
