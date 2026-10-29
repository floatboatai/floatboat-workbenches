// ABOUTME: 右侧检查器：所选节点的标题、运行模式、全部参数的大控件、校验与服务端错误。

import type { IWidget, LGraphNode } from "@comfyorg/litegraph";
import { BellOff, CircleAlert, EyeOff, Focus, Play, Trash2, Upload } from "lucide-react";
import { MODE_BYPASS, MODE_NEVER, type NodeDefs } from "../contracts/comfy";
import type { Problem } from "../contracts/validate";
import type { GraphEditor } from "./graph/editor";

type W = IWidget & { options?: { values?: unknown; min?: number; max?: number; step2?: number; precision?: number } };

function WidgetField({ editor, node, widget, onUpload, onChanged }: { editor: GraphEditor; node: LGraphNode; widget: W; onUpload: (n: LGraphNode, w: IWidget) => void; onChanged: () => void }) {
  const set = (value: unknown) => {
    widget.value = value as never;
    widget.callback?.(value, editor.canvas, node);
    editor.touch();
    onChanged();
  };
  const id = `w-${node.id}-${widget.name}`;
  const name = String(widget.label ?? widget.name);
  if (widget.type === "button")
    return (
      <div className="field">
        <button type="button" className="ghost" onClick={() => onUpload(node, widget)}>
          <Upload size={14} aria-hidden="true" />{widget.name === "upload" ? "上传图片…" : name}
        </button>
      </div>
    );
  if (widget.type === "toggle")
    return (
      <label className="field check" htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(widget.value)} onChange={(e) => set(e.target.checked)} />
        <span>{name}</span>
      </label>
    );
  if (widget.type === "combo") {
    const values = Array.isArray(widget.options?.values) ? (widget.options!.values as unknown[]).map(String) : [];
    const current = String(widget.value ?? "");
    const list = values.includes(current) || !current ? values : [current, ...values];
    if (list.length > 80)
      return (
        <label className="field" htmlFor={id}>
          <span>{name}</span>
          <input id={id} list={id + "-list"} value={current} onChange={(e) => set(e.target.value)} spellCheck={false} />
          <datalist id={id + "-list"}>{list.slice(0, 500).map((v) => <option key={v} value={v} />)}</datalist>
        </label>
      );
    return (
      <label className="field" htmlFor={id}>
        <span>{name}</span>
        <select id={id} value={current} onChange={(e) => set(e.target.value)}>
          {list.map((v) => <option key={v} value={v}>{v}</option>)}
          {!list.length && <option value="">（服务器没有可选项）</option>}
        </select>
      </label>
    );
  }
  if (widget.type === "number") {
    const { min, max, step2, precision } = widget.options ?? {};
    return (
      <label className="field" htmlFor={id}>
        <span>{name}</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(Number(widget.value)) ? String(widget.value) : ""}
          min={min}
          max={max}
          step={step2 ?? (precision ? Math.pow(10, -precision) : 1)}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(v)) set(v);
          }}
        />
      </label>
    );
  }
  const multiline = String(widget.type) === "customtext" || widget.options?.multiline === true;
  return (
    <label className="field" htmlFor={id}>
      <span>{name}</span>
      {multiline ? (
        <textarea id={id} rows={5} value={String(widget.value ?? "")} onChange={(e) => set(e.target.value)} spellCheck={false} />
      ) : (
        <input id={id} value={String(widget.value ?? "")} onChange={(e) => set(e.target.value)} spellCheck={false} />
      )}
    </label>
  );
}

export function Inspector({
  editor,
  selectedIds,
  problems,
  defs,
  onUpload,
  onChanged,
  onRun,
}: {
  editor: GraphEditor | null;
  selectedIds: string[];
  problems: Problem[];
  defs: NodeDefs;
  onUpload: (n: LGraphNode, w: IWidget) => void;
  onChanged: () => void;
  onRun: () => void;
}) {
  if (!editor) return null;
  const nodes = selectedIds.map((id) => editor.nodeById(id)).filter((n): n is LGraphNode => Boolean(n));
  if (!nodes.length)
    return (
      <div className="inspector-empty">
        <p>选择一个节点查看并编辑它的参数。</p>
        <ul className="hints">
          <li>双击画布空白处：搜索并添加节点</li>
          <li>从插槽拖到空白处：按类型筛选节点</li>
          <li><kbd>Ctrl</kbd>+<kbd>B</kbd> 绕过 · <kbd>Ctrl</kbd>+<kbd>M</kbd> 静音</li>
          <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 运行</li>
        </ul>
        <button type="button" className="ghost" onClick={onRun}><Play size={14} aria-hidden="true" />打开运行面板</button>
      </div>
    );
  if (nodes.length > 1)
    return (
      <div className="inspector-body">
        <h3>已选 {nodes.length} 个节点</h3>
        <div className="seg-row">
          <button type="button" className="ghost" onClick={() => { editor.toggleMute(); onChanged(); }}><BellOff size={14} aria-hidden="true" />静音</button>
          <button type="button" className="ghost" onClick={() => { editor.toggleBypass(); onChanged(); }}><EyeOff size={14} aria-hidden="true" />绕过</button>
          <button type="button" className="ghost" onClick={() => editor.groupSelected()}>成组</button>
          <button type="button" className="ghost danger" onClick={() => editor.deleteSelected()}><Trash2 size={14} aria-hidden="true" />删除</button>
        </div>
      </div>
    );
  const node = nodes[0];
  const def = defs[String(node.type)];
  const mine = problems.filter((p) => p.nodeId === String(node.id));
  const widgets = (node.widgets ?? []) as W[];
  const mode = node.mode === MODE_NEVER ? "mute" : node.mode === MODE_BYPASS ? "bypass" : "run";
  const setMode = (m: "run" | "mute" | "bypass") => {
    node.mode = m === "mute" ? MODE_NEVER : m === "bypass" ? MODE_BYPASS : 0;
    editor.touch();
    onChanged();
  };
  return (
    <div className="inspector-body">
      <header className="insp-head">
        <h3>{def?.display_name ?? String(node.type)}</h3>
        <span className="muted mono">#{node.id} · {String(node.type)}</span>
        <button type="button" className="icon-btn" onClick={() => editor.focusNode(String(node.id))} aria-label="定位到节点" title="定位到节点">
          <Focus size={15} aria-hidden="true" />
        </button>
      </header>
      {def?.description && <p className="desc">{def.description}</p>}
      <label className="field">
        <span>标题</span>
        <input value={node.title ?? ""} onChange={(e) => { node.title = e.target.value; editor.touch(); onChanged(); }} spellCheck={false} />
      </label>
      <div className="field">
        <span>运行模式</span>
        <div className="segmented" role="radiogroup" aria-label="运行模式">
          {([["run", "运行"], ["mute", "静音"], ["bypass", "绕过"]] as const).map(([k, text]) => (
            <button type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} key={k} onClick={() => setMode(k)}>{text}</button>
          ))}
        </div>
      </div>
      {mine.length > 0 && (
        <ul className="node-problems" aria-label="此节点的问题">
          {mine.map((p) => (
            <li key={p.id} className={p.severity}><CircleAlert size={13} aria-hidden="true" />{p.message}{p.source === "server" && <em>服务端</em>}</li>
          ))}
        </ul>
      )}
      <div className="fields">
        {widgets.map((w) => (
          <WidgetField key={w.name} editor={editor} node={node} widget={w} onUpload={onUpload} onChanged={onChanged} />
        ))}
        {!widgets.length && <p className="muted">这个节点没有可编辑的参数。</p>}
      </div>
      <div className="seg-row">
        <button type="button" className="ghost danger" onClick={() => editor.deleteSelected()}><Trash2 size={14} aria-hidden="true" />删除节点</button>
      </div>
    </div>
  );
}
