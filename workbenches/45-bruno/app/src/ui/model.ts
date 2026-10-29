// Pure helpers for the request editor and collection tree (no DOM access).
import {
  environmentName,
  fileKind,
  type Receipt,
  type RequestModel,
  type Row,
  type SourceFile,
} from "../contracts/bruno.ts";

/** Short content fingerprint used to tie a structured draft to the source it produced. */
export function sourceHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ":" + text.length;
}

function splitUrl(url: string) {
  const hash = url.indexOf("#");
  const beforeHash = hash < 0 ? url : url.slice(0, hash);
  const fragment = hash < 0 ? "" : url.slice(hash);
  const q = beforeHash.indexOf("?");
  return {
    base: q < 0 ? beforeHash : beforeHash.slice(0, q),
    query: q < 0 ? null : beforeHash.slice(q + 1),
    fragment,
  };
}

/** URL edited → query/path tables follow (disabled query rows are kept, like Bruno). */
export function syncFromUrl(model: RequestModel, url: string): RequestModel {
  const { base, query } = splitUrl(url);
  const enabled: Row[] =
    query === null || query === ""
      ? []
      : query.split("&").map((part) => {
          const i = part.indexOf("=");
          return {
            name: i < 0 ? part : part.slice(0, i),
            value: i < 0 ? "" : part.slice(i + 1),
            enabled: true,
          };
        });
  const disabled = model.query.filter((r) => !r.enabled);
  const names = [...base.matchAll(/\/:([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  const path = names.map(
    (name) => model.path.find((p) => p.name === name) ?? { name, value: "", enabled: true },
  );
  return { ...model, url, query: [...enabled, ...disabled], path };
}

/** Query table edited → URL query string follows. */
export function syncToUrl(model: RequestModel, query: Row[]): RequestModel {
  const { base, fragment } = splitUrl(model.url);
  const parts = query
    .filter((r) => r.enabled && r.name)
    .map((r) => (r.value === "" ? r.name : `${r.name}=${r.value}`));
  return { ...model, query, url: base + (parts.length ? "?" + parts.join("&") : "") + fragment };
}

export const SAFE_METHODS = ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"];

export interface TreeRequest {
  file: SourceFile;
  name: string;
  method: string;
  seq: number;
}
export interface TreeFolder {
  name: string;
  path: string;
  settings?: SourceFile;
  folders: TreeFolder[];
  requests: TreeRequest[];
}

const METHOD_BLOCK = /^(get|post|put|patch|delete|head|options|trace|connect)\s*\{/m;
export function outline(file: SourceFile): TreeRequest {
  const meta = /meta\s*\{([\s\S]*?)\n\}/.exec(file.source)?.[1] ?? "";
  const name = /^\s*name:\s*(.+)$/m.exec(meta)?.[1]?.trim();
  const seq = Number(/^\s*seq:\s*(\d+)/m.exec(meta)?.[1] ?? 9999);
  const method = METHOD_BLOCK.exec(file.source)?.[1]?.toUpperCase() ?? (/^\s*type:\s*(grpc|ws)/m.test(meta) ? "RPC" : "?");
  return {
    file,
    name: name || file.path.split("/").at(-1)!.replace(/\.bru$/, ""),
    method,
    seq: Number.isFinite(seq) ? seq : 9999,
  };
}

export function buildTree(files: SourceFile[]): TreeFolder {
  const root: TreeFolder = { name: "", path: "", folders: [], requests: [] };
  const folder = (segments: string[]) => {
    let node = root;
    for (const [i, s] of segments.entries()) {
      let next = node.folders.find((f) => f.name === s);
      if (!next) {
        next = { name: s, path: segments.slice(0, i + 1).join("/"), folders: [], requests: [] };
        node.folders.push(next);
      }
      node = next;
    }
    return node;
  };
  for (const f of files) {
    const kind = fileKind(f.path);
    if (kind === "environment" || kind === "config" || kind === "collection") continue;
    const segments = f.path.split("/");
    const node = folder(segments.slice(0, -1));
    if (kind === "folder") node.settings = f;
    else node.requests.push(outline(f));
  }
  const sort = (n: TreeFolder) => {
    n.folders.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    n.requests.sort((a, b) => a.seq - b.seq || a.name.localeCompare(b.name, "zh-CN"));
    n.folders.forEach(sort);
  };
  sort(root);
  return root;
}

export function firstRequest(files: SourceFile[]): string | undefined {
  const walk = (n: TreeFolder): string | undefined =>
    n.folders.map(walk).find(Boolean) ?? n.requests[0]?.file.id;
  return walk(buildTree(files));
}

export function environments(files: SourceFile[]) {
  return files
    .filter((f) => fileKind(f.path) === "environment")
    .map((f) => ({ file: f, name: environmentName(f.path) }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function uniquePath(files: SourceFile[], dir: string, stem: string) {
  const taken = new Set(files.map((f) => f.path));
  const prefix = dir ? dir + "/" : "";
  for (let i = 1; ; i++) {
    const path = `${prefix}${stem}${i === 1 ? "" : " " + i}.bru`;
    if (!taken.has(path)) return path;
  }
}

const AUTH_NAMES: Record<string, string> = { bearer: "Bearer Token", basic: "Basic Auth", apikey: "API Key", none: "无认证" };
/** Describes which folder.bru / collection.bru auth a request set to "inherit" will use. */
export function inheritedAuthLabel(files: SourceFile[], path: string): string {
  const mode = (src?: string) => (src ? /auth\s*\{\s*mode:\s*([\w-]+)/.exec(src)?.[1] : undefined);
  const segments = path.split("/").slice(0, -1);
  for (let i = segments.length; i > 0; i--) {
    const m = mode(files.find((f) => f.path === segments.slice(0, i).join("/") + "/folder.bru")?.source);
    if (m && m !== "inherit") return `继承文件夹「${segments[i - 1]}」：${AUTH_NAMES[m] ?? m}`;
  }
  const m = mode(files.find((f) => f.path === "collection.bru")?.source);
  return m
    ? `继承集合设置：${AUTH_NAMES[m] ?? m}（在左侧「集合设置 › collection.bru」中修改）`
    : "集合未设置认证，继承后不发送认证信息。";
}

export function historyFor(results: Receipt[], requestId: string) {
  return results
    .filter((r) => r.requestId === requestId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function statusTone(r: Receipt | undefined) {
  if (!r) return "idle";
  if (r.state === "initiated") return "pending";
  if (r.state === "unknown") return "unknown";
  if (r.state === "failed") return "failed";
  const s = r.status ?? 0;
  return s >= 500 ? "s5" : s >= 400 ? "s4" : s >= 300 ? "s3" : "s2";
}

export function formatBytes(n: number | undefined) {
  if (n === undefined) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

export function prettyBody(r: Receipt): { text: string; language: "json" | "text" | "base64" } {
  if (r.body === undefined) return { text: "", language: "text" };
  if (r.encoding === "base64") return { text: r.body, language: "base64" };
  const type = Object.entries(r.headers ?? {}).find(([k]) => k === "content-type")?.[1] ?? "";
  if (/json/i.test(type) || /^\s*[[{]/.test(r.body))
    try {
      return { text: JSON.stringify(JSON.parse(r.body), null, 2), language: "json" };
    } catch {
      /* not JSON */
    }
  return { text: r.body, language: "text" };
}
