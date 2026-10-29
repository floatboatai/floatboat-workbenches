// ABOUTME: 把用户选择、粘贴或拖入的图片转成文稿自带的 data URL：限制原图大小，缩放到长边 1600 px 并重新编码（同时去掉 EXIF 等元数据）。

export const MAX_IMAGE_INPUT = 25 * 1024 * 1024;
/** 压缩后单张图片 data URL 的目标上限，保证一篇文稿能容纳多张配图。 */
export const IMAGE_TARGET = 480_000;

export interface OwnedImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const KEEP_ORIGINAL = new Set(["image/png", "image/gif"]);

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("无法读取图片文件。"));
    reader.readAsDataURL(file);
  });
}

export function altFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  // 相机/截屏的自动文件名不是有效的替代文字，留空提示用户补写。
  if (!base || /^(img|dsc|dscn|pxl|photo|image|screenshot|screen shot|截屏|屏幕快照|微信图片)[\s\d._-]*/i.test(base))
    return "";
  return base.slice(0, 200);
}

function encode(bitmap: ImageBitmap, edge: number, quality: number): string {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法处理图片。");
  context.drawImage(bitmap, 0, 0, width, height);
  const webp = canvas.toDataURL("image/webp", quality);
  if (webp.startsWith("data:image/webp")) return webp;
  // 不支持 WebP 编码的浏览器改用 JPEG；先铺白底，避免透明区域变黑。
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function prepareImage(file: File): Promise<OwnedImage> {
  if (!file.type.startsWith("image/"))
    throw new Error(`「${file.name}」不是图片文件。`);
  if (file.type === "image/svg+xml")
    throw new Error("暂不支持插入 SVG 矢量图，请先导出为 PNG 或 JPEG。");
  if (file.size > MAX_IMAGE_INPUT)
    throw new Error(`图片超过 ${MAX_IMAGE_INPUT / 1024 / 1024} MB，请先缩小后再插入。`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`无法解码「${file.name}」，文件可能已损坏或格式不受浏览器支持。`);
  }
  try {
    const alt = altFromFileName(file.name);
    const { width, height } = bitmap;
    if (
      KEEP_ORIGINAL.has(file.type) &&
      Math.max(width, height) <= 1600 &&
      file.size * 1.37 + 40 <= IMAGE_TARGET
    ) {
      const src = await readAsDataUrl(file);
      if (src.startsWith(`data:${file.type};base64,`)) return { src, alt, width, height };
    }
    for (const [edge, quality] of [
      [1600, 0.86],
      [1600, 0.74],
      [1280, 0.72],
      [960, 0.7],
    ] as const) {
      const src = encode(bitmap, edge, quality);
      if (src.length <= IMAGE_TARGET) {
        const scale = Math.min(1, edge / Math.max(width, height));
        return { src, alt, width: Math.round(width * scale), height: Math.round(height * scale) };
      }
    }
    throw new Error("图片压缩后仍然过大，请裁剪后再插入。");
  } finally {
    bitmap.close();
  }
}
