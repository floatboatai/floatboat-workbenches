// ABOUTME: 节点库与双击搜索共用的检索：名称、分类、描述的加权匹配，可按插槽类型筛选。

import { typesCompatible, type NodeDef, type NodeDefs } from "../contracts/comfy";

export interface LibraryEntry {
  def: NodeDef;
  haystack: string;
}

export const VIRTUAL_ENTRIES: NodeDef[] = [
  virtual("Reroute", "转接点 Reroute", "utils", "把一条连线转接到别处，整理布局。", ["*"], ["*"]),
  virtual("PrimitiveNode", "原始值 Primitive", "utils", "把一个值接入其他节点的参数输入，多个节点共用同一个值。", [], ["*"]),
  virtual("Note", "备注 Note", "utils", "给工作流写说明；不参与运行。", [], []),
];

function virtual(name: string, display: string, category: string, description: string, inputs: string[], outputs: string[]): NodeDef {
  return {
    name, display_name: display, description, category, python_module: "frontend",
    inputs: inputs.map((type) => ({ name: "", type, options: null, config: {}, required: false })),
    hidden: [], output: outputs, output_is_list: outputs.map(() => false), output_name: outputs,
    output_tooltips: outputs.map(() => ""), output_node: false, search_aliases: [], deprecated: false, experimental: false,
  };
}

export function buildLibrary(defs: NodeDefs): LibraryEntry[] {
  const entries = [...Object.values(defs), ...VIRTUAL_ENTRIES.filter((v) => !defs[v.name])].map((def) => ({
    def,
    haystack: `${def.display_name} ${def.name} ${def.category} ${def.description} ${def.search_aliases.join(" ")}`.toLowerCase(),
  }));
  return entries.sort((a, b) => a.def.display_name.localeCompare(b.def.display_name));
}

export interface SearchFilter {
  /** Dragged-from slot: find nodes that can connect to it. */
  side?: "output" | "input";
  type?: string;
}

export function search(entries: LibraryEntry[], query: string, filter: SearchFilter = {}, limit = 40): NodeDef[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: { def: NodeDef; score: number }[] = [];
  for (const { def, haystack } of entries) {
    if (def.deprecated && !terms.length) continue;
    if (filter.type && filter.side) {
      const ok =
        filter.side === "output"
          ? def.inputs.some((i) => typesCompatible(filter.type!, i.type))
          : def.output.some((o) => typesCompatible(o, filter.type!));
      if (!ok) continue;
    }
    let score = 0;
    if (!terms.length) score = 1;
    else {
      for (const term of terms) {
        if (!haystack.includes(term)) {
          score = -1;
          break;
        }
        const title = def.display_name.toLowerCase();
        score += title === term ? 40 : title.startsWith(term) ? 25 : title.includes(term) ? 12 : def.name.toLowerCase().includes(term) ? 8 : 2;
      }
    }
    if (score >= 0) scored.push({ def, score: score - (def.deprecated ? 20 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score || a.def.display_name.localeCompare(b.def.display_name)).slice(0, limit).map((s) => s.def);
}

export interface CategoryNode {
  name: string;
  path: string;
  children: Map<string, CategoryNode>;
  nodes: NodeDef[];
}

export function categoryTree(entries: LibraryEntry[]): CategoryNode {
  const root: CategoryNode = { name: "", path: "", children: new Map(), nodes: [] };
  for (const { def } of entries) {
    if (def.deprecated) continue;
    let at = root;
    const parts = def.category.split("/").filter(Boolean);
    for (const part of parts.length ? parts : ["未分类"]) {
      let next = at.children.get(part);
      if (!next) {
        next = { name: part, path: at.path ? at.path + "/" + part : part, children: new Map(), nodes: [] };
        at.children.set(part, next);
      }
      at = next;
    }
    at.nodes.push(def);
  }
  return root;
}
