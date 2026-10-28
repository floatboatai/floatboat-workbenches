import { SceneGraph, type SceneNode } from "@open-pencil/scene-graph";
import { parseFigFile, exportFigFile } from "@open-pencil/core/io/formats/fig";
import { renderNodesToSVG } from "@open-pencil/core/io/formats/svg";
import { designValue, propertyValue, type View } from "../contracts/design.ts";
import { isRecord, boundedText } from "../contracts/project.ts";
function color(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
    a: 1,
  };
}
const fill = (hex: string) => [
  { type: "SOLID" as const, color: color(hex), visible: true, opacity: 1 },
];
function assertGraph(g: SceneGraph) {
  if (g.nodes.size > 1000 || g.getPages().length > 30)
    throw new Error("设计超过1000图层或30页，请拆分文件。");
  let bytes = 0;
  for (const image of g.images.values()) bytes += image.byteLength;
  if (bytes > 1500000) throw new Error("图片资源超过1.5MB，请先压缩资源。");
  for (const n of g.nodes.values()) {
    if (
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      !Number.isFinite(n.width) ||
      !Number.isFinite(n.height) ||
      Math.abs(n.x) > 100000 ||
      Math.abs(n.y) > 100000 ||
      n.width > 10000 ||
      n.height > 10000
    )
      throw new Error("画板或图层坐标超出范围。");
  }
}
export async function readGraph(file: string) {
  designValue({ file, notes: "" });
  if (!file) throw new Error("请先创建或导入设计。");
  const bytes = Buffer.from(file, "base64");
  if (bytes.length > 600000) throw new Error("FIG文件最多600KB。");
  const g = await parseFigFile(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    { populate: "all" },
  );
  assertGraph(g);
  return g;
}
export async function encode(g: SceneGraph) {
  assertGraph(g);
  const bytes = await exportFigFile(g);
  if (bytes.length > 600000)
    throw new Error("设计超过600KB，请减少内容后重试。");
  return Buffer.from(bytes).toString("base64");
}
export async function seedFile() {
  const g = new SceneGraph();
  const p = g.getPages()[0];
  g.updateNode(p.id, { name: "产品组件" });
  const frame = g.createNode("FRAME", p.id, {
    name: "会员卡 · 默认",
    width: 720,
    height: 440,
    fills: fill("#ffffff"),
    clipsContent: true,
  });
  g.createNode("RECTANGLE", frame.id, {
    name: "背景色带",
    x: 0,
    y: 0,
    width: 720,
    height: 148,
    fills: fill("#ebf4f0"),
  });
  g.createNode("TEXT", frame.id, {
    name: "品牌标题",
    x: 44,
    y: 36,
    width: 500,
    height: 40,
    text: "FIELDNOTES / MEMBERS",
    fontSize: 20,
    fontFamily: "Arial",
    fills: fill("#274c43"),
  });
  g.createNode("TEXT", frame.id, {
    name: "主标题",
    x: 44,
    y: 186,
    width: 600,
    height: 66,
    text: "Keep your curiosity.",
    fontSize: 42,
    fontFamily: "Arial",
    fills: fill("#242d2b"),
  });
  g.createNode("TEXT", frame.id, {
    name: "说明文字",
    x: 46,
    y: 270,
    width: 570,
    height: 36,
    text: "Make space for ideas worth keeping.",
    fontSize: 20,
    fontFamily: "Arial",
    fills: fill("#667770"),
  });
  g.createNode("RECTANGLE", frame.id, {
    name: "行动按钮",
    x: 44,
    y: 340,
    width: 186,
    height: 54,
    cornerRadius: 8,
    fills: fill("#274c43"),
  });
  g.createNode("TEXT", frame.id, {
    name: "按钮文案",
    x: 70,
    y: 354,
    width: 150,
    height: 26,
    text: "Explore collection",
    fontSize: 16,
    fontFamily: "Arial",
    fills: fill("#ffffff"),
  });
  g.createNode("ELLIPSE", frame.id, {
    name: "点缀圆形",
    x: 585,
    y: 35,
    width: 76,
    height: 76,
    fills: fill("#d89b7a"),
  });
  return encode(g);
}
function hex(n: SceneNode) {
  const f = n.fills.find((f) => f.type === "SOLID");
  if (!f) return "#ffffff";
  return (
    "#" +
    [f.color.r, f.color.g, f.color.b]
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function graphView(g: SceneGraph, pageId?: string): View {
  const pages = g.getPages();
  const page = pages.find((p) => p.id === pageId) ?? pages[0];
  if (!page) throw new Error("设计没有页面。");
  const layers: View["layers"] = [];
  const visited = new Set<string>();
  function walk(id: string, depth: number) {
    if (visited.has(id) || depth > 40) throw new Error("图层层级无效。");
    visited.add(id);
    const n = g.getNode(id);
    if (!n) return;
    const abs = g.getAbsolutePosition(id);
    layers.push({
      id: n.id,
      name: n.name,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      text: n.text,
      color: hex(n),
      visible: n.visible,
      depth,
      absoluteX: abs.x,
      absoluteY: abs.y,
    });
    for (const child of n.childIds) walk(child, depth + 1);
  }
  for (const id of page.childIds) walk(id, 0);
  const top = layers.filter((x) => x.depth === 0 && x.visible);
  const offsetX = top.length ? Math.min(...top.map((x) => x.absoluteX)) : 0,
    offsetY = top.length ? Math.min(...top.map((x) => x.absoluteY)) : 0;
  const width = top.length
      ? Math.max(...top.map((x) => x.absoluteX + x.width)) - offsetX
      : 720,
    height = top.length
      ? Math.max(...top.map((x) => x.absoluteY + x.height)) - offsetY
      : 440;
  const svg =
    renderNodesToSVG(g, page.id, page.childIds) ??
    '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440"></svg>';
  return {
    svg,
    layers,
    pages: pages.map((p) => ({ id: p.id, name: p.name })),
    pageId: page.id,
    width: Math.max(1, width),
    height: Math.max(1, height),
    offsetX,
    offsetY,
  };
}
export async function viewFile(file: string, pageId?: string) {
  return graphView(await readGraph(file), pageId);
}
export async function transform(
  file: string,
  action: unknown,
  pageId?: string,
) {
  if (!isRecord(action)) throw new Error("编辑操作无效。");
  const g = await readGraph(file);
  const page = g.getPages().find((p) => p.id === pageId) ?? g.getPages()[0];
  const id = typeof action.id === "string" ? action.id : "";
  const n = g.getNode(id);
  if (action.kind === "update") {
    if (!n || n.id === g.rootId || n.type === "CANVAS")
      throw new Error("请先选择一个图层。");
    const prop = propertyValue(action.props);
    g.updateNode(id, {
      ...prop,
      text: n.type === "TEXT" ? prop.text : n.text,
      fills: prop.color === hex(n) ? n.fills : fill(prop.color),
    });
  } else if (action.kind === "add") {
    const kind = action.type;
    if (!["RECTANGLE", "ELLIPSE", "TEXT", "FRAME"].includes(String(kind)))
      throw new Error("不支持的新增图层。");
    const parent =
      kind === "FRAME"
        ? page
        : (g.getChildren(page.id).find((x) => x.type === "FRAME") ?? page);
    const type = kind as "RECTANGLE" | "ELLIPSE" | "TEXT" | "FRAME";
    g.createNode(type, parent.id, {
      name: `${type === "TEXT" ? "文字" : type === "FRAME" ? "画板" : type === "ELLIPSE" ? "圆形" : "矩形"} ${g.nodes.size}`,
      x: 40,
      y: 40,
      width: type === "FRAME" ? 720 : 200,
      height: type === "FRAME" ? 440 : type === "TEXT" ? 50 : 100,
      text: type === "TEXT" ? "New idea" : "",
      fontSize: 24,
      fontFamily: "Arial",
      fills: fill(
        type === "TEXT" ? "#20312a" : type === "FRAME" ? "#ffffff" : "#e4bba5",
      ),
    });
  } else if (action.kind === "delete") {
    if (!n || n.type === "CANVAS" || n.id === g.rootId)
      throw new Error("图层不可删除。");
    g.deleteNode(id);
  } else if (action.kind === "duplicate") {
    if (!n || n.type === "CANVAS" || n.id === g.rootId)
      throw new Error("图层不可复制。");
    const clone = g.cloneTree(id, n.parentId ?? page.id, {
      x: n.x + 24,
      y: n.y + 24,
      name: n.name + " 副本",
    });
    if (clone) g.updateNode(clone.id, { x: n.x + 24, y: n.y + 24 });
  } else throw new Error("编辑操作无效。");
  const output = await encode(g);
  return { file: output, view: await viewFile(output, pageId) };
}
