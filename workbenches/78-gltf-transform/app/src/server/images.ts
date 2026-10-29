import { ImageUtils } from "@gltf-transform/core";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { MAX_IMAGE, type ImageMime } from "../contracts/asset.ts";

export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

/** Validates an uploaded replacement texture and reports its pixel size. */
export function imageInfo(bytes: Uint8Array) {
  if (bytes.length > MAX_IMAGE) throw Error("贴图超过 32 MB。");
  const mime = sniffImage(bytes);
  if (!mime) throw Error("替换贴图需为 PNG、JPEG 或 WebP。");
  const size = ImageUtils.getSize(bytes, mime);
  if (!size || size[0] < 1 || size[1] < 1 || size[0] > 16384 || size[1] > 16384)
    throw Error("贴图尺寸无法读取或超过 16384px。");
  return { mime, width: size[0], height: size[1] };
}

interface Pixels {
  width: number;
  height: number;
  data: Uint8Array;
}
function decode(bytes: Uint8Array, mime: string): Pixels {
  if (mime === "image/png") {
    const png = PNG.sync.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  }
  const img = jpeg.decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: 280,
    maxMemoryUsageInMB: 2048,
  });
  return { width: img.width, height: img.height, data: img.data };
}
/** Area-average downscale; exact for integer factors, smooth for others. */
export function downscale(src: Pixels, width: number, height: number): Pixels {
  const out = new Uint8Array(width * height * 4),
    sx = src.width / width,
    sy = src.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = y * sy,
      y1 = y0 + sy;
    for (let x = 0; x < width; x++) {
      const x0 = x * sx,
        x1 = x0 + sx;
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        w = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        if (wy <= 0) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0);
          if (wx <= 0) continue;
          const k = wx * wy,
            i = (yy * src.width + xx) * 4;
          r += src.data[i] * k;
          g += src.data[i + 1] * k;
          b += src.data[i + 2] * k;
          a += src.data[i + 3] * k;
          w += k;
        }
      }
      const o = (y * width + x) * 4;
      out[o] = Math.round(r / w);
      out[o + 1] = Math.round(g / w);
      out[o + 2] = Math.round(b / w);
      out[o + 3] = Math.round(a / w);
    }
  }
  return { width, height, data: out };
}
function encode(p: Pixels, mime: string): Uint8Array {
  if (mime === "image/png") {
    const png = new PNG({ width: p.width, height: p.height });
    Buffer.from(p.data.buffer, p.data.byteOffset, p.data.byteLength).copy(png.data);
    return new Uint8Array(PNG.sync.write(png, { colorType: 6 }));
  }
  return new Uint8Array(
    jpeg.encode({ width: p.width, height: p.height, data: p.data }, 90).data,
  );
}
/** Returns resized bytes, or null when the image already fits or the format is not decodable here. */
export function resizeImage(bytes: Uint8Array, mime: string, maxSide: number) {
  if (mime !== "image/png" && mime !== "image/jpeg") return null;
  const size = ImageUtils.getSize(bytes, mime);
  if (!size || Math.max(size[0], size[1]) <= maxSide) return null;
  const scale = maxSide / Math.max(size[0], size[1]),
    width = Math.max(1, Math.round(size[0] * scale)),
    height = Math.max(1, Math.round(size[1] * scale));
  const pixels = decode(bytes, mime);
  return {
    bytes: encode(downscale(pixels, width, height), mime),
    width,
    height,
  };
}
/** Encoders for the generated demo asset. */
export function encodePng(width: number, height: number, data: Uint8Array) {
  return encode({ width, height, data }, "image/png");
}
export function encodeJpeg(width: number, height: number, data: Uint8Array) {
  return encode({ width, height, data }, "image/jpeg");
}
