// ABOUTME: 乐谱原件库：分块上传、SHA-256 校验、MXL 解压与索引入库；项目只保存原件引用与索引。
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { MAX_SOURCE_BYTES, readSource } from "../contracts/archive.ts";
import { parseIndex, type ScoreProject, type SourceRef } from "../contracts/domain.ts";
import type { ScoreIndex } from "../contracts/musicxml.ts";
import { SAMPLES, sampleSource } from "../contracts/samples.ts";
import { StoreError } from "./store.ts";

/** 每块原始字节；base64 后约 1 MB，低于运行时 2 MB 请求上限。 */
export const CHUNK = 768 * 1024;
const ID = /^[0-9a-f]{64}$/;
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const identifier = (value: string) => {
  if (!ID.test(value)) throw new StoreError(400, "原文件标识无效。");
  return value;
};

interface Row {
  id: string;
  kind: string;
  size: number;
  score_index: string;
}

export function createSourceStore(db: DatabaseSync) {
  const row = (id: string) =>
    db.prepare("SELECT id,kind,size,score_index FROM score_sources WHERE id=?").get(identifier(id)) as Row | undefined;
  const describe = (found: Row) => ({ id: found.id, kind: found.kind as SourceRef["kind"], size: Number(found.size), index: parseIndex(JSON.parse(found.score_index)) });
  async function insert(bytes: Uint8Array, fileName: string) {
    const id = digest(bytes);
    const known = row(id);
    if (known) return describe(known);
    let parsed: Awaited<ReturnType<typeof readSource>>;
    try {
      parsed = await readSource(bytes, fileName);
    } catch (error) {
      throw new StoreError(422, error instanceof Error ? error.message : "乐谱无法读取。");
    }
    const raw = parsed.kind === "xml" && Buffer.from(parsed.xml, "utf8").equals(Buffer.from(bytes));
    db.prepare("INSERT OR IGNORE INTO score_sources(id,kind,size,data,xml,score_index,created_at) VALUES(?,?,?,?,?,?,?)").run(
      id,
      parsed.kind,
      bytes.length,
      bytes,
      raw ? null : parsed.xml,
      JSON.stringify(parsed.index),
      new Date().toISOString(),
    );
    return { id, kind: parsed.kind, size: bytes.length, index: parsed.index };
  }
  return {
    insert,
    status(id: string) {
      const found = row(id);
      return found ? { stored: true, ...describe(found) } : { stored: false };
    },
    part(id: string, index: number, raw: unknown) {
      identifier(id);
      if (!Number.isInteger(index) || index < 0 || index >= Math.ceil(MAX_SOURCE_BYTES / CHUNK)) throw new StoreError(400, "分块序号无效。");
      if (typeof raw !== "string" || raw.length > Math.ceil(CHUNK / 3) * 4) throw new StoreError(413, "分块超过容量。");
      const bytes = Buffer.from(raw, "base64");
      if (!bytes.length || bytes.length > CHUNK || bytes.toString("base64") !== raw) throw new StoreError(400, "分块编码无效。");
      if (row(id)) return { ok: true };
      db.prepare(
        "INSERT INTO score_source_parts(source_id,part,data,created_at) VALUES(?,?,?,?) ON CONFLICT(source_id,part) DO UPDATE SET data=excluded.data,created_at=excluded.created_at",
      ).run(id, index, bytes, new Date().toISOString());
      return { ok: true };
    },
    async finish(id: string, input: unknown) {
      identifier(id);
      if (!isRecord(input) || typeof input.fileName !== "string" || !input.fileName.trim() || input.fileName.length > 200 || !Number.isInteger(input.size))
        throw new StoreError(400, "原文件信息无效。");
      const size = Number(input.size);
      if (size < 1 || size > MAX_SOURCE_BYTES) throw new StoreError(413, `原文件需要 1 B–${MAX_SOURCE_BYTES / 1048576} MB。`);
      const known = row(id);
      if (known) return describe(known);
      const count = Math.ceil(size / CHUNK);
      const parts = db.prepare("SELECT part,data FROM score_source_parts WHERE source_id=? AND part<? ORDER BY part").all(id, count) as { part: number; data: Uint8Array }[];
      if (parts.length !== count || parts.some((part, index) => Number(part.part) !== index))
        throw new StoreError(409, "文件尚未完整上传，请重新选择文件。");
      const bytes = Buffer.concat(parts.map((part) => Buffer.from(part.data)));
      if (bytes.length !== size || digest(bytes) !== id) throw new StoreError(400, "文件校验失败，请重新上传。");
      const result = await insert(new Uint8Array(bytes), input.fileName);
      db.prepare("DELETE FROM score_source_parts WHERE source_id=? OR created_at<?").run(id, new Date(Date.now() - 86_400_000).toISOString());
      return result;
    },
    original(id: string) {
      const found = db.prepare("SELECT kind,data FROM score_sources WHERE id=?").get(identifier(id)) as { kind: string; data: Uint8Array } | undefined;
      if (!found) throw new StoreError(404, "原文件不存在，请重新导入。");
      return { kind: found.kind, data: Buffer.from(found.data) };
    },
    musicxml(id: string): string {
      const found = db.prepare("SELECT data,xml FROM score_sources WHERE id=?").get(identifier(id)) as { data: Uint8Array; xml: string | null } | undefined;
      if (!found) throw new StoreError(404, "原文件不存在，请重新导入。");
      return found.xml ?? Buffer.from(found.data).toString("utf8");
    },
    /** 内置示例在首次启动时写入，种子项目引用的内容标识因此总是可用。 */
    ensureSamples() {
      for (const sample of SAMPLES) {
        const { bytes, id, index } = sampleSource(sample);
        if (!row(id))
          db.prepare("INSERT OR IGNORE INTO score_sources(id,kind,size,data,xml,score_index,created_at) VALUES(?,?,?,?,NULL,?,?)").run(
            id,
            "xml",
            bytes.length,
            bytes,
            JSON.stringify(index),
            new Date().toISOString(),
          );
      }
    },
    /** 保存前核对：原件在库中，项目携带的索引与入库时解析的一致。 */
    verify(project: ScoreProject) {
      const found = row(project.source.id);
      if (!found) throw new Error("乐谱原件不在本工作台中，请重新导入原文件。");
      if (found.kind !== project.source.kind || Number(found.size) !== project.source.size) throw new Error("原文件类型或大小与原件库不一致。");
      if (JSON.stringify(parseIndex(JSON.parse(found.score_index))) !== JSON.stringify(project.index))
        throw new Error("乐谱索引与原文件不一致，请重新导入。");
    },
  };
}
export type SourceStore = ReturnType<typeof createSourceStore>;
export type StoredSource = { id: string; kind: SourceRef["kind"]; size: number; index: ScoreIndex };

export function registerSourceRoutes(app: WorkbenchServer, sources: SourceStore) {
  const fail = (error: unknown) =>
    Response.json(
      { error: { message: error instanceof Error ? error.message : "原文件操作失败。" } },
      { status: error instanceof StoreError ? error.status : 400 },
    );
  const guard = async <T>(work: () => T | Promise<T>) => {
    try {
      return await work();
    } catch (error) {
      return fail(error);
    }
  };
  app.route("GET", "/api/sources/:id", ({ params }) => guard(() => sources.status(params.id)));
  app.route("POST", "/api/sources/:id/parts/:part", ({ params, body }) =>
    guard(() => sources.part(params.id, Number(params.part), isRecord(body) ? body.data : null)),
  );
  app.route("POST", "/api/sources/:id/finish", ({ params, body }) => guard(() => sources.finish(params.id, body)));
  app.route("GET", "/api/sources/:id/original", ({ params }) =>
    guard(() => {
      const { kind, data } = sources.original(params.id);
      return new Response(new Uint8Array(data), {
        headers: {
          "content-type": kind === "mxl" ? "application/vnd.recordare.musicxml" : "application/vnd.recordare.musicxml+xml",
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    }),
  );
  app.route("GET", "/api/sources/:id/musicxml", ({ params }) =>
    guard(
      () =>
        new Response(sources.musicxml(params.id), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "private, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
          },
        }),
    ),
  );
}
