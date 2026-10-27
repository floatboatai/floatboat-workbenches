export interface BoardSummary {
  id: string;
  title: string;
  revision: number;
  updatedAt: string;
}
export interface Board extends BoardSummary {
  scene: string;
}
export interface Diagram {
  title: string;
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label: string }[];
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function titleValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120)
    throw new Error("名称需要 1–120 个字符。");
  return value.trim();
}
export function sceneValue(value: unknown): string {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).length > 1_500_000
  )
    throw new Error("画布过大，请压缩图片后重试（上限 1.5 MB）。");
  let scene: unknown;
  try {
    scene = JSON.parse(value);
  } catch {
    throw new Error("无法读取画布文件。");
  }
  if (
    !record(scene) ||
    !Array.isArray(scene.elements) ||
    scene.elements.length > 10000 ||
    !scene.elements.every(
      (item) => record(item) && typeof item.type === "string",
    )
  )
    throw new Error("画布格式不正确。");
  if (scene.files !== undefined && !record(scene.files))
    throw new Error("画布图片格式不正确。");
  return value;
}
export function isBoardSummary(value: unknown): value is BoardSummary {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.revision === "number" &&
    typeof value.updatedAt === "string"
  );
}
export function isBoard(value: unknown): value is Board {
  return (
    isBoardSummary(value) && record(value) && typeof value.scene === "string"
  );
}
export function diagramValue(value: unknown): Diagram {
  if (
    !record(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges) ||
    value.nodes.length < 1 ||
    value.nodes.length > 12 ||
    value.edges.length > 24
  )
    throw new Error("生成的图形结构不完整，请重试。");
  const nodes = value.nodes.map((node) => {
    if (
      !record(node) ||
      typeof node.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,40}$/.test(node.id) ||
      typeof node.label !== "string" ||
      !node.label.trim() ||
      node.label.length > 120
    )
      throw new Error("生成的节点无效。");
    return { id: node.id, label: node.label };
  });
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) throw new Error("生成的节点标识重复。");
  const edges = value.edges.map((edge) => {
    if (
      !record(edge) ||
      typeof edge.from !== "string" ||
      typeof edge.to !== "string" ||
      !ids.has(edge.from) ||
      !ids.has(edge.to) ||
      edge.from === edge.to ||
      typeof edge.label !== "string" ||
      edge.label.length > 60
    )
      throw new Error("生成的连接无效。");
    return { from: edge.from, to: edge.to, label: edge.label };
  });
  return { title: titleValue(value.title), nodes, edges };
}
export const emptyScene = JSON.stringify({
  type: "excalidraw",
  version: 2,
  source: "floatboat-workbenches",
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
});
