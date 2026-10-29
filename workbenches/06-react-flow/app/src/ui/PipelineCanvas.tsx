// ABOUTME: React Flow 画布：受控节点/连线、端口类型校验、拖放添加、框选、删除、MiniMap 与尺寸变化时自适应。
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type NodeChange,
} from "@xyflow/react";
import { LayoutDashboard, Redo2, SquareDashedMousePointer, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { checkConnection, outputType } from "../contracts/engine";
import type { FlowDocument } from "../contracts/flow";
import { isOpKind, spec, type OpKind } from "../contracts/ops";
import type { PortType } from "../contracts/values";
import { OpNode, type OpFlowNode } from "./OpNode";
import type { NodeView } from "./view";
import "@xyflow/react/dist/style.css";

const nodeTypes = { op: OpNode };
export const DRAG_TYPE = "application/x-floatboat-op";
const edgeColors: Record<PortType | "any", string> = {
  text: "var(--type-text)",
  table: "var(--type-table)",
  json: "var(--type-json)",
  any: "var(--muted)",
};

/** 按顺序应用选中/取消，最后选中的保持在末尾（检查器显示它）。 */
function applyPicks(current: string[], picks: [string, boolean][]): string[] {
  const off = new Set(picks.filter(([, on]) => !on).map(([id]) => id));
  const result = current.filter((id) => !off.has(id));
  for (const [id, on] of picks) if (on && !result.includes(id)) result.push(id);
  return result;
}

export interface Selection {
  nodes: string[];
  edges: string[];
}

export function PipelineCanvas({
  doc,
  views,
  selection,
  onSelection,
  onMove,
  onConnect,
  onDelete,
  onDropOp,
  onDropFile,
  onLayout,
  onReject,
  undo,
  redo,
  sizes,
  onSizes,
}: {
  doc: FlowDocument;
  views: Record<string, NodeView>;
  selection: Selection;
  onSelection: (update: (previous: Selection) => Selection) => void;
  onMove: (positions: Record<string, { x: number; y: number }>) => void;
  onConnect: (connection: Connection) => void;
  onDelete: (nodes: string[], edges: string[]) => void;
  onDropOp: (op: OpKind, position: { x: number; y: number }) => void;
  onDropFile: (file: File, position: { x: number; y: number }) => void;
  onLayout: () => void;
  onReject: (reason: string) => void;
  undo: { run: () => void; enabled: boolean };
  redo: { run: () => void; enabled: boolean };
  sizes: Record<string, { width: number; height: number }>;
  onSizes: (update: (previous: Record<string, { width: number; height: number }>) => Record<string, { width: number; height: number }>) => void;
}) {
  const flow = useReactFlow<OpFlowNode, Edge>();
  const [dragging, setDragging] = useState<Record<string, { x: number; y: number }>>({});
  const [boxMode, setBoxMode] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  const types = useMemo(() => {
    const out: Record<string, Record<string, PortType | null>> = {};
    for (const node of doc.nodes) {
      out[node.id] = {};
      for (const port of spec(node.data.op).outputs) out[node.id][port.id] = outputType(doc, node.id, port.id);
    }
    return out;
  }, [doc]);

  const selectedNodes = useMemo(() => new Set(selection.nodes), [selection.nodes]);
  const selectedEdges = useMemo(() => new Set(selection.edges), [selection.edges]);

  const nodes = useMemo<OpFlowNode[]>(
    () =>
      doc.nodes.map((node) => {
        const incoming = doc.edges.filter((edge) => edge.target === node.id);
        const inTypes: Record<string, PortType | null> = {};
        const connected: Record<string, boolean> = {};
        for (const port of spec(node.data.op).inputs) {
          const edge = incoming.find((item) => item.targetHandle === port.id);
          connected[port.id] = !!edge;
          inTypes[port.id] = edge ? (types[edge.source]?.[edge.sourceHandle] ?? null) : port.accepts.length === 1 ? port.accepts[0] : null;
        }
        return {
          id: node.id,
          type: "op",
          position: dragging[node.id] ?? node.position,
          selected: selectedNodes.has(node.id),
          ...(sizes[node.id] ? { measured: sizes[node.id] } : {}),
          ariaLabel: `${node.data.label}（${spec(node.data.op).title}）`,
          data: { node, view: views[node.id], inTypes, outTypes: types[node.id] ?? {}, connected },
        };
      }),
    [doc, views, types, dragging, selectedNodes, sizes],
  );

  const edges = useMemo<Edge[]>(
    () =>
      doc.edges.map((edge) => {
        const type = types[edge.source]?.[edge.sourceHandle] ?? "any";
        const running = views[edge.source]?.status === "running";
        return {
          id: edge.id,
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: edge.target,
          targetHandle: edge.targetHandle,
          selected: selectedEdges.has(edge.id),
          animated: running,
          style: { stroke: edgeColors[type], strokeWidth: selectedEdges.has(edge.id) ? 3 : 2 },
          className: `edge-${type}`,
        };
      }),
    [doc.edges, types, views, selectedEdges],
  );

  function onNodesChange(changes: NodeChange<OpFlowNode>[]) {
    const picks: [string, boolean][] = [];
    const moving: Record<string, { x: number; y: number }> = {};
    const finished: Record<string, { x: number; y: number }> = {};
    const measured: Record<string, { width: number; height: number }> = {};
    for (const change of changes) {
      if (change.type === "select") picks.push([change.id, change.selected]);
      else if (change.type === "position" && change.position) {
        if (change.dragging) moving[change.id] = change.position;
        else finished[change.id] = change.position;
      } else if (change.type === "position" && change.dragging === false) {
        const last = dragging[change.id];
        if (last) finished[change.id] = last;
      } else if (change.type === "dimensions" && change.dimensions) measured[change.id] = change.dimensions;
    }
    if (Object.keys(measured).length) onSizes((previous) => ({ ...previous, ...measured }));
    if (Object.keys(moving).length) setDragging((previous) => ({ ...previous, ...moving }));
    if (Object.keys(finished).length) {
      onMove(finished);
      setDragging((previous) => {
        const next = { ...previous };
        for (const id of Object.keys(finished)) delete next[id];
        return next;
      });
    }
    if (picks.length) onSelection((previous) => ({ ...previous, nodes: applyPicks(previous.nodes, picks) }));
  }

  function onEdgesChange(changes: EdgeChange<Edge>[]) {
    const picks: [string, boolean][] = [];
    for (const change of changes) if (change.type === "select") picks.push([change.id, change.selected]);
    if (picks.length) onSelection((previous) => ({ ...previous, edges: applyPicks(previous.edges, picks) }));
  }

  const isValidConnection: IsValidConnection<Edge> = (connection) => checkConnection(doc, connection).ok;

  function position(event: { clientX: number; clientY: number }) {
    return flow.screenToFlowPosition({ x: event.clientX - 112, y: event.clientY - 24 });
  }
  function onDragOver(event: DragEvent) {
    if (event.dataTransfer.types.includes(DRAG_TYPE) || event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes("Files") ? "copy" : "move";
    }
  }
  function onDrop(event: DragEvent) {
    const op = event.dataTransfer.getData(DRAG_TYPE);
    if (isOpKind(op)) {
      event.preventDefault();
      onDropOp(op, position(event));
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) {
      event.preventDefault();
      onDropFile(file, position(event));
    }
  }

  // 容器尺寸明显变化（窗口、侧栏收起、窄屏旋转）时重新适应视图。
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    let width = element.clientWidth,
      height = element.clientHeight,
      timer = 0;
    const observer = new ResizeObserver(() => {
      if (Math.abs(element.clientWidth - width) < 40 && Math.abs(element.clientHeight - height) < 40) return;
      width = element.clientWidth;
      height = element.clientHeight;
      clearTimeout(timer);
      timer = window.setTimeout(() => void flow.fitView({ padding: 0.12, maxZoom: 1.1 }), 120);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [flow]);

  return (
    <div className="pipeline-canvas" ref={wrapper} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow<OpFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={({ nodes: removed, edges: cut }) => onDelete(removed.map((n) => n.id), cut.map((e) => e.id))}
        onConnectEnd={(_, state) => {
          if (state.isValid === false && state.toHandle && state.fromHandle) {
            const forward = state.fromHandle.type === "source";
            const from = forward ? state.fromHandle : state.toHandle;
            const to = forward ? state.toHandle : state.fromHandle;
            const check = checkConnection(doc, { source: from.nodeId, sourceHandle: from.id, target: to.nodeId, targetHandle: to.id });
            if (check.reason) onReject(check.reason);
          }
        }}
        isValidConnection={isValidConnection}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        selectionOnDrag={boxMode}
        panOnDrag={boxMode ? [1, 2] : true}
        selectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
        minZoom={0.15}
        maxZoom={2}
        colorMode="dark"
        defaultEdgeOptions={{ interactionWidth: 18 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--grid)" />
        <MiniMap
          pannable
          zoomable
          style={{ width: 150, height: 96 }}
          position="top-right"
          ariaLabel="流水线小地图"
          nodeColor={(node) => `var(--cat-${spec((node.data as OpFlowNode["data"]).node.data.op).category})`}
          nodeStrokeWidth={0}
          maskColor="rgba(10, 13, 17, 0.65)"
        />
        <Controls showInteractive={false} position="bottom-left" aria-label="画布缩放">
          <ControlButton onClick={undo.run} disabled={!undo.enabled} title="撤销（⌘/Ctrl+Z）" aria-label="撤销">
            <Undo2 size={14} />
          </ControlButton>
          <ControlButton onClick={redo.run} disabled={!redo.enabled} title="重做（⇧⌘Z / Ctrl+Y）" aria-label="重做">
            <Redo2 size={14} />
          </ControlButton>
          <ControlButton onClick={onLayout} title="自动整理布局" aria-label="自动整理布局">
            <LayoutDashboard size={14} />
          </ControlButton>
          <ControlButton
            onClick={() => setBoxMode((value) => !value)}
            title={boxMode ? "框选模式：拖动画布框选节点（再次点击切回平移）" : "切换框选模式（或按住 Shift 拖动）"}
            aria-label="框选模式"
            aria-pressed={boxMode}
            className={boxMode ? "is-active" : ""}
          >
            <SquareDashedMousePointer size={14} />
          </ControlButton>
        </Controls>
        {!doc.nodes.length ? (
          <Panel position="top-center" className="empty-hint">
            从左侧节点架拖入一个输入节点，或在「文件」里从模板新建。
          </Panel>
        ) : null}
      </ReactFlow>
    </div>
  );
}
