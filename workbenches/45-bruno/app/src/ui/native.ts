import { request } from "./requests";
import { isRecord } from "../contracts/project";

/** Native Bru conversion endpoints report invalid input as {ok:false,message} (HTTP 200), not as transport errors. */
export async function bru(path: string, body: unknown): Promise<unknown> {
  const value = await request(path, { method: "POST", body: JSON.stringify(body) });
  if (isRecord(value) && value.ok === false)
    throw new Error(typeof value.message === "string" ? value.message : "解析失败。");
  return value;
}
