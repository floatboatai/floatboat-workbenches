import { GLB_BUFFER, type Document, type JSONDocument } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { unpartition } from "@gltf-transform/functions";
import { unzipSync } from "fflate";
import { posix } from "node:path";
import { MAX_IMPORT, MAX_MODEL } from "../contracts/asset.ts";
import { isRecord } from "../contracts/project.ts";
import { budget, Collector, createIO, readDocument } from "./model.ts";

export interface UploadedFile {
  name: string;
  bytes: Uint8Array;
}
const SUPPORTED = new Set(ALL_EXTENSIONS.map((e) => e.EXTENSION_NAME));
const isZip = (b: Uint8Array) =>
  b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const isGlb = (b: Uint8Array) =>
  b.length >= 12 && b[0] === 0x67 && b[1] === 0x6c && b[2] === 0x54 && b[3] === 0x46;
const clean = (name: string) =>
  posix.normalize(name.replaceAll("\\", "/")).replace(/^(\.\.\/|\/)+/, "");

/** Expands ZIP archives with entry-count and uncompressed-size limits. */
export function expand(files: UploadedFile[]) {
  const out: UploadedFile[] = [];
  let total = 0;
  for (const f of files) {
    if (!isZip(f.bytes)) {
      out.push({ name: clean(f.name), bytes: f.bytes });
      total += f.bytes.length;
      continue;
    }
    let entries = 0;
    let unpackedBytes = 0;
    let unpacked: Record<string, Uint8Array>;
    try {
      unpacked = unzipSync(f.bytes, {
        filter: (entry) => {
          if (entry.name.endsWith("/") || /(^|\/)(__MACOSX|\.DS_Store)/.test(entry.name))
            return false;
          if (++entries > 4000) throw Error("压缩包文件超过 4000 个。");
          unpackedBytes += entry.originalSize;
          if (unpackedBytes > MAX_MODEL)
            throw Error("压缩包解压后超过 128 MB。");
          return true;
        },
      });
    } catch (e) {
      throw Error(
        e instanceof Error && /压缩包/.test(e.message)
          ? e.message
          : "ZIP 无法解压，请确认文件完整。",
      );
    }
    for (const [name, bytes] of Object.entries(unpacked)) {
      out.push({ name: clean(name), bytes });
      total += bytes.length;
    }
  }
  if (total > MAX_MODEL) throw Error("导入文件解压后超过 128 MB。");
  return out;
}

function parseGlb(bytes: Uint8Array): JSONDocument {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) !== 2) throw Error("仅支持 glTF 2.0 GLB。");
  const declared = view.getUint32(8, true);
  if (declared > bytes.length) throw Error("GLB 文件被截断。");
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > declared)
    throw Error("GLB JSON 块无效。");
  let json: unknown;
  try {
    json = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(20, 20 + jsonLength),
      ),
    );
  } catch {
    throw Error("GLB JSON 无法解析。");
  }
  const resources: JSONDocument["resources"] = {};
  const at = 20 + jsonLength;
  if (at + 8 <= declared && view.getUint32(at + 4, true) === 0x004e4942) {
    const length = view.getUint32(at, true);
    if (at + 8 + length > declared) throw Error("GLB 二进制块越界。");
    resources[GLB_BUFFER] = bytes.subarray(at + 8, at + 8 + length) as Uint8Array<ArrayBuffer>;
  }
  if (!isRecord(json)) throw Error("模型结构无效。");
  return { json: json as unknown as JSONDocument["json"], resources };
}

function pickEntry(files: UploadedFile[]) {
  const glb = files.filter((f) => /\.glb$/i.test(f.name) || isGlb(f.bytes)),
    gltf = files.filter((f) => /\.gltf$/i.test(f.name));
  const models = [...gltf, ...glb.filter((f) => !gltf.includes(f))];
  if (!models.length)
    throw Error("没有找到 .glb 或 .gltf 文件。可选择 GLB、glTF 及其 .bin/贴图，或打包为 ZIP。");
  if (models.length > 1)
    throw Error(
      `一次只能导入一个模型，当前包含：${models
        .slice(0, 4)
        .map((f) => posix.basename(f.name))
        .join("、")}。`,
    );
  return models[0];
}

/** Reads GLB / glTF+resources / ZIP into a canonical, decompressed single-buffer GLB. */
export async function importModel(input: UploadedFile[]) {
  const picked = input.reduce((s, f) => s + f.bytes.length, 0);
  if (picked > MAX_IMPORT) throw Error("导入文件合计超过 64 MB。");
  const files = expand(input),
    entry = pickEntry(files),
    notes: string[] = [];
  let jsonDoc: JSONDocument;
  if (isGlb(entry.bytes)) jsonDoc = parseGlb(entry.bytes);
  else {
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(entry.bytes));
    } catch {
      throw Error(`${posix.basename(entry.name)} 不是有效的 glTF JSON。`);
    }
    if (!isRecord(json)) throw Error("模型结构无效。");
    jsonDoc = { json: json as unknown as JSONDocument["json"], resources: {} };
  }
  const json = jsonDoc.json as unknown as Record<string, unknown>;
  if (!isRecord(json.asset) || !String(json.asset.version ?? "").startsWith("2."))
    throw Error("仅支持 glTF 2.0。");
  const required = Array.isArray(json.extensionsRequired)
    ? json.extensionsRequired.map(String)
    : [];
  const used = Array.isArray(json.extensionsUsed)
    ? json.extensionsUsed.map(String)
    : [];
  const missingRequired = required.filter((e) => !SUPPORTED.has(e));
  if (missingRequired.length)
    throw Error(`模型需要不支持的扩展：${missingRequired.join("、")}。`);
  const unknown = used.filter((e) => !SUPPORTED.has(e));
  if (unknown.length)
    notes.push(`未识别的可选扩展会在处理时移除：${unknown.join("、")}`);

  // Resolve external URIs against the entry directory, then by unique file name.
  const dir = posix.dirname(entry.name),
    byPath = new Map(files.map((f) => [f.name.toLowerCase(), f])),
    byBase = new Map<string, UploadedFile | null>();
  for (const f of files) {
    const base = posix.basename(f.name).toLowerCase();
    byBase.set(base, byBase.has(base) ? null : f);
  }
  const missing: string[] = [];
  const resolve = (uri: unknown) => {
    if (typeof uri !== "string" || uri.startsWith("data:")) return;
    let path: string;
    try {
      path = decodeURIComponent(uri);
    } catch {
      path = uri;
    }
    const full = clean(dir === "." ? path : posix.join(dir, path)).toLowerCase(),
      found = byPath.get(full) ?? byBase.get(posix.basename(full)) ?? null;
    if (!found) missing.push(path);
    else jsonDoc.resources[uri] = found.bytes as Uint8Array<ArrayBuffer>;
  };
  const list = (k: string) =>
    Array.isArray(json[k]) ? (json[k] as unknown[]).filter(isRecord) : [];
  for (const b of list("buffers")) resolve(b.uri);
  for (const i of list("images")) if (i.bufferView === undefined) resolve(i.uri);
  if (missing.length)
    throw Error(
      `缺少资源文件：${missing.slice(0, 6).join("、")}${missing.length > 6 ? " 等" : ""}。请同时选择 .gltf、.bin 与贴图，或打包为 ZIP 再导入。`,
    );
  // glTF Transform stores TRS; a sheared matrix cannot be represented losslessly.
  for (const n of list("nodes"))
    if (Array.isArray(n.matrix)) {
      const m = n.matrix.map(Number);
      const col = (i: number) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]];
      const dot = (a: number[], b: number[]) =>
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const [x, y, z] = [col(0), col(1), col(2)];
      const len = (a: number[]) => Math.sqrt(dot(a, a)) || 1;
      if (
        Math.abs(dot(x, y)) / (len(x) * len(y)) > 1e-4 ||
        Math.abs(dot(y, z)) / (len(y) * len(z)) > 1e-4 ||
        Math.abs(dot(x, z)) / (len(x) * len(z)) > 1e-4
      )
        throw Error("模型含有剪切矩阵节点，无法无损转换为 TRS，请在上游应用变换后导出。");
    }

  const logger = new Collector(),
    io = await createIO(logger);
  let doc: Document;
  try {
    doc = await io.readJSON(jsonDoc);
  } catch (e) {
    throw Error("模型无法解析：" + (e instanceof Error ? e.message : "未知错误"));
  }
  const r = doc.getRoot();
  for (const ext of r.listExtensionsUsed()) {
    if (ext.extensionName === "KHR_draco_mesh_compression") {
      ext.dispose();
      notes.push("Draco 几何已解码；导出时可重新压缩");
    } else if (ext.extensionName === "EXT_meshopt_compression") {
      ext.dispose();
      notes.push("Meshopt 压缩已解码；导出时可重新压缩");
    }
  }
  if (r.listBuffers().length > 1) await doc.transform(unpartition());
  if (!r.listBuffers().length && r.listAccessors().length) {
    const buffer = doc.createBuffer();
    r.listAccessors().forEach((a) => a.setBuffer(buffer));
  }
  for (const b of r.listBuffers()) b.setURI("");
  budget(doc);
  const bytes = await io.writeBinary(doc);
  if (bytes.length > MAX_MODEL) throw Error("解码后的模型超过 128 MB。");
  await readDocument(bytes);
  notes.push(...logger.warnings.slice(0, 4));
  const name =
    posix.basename(entry.name).replace(/\.(glb|gltf)$/i, "") + ".glb";
  return { bytes, name, notes, files: files.length };
}
