import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import type { Project } from "../contracts/project.ts";
import { isRecord, titleValue } from "../contracts/project.ts";
import type {
  DraftRecord,
  SaveReceipt,
  SaveRequest,
} from "../contracts/autosave.ts";
import { createStore, StoreError } from "./store.ts";
export interface AutosaveAdapter<T> {
  get(id: string): Project<T>;
  create(title: string, data: T, id: string): Project<T>;
  update(id: string, title: string, data: T, revision: number): Project<T>;
}
const uuid = (x: unknown): x is string =>
  typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x,
  );
const validId = (x: unknown): x is string =>
  typeof x === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(x);
function envelope(value: unknown): SaveRequest<unknown> {
  if (
    !isRecord(value) ||
    !uuid(value.documentId) ||
    !uuid(value.mutationId) ||
    typeof value.draftRevision !== "number" ||
    !Number.isInteger(value.draftRevision) ||
    value.draftRevision < 0 ||
    !isRecord(value.snapshot) ||
    typeof value.snapshot.title !== "string" ||
    value.snapshot.title.length > 120 ||
    !isRecord(value.snapshot.extra)
  )
    throw new StoreError(400, "自动保存草稿格式无效。");
  if (
    value.projectId !== null &&
    (!validId(value.projectId) ||
      typeof value.projectRevision !== "number" ||
      !Number.isInteger(value.projectRevision) ||
      value.projectRevision < 1)
  )
    throw new StoreError(400, "自动保存项目版本无效。");
  if (Buffer.byteLength(JSON.stringify(value)) > 1950000)
    throw new StoreError(413, "草稿超过请求容量，请先导出并减少内容。");
  return value as unknown as SaveRequest<unknown>;
}
export function createAutosaveStore<T>(
  db: WorkbenchServer["database"],
  validate: (value: unknown) => T,
  adapter?: AutosaveAdapter<T>,
  options: { verify?: (data: T) => Promise<void> } = {},
) {
  const standard = createStore(db, validate);
  const projects: AutosaveAdapter<T> = adapter ?? {
    get: standard.get,
    create(title, data, id) {
      const payload = JSON.stringify(validate(data));
      if (Buffer.byteLength(payload) > 900000)
        throw new StoreError(413, "项目超过900KB，草稿仍会保留。");
      db.prepare(
        "INSERT INTO projects(id,title,payload,revision,updated_at) VALUES(?,?,?,1,?)",
      ).run(id, titleValue(title), payload, new Date().toISOString());
      return standard.get(id);
    },
    update: (id, title, data, revision) =>
      standard.update(id, title, data, revision),
  };
  function record(row: Record<string, unknown>): DraftRecord<unknown> {
    return {
      documentId: String(row.id),
      mutationId: String(row.mutation_id),
      draftRevision: Number(row.revision),
      revision: Number(row.revision),
      projectId: row.project_id === null ? null : String(row.project_id),
      projectRevision:
        row.project_revision === null ? null : Number(row.project_revision),
      snapshot: JSON.parse(String(row.snapshot)),
      receipt: JSON.parse(String(row.receipt)),
      updatedAt: String(row.updated_at),
    };
  }
  const get = (id: string) => {
    const row = db.prepare("SELECT * FROM autosave_drafts WHERE id=?").get(id);
    return row ? record(row) : null;
  };
  const recent = (projectId?: string) => {
    const rows = projectId
      ? db
          .prepare(
            "SELECT * FROM autosave_drafts WHERE project_id=? ORDER BY updated_at DESC,id DESC LIMIT 20",
          )
          .all(projectId)
      : db
          .prepare(
            "SELECT * FROM autosave_drafts ORDER BY updated_at DESC,id DESC LIMIT 20",
          )
          .all();
    for (const row of rows) {
      const d = record(row);
      if (d.projectId)
        try {
          projects.get(d.projectId);
        } catch {
          continue;
        }
      return d;
    }
    return null;
  };
  return {
    get,
    recent,
    list() {
      return db
        .prepare(
          "SELECT * FROM autosave_drafts ORDER BY updated_at DESC,id DESC LIMIT 50",
        )
        .all()
        .map(record)
        .filter((d) => d.receipt.phase !== "saved" || !d.projectId)
        .map((d) => ({
          id: "draft:" + d.documentId,
          title: "草稿 · " + (d.snapshot.title.trim() || "未命名"),
          revision: d.revision,
          updatedAt: d.updatedAt,
        }));
    },
    discard(id: string) {
      db.prepare("DELETE FROM autosave_drafts WHERE id=?").run(id);
      return { deleted: true };
    },
    async commit(input: unknown): Promise<SaveReceipt<T>> {
      const request = envelope(input);
      let valid: { title: string; data: T } | undefined, invalid: unknown;
      try {
        const data = validate(request.snapshot.data);
        await options.verify?.(data);
        valid = { title: titleValue(request.snapshot.title), data };
      } catch (e) {
        invalid = e;
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        const previous = get(request.documentId);
        if (previous?.mutationId === request.mutationId) {
          if (
            JSON.stringify(previous.snapshot) !==
            JSON.stringify(request.snapshot)
          )
            throw new StoreError(400, "保存标识与内容不一致。");
          db.exec("COMMIT");
          return previous.receipt as SaveReceipt<T>;
        }
        if ((previous?.revision ?? 0) !== request.draftRevision)
          throw new StoreError(409, "此草稿已在另一窗口更新，本机输入已保留。");
        const savedAt = new Date().toISOString(),
          revision = (previous?.revision ?? 0) + 1;
        const receipt: SaveReceipt<T> = {
          phase: "draft",
          message: "草稿已自动保存，待完善输入。",
          draftRevision: revision,
          project: null,
          savedAt,
        };
        try {
          if (!valid) throw invalid;
          const { title, data } = valid;
          if (request.projectId) {
            const current = projects.get(request.projectId);
            if (current.revision !== request.projectRevision)
              throw new StoreError(
                409,
                "另一窗口已更新此项目。草稿已保留，请打开服务器版本或导出草稿。",
              );
            receipt.project =
              current.title === title &&
              JSON.stringify(current.data) === JSON.stringify(data)
                ? current
                : projects.update(current.id, title, data, current.revision);
          } else
            receipt.project = projects.create(title, data, request.documentId);
          receipt.phase = "saved";
          receipt.message = "已自动保存";
        } catch (error) {
          receipt.phase =
            error instanceof Error &&
            "status" in error &&
            (error.status === 409 || error.status === 404)
              ? "conflict"
              : "draft";
          receipt.message =
            (receipt.phase === "conflict"
              ? "草稿已保留，项目有版本冲突。"
              : "草稿已自动保存，待完善输入。") +
            " " +
            (error instanceof Error ? error.message : "请检查输入。");
        }
        const projectId = receipt.project?.id ?? request.projectId;
        const projectRevision =
          receipt.project?.revision ?? request.projectRevision;
        db.prepare(
          "INSERT INTO autosave_drafts(id,project_id,project_revision,revision,mutation_id,snapshot,receipt,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,project_revision=excluded.project_revision,revision=excluded.revision,mutation_id=excluded.mutation_id,snapshot=excluded.snapshot,receipt=excluded.receipt,updated_at=excluded.updated_at",
        ).run(
          request.documentId,
          projectId,
          projectRevision,
          revision,
          request.mutationId,
          JSON.stringify(request.snapshot),
          JSON.stringify(receipt),
          savedAt,
        );
        db.exec("COMMIT");
        return receipt;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
export function registerAutosaveRoutes<T>(
  app: WorkbenchServer,
  validate: (value: unknown) => T,
  adapter?: AutosaveAdapter<T>,
  options: { verify?: (data: T) => Promise<void> } = {},
) {
  const drafts = createAutosaveStore(app.database, validate, adapter, options);
  const failure = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "草稿操作失败。" } },
      { status: e instanceof StoreError ? e.status : 400 },
    );
  app.route("GET", "/api/autosave/recent", () => drafts.recent());
  app.route("GET", "/api/autosave/list", () => drafts.list());
  app.route("GET", "/api/autosave/project/:id", ({ params }) =>
    drafts.recent(params.id),
  );
  app.route("GET", "/api/autosave/:id", ({ params }) => drafts.get(params.id));
  app.route("DELETE", "/api/autosave/:id", ({ params }) =>
    drafts.discard(params.id),
  );
  app.route("POST", "/api/autosave", async ({ body }) => {
    try {
      return await drafts.commit(body);
    } catch (e) {
      return failure(e);
    }
  });
}
