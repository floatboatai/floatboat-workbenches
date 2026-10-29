// ABOUTME: 读取“下载恢复稿”生成的工作副本 JSON，校验结构后作为新图形导入。
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
    throw new Error("恢复稿不是有效的 JSON 文件。");
  }
  if (!isRecord(raw) || !isRecord(raw.snapshot))
    throw new Error("请选择由“下载恢复稿”保存的 JSON 文件。");
  const s = raw.snapshot;
  if (
    typeof s.title !== "string" ||
    s.title.length > 120 ||
    !isRecord(s.extra) ||
    new TextEncoder().encode(JSON.stringify(s)).length > 1940000
  )
    throw new Error("恢复稿结构或容量无效。");
  let nodes = 0;
  const inspect = (v: unknown, depth = 0): void => {
    if (++nodes > 40000 || depth > 24) throw new Error("恢复稿结构过深。");
    if (Array.isArray(v)) for (const x of v) inspect(x, depth + 1);
    else if (isRecord(v))
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k))
          throw new Error("恢复稿属性无效。");
        inspect(x, depth + 1);
      }
  };
  inspect(s);
  return {
    title: s.title.trim() || "恢复的图形",
    data: restore(s.data),
    extra: s.extra,
  };
}
