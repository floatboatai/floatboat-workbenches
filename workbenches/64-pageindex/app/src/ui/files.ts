import { getPageConnection } from "./connection.ts";
import { request } from "./requests.ts";
import { CHUNK, MAX_PDF, indexValue } from "../contracts/reader.ts";
export async function blobRequest(path: string): Promise<Blob> {
  const page = await getPageConnection(),
    response = await page.fetch(path);
  if (!response.ok) throw new Error("原文件或页面暂时不可用，请检查解析服务。");
  return response.blob();
}
export function toBase64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function fromBase64(text: string) {
  if (text.length > Math.ceil(MAX_PDF / 3) * 4)
    throw new Error("PDF超过8MiB。");
  const raw = atob(text),
    bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  if (toBase64(bytes) !== text) throw new Error("PDF编码无效。");
  return bytes;
}
export async function uploadPdf(
  bytes: Uint8Array,
  name: string,
  progress: (text: string) => void,
) {
  if (!bytes.length || bytes.length > MAX_PDF)
    throw new Error("请选择8MiB以内的PDF。");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  for (let i = 0; i < Math.ceil(bytes.length / CHUNK); i++) {
    progress(
      `正在上传 ${Math.round((Math.min(bytes.length, (i + 1) * CHUNK) / bytes.length) * 100)}%…`,
    );
    await request(`/api/documents/${hash}/chunks/${i}`, {
      method: "POST",
      body: JSON.stringify({
        data: toBase64(bytes.subarray(i * CHUNK, (i + 1) * CHUNK)),
      }),
    });
  }
  progress("正在提取章节与原页文字…");
  return indexValue(
    await request(`/api/documents/${hash}/finish`, {
      method: "POST",
      body: JSON.stringify({ bytes: bytes.length, name }),
    }),
  );
}
