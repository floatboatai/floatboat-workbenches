import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import {
  samples,
  assetId,
  MAX_IMAGE_BYTES,
  type Asset,
} from "../contracts/folio.ts";
import { isRecord, boundedText } from "../contracts/project.ts";
import { StoreError } from "./store.ts";

export function imageInfo(bytes: Buffer): {
  mime: string;
  width: number;
  height: number;
} {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new StoreError(413, "每张图像须小于等于 1 MiB。");
  let width = 0,
    height = 0,
    mime = "";
  if (
    bytes.length >= 33 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR"
  ) {
    mime = "image/png";
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    mime = "image/jpeg";
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const size = bytes.readUInt16BE(offset);
      if (size < 2 || offset + size > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        size >= 8
      ) {
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
        break;
      }
      offset += size;
    }
  }
  if (
    !mime ||
    width < 1 ||
    height < 1 ||
    width > 10000 ||
    height > 10000 ||
    width * height > 30000000
  )
    throw new StoreError(
      400,
      "请使用有效 PNG/JPEG，边长不超过 10,000 像素、总像素不超过 3,000 万。",
    );
  return { mime, width, height };
}
export function createImages(
  db: WorkbenchServer["database"],
  resources: WorkbenchServer["resources"],
) {
  const get = (raw: string): Asset => {
    const id = assetId(raw);
    const demo = samples.find((x) => x.id === id);
    if (demo) return demo;
    const row = db
      .prepare("SELECT id,name,mime,width,height FROM images WHERE id=?")
      .get(id);
    if (!row)
      throw new StoreError(404, "原图不存在，请重新导入图像或完整项目包。");
    return {
      id: String(row.id),
      name: String(row.name),
      mime: String(row.mime),
      width: Number(row.width),
      height: Number(row.height),
    };
  };
  const read = async (id: string) => {
    const meta = get(id);
    try {
      const path = meta.id.startsWith("demo-")
        ? await resources.path("samples", meta.id + ".svg")
        : await resources.path(
            "scans",
            meta.id + (meta.mime === "image/png" ? ".png" : ".jpg"),
          );
      return { meta, bytes: await readFile(path) };
    } catch {
      throw new StoreError(404, "原图文件不可用，请从完整项目包重新导入。");
    }
  };
  return {
    get,
    read,
    async put(value: unknown): Promise<Asset> {
      if (
        !isRecord(value) ||
        typeof value.base64 !== "string" ||
        value.base64.length > 1400000 ||
        value.base64.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(value.base64)
      )
        throw new StoreError(400, "图像数据格式无效。");
      const bytes = Buffer.from(value.base64, "base64");
      if (bytes.toString("base64") !== value.base64)
        throw new StoreError(400, "图像编码无效。");
      const info = imageInfo(bytes);
      const id = createHash("sha256").update(bytes).digest("hex");
      if (value.expectedId !== undefined && value.expectedId !== id)
        throw new StoreError(400, "项目包图像校验失败。");
      const name = boundedText(value.name, 120).trim();
      if (!name) throw new StoreError(400, "缺少图像名称。");
      const path = await resources.path(
        "scans",
        id + (info.mime === "image/png" ? ".png" : ".jpg"),
        "write",
      );
      let complete = false;
      try {
        complete =
          createHash("sha256")
            .update(await readFile(path))
            .digest("hex") === id;
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          )
        )
          throw error;
      }
      if (!complete) {
        const temporary = await resources.path(
          "scans",
          id + "." + randomUUID() + ".tmp",
          "write",
        );
        try {
          await writeFile(temporary, bytes, { flag: "wx" });
          await rename(temporary, path);
        } finally {
          await unlink(temporary).catch(() => {});
        }
      }
      db.prepare(
        "INSERT OR IGNORE INTO images(id,name,mime,width,height,size,created_at) VALUES(?,?,?,?,?,?,?)",
      ).run(
        id,
        name,
        info.mime,
        info.width,
        info.height,
        bytes.length,
        new Date().toISOString(),
      );
      return get(id);
    },
  };
}
export function imageManifest(asset: Asset, origin: string) {
  const root = origin + "/api/iiif/" + asset.id;
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: root + "/manifest",
    type: "Manifest",
    label: { zh: [asset.name] },
    requiredStatement: {
      label: { zh: ["资料来源"] },
      value: {
        zh: [
          asset.id.startsWith("demo-")
            ? "本工作台原创演示资料"
            : "用户导入的本地扫描图像",
        ],
      },
    },
    items: [
      {
        id: root + "/canvas",
        type: "Canvas",
        width: asset.width,
        height: asset.height,
        label: { zh: [asset.name] },
        items: [
          {
            id: root + "/page",
            type: "AnnotationPage",
            items: [
              {
                id: root + "/annotation",
                type: "Annotation",
                motivation: "painting",
                target: root + "/canvas",
                body: {
                  id: origin + "/api/images/" + asset.id,
                  type: "Image",
                  format: asset.mime,
                  width: asset.width,
                  height: asset.height,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}
