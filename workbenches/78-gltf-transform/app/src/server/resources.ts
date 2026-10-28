import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { fileRef, MAX_FILE, type FileRef } from "../contracts/asset.ts";
import { isRecord } from "../contracts/project.ts";
import { hash, inspect, readDocument } from "./native.ts";
export function resourceStore(app: WorkbenchServer) {
  const read = async (id: string) => {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("资源编号无效。");
    return readFile(await app.resources.path("models", id));
  };
  const save = async (bytes: Uint8Array, name: string) => {
    await readDocument(bytes);
    const id = hash(bytes),
      target = await app.resources.path("models", id, "write"),
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
    return fileRef({ id, name, bytes: bytes.length });
  };
  return {
    read,
    save,
    async put(raw: unknown) {
      if (
        !isRecord(raw) ||
        typeof raw.name !== "string" ||
        raw.name.length > 160 ||
        typeof raw.base64 !== "string" ||
        raw.base64.length > Math.ceil(MAX_FILE / 3) * 4 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(raw.base64)
      )
        throw Error("上传格式无效，模型限1.4MB。");
      const bytes = Buffer.from(raw.base64, "base64");
      if (bytes.toString("base64") !== raw.base64)
        throw Error("资源编码无效。");
      return {
        ref: await save(bytes, raw.name),
        inspection: await inspect(bytes),
      };
    },
    async verify(ref: FileRef | null) {
      if (!ref) return;
      let bytes: Buffer;
      try {
        bytes = await read(ref.id);
      } catch {
        throw Error("模型资源缺失，请补齐同一文件或导入完整工程。");
      }
      if (bytes.length !== ref.bytes || hash(bytes) !== ref.id)
        throw Error("资源校验不匹配。");
      await readDocument(bytes);
    },
  };
}
