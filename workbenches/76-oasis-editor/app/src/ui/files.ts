import { unzipSync, strFromU8 } from "fflate";
import { isRecord } from "../contracts/project";
import type { Source } from "../contracts/document";
import { request } from "./requests";
export function base64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768)
    s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}
export function fromBase64(s: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length > 1600000)
    throw Error("原件编码无效。");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export async function storeOriginal(
  bytes: Uint8Array,
  name: string,
  warnings: string[],
): Promise<Source> {
  const r = await request("/api/originals", {
    method: "POST",
    body: JSON.stringify({ base64: base64(bytes) }),
  });
  if (!isRecord(r) || typeof r.hash !== "string" || typeof r.bytes !== "number")
    throw Error("原件保存回执无效。");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (r.hash !== hash || r.bytes !== bytes.length)
    throw Error("原件保存校验失败。");
  return { hash, name: name.slice(0, 240), bytes: r.bytes, warnings };
}
export async function loadOriginal(hash: string) {
  const r = await request("/api/originals/" + hash);
  if (!isRecord(r) || typeof r.base64 !== "string") throw Error("原件不可读。");
  return r.base64;
}
export function preflight(bytes: Uint8Array) {
  if (bytes.length > 1200000)
    throw Error("DOCX原件限1.2MB。请精简图片后导入，原文件不受影响。");
  let total = 0,
    count = 0;
  const zip = unzipSync(bytes, {
    filter: (file) => {
      total += file.originalSize;
      if (++count > 200 || total > 8000000 || file.originalSize > 4000000)
        throw Error("DOCX展开后超出8MB/200部件安全容量。");
      return true;
    },
  });
  if (!zip["word/document.xml"] || !zip["[Content_Types].xml"])
    throw Error("不是受支持的Word DOCX文件。");
  if (
    Object.keys(zip).some((p) =>
      /vbaproject|embeddings\/|charts\/|activeX\//i.test(p),
    )
  )
    throw Error(
      "含宏、嵌入对象或图表的DOCX尚不支持编辑。请保留原文件并另存简化副本。",
    );
  const xml = strFromU8(zip["word/document.xml"]);
  const imageCount = (xml.match(/<a:blip\b/g) || []).length;
  const warnings = [
    "本地校样统一使用 Workbench Sans SC。原字体名称与原始OOXML保留；Word中的换行、分页可能不同。",
  ];
  if (/<(?:w:altChunk|w:sdt|w:object|w:pict|mc:AlternateContent)\b/.test(xml))
    warnings.push(
      "此文档含扩展内容；原始部件保留，但画布可能不显示全部内容，请对照原件校样。",
    );
  return {
    warnings,
    imageCount,
    tableCount: (xml.match(/<w:tbl\b/g) || []).length,
  };
}
export function imageCount(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((n, x) => n + imageCount(x), 0);
  if (!isRecord(value)) return 0;
  return (
    (value.kind === "image" ? 1 : 0) +
    Object.entries(value)
      .filter(([k]) => k !== "sourcePackage")
      .reduce((n, [, x]) => n + imageCount(x), 0)
  );
}

export function tableCount(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((n, x) => n + tableCount(x), 0);
  if (!isRecord(value)) return 0;
  return (
    (value.type === "table" ? 1 : 0) +
    Object.entries(value)
      .filter(([k]) => k !== "sourcePackage")
      .reduce((n, [, x]) => n + tableCount(x), 0)
  );
}
