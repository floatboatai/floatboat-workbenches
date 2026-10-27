import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import type { Board } from "../contracts/boards.ts";
import { record } from "../contracts/boards.ts";
import type { Project } from "../contracts/project.ts";
import {
  validateSceneDocument,
  type SceneDocument,
} from "../contracts/scene-document.ts";
import { registerAutosaveRoutes, type AutosaveAdapter } from "./autosave.ts";
import { boardStore, BoardError } from "./board-store.ts";
const project = (board: Board): Project<SceneDocument> => ({
  id: board.id,
  title: board.title,
  revision: board.revision,
  updatedAt: board.updatedAt,
  data: { scene: board.scene },
});
export function createBoardAdapter(
  database: WorkbenchServer["database"],
): AutosaveAdapter<SceneDocument> {
  const store = boardStore(database);
  return {
    get: (id) => project(store.get(id)),
    create: (title, data, id) => project(store.create(title, data.scene, id)),
    update: (id, title, data, revision) =>
      project(store.update(id, title, data.scene, revision)),
  };
}
export function registerBoardAutosave(app: WorkbenchServer) {
  const store = boardStore(app.database),
    adapter = createBoardAdapter(app.database);
  const fail = (error: unknown) =>
    Response.json(
      {
        error: {
          message: error instanceof Error ? error.message : "画布操作失败。",
        },
      },
      { status: error instanceof BoardError ? error.status : 400 },
    );
  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", ({ params }) => {
    try {
      return adapter.get(params.id);
    } catch (error) {
      return fail(error);
    }
  });
  app.route("DELETE", "/api/projects/:id", ({ params, body }) => {
    try {
      if (!record(body)) throw new Error("删除请求无效。");
      store.remove(params.id, body.revision);
      return { deleted: true };
    } catch (error) {
      return fail(error);
    }
  });
  registerAutosaveRoutes(app, validateSceneDocument, adapter);
}
