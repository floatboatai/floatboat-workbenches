import { getPageConnection } from "./connection";
import { isRecord } from "../contracts/project";
export async function request(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  if (
    typeof options.body === "string" &&
    new TextEncoder().encode(options.body).length > 1950000
  )
    throw Object.assign(new Error("请求超过容量，请先导出并减少内容。"), {
      status: 413,
    });
  const page = await getPageConnection();
  const response = await page.fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const value: unknown = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        isRecord(value) &&
        isRecord(value.error) &&
        typeof value.error.message === "string"
          ? value.error.message
          : "请求失败，请重试。",
      ),
      { status: response.status },
    );
  return value;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
