/**
 * Ordinary photos (several MB) would push a manuscript past the 850 KB formal
 * save budget, so inserted pictures are re-encoded to a document-sized bitmap
 * before the native engine embeds them. Small PNG/JPEG/GIF files pass through.
 */
const KEEP_BYTES = 200_000;
const MAX_INPUT = 30 * 1024 * 1024;
const TARGET_BYTES = 280_000;
const ACCEPTED = /^image\/(png|jpeg|gif|webp|bmp)$/;

export type PreparedImage = { file: File; note: string };
const kb = (n: number) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.round(n / 1024) + " KB");

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.test(file.type)) throw Error("请选择 PNG、JPEG、GIF、WebP 或 BMP 图片。");
  if (file.size > MAX_INPUT) throw Error(`图片 ${kb(file.size)} 超过 30 MB，请先在相册中导出较小的副本。`);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw Error("无法读取这张图片，文件可能已损坏。");
  });
  try {
    const native = /^image\/(png|jpeg|gif)$/.test(file.type);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (native && file.size <= KEEP_BYTES && longEdge <= 2400) return { file, note: "" };
    for (const [edge, quality] of [
      [1600, 0.85],
      [1280, 0.78],
      [1024, 0.72],
    ] as const) {
      const scale = Math.min(1, edge / longEdge);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const g = canvas.getContext("2d")!;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw Error("图片压缩失败，请换一张图片。");
      if (blob.size <= TARGET_BYTES || edge === 1024) {
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return {
          file: new File([blob], name, { type: "image/jpeg" }),
          note: `图片已按文档尺寸压缩：${canvas.width}×${canvas.height}，${kb(file.size)} → ${kb(blob.size)}。`,
        };
      }
    }
    throw Error("图片压缩失败。");
  } finally {
    bitmap.close();
  }
}

/** Hand a prepared file to the engine's own insert-image input (keeps native sizing and undo). */
export function insertIntoEditor(file: File) {
  const input = document.querySelector<HTMLInputElement>(".native-host [data-testid=editor-insert-image-input]");
  if (!input) throw Error("编辑器尚未就绪，图片未插入。");
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Prepare and insert a picture; returns a note when it was re-encoded. */
export async function insertImageFile(file: File) {
  const prepared = await prepareImage(file);
  insertIntoEditor(prepared.file);
  return prepared.note;
}
