import { isRecord } from "./project.ts";
export interface Branch {
  data: {
    text: string;
    uid?: string;
    expand?: boolean;
    isActive?: boolean;
    richText?: false;
    resetRichText?: false;
  };
  children: Branch[];
  smmVersion?: string;
  inserting?: boolean;
}
export type Layout = "mindMap" | "logicalStructure" | "organizationStructure";
export type Theme = "garden" | "ink" | "plum";
export interface MapProject {
  version: 1;
  tree: Branch;
  layout: Layout;
  theme: Theme;
}
export const layouts: Record<Layout, string> = {
  mindMap: "思维导图",
  logicalStructure: "向右展开",
  organizationStructure: "组织结构",
};
export const themes: Record<Theme, string> = {
  garden: "花园",
  ink: "墨色",
  plum: "莓紫",
};
export function restoreMap(v: unknown): MapProject {
  if (
    !isRecord(v) ||
    v.version !== 1 ||
    typeof v.layout !== "string" ||
    typeof v.theme !== "string" ||
    JSON.stringify(v).length > 1800000
  )
    throw new Error("导图工作稿格式或容量无效。");
  let count = 0;
  function walk(n: unknown, depth: number) {
    if (
      !isRecord(n) ||
      !isRecord(n.data) ||
      typeof n.data.text !== "string" ||
      n.data.text.length > 100000 ||
      !Array.isArray(n.children) ||
      depth > 30 ||
      ++count > 1000
    )
      throw new Error("节点结构无效，最多 1000 节点、30 层。");
    for (const child of n.children) walk(child, depth + 1);
  }
  walk(v.tree, 0);
  return v as unknown as MapProject;
}
export function validateMap(v: unknown): MapProject {
  const m = restoreMap(v);
  if (
    !Object.hasOwn(layouts, m.layout) ||
    !Object.hasOwn(themes, m.theme) ||
    new TextEncoder().encode(JSON.stringify(m)).length > 850000
  )
    throw new Error("导图结构、主题或容量无效。");
  let count = 0;
  const ids = new Set<string>();
  function walk(n: Branch) {
    if (++count > 300 || n.data.text.length > 4000)
      throw new Error(
        "正式导图最多 300 节点，每节点 4000 字符；工作稿仍保留。",
      );
    for (const key of Object.keys(n.data))
      if (
        ![
          "text",
          "uid",
          "expand",
          "isActive",
          "richText",
          "resetRichText",
        ].includes(key)
      )
        throw new Error(
          "不支持节点字段 " + key + "；请使用纯文本节点，原始输入仍保留。",
        );
    for (const key of Object.keys(n))
      if (!["data", "children", "inserting", "smmVersion"].includes(key))
        throw new Error("不支持节点结构字段 " + key);
    if (
      n.smmVersion !== undefined &&
      (typeof n.smmVersion !== "string" || n.smmVersion.length > 100)
    )
      throw new Error("原生版本字段无效");
    if (n.inserting !== undefined && typeof n.inserting !== "boolean")
      throw new Error("原生插入状态无效");
    if (n.data.uid !== undefined) {
      if (
        typeof n.data.uid !== "string" ||
        !/^[\w-]{1,100}$/.test(n.data.uid) ||
        ["__proto__", "constructor", "prototype"].includes(n.data.uid) ||
        ids.has(n.data.uid)
      )
        throw new Error("节点编号无效或重复。");
      ids.add(n.data.uid);
    }
    for (const key of ["expand", "isActive"] as const)
      if (n.data[key] !== undefined && typeof n.data[key] !== "boolean")
        throw new Error("节点展开或选中状态无效。");
    if (
      (n.data.richText !== undefined && n.data.richText !== false) ||
      (n.data.resetRichText !== undefined && n.data.resetRichText !== false)
    )
      throw new Error("暂不支持富文本节点，原始输入仍保留。");
    n.children.forEach(walk);
  }
  walk(m.tree);
  return m;
}
function branch(uid: string, text: string, children: Branch[] = []): Branch {
  return { data: { uid, text, expand: true }, children };
}
export const seed: MapProject = {
  version: 1,
  layout: "mindMap",
  theme: "garden",
  tree: branch("garden-root", "周末社区花园", [
    branch("plants", "种下什么", [
      branch("herbs", "香草角 · 薄荷与迷迭香"),
      branch("flowers", "花境 · 向日葵与波斯菊"),
      branch("vegetables", "菜畦 · 生菜与小番茄"),
    ]),
    branch("people", "一起参与", [
      branch("neighbors", "邻里报名"),
      branch("children", "孩子的观察日记"),
    ]),
    branch("supplies", "提前准备", [
      branch("tools", "手套、花铲与浇水壶"),
      branch("soil", "土壤与堆肥"),
      branch("labels", "植物名牌"),
    ]),
    branch("day", "当天安排", [
      branch("morning", "09:30 集合与分组"),
      branch("planting", "10:00 播种与移栽"),
      branch("sharing", "11:30 分享与收拾"),
    ]),
  ]),
};
export function flatBranches(
  tree: Branch,
): { uid: string; text: string; depth: number; parent: string | null }[] {
  const list: {
    uid: string;
    text: string;
    depth: number;
    parent: string | null;
  }[] = [];
  function visit(n: Branch, depth: number, parent: string | null) {
    list.push({ uid: n.data.uid ?? "", text: n.data.text, depth, parent });
    n.children.forEach((c) => visit(c, depth + 1, n.data.uid ?? null));
  }
  visit(tree, 0, null);
  return list;
}
export function parseMapImport(raw: unknown): {
  title: string;
  data: MapProject;
  extra: Record<string, unknown>;
} {
  if (!isRecord(raw))
    throw new Error("请选择导图工程、原生节点 JSON 或恢复稿。");
  const snapshot = isRecord(raw.snapshot) ? raw.snapshot : raw;
  if (isRecord(snapshot.data) && snapshot.data.version === 1) {
    if (
      typeof snapshot.title !== "string" ||
      snapshot.title.length > 120 ||
      !isRecord(snapshot.extra ?? {})
    )
      throw new Error("工作稿标题或附加内容无效。");
    return {
      title: snapshot.title,
      data: restoreMap(snapshot.data),
      extra: (snapshot.extra ?? {}) as Record<string, unknown>,
    };
  }
  if (isRecord(raw.root))
    throw new Error(
      "暂不支持带主题/视图配置的上游文件，请导入原生节点树或本工作台完整工程。",
    );
  const tree = raw;
  const data = validateMap({
    version: 1,
    tree,
    layout: "mindMap",
    theme: "garden",
  });
  return {
    title: data.tree.data.text.slice(0, 120) || "未命名导图",
    data,
    extra: {},
  };
}
