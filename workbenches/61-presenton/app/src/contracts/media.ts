// ABOUTME: 图片媒体的格式识别、尺寸读取与容量上限；浏览器上传前与服务端入库共用。

/** Largest stored image after browser-side downscaling (fits the 2 MB request limit as base64). */
export const MEDIA_MAX_BYTES = 1_400_000;
/** Largest original file accepted for decoding in the browser. */
export const MEDIA_INPUT_MAX_BYTES = 30 * 1024 * 1024;
/** Long edge after downscaling; enough for full-bleed 16:9 slides. */
export const MEDIA_MAX_EDGE = 2400;
export const MEDIA_MIME = ["image/png", "image/jpeg", "image/gif"] as const;
export type MediaMime = (typeof MEDIA_MIME)[number];

export interface MediaInfo {
  id: string;
  mime: MediaMime;
  width: number;
  height: number;
  bytes: number;
  name: string;
}
export interface MediaRecord extends MediaInfo {
  base64: string;
}

export function sniffImage(bytes: Uint8Array): { mime: MediaMime; width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a)
    return { mime: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return { mime: "image/gif", width: view.getUint16(6, true), height: view.getUint16(8, true) };
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
        offset += marker === 0xff ? 1 : 2;
        continue;
      }
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return { mime: "image/jpeg", height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      offset += 2 + length;
    }
  }
  return null;
}
