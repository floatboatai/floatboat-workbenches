// ABOUTME: 读取「下载恢复稿」生成的工作副本文件，校验结构后作为新规格打开。
import { isRecord } from "../contracts/project";

export async function readWorkingCopy<T>(
  file: File,
  restore: (value: unknown) => T,
) {
  if (file.size > 12 * 1024 * 1024) throw new Error("恢复文件超过 12 MiB。");
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("恢复文件不是有效的 JSON。请选择「下载恢复稿」得到的文件。");
  }
  if (!isRecord(raw) || !isRecord(raw.snapshot))
    throw new Error("请选择「下载恢复稿」得到的工作副本文件。");
  const snapshot = raw.snapshot;
  if (
    typeof snapshot.title !== "string" ||
    snapshot.title.length > 120 ||
    !isRecord(snapshot.extra) ||
    new TextEncoder().encode(JSON.stringify(snapshot)).length > 1_940_000
  )
    throw new Error("工作副本的结构或容量无效。");
  let nodes = 0;
  const inspect = (value: unknown, depth = 0): void => {
    if (++nodes > 40_000 || depth > 24) throw new Error("工作副本结构过深。");
    if (Array.isArray(value)) for (const item of value) inspect(item, depth + 1);
    else if (isRecord(value))
      for (const [key, item] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new Error("工作副本包含无效属性。");
        inspect(item, depth + 1);
      }
  };
  inspect(snapshot.extra);
  return {
    title: snapshot.title.trim() || "恢复的接口规格",
    data: restore(snapshot.data),
    extra: snapshot.extra,
  };
}
