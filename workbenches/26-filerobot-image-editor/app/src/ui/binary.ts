import { getPageConnection } from "./connection";
import { dimensions, type Source } from "../contracts/editor";
export async function checkedBlob(
  path: string,
  source?: Source,
): Promise<Blob> {
  const page = await getPageConnection(),
    response = await page.fetch(path);
  if (!response.ok)
    throw new Error(
      "原图读取失败（" + response.status + "），请重新打开工程后重试。",
    );
  const blob = await response.blob();
  if (source) {
    const bytes = await blob.arrayBuffer(),
      hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (x) => x.toString(16).padStart(2, "0"),
      ).join("");
    if (hash !== source.id || bytes.byteLength !== source.bytes)
      throw new Error("原图校验失败，工程未导出。");
  }
  return blob;
}

export async function verifyDecodedImage(blob: Blob): Promise<void> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("图片无法解码，请使用完整的 PNG 或 JPEG 文件。");
  }
  try {
    dimensions(bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}
