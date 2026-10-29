// ABOUTME: 二进制资源的分块上传、SHA-256 校验入库与读取；项目保存前核对引用的资源都在。
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { ASSET_ID, ASSET_TYPES, CHUNK, assetId, formatBytes, isAssetMime, sniffMatches } from "../contracts/assets.ts";
import { assetRefs, type PdfProject } from "../contracts/domain.ts";
import { StoreError } from "./store.ts";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const identifier = (value: string) => {
  if (!ASSET_ID.test(value)) throw new StoreError(400, "资源标识无效。");
  return value;
};

export function createAssetStore(db: DatabaseSync) {
  const stored = (id: string) =>
    db.prepare("SELECT id,mime,size FROM assets WHERE id=?").get(identifier(id)) as { id: string; mime: string; size: number } | undefined;
  return {
    status(id: string) {
      const row = stored(id);
      return row ? { stored: true, mime: row.mime, size: Number(row.size) } : { stored: false };
    },
    part(id: string, index: number, raw: unknown) {
      identifier(id);
      if (!Number.isInteger(index) || index < 0 || index >= Math.ceil(ASSET_TYPES["application/pdf"] / CHUNK)) throw new StoreError(400, "分块序号无效。");
      if (typeof raw !== "string" || raw.length > Math.ceil(CHUNK / 3) * 4) throw new StoreError(413, "分块超过容量。");
      const bytes = Buffer.from(raw, "base64");
      if (!bytes.length || bytes.length > CHUNK || bytes.toString("base64") !== raw) throw new StoreError(400, "分块编码无效。");
      if (stored(id)) return { ok: true };
      db.prepare(
        "INSERT INTO asset_parts(asset_id,part,data,created_at) VALUES(?,?,?,?) ON CONFLICT(asset_id,part) DO UPDATE SET data=excluded.data,created_at=excluded.created_at",
      ).run(id, index, bytes, new Date().toISOString());
      return { ok: true };
    },
    finish(id: string, input: unknown) {
      identifier(id);
      if (!isRecord(input) || !isAssetMime(input.mime) || !Number.isInteger(input.size)) throw new StoreError(400, "资源信息无效。");
      const mime = input.mime,
        size = Number(input.size);
      if (size < 1 || size > ASSET_TYPES[mime]) throw new StoreError(413, `文件超过 ${formatBytes(ASSET_TYPES[mime])}。`);
      const known = stored(id);
      if (known) return { id, mime: known.mime, size: Number(known.size) };
      const count = Math.ceil(size / CHUNK);
      const rows = db.prepare("SELECT part,data FROM asset_parts WHERE asset_id=? AND part<? ORDER BY part").all(id, count) as { part: number; data: Uint8Array }[];
      if (rows.length !== count || rows.some((row, index) => Number(row.part) !== index))
        throw new StoreError(409, "文件尚未完整上传，请重新选择文件。");
      const bytes = Buffer.concat(rows.map((row) => Buffer.from(row.data)));
      if (bytes.length !== size || digest(bytes) !== id) throw new StoreError(400, "文件校验失败，请重新上传。");
      if (!sniffMatches(mime, bytes)) throw new StoreError(415, "文件内容与类型不符。");
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("INSERT OR IGNORE INTO assets(id,mime,size,data,created_at) VALUES(?,?,?,?,?)").run(id, mime, size, bytes, new Date().toISOString());
        db.prepare("DELETE FROM asset_parts WHERE asset_id=?").run(id);
        // Abandoned uploads older than a day are cleared opportunistically.
        db.prepare("DELETE FROM asset_parts WHERE created_at<?").run(new Date(Date.now() - 86_400_000).toISOString());
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return { id, mime, size };
    },
    read(id: string) {
      const row = db.prepare("SELECT mime,data FROM assets WHERE id=?").get(identifier(id)) as { mime: string; data: Uint8Array } | undefined;
      if (!row) throw new StoreError(404, "资源不存在，请重新导入该文件。");
      return { mime: row.mime, data: Buffer.from(row.data) };
    },
    /** Server-side verification before the model is stored: every referenced asset must exist. */
    async verify(project: PdfProject) {
      for (const ref of await assetRefs(project))
        if (!stored(assetId(ref))) throw new Error("模板引用的底图、图片或数据文件缺失，请重新导入该文件。");
    },
  };
}

export function registerAssetRoutes(app: WorkbenchServer, assets: ReturnType<typeof createAssetStore>) {
  const fail = (error: unknown) =>
    Response.json(
      { error: { message: error instanceof Error ? error.message : "资源操作失败。" } },
      { status: error instanceof StoreError ? error.status : 400 },
    );
  const guard = <T>(work: () => T) => {
    try {
      return work();
    } catch (error) {
      return fail(error);
    }
  };
  app.route("GET", "/api/assets/:id/status", ({ params }) => guard(() => assets.status(params.id)));
  app.route("POST", "/api/assets/:id/parts/:part", ({ params, body }) =>
    guard(() => assets.part(params.id, Number(params.part), isRecord(body) ? body.data : null)),
  );
  app.route("POST", "/api/assets/:id/finish", ({ params, body }) => guard(() => assets.finish(params.id, body)));
  app.route("GET", "/api/assets/:id", ({ params }) =>
    guard(() => {
      const { mime, data } = assets.read(params.id);
      return new Response(data, {
        headers: { "content-type": mime, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
      });
    }),
  );
}
