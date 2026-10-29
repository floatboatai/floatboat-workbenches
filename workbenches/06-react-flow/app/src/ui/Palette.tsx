// ABOUTME: 左侧节点架：按输入/变换/输出分组，可拖到画布，也可点击（或回车）添加到视口中心。
import { useState } from "react";
import { categoryLabels, opKinds, spec, type Category, type OpKind } from "../contracts/ops";
import { portMarks } from "./icons";
import { opIcons } from "./icons";
import { DRAG_TYPE } from "./PipelineCanvas";

const categories: Category[] = ["input", "transform", "output"];

export function Palette({ onAdd, disabled }: { onAdd: (op: OpKind) => void; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = (op: OpKind) =>
    !q || spec(op).title.toLowerCase().includes(q) || spec(op).description.toLowerCase().includes(q) || op.toLowerCase().includes(q);
  return (
    <nav className="palette" aria-label="节点架">
      <label className="sr-only" htmlFor="palette-search">
        搜索节点
      </label>
      <input
        id="palette-search"
        className="palette-search"
        type="search"
        placeholder="搜索节点…"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {categories.map((category) => {
        const ops = opKinds.filter((op) => spec(op).category === category && visible(op));
        if (!ops.length) return null;
        return (
          <section key={category} className="palette-group" data-category={category}>
            <h2>{categoryLabels[category]}</h2>
            <ul>
              {ops.map((op) => {
                const Icon = opIcons[op];
                const s = spec(op);
                const output = s.outputs[0];
                const type = output && typeof output.type === "string" && output.type !== "same" ? portMarks[output.type] : "";
                return (
                  <li key={op}>
                    <button
                      type="button"
                      className="palette-item"
                      draggable={!disabled}
                      disabled={disabled}
                      title={s.description + " 拖到画布，或点击添加。"}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_TYPE, op);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => onAdd(op)}
                    >
                      <Icon aria-hidden="true" size={14} />
                      <span className="palette-title">{s.title}</span>
                      {type ? <span className="palette-type">{type}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="palette-hint">拖入画布，或点按添加到视图中心。CSV/JSON/日志文件可直接拖到画布。</p>
    </nav>
  );
}
