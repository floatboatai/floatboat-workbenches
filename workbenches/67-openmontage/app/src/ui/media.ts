import {
  CHUNK_BYTES,
  MAX_VIDEO_BYTES,
  videoSource,
  type VideoSource,
} from "../contracts/montage";
import { getPageConnection } from "./connection";
import { request } from "./requests";
export function base64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function unbase64(value: string) {
  if (value.length > Math.ceil(MAX_VIDEO_BYTES / 3) * 4)
    throw new Error("视频超过 20 MB。");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
export async function videoBytes(id: string) {
  const page = await getPageConnection();
  const response = await page.fetch("/api/media/" + id);
  if (!response.ok) throw new Error("视频原件无法读取，请重新上传。");
  return new Uint8Array(await response.arrayBuffer());
}
export async function upload(
  bytes: Uint8Array,
  source: VideoSource,
  onProgress: (n: number) => void,
) {
  for (let i = 0; i < Math.ceil(bytes.length / CHUNK_BYTES); i++) {
    await request(`/api/media/${source.id}/chunks/${i}`, {
      method: "PUT",
      body: JSON.stringify({
        base64: base64(bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES)),
      }),
    });
    onProgress(
      Math.round(((i + 1) / Math.ceil(bytes.length / CHUNK_BYTES)) * 100),
    );
  }
  return videoSource(
    await request("/api/media", {
      method: "POST",
      body: JSON.stringify(source),
    }),
  );
}
export async function sourceFor(
  file: File,
  bytes: Uint8Array,
): Promise<VideoSource> {
  if (bytes.length > MAX_VIDEO_BYTES) throw new Error("视频不能超过 20 MB。");
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return videoSource({
    id: Array.from(new Uint8Array(hash))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join(""),
    name: file.name,
    bytes: bytes.length,
    mime: "video/mp4",
  });
}
