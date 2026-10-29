// ABOUTME: 右侧检查器：节点名称、按端口选择来源（键盘/窄屏连线）、配置编辑与完整输出；未选中时显示流水线概览。
import { Copy, FileUp, Trash2 } from "lucide-react";
import { checkConnection, outputType } from "../contracts/engine";
import type { FlowDocument, PipelineNode } from "../contracts/flow";
import { spec } from "../contracts/ops";
import { typeLabels } from "../contracts/values";
import { ConfigEditor } from "./ConfigEditors";
import { opIcons } from "./icons";
import { PreviewView, ValueView } from "./OutputView";
import { formatMs, shownValue, type NodeView } from "./view";

export type InspectorTab = "config" | "output";

export function columnsFor(doc: FlowDocument, node: PipelineNode, views: Record<string, NodeView>): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const port of spec(node.data.op).inputs) {
    const edge = doc.edges.find((item) => item.target === node.id && item.targetHandle === port.id);
    if (!edge) continue;
    const view = views[edge.source];
    const value = view?.live?.outputs[edge.sourceHandle];
    if (value?.type === "table") result[port.id] = value.columns;
    else if (!view?.live && edge.sourceHandle === "out" && view?.preview?.type === "table") result[port.id] = view.preview.columns;
  }
  return result;
}

function Sources({ doc, node, onConnect, onDisconnect }: { doc: FlowDocument; node: PipelineNode; onConnect: (port: string, source: string, handle: string) => void; onDisconnect: (port: string) => void }) {
  const inputs = spec(node.data.op).inputs;
  if (!inputs.length) return null;
  return (
    <fieldset className="sources">
      <legend>输入来源</legend>
      {inputs.map((port) => {
        const current = doc.edges.find((edge) => edge.target === node.id && edge.targetHandle === port.id);
        const options = doc.nodes.flatMap((other) =>
          spec(other.data.op).outputs
            .filter((out) => (current && current.source === other.id && current.sourceHandle === out.id) || checkConnection(doc, { source: other.id, sourceHandle: out.id, target: node.id, targetHandle: port.id }).ok)
            .map((out) => {
              const type = outputType(doc, other.id, out.id);
              return {
                value: `${other.id}::${out.id}`,
                label: `${other.data.label}${spec(other.data.op).outputs.length > 1 ? " · " + out.label : ""}${type ? `（${typeLabels[type]}）` : ""}`,
              };
            }),
        );
        const id = `source-${port.id}`;
        return (
          <div className="field" key={port.id}>
            <label htmlFor={id}>
              {port.label} <span className="muted">接受 {port.accepts.map((t) => typeLabels[t]).join(" / ")}</span>
            </label>
            <select
              id={id}
              value={current ? `${current.source}::${current.sourceHandle}` : ""}
              onChange={(event) => {
                if (!event.target.value) onDisconnect(port.id);
                else {
                  const [source, handle] = event.target.value.split("::");
                  onConnect(port.id, source, handle);
                }
              }}
            >
              <option value="">（未连接）</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </fieldset>
  );
}

function Overview({ doc, views, onSelect }: { doc: FlowDocument; views: Record<string, NodeView>; onSelect: (id: string) => void }) {
  return (
    <div className="overview">
      <h2>流水线</h2>
      <p className="muted">
        {doc.nodes.length} 个节点 · {doc.edges.length} 条连线。点选节点编辑配置；从左侧拖入新节点，从端口拖出连线（颜色表示数据类型：<span className="type-text">文本</span>、
        <span className="type-table">表格</span>、<span className="type-json">JSON</span>）。
      </p>
      <ol className="node-index">
        {doc.nodes.map((node) => {
          const Icon = opIcons[node.data.op];
          const view = views[node.id];
          return (
            <li key={node.id}>
              <button type="button" onClick={() => onSelect(node.id)} data-status={view?.status}>
                <Icon aria-hidden="true" size={13} />
                <span>{node.data.label || "（未命名）"}</span>
                <small>{view?.status === "error" ? "失败" : view?.summary ?? ""}</small>
              </button>
            </li>
          );
        })}
      </ol>
      <h3>快捷键</h3>
      <dl className="shortcuts">
        <dt>Delete / Backspace</dt>
        <dd>删除所选</dd>
        <dt>⌘/Ctrl + C / V / D</dt>
        <dd>复制 / 粘贴 / 复制一份</dd>
        <dt>⌘/Ctrl + Z，⇧⌘Z</dt>
        <dd>撤销 / 重做</dd>
        <dt>Shift + 拖动</dt>
        <dd>框选</dd>
        <dt>⌘/Ctrl + Enter</dt>
        <dd>运行并记录</dd>
      </dl>
    </div>
  );
}

export function Inspector({
  doc,
  node,
  views,
  tab,
  onTab,
  onLabel,
  onConfig,
  onConnect,
  onDisconnect,
  onLoadFile,
  onDuplicate,
  onRemove,
  onSelect,
}: {
  doc: FlowDocument;
  node: PipelineNode | null;
  views: Record<string, NodeView>;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onLabel: (label: string) => void;
  onConfig: (key: string, value: unknown) => void;
  onConnect: (port: string, source: string, handle: string) => void;
  onDisconnect: (port: string) => void;
  onLoadFile: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSelect: (id: string) => void;
}) {
  if (!node) return <Overview doc={doc} views={views} onSelect={onSelect} />;
  const op = spec(node.data.op);
  const Icon = opIcons[node.data.op];
  const view = views[node.id];
  const value = view?.live ? shownValue(view.live) : undefined;
  const extraPorts = view?.live ? Object.entries(view.live.outputs).filter(([port]) => port !== "out") : [];
  return (
    <div className="inspector-body" data-category={op.category}>
      <header className="inspector-head">
        <Icon aria-hidden="true" size={16} />
        <div>
          <span className="eyebrow">{op.title}</span>
          <p className="muted">{op.description}</p>
        </div>
      </header>
      <div className="field">
        <label htmlFor="node-label">节点名称</label>
        <input id="node-label" value={node.data.label} maxLength={80} autoComplete="off" onChange={(event) => onLabel(event.target.value)} aria-invalid={!node.data.label.trim() || undefined} />
        {!node.data.label.trim() ? <p className="field-error">名称为空时只保存为草稿。</p> : null}
      </div>
      <div className="tabs" role="tablist" aria-label="检查器视图">
        <button type="button" role="tab" id="tab-config" aria-selected={tab === "config"} aria-controls="panel-config" onClick={() => onTab("config")}>
          配置
        </button>
        <button type="button" role="tab" id="tab-output" aria-selected={tab === "output"} aria-controls="panel-output" onClick={() => onTab("output")}>
          输出{view?.status === "error" ? " ⚠" : view?.summary ? ` · ${view.summary}` : ""}
        </button>
      </div>
      {tab === "config" ? (
        <div role="tabpanel" id="panel-config" aria-labelledby="tab-config">
          <Sources doc={doc} node={node} onConnect={onConnect} onDisconnect={onDisconnect} />
          {op.category === "input" ? (
            <button type="button" className="wide" onClick={onLoadFile}>
              <FileUp aria-hidden="true" size={14} />
              从文件载入{String(node.data.config.fileName || "") ? `（当前：${String(node.data.config.fileName)}）` : ""}
            </button>
          ) : null}
          <ConfigEditor op={node.data.op} config={node.data.config} columns={columnsFor(doc, node, views)} onChange={onConfig} />
          <div className="node-actions">
            <button type="button" onClick={onDuplicate}>
              <Copy aria-hidden="true" size={14} />
              复制节点
            </button>
            <button type="button" className="danger" onClick={onRemove}>
              <Trash2 aria-hidden="true" size={14} />
              删除节点
            </button>
          </div>
        </div>
      ) : (
        <div role="tabpanel" id="panel-output" aria-labelledby="tab-output" className="output-panel">
          {view?.status === "error" ? (
            <p className="field-error" role="alert">
              {view.error}
            </p>
          ) : null}
          {view?.status === "skipped" ? <p className="muted">{view.error}</p> : null}
          {view?.stale ? <p className="stale-note">配置已修改，这是旧结果；运行后更新。</p> : null}
          {view?.ms !== undefined && view.status === "ok" ? (
            <p className="muted">
              {view.summary} · 用时 {formatMs(view.ms)}
            </p>
          ) : null}
          {value ? (
            <ValueView value={value} chart={node.data.op === "chartOutput"} name={node.data.op === "fileOutput" ? String(node.data.config.fileName || node.data.label) : node.data.label} />
          ) : view?.preview ? (
            <PreviewView preview={view.preview} chart={node.data.op === "chartOutput"} />
          ) : view?.status !== "error" ? (
            <p className="muted">尚无输出。点击「运行」或开启自动运行。</p>
          ) : null}
          {extraPorts.map(([port, extra]) => (
            <section key={port} className="extra-port">
              <h3>{op.outputs.find((item) => item.id === port)?.label ?? port}端口</h3>
              <ValueView value={extra} name={`${node.data.label}-${port}`} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
