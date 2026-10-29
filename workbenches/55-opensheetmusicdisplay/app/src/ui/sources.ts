// ABOUTME: 页面侧原件库：分块上传（按 SHA-256 去重）、读取可渲染 MusicXML 与原始字节。
import { getPageConnection } from "./connection";
import { request } from "./requests";
import { isRecord } from "../contracts/project";
import { bytesToBase64, parseIndex, type SourceRef } from "../contracts/domain";
import { MAX_SOURCE_BYTES } from "../contracts/archive";
import type { ScoreIndex } from "../contracts/musicxml";

const CHUNK = 768 * 1024;
export const formatBytes = (size: number) =>
  size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : size >= 1024 ? `${Math.round(size / 1024)} KB` : `${size} B`;

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stored(value: unknown): { id: string; kind: SourceRef["kind"]; size: number; index: ScoreIndex } {
  if (!isRecord(value) || typeof value.id !== "string" || (value.kind !== "xml" && value.kind !== "mxl") || typeof value.size !== "number")
    throw new Error("原件库返回的信息无效。");
  return { id: value.id, kind: value.kind, size: value.size, index: parseIndex(value.index) };
}

/** 上传原文件；服务端解压、检查并建立索引后返回引用。已存在的相同内容不再上传。 */
export async function uploadSource(
  file: File,
  progress: (message: string) => void,
): Promise<{ source: SourceRef; index: ScoreIndex }> {
  if (!/\.(?:xml|musicxml|mxl)$/i.test(file.name)) throw new Error("请选择 .musicxml、.xml 或 .mxl 文件。");
  if (!file.size) throw new Error("文件是空的。");
  if (file.size > MAX_SOURCE_BYTES)
    throw new Error(`文件为 ${formatBytes(file.size)}，超过 ${formatBytes(MAX_SOURCE_BYTES)} 上限；请导出为压缩的 .mxl 或分册导入。`);
  progress("正在读取文件…");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = await sha256(bytes);
  const status = await request(`/api/sources/${id}`);
  let result = isRecord(status) && status.stored === true ? stored(status) : null;
  if (!result) {
    const total = Math.ceil(bytes.length / CHUNK);
    for (let index = 0; index < total; index++) {
      progress(total > 1 ? `正在上传 ${index + 1}/${total}（${formatBytes(bytes.length)}）…` : "正在上传…");
      await request(`/api/sources/${id}/parts/${index}`, {
        method: "POST",
        body: JSON.stringify({ data: bytesToBase64(bytes.subarray(index * CHUNK, (index + 1) * CHUNK)) }),
      });
    }
    progress("正在检查 MusicXML 结构…");
    result = stored(await request(`/api/sources/${id}/finish`, { method: "POST", body: JSON.stringify({ fileName: file.name, size: bytes.length }) }));
  }
  return { source: { id: result.id, fileName: file.name, kind: result.kind, size: result.size }, index: result.index };
}

export class MissingSourceError extends Error {}

const xmlCache = new Map<string, Promise<string>>();
/** 读取原件对应的 MusicXML 文本（MXL 已在服务端解压）；最近两份保留在内存中。 */
export function loadMusicXml(id: string): Promise<string> {
  let pending = xmlCache.get(id);
  if (!pending) {
    pending = (async () => {
      const page = await getPageConnection();
      const response = await page.fetch(`/api/sources/${id}/musicxml`);
      if (response.status === 404) throw new MissingSourceError("这份审校引用的乐谱原件不在本工作台中。");
      if (!response.ok) throw new Error("读取乐谱原件失败，请重试。");
      return response.text();
    })();
    pending.catch(() => xmlCache.delete(id));
    xmlCache.set(id, pending);
    while (xmlCache.size > 2) xmlCache.delete(xmlCache.keys().next().value!);
  }
  return pending;
}

export async function loadOriginal(id: string): Promise<Blob> {
  const page = await getPageConnection();
  const response = await page.fetch(`/api/sources/${id}/original`);
  if (!response.ok) throw new Error(response.status === 404 ? "原件不在本工作台中，请重新导入。" : "读取原文件失败。");
  return response.blob();
}
