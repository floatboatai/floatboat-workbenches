// ABOUTME: 0.3.x 项目（原件 base64 内嵌在项目中）在启动时迁入原件库并改写为 0.9 结构；只处理一次，失败的条目保持原样。
import type { DatabaseSync } from "node:sqlite";
import { isRecord } from "../contracts/project.ts";
import { defaultView, newProject, validateScore, type Annotation, type ScoreProject } from "../contracts/domain.ts";
import type { SourceStore } from "./sources.ts";

const isLegacy = (value: unknown): value is Record<string, unknown> & { source: Record<string, unknown> } =>
  isRecord(value) && isRecord(value.source) && typeof value.source.originalBase64 === "string";

/** 把一个旧项目转换为新结构；原件写入原件库（按内容去重）。 */
export async function upgradeLegacy(value: unknown, sources: SourceStore, at: string): Promise<ScoreProject> {
  if (!isLegacy(value)) throw new Error("不是旧版项目。");
  const fileName = typeof value.source.fileName === "string" ? value.source.fileName : "score.musicxml";
  const bytes = new Uint8Array(Buffer.from(String(value.source.originalBase64), "base64"));
  const stored = await sources.insert(bytes, fileName);
  const project = newProject({ id: stored.id, fileName, kind: stored.kind, size: stored.size }, stored.index);
  const parts = stored.index.parts.map((part) => part.id);
  const partId = typeof value.partId === "string" ? value.partId : "";
  project.view = {
    ...defaultView(),
    hiddenParts: partId && parts.includes(partId) ? parts.filter((id) => id !== partId) : [],
    layout: value.layout === "continuous" ? "endless" : "page",
    zoom: typeof value.zoom === "number" ? value.zoom : 0.85,
  };
  if (Array.isArray(value.annotations))
    project.annotations = value.annotations.filter(isRecord).map(
      (item): Annotation => ({
        id: String(item.id),
        partId: String(item.partId),
        measureIndex: Number(item.measureIndex),
        beat: null,
        kind: "other",
        text: typeof item.text === "string" ? item.text : "",
        resolved: item.resolved === true,
        createdAt: at,
      }),
    );
  if (isRecord(value.focus)) project.focus = { partId: String(value.focus.partId), measureIndex: Number(value.focus.measureIndex), beat: null };
  return project;
}

export async function upgradeLegacyRows(db: DatabaseSync, sources: SourceStore): Promise<{ projects: number; drafts: number }> {
  let projects = 0,
    drafts = 0;
  for (const row of db.prepare("SELECT id,payload,updated_at FROM projects").all()) {
    try {
      const payload: unknown = JSON.parse(String(row.payload));
      if (!isLegacy(payload)) continue;
      const next = validateScore(await upgradeLegacy(payload, sources, String(row.updated_at)));
      db.prepare("UPDATE projects SET payload=?,revision=revision+1 WHERE id=?").run(JSON.stringify(next), String(row.id));
      projects++;
    } catch (error) {
      console.warn(`旧项目 ${String(row.id)} 未能迁移：${error instanceof Error ? error.message : error}`);
    }
  }
  // 自动保存草稿：只改写快照里的数据；对应项目的版本号随上面的改写增加，旧窗口重放时会得到冲突而不是覆盖。
  for (const row of db.prepare("SELECT id,snapshot,receipt,project_id,updated_at FROM autosave_drafts").all()) {
    try {
      const snapshot: unknown = JSON.parse(String(row.snapshot));
      if (!isRecord(snapshot) || !isLegacy(snapshot.data)) continue;
      const data = await upgradeLegacy(snapshot.data, sources, String(row.updated_at));
      const current = row.project_id ? db.prepare("SELECT revision,payload FROM projects WHERE id=?").get(String(row.project_id)) : undefined;
      const receipt: unknown = JSON.parse(String(row.receipt));
      if (isRecord(receipt) && isRecord(receipt.project) && current) {
        receipt.project.data = JSON.parse(String(current.payload));
        receipt.project.revision = Number(current.revision);
      }
      db.prepare("UPDATE autosave_drafts SET snapshot=?,receipt=?,project_revision=COALESCE(?,project_revision) WHERE id=?").run(
        JSON.stringify({ ...snapshot, data }),
        JSON.stringify(receipt),
        current ? Number(current.revision) : null,
        String(row.id),
      );
      drafts++;
    } catch (error) {
      console.warn(`旧草稿 ${String(row.id)} 未能迁移：${error instanceof Error ? error.message : error}`);
    }
  }
  return { projects, drafts };
}
