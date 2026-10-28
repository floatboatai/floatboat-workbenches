import { getPageConnection } from "./connection";
import { request } from "./requests";
import { refValue, type ModelRef } from "../contracts/model.ts";
import { base64 } from "./native";
import { isRecord } from "../contracts/project";
export async function readBytes(url: string) {
  const page = await getPageConnection(),
    r = await page.fetch(url);
  if (!r.ok) {
    let value: unknown;
    try {
      value = await r.json();
    } catch {}
    throw Error(
      isRecord(value) &&
        isRecord(value.error) &&
        typeof value.error.message === "string"
        ? value.error.message
        : "模型资源读取失败。",
    );
  }
  return new Uint8Array(await r.arrayBuffer());
}
export async function upload(
  bytes: Uint8Array,
  name: string,
  kind: ModelRef["kind"],
) {
  return refValue(
    await request("/api/originals", {
      method: "POST",
      body: JSON.stringify({ name, kind, base64: base64(bytes) }),
    }),
  );
}
export function readSource(ref: ModelRef) {
  return readBytes("/api/originals/" + ref.id);
}
export async function sha256(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
