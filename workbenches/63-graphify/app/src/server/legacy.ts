// ABOUTME: 启动时把 0.5 版内嵌图谱的项目与草稿迁移为内容地址引用；原文与图谱写入内容库。

import type { DatabaseSync } from "node:sqlite";
import { decodeProjectImport } from "../contracts/import-project.ts";
import { isLegacyProject, graphText } from "../contracts/map.ts";
import { isRecord } from "../contracts/project.ts";
import type { BlobStore } from "./blobs.ts";

function convert(blobs: BlobStore, data: unknown, title: string) {
  const imported = decodeProjectImport({ title, data }, title);
  if (imported.graph) blobs.put("graph", graphText(imported.graph));
  for (const [, text] of imported.sources) blobs.put("source", text);
  return imported.data;
}

export function migrateLegacy(db: DatabaseSync, blobs: BlobStore) {
  let migrated = 0;
  const projects = db.prepare("SELECT id,title,payload FROM projects").all();
  for (const row of projects) {
    try {
      const payload: unknown = JSON.parse(String(row.payload));
      if (!isLegacyProject(payload)) continue;
      const data = convert(blobs, payload, String(row.title));
      db.prepare("UPDATE projects SET payload=? WHERE id=?").run(JSON.stringify(data), String(row.id));
      migrated++;
    } catch {
      /* 无法迁移的旧行保持原样，打开时会提示格式无效 */
    }
  }
  const drafts = db.prepare("SELECT id,snapshot,receipt FROM autosave_drafts").all();
  for (const row of drafts) {
    try {
      const snapshot: unknown = JSON.parse(String(row.snapshot));
      const receipt: unknown = JSON.parse(String(row.receipt));
      let changed = false;
      if (isRecord(snapshot) && isLegacyProject(snapshot.data)) {
        snapshot.data = convert(blobs, snapshot.data, String(snapshot.title ?? "旧版知识地图"));
        changed = true;
      }
      if (isRecord(receipt) && isRecord(receipt.project) && isLegacyProject(receipt.project.data)) {
        receipt.project.data = convert(blobs, receipt.project.data, String(receipt.project.title ?? "旧版知识地图"));
        changed = true;
      }
      if (changed) {
        db.prepare("UPDATE autosave_drafts SET snapshot=?,receipt=? WHERE id=?").run(JSON.stringify(snapshot), JSON.stringify(receipt), String(row.id));
        migrated++;
      }
    } catch {
      /* 保留原草稿 */
    }
  }
  return migrated;
}
