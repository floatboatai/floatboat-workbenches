import { getPageConnection } from "./connection";
import { record } from "../contracts/boards";
export async function request(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  if (
    typeof options.body === "string" &&
    new TextEncoder().encode(options.body).length > 1_900_000
  )
    throw new Error("画布过大，请减少或压缩图片后保存。");
  const page = await getPageConnection();
  const response = await page.fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = record(data) && record(data.error) ? data.error : null;
    throw new Error(
      error && typeof error.message === "string"
        ? error.message
        : "请求失败，请重试。",
    );
  }
  return data;
}
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
