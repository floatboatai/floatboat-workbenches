// ABOUTME: 右侧复核栏：文案（逐条草稿/应用）、图层（名称与填色）、交付（画板名、备注、全稿统计）。
import { useEffect, useRef } from "react";
import { Check, Undo2, Type, Square, Shapes, Frame, FileText } from "lucide-react";
import { descendants, firstSolidHex, type FigDocument, type FigNode, type Outline } from "../contracts/figdoc";
import { STATUS_LABEL } from "../contracts/handoff";

export type Tab = "copy" | "layers" | "handoff";
interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  doc: FigDocument;
  info: Outline;
  frame: FigNode;
  layer: FigNode | null;
  texts: Record<string, string>;
  names: Record<string, string>;
  fills: Record<string, string>;
  note: string;
  notes: Record<string, string>;
  disabled: boolean;
  editing: boolean;
  focusText: number | null;
  onFocused: () => void;
  onSelect: (id: number) => void;
  onText: (id: number, value: string | undefined) => void;
  onName: (id: number, value: string | undefined) => void;
  onFill: (id: number, value: string | undefined) => void;
  onApplyText: (id: number) => void;
  onApplyAll: () => void;
  onApplyName: (id: number) => void;
  onApplyFill: (id: number) => void;
  onNote: (value: string) => void;
  onHandoff: () => void;
  onFrame: (id: number) => void;
}
const ICON: Record<string, typeof Type> = { text: Type, vector: Shapes, ellipse: Shapes, frame: Frame, instance: Square, component: Square };

export function ReviewPanel(p: Props) {
  const all = descendants(p.doc, p.frame);
  const textNodes = all.filter((n) => n.type === "text" && n.visible !== false);
  const pending = textNodes.filter((n) => p.texts[n.id] !== undefined && p.texts[n.id] !== n.characters);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (p.focusText === null || p.tab !== "copy") return;
    const el = list.current?.querySelector<HTMLTextAreaElement>(`#copy-${p.focusText}`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      el.focus();
    }
    p.onFocused();
  }, [p.focusText, p.tab]);
  useEffect(() => {
    if (p.tab !== "copy" || !p.layer) return;
    list.current?.querySelector(`#copy-${p.layer.id}`)?.closest(".copy-item")?.scrollIntoView({ block: "nearest" });
  }, [p.layer?.id, p.tab]);
  const depthOf = (n: FigNode) => {
    let d = 0,
      cur: FigNode | undefined = n;
    while (cur && cur.id !== p.frame.id && cur.parent !== undefined && d < 60) {
      cur = p.doc.nodes[String(cur.parent)];
      d++;
    }
    return d;
  };
  const layer = p.layer;
  const layerName = layer ? (p.names[layer.id] ?? layer.name) : "";
  const currentFill = layer ? firstSolidHex(layer) : null;
  const fillDraft = layer ? p.fills[layer.id] : undefined;
  const frameName = p.names[p.frame.id] ?? p.frame.name;
  const counts = { none: 0, readyForDev: 0, completed: 0 };
  for (const f of p.info.frames) counts[f.status]++;
  return (
    <aside className="review-panel" aria-label="复核">
      <div className="tabs" role="tablist" aria-label="复核内容">
        {(
          [
            ["copy", `文案 ${textNodes.length}`],
            ["layers", "图层"],
            ["handoff", "交付"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={"tab-" + id}
            aria-selected={p.tab === id}
            aria-controls={"panel-" + id}
            tabIndex={p.tab === id ? 0 : -1}
            onClick={() => p.onTab(id)}
            onKeyDown={(e) => {
              const order: Tab[] = ["copy", "layers", "handoff"];
              const i = order.indexOf(p.tab);
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = order[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3];
                p.onTab(next);
                document.getElementById("tab-" + next)?.focus();
              }
            }}
          >
            {label}
            {id === "copy" && pending.length ? <span className="dot" aria-label={`${pending.length} 条未应用`} /> : null}
          </button>
        ))}
      </div>
      {p.tab === "copy" ? (
        <div className="panel" role="tabpanel" id="panel-copy" aria-labelledby="tab-copy" ref={list}>
          <div className="panel-head">
            <p>
              {pending.length ? `${pending.length} 条未应用 · 画板上以虚线标出` : "直接改写文案，应用后写回原生文件。"}
            </p>
            {pending.length > 1 ? (
              <button type="button" className="primary small" disabled={p.disabled} onClick={p.onApplyAll}>
                应用本屏 {pending.length} 条
              </button>
            ) : null}
          </div>
          {textNodes.length ? (
            textNodes.map((n) => {
              const original = typeof n.characters === "string" ? n.characters : "";
              const draft = p.texts[n.id];
              const value = draft ?? original;
              const dirty = draft !== undefined && draft !== original;
              return (
                <section className={"copy-item" + (layer?.id === n.id ? " is-current" : "")} key={n.id}>
                  <label htmlFor={"copy-" + n.id}>
                    <span>{n.name}</span>
                    {dirty ? <em>未应用</em> : null}
                  </label>
                  <textarea
                    id={"copy-" + n.id}
                    name={"copy-" + n.id}
                    autoComplete="off"
                    rows={Math.min(6, Math.max(1, Math.ceil(value.length / 34)))}
                    value={value}
                    disabled={p.editing}
                    onFocus={() => p.onSelect(n.id)}
                    onChange={(e) => p.onText(n.id, e.target.value === original ? undefined : e.target.value)}
                  />
                  {dirty ? (
                    <div className="row-actions">
                      <button type="button" disabled={p.disabled} onClick={() => p.onApplyText(n.id)}>
                        <Check size={13} aria-hidden="true" />
                        应用
                      </button>
                      <button type="button" className="ghost" disabled={p.editing} onClick={() => p.onText(n.id, undefined)}>
                        <Undo2 size={13} aria-hidden="true" />
                        还原
                      </button>
                    </div>
                  ) : null}
                </section>
              );
            })
          ) : (
            <p className="empty-note">此画板没有文字图层。</p>
          )}
        </div>
      ) : null}
      {p.tab === "layers" ? (
        <div className="panel" role="tabpanel" id="panel-layers" aria-labelledby="tab-layers">
          {layer ? (
            <section className="layer-card">
              <p className="layer-kind">
                {layer.type} · {Math.round(layer.width)} × {Math.round(layer.height)}
                {layer.source !== undefined ? " · 实例内图层" : ""}
              </p>
              <label htmlFor="layer-name">图层名称</label>
              <div className="inline-field">
                <input
                  id="layer-name"
                  name="layer-name"
                  autoComplete="off"
                  value={layerName}
                  disabled={p.editing}
                  onChange={(e) => p.onName(layer.id, e.target.value === layer.name ? undefined : e.target.value)}
                />
                <button
                  type="button"
                  disabled={p.disabled || layerName === layer.name || !layerName.trim()}
                  onClick={() => p.onApplyName(layer.id)}
                >
                  应用
                </button>
              </div>
              <label htmlFor="layer-fill">{layer.type === "text" ? "文字颜色" : "填色"}</label>
              <div className="inline-field fill-field">
                <input
                  type="color"
                  aria-label="选择颜色"
                  value={fillDraft ?? currentFill ?? "#000000"}
                  disabled={p.editing}
                  onChange={(e) => p.onFill(layer.id, e.target.value === currentFill ? undefined : e.target.value)}
                />
                <input
                  id="layer-fill"
                  name="layer-fill"
                  autoComplete="off"
                  spellCheck={false}
                  value={fillDraft ?? currentFill ?? ""}
                  placeholder="#RRGGBB"
                  disabled={p.editing}
                  onChange={(e) => p.onFill(layer.id, e.target.value === currentFill ? undefined : e.target.value.trim())}
                />
                <button
                  type="button"
                  disabled={p.disabled || !fillDraft || !/^#[0-9a-f]{6}$/i.test(fillDraft)}
                  onClick={() => p.onApplyFill(layer.id)}
                >
                  应用
                </button>
              </div>
              {fillDraft && !/^#[0-9a-f]{6}$/i.test(fillDraft) ? (
                <p className="field-error">填色需要 #RRGGBB 格式，草稿已保留。</p>
              ) : (
                <p className="field-hint">
                  {currentFill ? `当前 ${currentFill}` : "当前无纯色填充（渐变或空）"}；应用后替换为单一纯色并解除样式关联。
                </p>
              )}
            </section>
          ) : (
            <p className="empty-note">在画板上点选图层，或从下方列表选择。</p>
          )}
          <h3 className="list-title">图层（{all.length}）</h3>
          <ul className="layer-tree">
            {all.slice(0, 600).map((n) => {
              const Icon = ICON[n.type] ?? Square;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    style={{ paddingLeft: 8 + Math.min(depthOf(n), 10) * 12 }}
                    aria-current={layer?.id === n.id ? "true" : undefined}
                    onClick={() => p.onSelect(n.id)}
                  >
                    <Icon size={13} aria-hidden="true" />
                    <span>{p.names[n.id] ?? n.name}</span>
                    {p.fills[n.id] || (p.names[n.id] !== undefined && p.names[n.id] !== n.name) ? <em>未应用</em> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {all.length > 600 ? <p className="field-hint">仅列出前 600 个图层，可在画板上点选其余图层。</p> : null}
        </div>
      ) : null}
      {p.tab === "handoff" ? (
        <div className="panel" role="tabpanel" id="panel-handoff" aria-labelledby="tab-handoff">
          <label htmlFor="frame-name">画板名称</label>
          <div className="inline-field">
            <input
              id="frame-name"
              name="frame-name"
              autoComplete="off"
              value={frameName}
              disabled={p.editing}
              onChange={(e) => p.onName(p.frame.id, e.target.value === p.frame.name ? undefined : e.target.value)}
            />
            <button
              type="button"
              disabled={p.disabled || frameName === p.frame.name || !frameName.trim()}
              onClick={() => p.onApplyName(p.frame.id)}
            >
              应用
            </button>
          </div>
          <label htmlFor="frame-note">交付备注</label>
          <textarea
            id="frame-note"
            name="frame-note"
            autoComplete="off"
            rows={6}
            placeholder="例如：按钮文案待法务确认；空态插画下周补…"
            value={p.note}
            disabled={p.editing}
            onChange={(e) => p.onNote(e.target.value)}
          />
          <h3 className="list-title">全稿进度</h3>
          <p className="progress-line">
            可交付 {counts.readyForDev} · 已完成 {counts.completed} · 未标记 {counts.none}
          </p>
          <ul className="handoff-list">
            {p.info.frames.map((f) => (
              <li key={f.id}>
                <button type="button" aria-current={f.id === p.frame.id ? "true" : undefined} onClick={() => p.onFrame(f.id)}>
                  <span className={"status-dot " + f.status + (f.changed ? " changed" : "")} aria-hidden="true" />
                  <span>{f.name}</span>
                  <small>
                    {STATUS_LABEL[f.status]}
                    {f.changed ? " · 已变更" : ""}
                    {p.notes[f.id]?.trim() ? " · 有备注" : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="wide" onClick={p.onHandoff}>
            <FileText size={15} aria-hidden="true" />
            导出交付说明 .md
          </button>
        </div>
      ) : null}
    </aside>
  );
}
