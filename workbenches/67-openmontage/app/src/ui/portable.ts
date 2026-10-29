// ABOUTME: 完整工程包（.openmontage）：JSON 头 + 原始素材字节，按片段读取，不经 base64；兼容 0.5 版 JSON 工程与恢复稿。
import { isRecord } from "../contracts/project";
import { timelineValue, type Timeline } from "../contracts/timeline";
import { mediaBlob, uploadBlob } from "./media";

const MAGIC = "FBMONTAGE2\n";
const FORMAT = "floatboat-openmontage-v2";
export const PROJECT_EXTENSION = ".openmontage";

/** 示例素材每个安装都自带，不写入工程包；成片也一并打包，便于在另一台机器回看。 */
export async function pack(title: string, data: Timeline, draft: Record<string, unknown>, onProgress: (r: number) => void) {
  const records = [...data.assets.filter((a) => !a.sample), ...data.outputs].filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i);
  const blobs: Blob[] = [], entries: { id: string; bytes: number; offset: number }[] = [];
  let offset = 0;
  for (let i = 0; i < records.length; i++) {
    const b = await mediaBlob(records[i].id);
    if (b.size !== records[i].bytes) throw new Error(`素材「${records[i].name}」大小与记录不符，请重新导入后再导出。`);
    entries.push({ id: records[i].id, bytes: b.size, offset });
    blobs.push(b);
    offset += b.size;
    onProgress((i + 1) / Math.max(1, records.length));
  }
  const pending = { ...draft };
  delete pending.pendingRender;
  const header = new TextEncoder().encode(JSON.stringify({ format: FORMAT, title, data, draft: pending, assets: entries }));
  const length = String(header.length).padStart(12, "0") + "\n";
  return new Blob([MAGIC, length, header, ...blobs], { type: "application/octet-stream" });
}

export type Unpacked = { title: string; data: Timeline; draft: Record<string, unknown>; recovery?: boolean };

export async function unpack(file: File, onProgress: (r: number) => void): Promise<Unpacked> {
  const lead = await file.slice(0, MAGIC.length + 13).text();
  if (lead.startsWith(MAGIC)) {
    const size = Number(lead.slice(MAGIC.length, MAGIC.length + 12));
    if (!Number.isInteger(size) || size <= 0 || size > 8 * 1024 * 1024) throw new Error("工程包头部损坏。");
    const start = MAGIC.length + 13;
    const v: unknown = JSON.parse(await file.slice(start, start + size).text());
    if (!isRecord(v) || v.format !== FORMAT || typeof v.title !== "string" || !Array.isArray(v.assets)) throw new Error("工程包格式无效。");
    const entries: unknown[] = v.assets;
    const data = timelineValue(v.data);
    const base = start + size;
    const needed = new Map([...data.assets.filter((a) => !a.sample), ...data.outputs].map((a) => [a.id, a]));
    let done = 0;
    for (const raw of entries) {
      if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.bytes !== "number" || typeof raw.offset !== "number") throw new Error("工程包素材目录无效。");
      const asset = needed.get(raw.id);
      if (!asset || asset.bytes !== raw.bytes) throw new Error("工程包素材与工程不一致。");
      if (base + raw.offset + raw.bytes > file.size) throw new Error("工程包不完整，素材数据被截断。");
      const stored = await uploadBlob(file.slice(base + raw.offset, base + raw.offset + raw.bytes), asset.mime, (r) => onProgress((done + r) / Math.max(1, entries.length)));
      if (stored.id !== raw.id) throw new Error(`素材「${asset.name}」内容校验失败。`);
      needed.delete(raw.id);
      done++;
    }
    if (needed.size) throw new Error("工程包缺少 " + needed.size + " 个素材文件。");
    return { title: v.title, data, draft: isRecord(v.draft) ? { ...v.draft } : {} };
  }
  if (file.size > 200 * 1024 * 1024) throw new Error("无法识别的工程文件。");
  const v: unknown = JSON.parse(await file.text());
  // 自动保存的恢复稿：只含工作稿，素材需已在本机或重新导入。
  if (isRecord(v) && isRecord(v.snapshot) && typeof v.snapshot.title === "string")
    return { title: v.snapshot.title, data: timelineValue(v.snapshot.data), draft: isRecord(v.snapshot.extra) ? { ...v.snapshot.extra } : {}, recovery: true };
  // 0.5 版完整工程：base64 原片 + 分镜单。
  if (isRecord(v) && v.format === "floatboat-openmontage-v1" && typeof v.title === "string" && Array.isArray(v.assets)) {
    const data = timelineValue(v.data);
    let done = 0;
    for (const raw of v.assets) {
      if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.base64 !== "string") throw new Error("素材格式无效");
      const bytes = Uint8Array.from(atob(raw.base64), (c) => c.charCodeAt(0));
      const stored = await uploadBlob(new Blob([bytes]), "video/mp4", () => {});
      if (stored.id !== raw.id) throw new Error("工程素材内容校验失败。");
      onProgress(++done / v.assets.length);
    }
    return { title: v.title, data, draft: isRecord(v.draft) ? { ...v.draft } : {} };
  }
  throw new Error("无法识别的工程文件。请选择 .openmontage 工程包、0.5 版工程 JSON 或恢复稿。");
}
