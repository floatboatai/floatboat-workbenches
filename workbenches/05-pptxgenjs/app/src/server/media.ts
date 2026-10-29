// ABOUTME: 本应用自有的图片媒体库：按内容哈希去重保存在 SQLite，文稿只引用媒体 ID。
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { MEDIA_MAX_BYTES, sniffImage, type MediaInfo, type MediaRecord } from "../contracts/media.ts";
import { MEDIA_ID } from "../contracts/domain.ts";
import { isRecord } from "../contracts/project.ts";
import { StoreError } from "./store.ts";
import { DEMO_MEDIA } from "./demo-media.ts";

export function createMediaStore(db: DatabaseSync) {
  const info = (row: Record<string, unknown>): MediaInfo => ({
    id: String(row.id),
    mime: String(row.mime) as MediaInfo["mime"],
    width: Number(row.width),
    height: Number(row.height),
    bytes: Number(row.bytes),
    name: String(row.name),
  });
  function put(nameValue: unknown, base64Value: unknown): MediaInfo {
    if (typeof base64Value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64Value))
      throw new StoreError(400, "图片数据需要 base64 编码。");
    const bytes = Buffer.from(base64Value, "base64");
    if (!bytes.length) throw new StoreError(400, "图片内容为空。");
    if (bytes.length > MEDIA_MAX_BYTES)
      throw new StoreError(413, `图片压缩后仍超过 ${Math.round(MEDIA_MAX_BYTES / 1000)} KB，请换一张较小的图片。`);
    const sniffed = sniffImage(bytes);
    if (!sniffed) throw new StoreError(415, "只能保存 PNG、JPEG 或 GIF 图片。");
    if (sniffed.width < 1 || sniffed.height < 1 || sniffed.width > 10000 || sniffed.height > 10000)
      throw new StoreError(400, "图片尺寸无效。");
    const name = typeof nameValue === "string" ? nameValue.slice(0, 200) : "";
    const id = createHash("sha256").update(bytes).digest("hex");
    db.prepare(
      "INSERT OR IGNORE INTO media(id,mime,width,height,bytes,name,data,created_at) VALUES(?,?,?,?,?,?,?,?)",
    ).run(id, sniffed.mime, sniffed.width, sniffed.height, bytes.length, name, bytes, new Date().toISOString());
    return get(id);
  }
  function get(id: string): MediaInfo {
    if (!MEDIA_ID.test(id)) throw new StoreError(400, "图片标识无效。");
    const row = db.prepare("SELECT id,mime,width,height,bytes,name FROM media WHERE id=?").get(id);
    if (!row) throw new StoreError(404, "图片不存在。");
    return info(row);
  }
  function read(id: string): MediaRecord {
    const meta = get(id);
    const row = db.prepare("SELECT data FROM media WHERE id=?").get(id) as { data: Uint8Array };
    return { ...meta, base64: Buffer.from(row.data).toString("base64") };
  }
  const has = (id: string) => MEDIA_ID.test(id) && !!db.prepare("SELECT 1 FROM media WHERE id=?").get(id);
  return {
    put,
    get,
    read,
    has,
    seedDemo: () => put(DEMO_MEDIA.name, DEMO_MEDIA.base64),
  };
}
export type MediaStore = ReturnType<typeof createMediaStore>;

export function registerMediaRoutes(app: WorkbenchServer, store: MediaStore) {
  const fail = (error: unknown) =>
    Response.json(
      { error: { message: error instanceof Error ? error.message : "图片操作失败。" } },
      { status: error instanceof StoreError ? error.status : 400 },
    );
  app.route("POST", "/api/media", ({ body }) => {
    try {
      if (!isRecord(body)) throw new StoreError(400, "请求格式无效。");
      return Response.json(store.put(body.name, body.data), { status: 201 });
    } catch (error) {
      return fail(error);
    }
  });
  app.route("GET", "/api/media/:id", ({ params }) => {
    try {
      return store.read(params.id);
    } catch (error) {
      return fail(error);
    }
  });
}
