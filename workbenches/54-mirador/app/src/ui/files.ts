import {
  MAX_IMAGE_BYTES,
  isAsset,
  validateCollection,
  type Collection,
} from "../contracts/folio";
import { isRecord, titleValue } from "../contracts/project";
import { request } from "./workspace";
interface ImagePayload {
  id: string;
  name: string;
  base64: string;
}
export async function uploadScans(
  files: File[],
  existing: number,
): Promise<Collection["pages"]> {
  if (existing + files.length > 20) throw new Error("每个项目最多 20 页。");
  const payloads = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES)
      throw new Error("每张图像最大 1 MiB，请先调整文件大小。");
    const base64 = await asBase64(file);
    await verifyImage(base64);
    payloads.push({ name: file.name.slice(0, 120), base64 });
  }
  const pages: Collection["pages"] = [];
  for (const payload of payloads) {
    const result = await request("/api/images", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!isAsset(result)) throw new Error("图像保存响应无效。");
    pages.push({
      id: crypto.randomUUID(),
      assetId: result.id,
      label: payload.name,
    });
  }
  return pages;
}
export async function projectBundle(data: Collection, title: string) {
  const clean = validateCollection(data),
    name = titleValue(title);
  const images: unknown[] = [];
  for (const id of new Set(clean.pages.map((p) => p.assetId))) {
    const result = await request("/api/images/" + id + "/export");
    if (
      !isRecord(result) ||
      result.id !== id ||
      typeof result.name !== "string" ||
      (result.sample !== true && typeof result.base64 !== "string")
    )
      throw new Error("原图导出响应无效。");
    images.push(result);
  }
  return {
    format: "folio-review",
    version: 1,
    title: name,
    data: clean,
    images,
  };
}
export async function readBundle(file: File) {
  if (file.size > 30000000) throw new Error("项目包不能超过 30 MB。");
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("项目 JSON 无法解析，请检查文件内容。");
  }
  if (
    !isRecord(value) ||
    value.format !== "folio-review" ||
    value.version !== 1 ||
    !Array.isArray(value.images)
  )
    throw new Error("请选择完整的馆藏对照项目包。");
  const title = titleValue(value.title),
    data = validateCollection(value.data),
    required = new Set(data.pages.map((p) => p.assetId));
  if (value.images.length !== required.size)
    throw new Error("项目包缺少或包含多余图像。");
  const images: ImagePayload[] = [];
  for (const image of value.images) {
    if (
      !isRecord(image) ||
      typeof image.id !== "string" ||
      !required.delete(image.id) ||
      typeof image.name !== "string"
    )
      throw new Error("项目包图像清单无效。");
    if (image.id.startsWith("demo-") && image.sample === true) continue;
    if (typeof image.base64 !== "string" || image.base64.length > 1400000)
      throw new Error("项目包图像过大或格式无效。");
    await verifyImage(image.base64);
    images.push({ id: image.id, name: image.name, base64: image.base64 });
  }
  if (required.size) throw new Error("项目包原图不完整。");
  return { title, data, images };
}
export async function storeBundleImages(images: ImagePayload[]) {
  for (const image of images)
    await request("/api/images", {
      method: "POST",
      body: JSON.stringify({ ...image, expectedId: image.id }),
    });
}
function asBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result.split(",")[1])
        : reject(new Error("文件读取失败。"));
    reader.onerror = () => reject(new Error("文件读取失败。"));
    reader.readAsDataURL(file);
  });
}
async function verifyImage(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (x) => x.charCodeAt(0));
  if (
    bytes.length > MAX_IMAGE_BYTES ||
    !(
      (bytes[0] === 137 && bytes[1] === 80) ||
      (bytes[0] === 255 && bytes[1] === 216)
    )
  )
    throw new Error("只支持 PNG/JPEG 图像。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes]));
  } catch {
    throw new Error("图像无法解码，请使用完整的 PNG/JPEG 文件。");
  }
  try {
    if (
      bitmap.width > 10000 ||
      bitmap.height > 10000 ||
      bitmap.width * bitmap.height > 30000000
    )
      throw new Error("图像尺寸超出限制。");
  } finally {
    bitmap.close();
  }
}
