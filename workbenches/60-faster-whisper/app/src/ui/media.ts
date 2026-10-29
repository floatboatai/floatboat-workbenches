import {
  CHUNK_BYTES,
  MAX_AUDIO_BYTES,
  audioSource,
  sniffAudio,
  type AudioSource,
} from "../contracts/transcript";
import { getPageConnection } from "./connection";
import { request } from "./requests";
export function base64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function unbase64(value: string) {
  if (value.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4)
    throw new Error("音频超过 200 MB。");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
export async function audioBytes(id: string) {
  const page = await getPageConnection();
  const response = await page.fetch("/api/audio/" + id);
  if (!response.ok) throw new Error("音频原件无法读取，请重新上传。");
  return new Uint8Array(await response.arrayBuffer());
}
export async function upload(
  bytes: Uint8Array,
  source: AudioSource,
  onProgress: (n: number) => void,
) {
  for (let i = 0; i < Math.ceil(bytes.length / CHUNK_BYTES); i++) {
    await request(`/api/audio/${source.id}/chunks/${i}`, {
      method: "PUT",
      body: JSON.stringify({
        base64: base64(bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES)),
      }),
    });
    onProgress(
      Math.round(((i + 1) / Math.ceil(bytes.length / CHUNK_BYTES)) * 100),
    );
  }
  return audioSource(
    await request("/api/audio", {
      method: "POST",
      body: JSON.stringify(source),
    }),
  );
}
export async function sourceFor(
  file: File,
  bytes: Uint8Array,
): Promise<AudioSource> {
  if (bytes.length > MAX_AUDIO_BYTES) throw new Error("音频不能超过 200 MB。");
  const mime = sniffAudio(bytes);
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return audioSource({
    id: Array.from(new Uint8Array(hash))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join(""),
    name: file.name.slice(0, 180),
    bytes: bytes.length,
    mime,
  });
}
