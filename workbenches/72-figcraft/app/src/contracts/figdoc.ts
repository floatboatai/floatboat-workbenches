// ABOUTME: 无引擎读取/修改 FigCraft 原生 .figcraft（zip + document.json），浏览器与服务端共用。
import { unzipSync, zipSync, strFromU8, strToU8, type Zippable } from "fflate";
import { isRecord } from "./project.ts";

/** 原生文件以 base64 保存在工作副本里；SDK 单次请求上限 2MB，留出备注与草稿空间。 */
export const MAX_FILE_BYTES = 1_350_000;
export const MAX_EXPANDED_BYTES = 80_000_000;
export const MAX_NODES = 60_000;
export const MAX_TEXT = 20_000;
export const MAX_NAME = 100;

export type Rgba = { r: number; g: number; b: number; a: number };
export type Paint = Record<string, unknown> & { type: string; visible?: boolean; opacity?: number };
export interface FigNode {
  id: number;
  name: string;
  type: string;
  width: number;
  height: number;
  parent?: number;
  children?: number[];
  transform?: number[];
  fills?: Paint[];
  strokes?: Paint[];
  characters?: string;
  dev_status?: string;
  dev_changed?: boolean;
  source?: number;
  overrides?: string[];
  styles?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface FigDocument {
  format: "figcraft";
  version: 1;
  name: string;
  pages: number[];
  nodes: Record<string, FigNode>;
  [key: string]: unknown;
}
export interface Archive {
  entries: Record<string, Uint8Array>;
  doc: FigDocument;
}
export type DevStatus = "none" | "readyForDev" | "completed";
export const DEV_STATUSES: DevStatus[] = ["none", "readyForDev", "completed"];
export interface FrameInfo {
  id: number;
  name: string;
  type: string;
  pageId: number;
  pageName: string;
  width: number;
  height: number;
  status: DevStatus;
  changed: boolean;
  texts: number;
}
export interface Outline {
  name: string;
  nodeCount: number;
  pages: { id: number; name: string; frames: number[] }[];
  frames: FrameInfo[];
}
export type EditAction =
  | { kind: "rename"; id: number; name: string }
  | { kind: "text"; id: number; text: string }
  | { kind: "fill"; id: number; color: string }
  | { kind: "status"; id: number; status: DevStatus }
  | { kind: "move"; id: number; offset: -1 | 1 };

export class FigDocError extends Error {}
const fail = (message: string): never => {
  throw new FigDocError(message);
};

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
export function base64ToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail("原生设计编码无效。");
  const raw = atob(value),
    bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
const FRAME_TYPES = new Set(["frame", "component", "componentSet", "component_set"]);

export function validateDocument(value: unknown): FigDocument {
  if (!isRecord(value) || value.format !== "figcraft" || value.version !== 1)
    fail("不是 FigCraft v1 原生文档。");
  const doc = value as Record<string, unknown>;
  if (!Array.isArray(doc.pages) || !doc.pages.length || !isRecord(doc.nodes))
    fail("FigCraft 文档缺少页面或图层。");
  const nodes = doc.nodes as Record<string, unknown>;
  const ids = Object.keys(nodes);
  if (ids.length > MAX_NODES) fail(`设计超过 ${MAX_NODES} 个图层，请拆分后导入。`);
  for (const key of ids) {
    const n = nodes[key];
    if (
      !isRecord(n) ||
      typeof n.id !== "number" ||
      String(n.id) !== key ||
      typeof n.name !== "string" ||
      typeof n.type !== "string" ||
      !Number.isFinite(n.width) ||
      !Number.isFinite(n.height)
    )
      fail(`图层 ${key} 结构无效。`);
    const node = n as Record<string, unknown>;
    if (node.children !== undefined && (!Array.isArray(node.children) || node.children.some((c) => typeof c !== "number")))
      fail(`图层 ${key} 的子图层无效。`);
  }
  for (const page of doc.pages as unknown[])
    if (typeof page !== "number" || !isRecord(nodes[String(page)])) fail("页面引用无效。");
  return { ...(doc as FigDocument), name: typeof doc.name === "string" ? doc.name : "未命名设计" };
}

export function readArchive(bytes: Uint8Array): Archive {
  if (bytes.length > MAX_FILE_BYTES)
    fail(`原生文件 ${(bytes.length / 1e6).toFixed(2)} MB，超过单次保存上限 ${(MAX_FILE_BYTES / 1e6).toFixed(2)} MB。`);
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) fail("不是 .figcraft（zip）文件。");
  let expanded = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (entry) => {
        expanded += entry.originalSize;
        if (expanded > MAX_EXPANDED_BYTES) fail("设计展开后超过 80 MB。");
        if (entry.name.includes("..") || entry.name.startsWith("/")) fail("压缩包含有不安全路径。");
        return true;
      },
    });
  } catch (error) {
    if (error instanceof FigDocError) throw error;
    return fail("压缩包已损坏，无法读取。");
  }
  const json = entries["document.json"];
  if (!json) fail("压缩包缺少 document.json。");
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(json));
  } catch {
    fail("document.json 不是有效 JSON。");
  }
  return { entries, doc: validateDocument(parsed) };
}

const isCompressed = (name: string) => /\.(png|jpe?g|webp|gif|avif|woff2?|zip)$/i.test(name);
/** 重新打包：保留其它条目原始字节与顺序，只替换 document.json。 */
export function writeArchive(archive: Archive, doc: FigDocument): Uint8Array {
  const files: Zippable = {};
  const mtime = new Date(1980, 0, 1, 0, 0, 0);
  let wroteDoc = false;
  for (const [name, data] of Object.entries(archive.entries)) {
    if (name === "document.json") {
      files[name] = [strToU8(JSON.stringify(doc)), { level: 6, mtime }];
      wroteDoc = true;
    } else files[name] = [data, { level: isCompressed(name) ? 0 : 6, mtime }];
  }
  if (!wroteDoc) files["document.json"] = [strToU8(JSON.stringify(doc)), { level: 6, mtime }];
  const out = zipSync(files);
  if (out.length > MAX_FILE_BYTES) fail("修改后的原生文件超过保存上限。");
  return out;
}

export function nodeOf(doc: FigDocument, id: number): FigNode | undefined {
  return doc.nodes[String(id)];
}
export function childrenOf(doc: FigDocument, node: FigNode): FigNode[] {
  return (node.children ?? []).map((id) => doc.nodes[String(id)]).filter((n): n is FigNode => Boolean(n));
}
export function statusOf(node: FigNode): DevStatus {
  return node.dev_status === "readyForDev" || node.dev_status === "completed" ? node.dev_status : "none";
}
/** 页面顶层或 section 中的画板才是可交付单元（与引擎规则一致）。 */
export function reviewFrames(doc: FigDocument): FigNode[] {
  const out: FigNode[] = [];
  for (const pageId of doc.pages) {
    const page = nodeOf(doc, pageId);
    if (!page) continue;
    for (const child of childrenOf(doc, page)) {
      if (child.type === "section") out.push(...childrenOf(doc, child).filter((n) => FRAME_TYPES.has(n.type)));
      else if (FRAME_TYPES.has(child.type)) out.push(child);
    }
  }
  return out;
}
export function descendants(doc: FigDocument, root: FigNode, limit = MAX_NODES): FigNode[] {
  const out: FigNode[] = [],
    stack = [root],
    seen = new Set<number>();
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n.id)) fail("图层层级存在循环。");
    seen.add(n.id);
    out.push(n);
    if (out.length > limit) fail("图层过多。");
    const kids = childrenOf(doc, n);
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return out;
}
export function outline(doc: FigDocument): Outline {
  const frames = reviewFrames(doc);
  const pageOf = (frame: FigNode): FigNode | undefined => {
    let cur: FigNode | undefined = frame;
    while (cur && cur.type !== "page") cur = cur.parent === undefined ? undefined : nodeOf(doc, cur.parent);
    return cur;
  };
  const infos: FrameInfo[] = frames.map((f) => {
    const page = pageOf(f);
    return {
      id: f.id,
      name: f.name,
      type: f.type,
      pageId: page?.id ?? doc.pages[0],
      pageName: page?.name ?? "",
      width: f.width,
      height: f.height,
      status: statusOf(f),
      changed: f.dev_changed === true,
      texts: descendants(doc, f).filter((n) => n.type === "text").length,
    };
  });
  return {
    name: doc.name,
    nodeCount: Object.keys(doc.nodes).length,
    pages: doc.pages
      .map((id) => nodeOf(doc, id))
      .filter((p): p is FigNode => Boolean(p))
      .map((p) => ({ id: p.id, name: p.name, frames: infos.filter((f) => f.pageId === p.id).map((f) => f.id) })),
    frames: infos,
  };
}
export function frameOf(doc: FigDocument, id: number): FigNode | undefined {
  const tops = new Set(reviewFrames(doc).map((f) => f.id));
  let cur = nodeOf(doc, id);
  while (cur) {
    if (tops.has(cur.id)) return cur;
    cur = cur.parent === undefined ? undefined : nodeOf(doc, cur.parent);
  }
  return undefined;
}

export function hexColor(c: unknown): string {
  if (!isRecord(c)) return "#000000";
  const h = (v: unknown) =>
    Math.round(Math.max(0, Math.min(1, typeof v === "number" ? v : 0)) * 255)
      .toString(16)
      .padStart(2, "0");
  return "#" + h(c.r) + h(c.g) + h(c.b);
}
export function firstSolidHex(node: FigNode): string | null {
  const paint = (node.fills ?? []).find((p) => p.type === "solid" && p.visible !== false);
  return paint ? hexColor(paint.color) : null;
}

export function parseAction(value: unknown): EditAction {
  if (!isRecord(value) || typeof value.id !== "number" || !Number.isInteger(value.id)) return fail("编辑请求无效。");
  const id = value.id;
  switch (value.kind) {
    case "rename": {
      if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > MAX_NAME)
        fail(`名称需要 1–${MAX_NAME} 个字符。`);
      return { kind: "rename", id, name: String(value.name).trim() };
    }
    case "text":
      if (typeof value.text !== "string" || value.text.length > MAX_TEXT) fail(`文案最多 ${MAX_TEXT} 个字符。`);
      return { kind: "text", id, text: String(value.text) };
    case "fill":
      if (typeof value.color !== "string" || !/^#[0-9a-f]{6}$/i.test(value.color)) fail("填色需要 #RRGGBB。");
      return { kind: "fill", id, color: String(value.color).toLowerCase() };
    case "status":
      if (!DEV_STATUSES.includes(value.status as DevStatus)) fail("交付状态无效。");
      return { kind: "status", id, status: value.status as DevStatus };
    case "move":
      if (value.offset !== -1 && value.offset !== 1) fail("移动方向无效。");
      return { kind: "move", id, offset: value.offset as -1 | 1 };
    default:
      return fail("不支持的编辑操作。");
  }
}

const addOverride = (node: FigNode, key: string) => {
  const list = Array.isArray(node.overrides) ? node.overrides.filter((x) => typeof x === "string") : [];
  if (!list.includes(key)) list.push(key);
  node.overrides = list;
};
/** 纯函数：返回新文档。语义与 FigCraft CLI 0.11.2 的 node.set 一致（覆盖标记、样式解绑、可交付后变更）。 */
export function applyEdits(source: FigDocument, actions: EditAction[]): FigDocument {
  const doc = structuredClone(source);
  const tops = new Set(reviewFrames(doc).map((f) => f.id));
  const touch = (id: number) => {
    const frame = frameOf(doc, id);
    if (frame?.dev_status === "readyForDev") frame.dev_changed = true;
  };
  for (const action of actions) {
    const node = nodeOf(doc, action.id);
    if (!node || node.type === "page") fail(`图层 ${action.id} 不存在。`);
    const n = node as FigNode;
    if (action.kind === "rename") {
      n.name = action.name;
      if (n.source !== undefined) addOverride(n, "name");
      touch(n.id);
    } else if (action.kind === "text") {
      if (n.type !== "text") fail("只能修改文字图层的文案。");
      n.characters = action.text;
      addOverride(n, "characters");
      touch(n.id);
    } else if (action.kind === "fill") {
      n.fills = [
        {
          type: "solid",
          color: {
            r: parseInt(action.color.slice(1, 3), 16) / 255,
            g: parseInt(action.color.slice(3, 5), 16) / 255,
            b: parseInt(action.color.slice(5, 7), 16) / 255,
            a: 1,
          },
          opacity: 1,
          visible: true,
          blend: "normal",
        },
      ];
      if (isRecord(n.styles) && n.styles.fill) n.styles = { ...n.styles, fill: null };
      if (n.source !== undefined) addOverride(n, "fills");
      touch(n.id);
    } else if (action.kind === "status") {
      if (!tops.has(n.id)) fail("只有页面顶层画板可以设置交付状态。");
      if (action.status === "none") delete n.dev_status;
      else n.dev_status = action.status;
      delete n.dev_changed;
    } else {
      if (!tops.has(n.id) || n.parent === undefined) return fail("只能调整顶层画板顺序。");
      const parent = nodeOf(doc, n.parent);
      const kids = parent?.children;
      if (!parent || !kids) return fail("画板父级无效。");
      const frameKids = kids.filter((id) => tops.has(id));
      const at = frameKids.indexOf(n.id),
        swapWith = frameKids[at + action.offset];
      if (swapWith === undefined) continue;
      const i = kids.indexOf(n.id),
        j = kids.indexOf(swapWith);
      const next = [...kids];
      [next[i], next[j]] = [next[j], next[i]];
      parent.children = next;
    }
  }
  return doc;
}

/** 解码 base64 → 修改 → 重新打包 → base64。 */
export function editFile(file: string, actions: EditAction[]): { file: string; doc: FigDocument } {
  const archive = readArchive(base64ToBytes(file));
  const doc = applyEdits(archive.doc, actions);
  return { file: bytesToBase64(writeArchive(archive, doc)), doc };
}
export function readFile(file: string): Archive {
  return readArchive(base64ToBytes(file));
}
