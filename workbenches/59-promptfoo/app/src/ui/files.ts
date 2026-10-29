// ABOUTME: 文件进出：识别导入文件类型、分片上传结果、读取运行结果缓存、组装便携项目与下载。
import { request, download } from "./requests";
import { isRecord } from "../contracts/project";
import { parseRun, resultSummary, type RunView } from "../contracts/results";
import { configToYaml } from "../contracts/config";
import { emptyProject, restoreProjectDraft, type EvalProject, type RunRef } from "../contracts/evaluation";

export const MAX_IMPORT_BYTES = 40 * 1024 * 1024;
const PART = 400_000;

const cache = new Map<string, { view: RunView; raw: unknown }>();
const inflight = new Map<string, Promise<{ view: RunView; raw: unknown }>>();
export function cachedRun(id: string) {
  return cache.get(id) ?? null;
}
export function loadRun(id: string) {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(id);
  if (!p) {
    p = request(`/api/runs/${encodeURIComponent(id)}`)
      .then((raw) => {
        const entry = { view: parseRun(raw), raw };
        cache.set(id, entry);
        if (cache.size > 12) cache.delete(cache.keys().next().value!);
        return entry;
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p;
}

function isRun(v: unknown): v is RunRef {
  return isRecord(v) && typeof v.id === "string" && isRecord(v.stats);
}
/** 每片 400000 字符；丢失回执可安全重试（同一 uploadId 返回同一运行）。 */
export async function uploadResult(text: string, name: string, onProgress?: (done: number, total: number) => void): Promise<RunRef> {
  const uploadId = crypto.randomUUID();
  const total = Math.max(1, Math.ceil(text.length / PART));
  for (let part = 0; part < total; part++) {
    const body = JSON.stringify({ uploadId, part, total, data: text.slice(part * PART, (part + 1) * PART), name });
    let result: unknown;
    for (let attempt = 0; ; attempt++) {
      try {
        result = await request("/api/runs/import", { method: "POST", body });
        break;
      } catch (e) {
        const status = isRecord(e) ? e.status : undefined;
        if (attempt >= 2 || (typeof status === "number" && status < 500)) throw e;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    onProgress?.(part + 1, total);
    if (isRecord(result) && result.done === true && isRun(result.run)) return result.run;
  }
  throw new Error("导入没有完成，请重试。");
}

export type Sniffed =
  | { kind: "config"; text: string; title: string }
  | { kind: "results"; text: string; title: string; config: unknown }
  | { kind: "project"; value: Record<string, unknown> }
  | { kind: "draft"; data: EvalProject; title: string; extra: Record<string, unknown> }
  | { kind: "csv"; text: string };
export function sniff(name: string, text: string): Sniffed {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return { kind: "csv", text };
  const base = name.replace(/\.(ya?ml|json)$/i, "").slice(0, 100) || "导入的评测";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return { kind: "config", text, title: base };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    if (/^\s*(description|prompts|providers|tests)\s*:/m.test(text)) return { kind: "config", text, title: base };
    throw new Error("文件不是 JSON、YAML 或 CSV。");
  }
  if (isRecord(value) && value.kind === "promptfoo-workbench") return { kind: "project", value };
  if (isRecord(value) && isRecord(value.snapshot) && typeof value.snapshot.title === "string" && isRecord(value.snapshot.extra)) {
    const data = restoreProjectDraft(value.snapshot.data);
    const config = value.snapshot.extra.config;
    if (config !== undefined && (typeof config !== "string" || config.length > 600_000)) throw new Error("草稿配置格式或容量无效。");
    // Recovery is a new document. Never revive an execution request from an imported file.
    return { kind: "draft", data, title: value.snapshot.title.slice(0, 120), extra: typeof config === "string" ? { config } : {} };
  }
  if (isRecord(value) && (Array.isArray(value.results) || (isRecord(value.results) && Array.isArray(value.results.results)))) {
    const { config } = resultSummary(value);
    return { kind: "results", text, title: base, config };
  }
  if (isRecord(value) && (value.prompts !== undefined || value.providers !== undefined || value.tests !== undefined))
    return { kind: "config", text: configToYaml(value), title: base };
  throw new Error("无法识别的 JSON：需要 promptfooconfig、Promptfoo 结果或评测项目文件。");
}

/** 便携项目（含每次运行的原始结果）。 */
export async function exportProject(title: string, data: EvalProject, configDraft: string) {
  const runs: Record<string, unknown> = {};
  for (const r of data.runs) {
    try {
      runs[r.id] = (await loadRun(r.id)).raw;
    } catch {
      throw new Error(`无法导出完整项目：“${r.name}”的结果不可读取，请重新导入结果或从项目移除该运行后重试。`);
    }
  }
  const text = JSON.stringify({ kind: "promptfoo-workbench", version: 2, title, data, draft: { config: configDraft }, runs });
  download(new Blob([text], { type: "application/json" }), `${safeName(title)}.promptfoo-project.json`);
}
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "evaluation";

/** 导入便携项目：上传每次运行（获得本机新 ID），改写引用，返回新的工作副本。兼容 0.4 的 reports 格式。 */
export async function importProject(value: Record<string, unknown>, onProgress?: (msg: string) => void) {
  const title = typeof value.title === "string" && value.title.trim() ? value.title.slice(0, 120) : "导入的评测";
  const draft = isRecord(value.draft) && typeof value.draft.config === "string" ? value.draft.config.slice(0, 600_000) : undefined;
  if (value.version === 1 && isRecord(value.data) && Array.isArray(value.data.reports)) {
    const legacy = value.data;
    const base = restoreProjectDraft(legacy);
    const refs: RunRef[] = [];
    const reviews: EvalProject["reviews"] = {};
    for (const r of legacy.reports as unknown[]) {
      if (!isRecord(r) || typeof r.raw !== "string" || typeof r.id !== "string") continue;
      onProgress?.(`上传 ${refs.length + 1}/${(legacy.reports as unknown[]).length}…`);
      const ref = await uploadResult(r.raw, typeof r.name === "string" ? r.name : "0.4 报告");
      refs.push(ref);
      const view = parseRun(JSON.parse(r.raw));
      if (isRecord(legacy.reviews))
        for (const [k, v] of Object.entries(legacy.reviews)) {
          const m = /^(.+):(\d+):(\d+)$/.exec(k);
          const cell = m && m[1] === r.id ? view.cells.find((c) => c.test === Number(m[2]) && c.column === Number(m[3])) : null;
          if (cell && isRecord(v) && ["pending", "accept", "reject"].includes(String(v.decision)))
            reviews[`${ref.id}:${cell.key}`] = { decision: v.decision as "pending", note: typeof v.note === "string" ? v.note.slice(0, 6000) : "" };
        }
    }
    return { title, data: restoreProjectDraft({ ...base, runs: refs, current: refs[0]?.id ?? "", reviews }), draft };
  }
  if (value.version !== 2 || !isRecord(value.data)) throw new Error("评测项目文件版本无效。");
  const data = restoreProjectDraft(value.data);
  const raws = isRecord(value.runs) ? value.runs : {};
  const map = new Map<string, string>();
  const runs: RunRef[] = [];
  for (const [i, r] of data.runs.entries()) {
    const raw = raws[r.id];
    if (raw === undefined) continue;
    onProgress?.(`上传运行 ${i + 1}/${data.runs.length}…`);
    const ref = await uploadResult(JSON.stringify(raw), r.name);
    map.set(r.id, ref.id);
    runs.push({ ...ref, name: r.name, origin: r.origin });
  }
  const remapKeys = <T,>(o: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(o).flatMap(([k, v]) => {
        const i = k.indexOf(":");
        const next = map.get(k.slice(0, i));
        return next ? [[`${next}${k.slice(i)}`, v]] : [];
      }),
    );
  const baseline = data.baseline.kind === "run" ? (map.has(data.baseline.runId) ? { kind: "run" as const, runId: map.get(data.baseline.runId)! } : { kind: "none" as const }) : data.baseline;
  return {
    title,
    data: restoreProjectDraft({
      ...data,
      runs,
      current: map.get(data.current) ?? runs[0]?.id ?? "",
      baseline,
      reviews: remapKeys(data.reviews),
      releases: remapKeys(data.releases),
    }),
    draft,
  };
}

export function newProjectFromConfig(text: string): EvalProject {
  return { ...structuredClone(emptyProject), config: text };
}
export { download };
