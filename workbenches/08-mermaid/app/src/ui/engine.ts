// ABOUTME: Mermaid 渲染引擎封装：按需加载、串行渲染、SVG 净化与 PNG 栅格化。
import type { Look, Theme } from "../contracts/model";
import {
  allowedReference,
  locateParseError,
  neutralizeExternal,
  sanitizeCssText,
} from "../contracts/mermaid-source";

type Mermaid = (typeof import("mermaid"))["default"];
let engine: Promise<Mermaid> | undefined;
const load = () =>
  (engine ??= import("mermaid").then(({ default: mermaid }) => mermaid));

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export interface Rendered {
  ok: true;
  svg: string;
  width: number;
  height: number;
  background: string;
  diagramType: string;
}
export interface RenderFailure {
  ok: false;
  line: number | null;
  column: number;
  message: string;
}

const FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",Arial,sans-serif';

let sequence = 0;
export function renderDiagram(
  source: string,
  options: { theme: Theme; look: Look },
): Promise<Rendered | RenderFailure> {
  return serial(async () => {
    const mermaid = await load();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: options.theme,
      look: options.look,
      handDrawnSeed: 17,
      fontFamily: FONT,
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      maxTextSize: 110000,
      maxEdges: 2000,
      suppressErrorRendering: true,
    });
    const id = "mmd" + (++sequence).toString(36) + Date.now().toString(36);
    try {
      const safe = neutralizeExternal(source);
      await mermaid.parse(safe);
      const result = await mermaid.render(id, safe);
      const config = mermaid.mermaidAPI.getConfig();
      const dark = config.darkMode === true || config.theme === "dark";
      const variables: unknown = config.themeVariables;
      const themeBackground =
        typeof variables === "object" &&
        variables !== null &&
        "background" in variables &&
        typeof variables.background === "string"
          ? variables.background
          : "#333333";
      const clean = sanitizeSvg(result.svg);
      return {
        ok: true,
        ...clean,
        background: dark ? themeBackground : "#ffffff",
        diagramType: result.diagramType,
      };
    } catch (error) {
      return { ok: false, ...locateParseError(error, source) };
    } finally {
      document.getElementById("d" + id)?.remove();
      document.getElementById(id)?.remove();
    }
  });
}

const BLOCKED = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "audio",
  "video",
  "source",
  "track",
  "frame",
  "frameset",
  "form",
  "input",
  "button",
  "textarea",
  "select",
]);
const REFERENCE = new Set([
  "href",
  "xlink:href",
  "src",
  "srcset",
  "action",
  "formaction",
  "background",
  "poster",
  "data",
]);

/** 净化 Mermaid 输出：去除脚本、事件属性与任何外部资源引用，并把尺寸固定为 viewBox。 */
export function sanitizeSvg(markup: string): {
  svg: string;
  width: number;
  height: number;
} {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (
    root.localName !== "svg" ||
    doc.getElementsByTagName("parsererror").length
  )
    throw new Error("图形输出无法解析。");
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    const name = element.localName.toLowerCase();
    if (BLOCKED.has(name)) {
      element.remove();
      continue;
    }
    if (name === "image" || name === "img") {
      const ref =
        element.getAttribute("href") ??
        element.getAttribute("xlink:href") ??
        element.getAttribute("src") ??
        "";
      if (!allowedReference(ref, name)) {
        element.remove();
        continue;
      }
    }
    for (const attribute of Array.from(element.attributes)) {
      const key = attribute.name.toLowerCase();
      if (key.startsWith("on")) element.removeAttribute(attribute.name);
      else if (REFERENCE.has(key)) {
        if (!allowedReference(attribute.value, name))
          element.removeAttribute(attribute.name);
      } else if (/url\(|@import/i.test(attribute.value))
        element.setAttribute(attribute.name, sanitizeCssText(attribute.value));
    }
    if (name === "style" && element.textContent)
      element.textContent = sanitizeCssText(element.textContent);
  }
  const box = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  let width = box.length === 4 && box[2] > 0 ? box[2] : 0,
    height = box.length === 4 && box[3] > 0 ? box[3] : 0;
  if (!width || !height) {
    width = Number.parseFloat(root.getAttribute("width") ?? "") || 800;
    height = Number.parseFloat(root.getAttribute("height") ?? "") || 600;
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  width = Math.ceil(width);
  height = Math.ceil(height);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  const style = (root.getAttribute("style") ?? "")
    .replace(/max-width:\s*[^;]+;?/gi, "")
    .trim();
  if (style) root.setAttribute("style", style);
  else root.removeAttribute("style");
  if (!root.getAttribute("xmlns"))
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { svg: new XMLSerializer().serializeToString(root), width, height };
}

/** 导出用 SVG：加入背景色（可选）与 XML 声明。 */
export function standaloneSvg(
  rendered: Rendered,
  transparent: boolean,
): string {
  if (transparent)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + rendered.svg;
  const doc = new DOMParser().parseFromString(rendered.svg, "image/svg+xml");
  const root = doc.documentElement;
  const style = root.getAttribute("style") ?? "";
  root.setAttribute(
    "style",
    (style ? style.replace(/;?\s*$/, "; ") : "") +
      "background-color: " +
      rendered.background,
  );
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLSerializer().serializeToString(root)
  );
}

const MAX_SIDE = 16384,
  MAX_AREA = 100_000_000;
export function pngScale(width: number, height: number, requested: number) {
  let scale = requested;
  while (
    scale > 0.25 &&
    (width * scale > MAX_SIDE ||
      height * scale > MAX_SIDE ||
      width * height * scale * scale > MAX_AREA)
  )
    scale /= 2;
  return scale;
}

export async function renderPng(
  rendered: Rendered,
  requested: number,
  transparent: boolean,
): Promise<{ blob: Blob; scale: number; width: number; height: number }> {
  const scale = pngScale(rendered.width, rendered.height, requested);
  const width = Math.max(1, Math.round(rendered.width * scale)),
    height = Math.max(1, Math.round(rendered.height * scale));
  const image = new Image();
  image.decoding = "async";
  image.src =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(rendered.svg);
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法创建画布。");
  if (!transparent) {
    context.fillStyle = rendered.background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("PNG 生成失败，请降低倍率后重试。");
  return { blob, scale, width, height };
}

const TYPE_LABELS: Record<string, string> = {
  flowchart: "流程图",
  "flowchart-v2": "流程图",
  "flowchart-elk": "流程图",
  graph: "流程图",
  sequence: "时序图",
  class: "类图",
  classDiagram: "类图",
  state: "状态图",
  stateDiagram: "状态图",
  er: "实体关系图",
  gantt: "甘特图",
  mindmap: "思维导图",
  timeline: "时间线",
  pie: "饼图",
  quadrantChart: "象限图",
  journey: "用户旅程",
  gitGraph: "Git 分支图",
  architecture: "架构图",
  xychart: "XY 图表",
  sankey: "桑基图",
  kanban: "看板",
  requirement: "需求图",
  block: "块图",
  packet: "数据包图",
  radar: "雷达图",
  treemap: "矩形树图",
  c4: "C4 架构图",
  info: "信息",
};
export function diagramLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}
