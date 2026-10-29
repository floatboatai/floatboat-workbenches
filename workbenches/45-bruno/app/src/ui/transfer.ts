// Collection import/export in Bruno's native folder layout.
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { restoreCollection, validateCollection, type Collection } from "../contracts/bruno.ts";
import { isRecord } from "../contracts/project.ts";
import { environments } from "./model.ts";

export interface Entry {
  path: string;
  text: string;
}
const isBru = (path: string) =>
  (/\.bru$/i.test(path) || /(^|\/)bruno\.json$/.test(path)) && !/(^|\/)(node_modules|\.git)\//.test(path);

export async function readEntries(picked: File[]): Promise<{ entries: Entry[]; rootName: string }> {
  const entries: Entry[] = [];
  let rootName = "";
  for (const f of picked) {
    if (/\.zip$/i.test(f.name)) {
      const unzipped = unzipSync(new Uint8Array(await f.arrayBuffer()));
      rootName ||= f.name.replace(/\.zip$/i, "");
      for (const [path, bytes] of Object.entries(unzipped))
        if (!path.endsWith("/")) entries.push({ path, text: isBru(path) ? strFromU8(bytes) : "" });
    } else {
      const rel = f.webkitRelativePath;
      if (rel) rootName ||= rel.split("/")[0];
      const path = rel ? rel.split("/").slice(1).join("/") : f.name;
      entries.push({ path, text: isBru(path) ? await f.text() : "" });
    }
  }
  return { entries, rootName };
}

export function buildCollection(
  entries: Entry[],
  rootName: string,
): { data: Collection; title: string; skipped: number; invalid: string } {
  let usable = entries.filter((e) => isBru(e.path));
  const top = usable[0]?.path.split("/")[0];
  if (top && usable.every((e) => e.path.startsWith(top + "/")) && usable.some((e) => e.path === top + "/bruno.json")) {
    rootName = top;
    usable = usable.map((e) => ({ ...e, path: e.path.slice(top.length + 1) }));
  }
  if (!usable.length) throw new Error("没有找到 .bru 或 bruno.json 文件。");
  const files = usable.map((e) => ({
    id: crypto.randomUUID(),
    path: e.path.replace(/^\.\//, ""),
    source: e.text.replace(/\r\n/g, "\n"),
  }));
  let title = rootName || "导入集合";
  const config = files.find((f) => f.path === "bruno.json");
  if (config)
    try {
      const c: unknown = JSON.parse(config.source);
      if (isRecord(c) && typeof c.name === "string" && c.name.trim()) title = c.name.trim().slice(0, 120);
    } catch {
      /* keep folder name */
    }
  const firstEnv = environments(files)[0]?.name;
  const data = restoreCollection({ files, results: [], notes: "", ...(firstEnv ? { activeEnvironment: firstEnv } : {}) });
  let invalid = "";
  try {
    validateCollection(data);
  } catch (e) {
    invalid = e instanceof Error ? e.message : "集合无效";
  }
  return { data, title, skipped: entries.length - usable.length, invalid };
}

export function zipCollection(data: Collection, title: string): Blob {
  validateCollection(data);
  const entries: Record<string, Uint8Array> = {};
  for (const f of data.files) entries[f.path] = strToU8(f.source);
  if (!entries["bruno.json"])
    entries["bruno.json"] = strToU8(
      JSON.stringify({ version: "1", name: title, type: "collection", ignore: ["node_modules", ".git"] }, null, 2) + "\n",
    );
  return new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>], { type: "application/zip" });
}

export const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "collection";
