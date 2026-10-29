// ABOUTME: 左侧节点库：搜索与分类树，节点可拖入画布或点击添加。

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, PanelLeftClose, Search } from "lucide-react";
import type { NodeDef } from "../contracts/comfy";
import { categoryTree, search, type CategoryNode, type LibraryEntry } from "./search";
import { NODE_DRAG_TYPE } from "./CanvasView";

function Item({ def, onAdd }: { def: NodeDef; onAdd: (def: NodeDef) => void }) {
  return (
    <button
      type="button"
      className="lib-item"
      draggable
      title={def.description || def.name}
      onDragStart={(e) => {
        e.dataTransfer.setData(NODE_DRAG_TYPE, def.name);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAdd(def)}
    >
      <span className="name">{def.display_name}</span>
      {def.output_node && <span className="chip">输出</span>}
    </button>
  );
}

function Branch({ node, depth, open, toggle, onAdd }: { node: CategoryNode; depth: number; open: Set<string>; toggle: (path: string) => void; onAdd: (def: NodeDef) => void }) {
  const isOpen = open.has(node.path);
  const count = (n: CategoryNode): number => n.nodes.length + [...n.children.values()].reduce((s, c) => s + count(c), 0);
  return (
    <li>
      <button type="button" className="lib-cat" style={{ paddingLeft: 8 + depth * 12 }} aria-expanded={isOpen} onClick={() => toggle(node.path)}>
        {isOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        <span>{node.name}</span>
        <span className="count">{count(node)}</span>
      </button>
      {isOpen && (
        <ul className="lib-list" style={{ paddingLeft: 8 + depth * 12 }}>
          {[...node.children.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <Branch key={c.path} node={c} depth={depth + 1} open={open} toggle={toggle} onAdd={onAdd} />
          ))}
          {node.nodes.sort((a, b) => a.display_name.localeCompare(b.display_name)).map((d) => (
            <li key={d.name}>
              <Item def={d} onAdd={onAdd} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Library({
  entries,
  source,
  nodeCount,
  onAdd,
  onCollapse,
}: {
  entries: LibraryEntry[];
  source: "snapshot" | "server";
  nodeCount: number;
  onAdd: (def: NodeDef) => void;
  onCollapse: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set(["loaders", "sampling", "conditioning"]));
  const tree = useMemo(() => categoryTree(entries), [entries]);
  const results = useMemo(() => (query.trim() ? search(entries, query, {}, 60) : []), [entries, query]);
  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  return (
    <div className="library-inner">
      <div className="lib-head">
        <strong>节点库</strong>
        <span className="muted">{nodeCount} 个 · {source === "server" ? "来自服务" : "内置快照"}</span>
        <button type="button" className="icon-btn" onClick={onCollapse} aria-label="收起节点库" title="收起节点库">
          <PanelLeftClose size={16} aria-hidden="true" />
        </button>
      </div>
      <label className="lib-search">
        <Search size={14} aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索节点…" autoComplete="off" aria-label="搜索节点库" spellCheck={false} />
      </label>
      <div className="lib-scroll">
        {query.trim() ? (
          <ul className="lib-list">
            {results.map((d) => (
              <li key={d.name}>
                <Item def={d} onAdd={onAdd} />
              </li>
            ))}
            {!results.length && <li className="none">没有匹配的节点。</li>}
          </ul>
        ) : (
          <ul className="lib-tree">
            {[...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
              <Branch key={c.path} node={c} depth={0} open={open} toggle={toggle} onAdd={onAdd} />
            ))}
          </ul>
        )}
      </div>
      <p className="lib-hint">拖到画布，或点击添加到视图中心。</p>
    </div>
  );
}
