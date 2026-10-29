// ABOUTME: 画布上的节点卡片：带类型的端口、配置摘要，以及直接显示在节点上的运行状态、耗时与结果预览。
import { Handle, NodeToolbar, Position, type Node, type NodeProps } from "@xyflow/react";
import { CircleAlert, CircleCheck, CircleDashed, Copy, Download, Eye, LoaderCircle, Trash2 } from "lucide-react";
import { memo, useContext } from "react";
import { spec } from "../contracts/ops";
import { cellText, type Preview } from "../contracts/values";
import { describe } from "./describe";
import { opIcons, portMarks } from "./icons";
import { ActionsContext, formatMs, type NodeView, type OpNodeData } from "./view";

export type OpFlowNode = Node<OpNodeData, "op">;

function StatusBadge({ view }: { view: NodeView }) {
  const label =
    view.status === "running"
      ? "运行中"
      : view.status === "ok"
        ? formatMs(view.ms)
        : view.status === "error"
          ? "失败"
          : view.status === "skipped"
            ? "跳过"
            : "未运行";
  const Icon =
    view.status === "running" ? LoaderCircle : view.status === "ok" ? CircleCheck : view.status === "error" ? CircleAlert : CircleDashed;
  return (
    <span className="status-badge" data-status={view.status} data-stale={view.stale || undefined}>
      <Icon aria-hidden="true" size={12} />
      {view.stale && view.status !== "running" ? "过期 · " : ""}
      {label}
    </span>
  );
}

function MiniPreview({ preview, chart }: { preview: Preview; chart: boolean }) {
  if (preview.type === "table" && chart) {
    const values = preview.rows.map((row) => Number(row[1]) || 0);
    const max = Math.max(1, ...values.map(Math.abs));
    return (
      <div className="mini-chart" aria-hidden="true">
        {preview.rows.slice(0, 4).map((row, index) => (
          <div key={index} className="mini-bar">
            <span className="mini-bar-label">{cellText(row[0])}</span>
            <span className="mini-bar-track">
              <span className="mini-bar-fill" style={{ width: `${(Math.abs(values[index]) / max) * 100}%` }} />
            </span>
            <span className="mini-bar-value">{values[index].toLocaleString("zh-CN")}</span>
          </div>
        ))}
      </div>
    );
  }
  if (preview.type === "table") {
    const columns = preview.columns.slice(0, 3);
    return (
      <table className="mini-table" aria-hidden="true">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.slice(0, 3).map((row, index) => (
            <tr key={index}>
              {columns.map((_, column) => (
                <td key={column}>{cellText(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const lines = preview.text.split("\n").slice(0, 3).join("\n");
  return (
    <pre className="mini-text" aria-hidden="true">
      {lines || "（空）"}
    </pre>
  );
}

function OpNodeView({ id, data, selected }: NodeProps<OpFlowNode>) {
  const actions = useContext(ActionsContext);
  const { node, view } = data;
  const op = spec(node.data.op);
  const Icon = opIcons[node.data.op];
  const rows = Math.max(op.inputs.length, op.outputs.length);
  return (
    <div
      className="op-node"
      data-category={op.category}
      data-status={view.status}
      data-stale={view.stale || undefined}
      data-selected={selected || undefined}
    >
      <NodeToolbar position={Position.Top} align="end" className="node-toolbar">
        <button type="button" className="nodrag" onClick={() => actions?.showOutput(id)} title="在检查器中查看完整输出">
          <Eye aria-hidden="true" size={13} />
          输出
        </button>
        <button type="button" className="nodrag" onClick={() => actions?.duplicate(id)} title="复制节点（⌘/Ctrl+D）">
          <Copy aria-hidden="true" size={13} />
          复制
        </button>
        <button type="button" className="nodrag danger" onClick={() => actions?.remove(id)} title="删除节点（Delete）">
          <Trash2 aria-hidden="true" size={13} />
          删除
        </button>
      </NodeToolbar>
      <header className="op-head">
        <Icon aria-hidden="true" size={14} />
        <span className="op-kind">{op.title}</span>
        <StatusBadge view={view} />
      </header>
      <strong className="op-label">{node.data.label || "（未命名）"}</strong>
      <p className="op-desc" title={describe(node.data)}>
        {describe(node.data)}
      </p>
      {rows ? (
        <div className="op-ports">
          {Array.from({ length: rows }, (_, index) => {
            const input = op.inputs[index],
              output = op.outputs[index];
            const inType = input ? data.inTypes[input.id] : null;
            const outType = output ? data.outTypes[output.id] : null;
            return (
              <div className="port-row" key={index}>
                {input ? (
                  <span className="port-label in" data-type={inType ?? "any"}>
                    <Handle
                      type="target"
                      id={input.id}
                      position={Position.Left}
                      className="port-handle"
                      data-type={inType ?? "any"}
                      data-connected={data.connected[input.id] || undefined}
                      aria-label={`${node.data.label} 的输入端口 ${input.label}`}
                    />
                    <span className="port-mark">{input.accepts.map((t) => portMarks[t]).join("/")}</span>
                    {input.label}
                  </span>
                ) : (
                  <span />
                )}
                {output ? (
                  <span className="port-label out" data-type={outType ?? "any"}>
                    {output.label}
                    <span className="port-mark">{outType ? portMarks[outType] : "?"}</span>
                    <Handle
                      type="source"
                      id={output.id}
                      position={Position.Right}
                      className="port-handle"
                      data-type={outType ?? "any"}
                      aria-label={`${node.data.label} 的输出端口 ${output.label}`}
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {view.status === "error" && view.error ? (
        <p className="op-error" role="alert">
          {view.error}
        </p>
      ) : view.status === "skipped" && view.error ? (
        <p className="op-skip">{view.error}</p>
      ) : null}
      {view.status === "ok" ? (
        <footer className="op-result">
          <span className="op-summary">{view.summary}</span>
          {view.preview ? <MiniPreview preview={view.preview} chart={node.data.op === "chartOutput"} /> : null}
          {node.data.op === "fileOutput" ? (
            <button
              type="button"
              className="nodrag node-download"
              disabled={!view.live}
              onClick={() => actions?.download(id)}
              title={view.live ? undefined : "运行后可下载"}
            >
              <Download aria-hidden="true" size={13} />
              下载 {String(node.data.config.fileName || "结果")}.{String(node.data.config.format)}
            </button>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

export const OpNode = memo(OpNodeView);
