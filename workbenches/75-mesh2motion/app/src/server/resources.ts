import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { inspectGlb } from "../contracts/glb.ts";
import { refValue, type ModelRef, MAX_RESOURCE } from "../contracts/model.ts";
import { isRecord } from "../contracts/project.ts";
export function resourceStore(app: WorkbenchServer) {
  const read = async (id: string) => {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("资源编号无效。");
    return readFile(await app.resources.path("originals", id));
  };
  return {
    read,
    async put(raw: unknown) {
      if (
        !isRecord(raw) ||
        typeof raw.name !== "string" ||
        raw.name.length > 160 ||
        typeof raw.base64 !== "string" ||
        raw.base64.length > Math.ceil(MAX_RESOURCE / 3) * 4 ||
        (raw.kind !== "source" && raw.kind !== "bound") ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(raw.base64)
      )
        throw Error("模型上传格式或大小无效。");
      const bytes = Buffer.from(raw.base64, "base64");
      if (bytes.toString("base64") !== raw.base64)
        throw Error("资源编码无效。");
      inspectGlb(bytes, raw.kind);
      const id = createHash("sha256").update(bytes).digest("hex"),
        target = await app.resources.path("originals", id, "write"),
        temp = await app.resources.path(
          "originals",
          id + "." + randomUUID() + ".tmp",
          "write",
        );
      try {
        await writeFile(temp, bytes, { flag: "wx" });
        await rename(temp, target);
      } finally {
        await unlink(temp).catch(() => {});
      }
      return refValue({
        id,
        name: raw.name,
        kind: raw.kind,
        bytes: bytes.length,
      });
    },
    async verify(ref: ModelRef | null) {
      if (!ref) return;
      let bytes: Buffer;
      try {
        bytes = await read(ref.id);
      } catch {
        throw Error("原件或绑定结果缺失，请导入完整工程或重附匹配文件。");
      }
      if (
        bytes.length !== ref.bytes ||
        createHash("sha256").update(bytes).digest("hex") !== ref.id
      )
        throw Error("资源与工程不匹配。");
      inspectGlb(bytes, ref.kind);
    },
  };
}
