// ABOUTME: 模板中二进制内容（PDF底图、图片、数据表）的引用格式与容量边界，页面与服务端共用。

/** Persisted reference to a binary stored in the assets table, keyed by SHA-256. */
export const ASSET_PREFIX = "fbasset:";
export const ASSET_ID = /^[0-9a-f]{64}$/;
/** Upload chunk; base64 stays below the 2 MB runtime request ceiling. */
export const CHUNK = 1024 * 1024;
/** Real forms (scanned contracts, government forms) fit comfortably below this. */
export const MAX_PDF_BYTES = 40 * 1024 * 1024;
export const MAX_PDF_PAGES = 100;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DATASET_BYTES = 16 * 1024 * 1024;
/** Data URLs up to this length stay inline in the project; larger ones become asset references. */
export const INLINE_LIMIT = 96_000;

export const ASSET_TYPES = {
  "application/pdf": MAX_PDF_BYTES,
  "image/png": MAX_IMAGE_BYTES,
  "image/jpeg": MAX_IMAGE_BYTES,
  "text/csv": MAX_DATASET_BYTES,
  "application/json": MAX_DATASET_BYTES,
} as const;
export type AssetMime = keyof typeof ASSET_TYPES;
export const isAssetMime = (value: unknown): value is AssetMime =>
  typeof value === "string" && Object.hasOwn(ASSET_TYPES, value);

export const isAssetRef = (value: unknown): value is string =>
  typeof value === "string" &&
  value.startsWith(ASSET_PREFIX) &&
  ASSET_ID.test(value.slice(ASSET_PREFIX.length));
export const assetId = (ref: string) => ref.slice(ASSET_PREFIX.length);

const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/;
export function dataUrlMime(value: string): string | null {
  if (!value.startsWith("data:")) return null;
  const head = value.slice(0, 80);
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/.exec(head);
  return match ? match[1] : null;
}
/** Strict check used on persisted values: only known types, only base64, only short inline payloads. */
export function isInlineData(value: string, mimes: readonly string[], limit = INLINE_LIMIT): boolean {
  if (value.length > limit) return false;
  const match = DATA_URL.exec(value);
  return !!match && mimes.includes(match[1] === "image/jpg" ? "image/jpeg" : match[1]);
}
/** A binary slot is either inline data, an asset reference, or empty. */
export function isBlobValue(value: unknown, mimes: readonly string[], limit = INLINE_LIMIT): boolean {
  return typeof value === "string" && (value === "" || isAssetRef(value) || isInlineData(value, mimes, limit));
}

export const PDF_MIMES = ["application/pdf"] as const;
export const IMAGE_MIMES = ["image/png", "image/jpeg"] as const;
export const DATASET_MIMES = ["text/csv", "application/json"] as const;

/** Magic-byte check so a renamed file cannot pass as another type. */
export function sniffMatches(mime: AssetMime, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (mime === "application/pdf") {
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
    return head.includes("%PDF-");
  }
  if (mime === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mime === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
