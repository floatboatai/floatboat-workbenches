import { unzipSync, zipSync, strToU8, strFromU8, type Zippable } from "fflate";
import {
  documentRefs,
  importAsset,
  LEGACY_PROJECT,
  MAX_PROJECT,
  type AssetDocument,
} from "../contracts/asset";
import { isRecord } from "../contracts/project";
import { formatBytes } from "../contracts/pipeline";
import { fromBytes, missingResources, readBytes, sha256, uploadResource } from "./files";
import { unbase64 } from "./preview";

type Report = (text: string) => void;
export const PROJECT_FORMAT = "floatboat-gltf-project";

/** Complete project v2: project.json plus every referenced model/image, stored uncompressed. */
export async function packProject(
  snapshot: { title: string; data: AssetDocument; extra: Record<string, unknown> },
  report: Report,
) {
  const refs = documentRefs(snapshot.data),
    total = refs.reduce((s, r) => s + r.ref.bytes, 0);
  if (total > MAX_PROJECT)
    throw Error("完整工程超过 512 MB，请先撤销中间步骤或只导出 GLB。");
  const files: Zippable = {};
  let packed = 0;
  for (const { ref } of refs) {
    files["resources/" + ref.id] = [await readBytes(ref), { level: 0 }];
    packed += ref.bytes;
    report(`打包 ${formatBytes(packed)} / ${formatBytes(total)}`);
  }
  files["project.json"] = [
    strToU8(
      JSON.stringify({
        format: PROJECT_FORMAT,
        version: 2,
        ...snapshot,
        resources: refs.map((r) => ({ ...r.ref, kind: r.kind })),
      }),
    ),
    { level: 6 },
  ];
  return {
    blob: new Blob([zipSync(files).slice().buffer], { type: "application/zip" }),
    count: refs.length,
  };
}

export const zipHasProject = (bytes: Uint8Array) => {
  try {
    return Boolean(
      unzipSync(bytes, { filter: (f) => f.name === "project.json" })["project.json"],
    );
  } catch {
    return false;
  }
};

/** Reads a v2 ZIP, a 0.8.x JSON project (inline base64) or a recovery draft. */
export async function unpackProject(f: File) {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let raw: unknown,
    entries: Record<string, Uint8Array> = {};
  try {
    if (/\.zip$/i.test(f.name) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
      if (f.size > MAX_PROJECT) throw Error("工程文件超过 512 MB。");
      try {
        entries = unzipSync(bytes);
      } catch {
        throw Error("工程 ZIP 无法解压。");
      }
      if (!entries["project.json"])
        throw Error("ZIP 中没有 project.json；模型压缩包请用“打开模型”。");
      raw = JSON.parse(strFromU8(entries["project.json"]));
    } else {
      if (f.size > LEGACY_PROJECT) throw Error("JSON 工程或恢复稿超过 12 MB。");
      raw = JSON.parse(new TextDecoder().decode(bytes));
      if (isRecord(raw) && Array.isArray(raw.resources))
        for (const r of raw.resources)
          if (isRecord(r) && typeof r.id === "string" && typeof r.base64 === "string")
            entries["resources/" + r.id] = unbase64(r.base64);
    }
  } catch (e) {
    throw e instanceof SyntaxError ? Error("工程 JSON 无法解析。") : e;
  }
  return { value: importAsset(raw), entries };
}

/** Uploads only the resources the service lacks, after verifying size and SHA-256. */
export async function restoreResources(
  data: AssetDocument,
  entries: Record<string, Uint8Array>,
  report: Report,
) {
  const refs = documentRefs(data),
    absent = new Set(await missingResources(refs.map((r) => r.ref.id)));
  let restored = 0,
    unresolved = 0;
  for (const { ref, kind } of refs) {
    if (!absent.has(ref.id)) continue;
    const bytes = entries["resources/" + ref.id];
    if (!bytes) {
      unresolved++;
      continue;
    }
    if (bytes.length !== ref.bytes || (await sha256(bytes)) !== ref.id)
      throw Error(`工程资源 ${ref.name} 的 hash 不匹配。`);
    report(`恢复资源 ${restored + 1} / ${absent.size}`);
    if (kind === "image") await uploadResource(fromBytes(ref.name, bytes), "image");
    else await uploadResource(fromBytes(ref.name, bytes), "model");
    restored++;
  }
  return { restored, unresolved };
}
