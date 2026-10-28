import { isRecord, boundedText } from "./project.ts";
import { restoreDraftData } from "./research.ts";
export function decodeProjectImport(raw: unknown) {
  if (!isRecord(raw)) return null;
  const recovered = isRecord(raw.snapshot);
  const snapshot = recovered ? (raw.snapshot as Record<string, unknown>) : raw;
  if (!isRecord(snapshot.data)) {
    if (recovered) throw new Error("恢复文件缺少工作稿数据");
    return null;
  }
  const data = restoreDraftData(snapshot.data);
  const title = boundedText(snapshot.title ?? "导入的项目", 120);
  if (snapshot.extra !== undefined && !isRecord(snapshot.extra))
    throw new Error("工作稿附加数据格式无效");
  const extra: Record<string, unknown> = isRecord(snapshot.extra)
    ? { ...snapshot.extra }
    : {};
  const history: Record<string, unknown> = {
    recovered,
    importedAt: new Date().toISOString(),
  };
  let archived = false;
  for (const key of ["pendingQuery"] as string[]) {
    if (Object.hasOwn(extra, key)) {
      history[key] = extra[key];
      delete extra[key];
      archived = true;
    }
  }
  if (recovered && isRecord(raw.pending)) {
    history.autosave = {
      documentId: raw.pending.documentId,
      projectId: raw.pending.projectId,
      mutationId: raw.pending.mutationId,
    };
    archived = true;
  }
  if (recovered || archived) {
    const prior = extra.importHistory;
    extra.importHistory = Array.isArray(prior)
      ? [...prior, history]
      : prior === undefined
        ? [history]
        : [{ previousHistory: prior }, history];
  }
  if (
    new TextEncoder().encode(JSON.stringify({ title, data, extra })).length >
    1800000
  )
    throw new Error("完整工作稿超过1.8MB，请先在原项目导出分拆内容");
  return { data, title, extra, recovered, archived };
}
