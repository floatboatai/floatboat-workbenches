// ABOUTME: 读取用户选择的文件或拖入的文件夹：先按路径排除依赖/构建目录，再读文本并排除二进制内容。

import { classifyPath, contentProblem, isIgnoredDirectory, LIMITS, normalizePath, type SkippedFile } from "../contracts/corpus.ts";

export type Picked = { path: string; text: string };
export type Selection = { files: Picked[]; skipped: SkippedFile[] };

type Entry = { file: File; path: string };

function stripCommonRoot(entries: Entry[]) {
  // 选择单个文件夹时去掉最外层目录名，让路径与仓库内一致
  const first = entries[0]?.path.split("/") ?? [];
  if (first.length < 2) return entries;
  const root = first[0];
  if (!entries.every((e) => e.path.startsWith(root + "/"))) return entries;
  return entries.map((e) => ({ ...e, path: e.path.slice(root.length + 1) }));
}

async function readEntries(entries: Entry[], onProgress?: (n: number, total: number) => void): Promise<Selection> {
  const files: Picked[] = [];
  const skipped: SkippedFile[] = [];
  let total = 0;
  const list = stripCommonRoot(entries);
  for (let i = 0; i < list.length; i++) {
    const { file } = list[i];
    let path: string;
    try {
      path = normalizePath(list[i].path);
    } catch (e) {
      skipped.push({ path: list[i].path.slice(0, 200), reason: e instanceof Error ? e.message : "路径无效" });
      continue;
    }
    const c = classifyPath(path);
    if ("skip" in c) {
      skipped.push({ path, reason: c.skip });
      continue;
    }
    if (file.size > LIMITS.fileBytes) {
      skipped.push({ path, reason: `超过 ${LIMITS.fileBytes / 1048576} MB` });
      continue;
    }
    if (files.length >= LIMITS.files) {
      skipped.push({ path, reason: `超过 ${LIMITS.files} 个文件` });
      continue;
    }
    if (total + file.size > LIMITS.totalBytes) {
      skipped.push({ path, reason: `资料总量超过 ${LIMITS.totalBytes / 1048576} MB` });
      continue;
    }
    const text = await file.text();
    const problem = contentProblem(text);
    if (problem) {
      skipped.push({ path, reason: problem });
      continue;
    }
    total += file.size;
    files.push({ path, text });
    if (i % 25 === 0) onProgress?.(i + 1, list.length);
  }
  return { files, skipped };
}

export function readFileList(list: FileList, onProgress?: (n: number, total: number) => void) {
  const entries: Entry[] = Array.from(list).map((file) => ({ file, path: file.webkitRelativePath || file.name }));
  return readEntries(entries, onProgress);
}

type FsEntry = { isFile: boolean; isDirectory: boolean; name: string; fullPath: string };
type FsFileEntry = FsEntry & { file: (ok: (f: File) => void, fail: (e: unknown) => void) => void };
type FsDirEntry = FsEntry & { createReader: () => { readEntries: (ok: (e: FsEntry[]) => void, fail: (e: unknown) => void) => void } };

async function walk(entry: FsEntry, out: Entry[], skipped: SkippedFile[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((ok, fail) => (entry as FsFileEntry).file(ok, fail));
    out.push({ file, path: entry.fullPath.replace(/^\//, "") });
    return;
  }
  if (!entry.isDirectory) return;
  if (isIgnoredDirectory(entry.name)) {
    skipped.push({ path: entry.fullPath.replace(/^\//, "") + "/", reason: `依赖或构建目录 ${entry.name}` });
    return;
  }
  const reader = (entry as FsDirEntry).createReader();
  for (;;) {
    const batch = await new Promise<FsEntry[]>((ok, fail) => reader.readEntries(ok, fail));
    if (!batch.length) break;
    for (const child of batch) await walk(child, out, skipped);
    if (out.length > LIMITS.files * 2) break;
  }
}

/** 拖放：支持文件夹（webkitGetAsEntry），被忽略的目录不展开。 */
export async function readDrop(data: DataTransfer, onProgress?: (n: number, total: number) => void): Promise<Selection> {
  const items = Array.from(data.items).filter((i) => i.kind === "file");
  const roots = items.map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.() ?? null);
  if (roots.every((r) => !r)) return readFileList(data.files, onProgress);
  const entries: Entry[] = [];
  const skipped: SkippedFile[] = [];
  for (const r of roots) if (r) await walk(r, entries, skipped);
  const read = await readEntries(entries, onProgress);
  return { files: read.files, skipped: [...skipped, ...read.skipped] };
}
