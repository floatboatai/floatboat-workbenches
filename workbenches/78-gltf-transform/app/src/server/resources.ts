import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import {
  documentRefs,
  fileRef,
  MAX_IMAGE,
  type AssetDocument,
  type FileRef,
  type ImageRef,
} from "../contracts/asset.ts";
import { hash, readDocument } from "./model.ts";
import { imageInfo } from "./images.ts";

/**
 * Content-addressed files under the manifest's writable `models/` directory.
 * Models and replacement images share the store; each is validated on entry.
 */
export function resourceStore(app: Pick<WorkbenchServer, "resources">) {
  const verified = new Set<string>();
  const path = (id: string, intent: "read" | "write" = "read") => {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("资源编号无效。");
    return app.resources.path("models", id, intent);
  };
  const read = async (id: string) => new Uint8Array(await readFile(await path(id)));
  const put = async (bytes: Uint8Array) => {
    const id = hash(bytes),
      target = await path(id, "write"),
      temp = await app.resources.path(
        "models",
        id + "." + randomUUID() + ".tmp",
        "write",
      );
    try {
      await writeFile(temp, bytes, { flag: "wx" });
      await rename(temp, target);
    } finally {
      await unlink(temp).catch(() => {});
    }
    verified.add(id);
    return id;
  };
  const exists = async (ref: FileRef) => {
    try {
      const s = await stat(await path(ref.id));
      if (s.size !== ref.bytes) return false;
      if (!verified.has(ref.id)) {
        if (hash(await read(ref.id)) !== ref.id) return false;
        verified.add(ref.id);
      }
      return true;
    } catch {
      return false;
    }
  };
  return {
    read,
    exists,
    /** Saves an already-validated model produced by the engine. */
    async save(bytes: Uint8Array, name: string) {
      const id = await put(bytes);
      return fileRef({ id, name, bytes: bytes.length });
    },
    /** Saves a model received from the browser after parsing it. */
    async saveModel(bytes: Uint8Array, name: string) {
      await readDocument(bytes);
      const id = await put(bytes);
      return fileRef({ id, name, bytes: bytes.length });
    },
    async saveImage(bytes: Uint8Array, name: string): Promise<ImageRef> {
      if (bytes.length > MAX_IMAGE) throw Error("贴图超过 32 MB。");
      const info = imageInfo(bytes),
        id = await put(bytes);
      return { id, name: name.slice(0, 160), bytes: bytes.length, ...info };
    },
    async missing(ids: unknown) {
      if (!Array.isArray(ids) || ids.length > 200) throw Error("资源列表无效。");
      const out: string[] = [];
      for (const id of ids) {
        if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id))
          throw Error("资源编号无效。");
        try {
          await stat(await path(id));
        } catch {
          out.push(id);
        }
      }
      return out;
    },
    /** Formal saves require every referenced model and image to be present and intact. */
    async verifyDocument(d: AssetDocument) {
      for (const { ref } of documentRefs(d))
        if (!(await exists(ref)))
          throw Error(
            `资源 ${ref.name} 缺失或校验不匹配，请补齐同一文件或导入完整工程。`,
          );
    },
    images: async (d: Pick<AssetDocument, "edits">) => {
      const map = new Map<string, Uint8Array>();
      for (const ref of Object.values(d.edits.textures)) {
        if (!(await exists(ref)))
          throw Error(`替换贴图 ${ref.name} 缺失，请重新选择。`);
        map.set(ref.id, await read(ref.id));
      }
      return map;
    },
  };
}
