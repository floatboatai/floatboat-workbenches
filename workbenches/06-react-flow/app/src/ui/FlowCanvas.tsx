import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeProps,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useRef } from "react";
import type { FlowDocument, StepNode, FlowEdge } from "../contracts/flow";
import "@xyflow/react/dist/style.css";
const labels = {
  input: "输入",
  uppercase: "文本变换",
  prefix: "文本变换",
  output: "输出",
};
function Step({ data: unknownData }: NodeProps) {
  const data = unknownData as StepNode["data"];
  return (
    <div className={`flow-step op-${data.operation}`}>
      {data.operation !== "input" ? (
        <Handle type="target" position={Position.Left} />
      ) : null}
      <span className="step-kind">{labels[data.operation]}</span>
      <strong>{data.label}</strong>
      <small>
        {data.operation === "input" || data.operation === "prefix"
          ? data.value || "尚未输入"
          : data.operation === "uppercase"
            ? "a → A"
            : "接收上一步结果"}
      </small>
      {data.operation !== "output" ? (
        <Handle type="source" position={Position.Right} />
      ) : null}
    </div>
  );
}
const nodeTypes = { step: Step };
export function FlowCanvas({
  data,
  onChange,
  onSelect,
  locked,
}: {
  data: FlowDocument;
  onChange: (value: FlowDocument) => void;
  onSelect: (id: string) => void;
  locked: boolean;
}) {
  const instance = useRef<ReactFlowInstance<StepNode, FlowEdge> | null>(null);
  const onNodesChange: OnNodesChange<StepNode> = (changes) => {
    const updates = changes.filter(
      (change) => change.type !== "select" && change.type !== "dimensions",
    );
    if (!locked && updates.length)
      onChange({
        ...data,
        nodes: applyNodeChanges(updates, data.nodes).map((node) => ({
          id: node.id,
          type: "step",
          position: node.position,
          data: node.data,
        })),
      });
  };
  const onEdgesChange: OnEdgesChange<FlowEdge> = (changes) => {
    const updates = changes.filter((change) => change.type !== "select");
    if (!locked && updates.length)
      onChange({
        ...data,
        edges: applyEdgeChanges(updates, data.edges).map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
        })),
      });
  };
  const onConnect: OnConnect = (connection) => {
    if (!locked) onChange({ ...data, edges: addEdge(connection, data.edges) });
  };
  return (
    <div className="flow-canvas">
      <ReactFlow<StepNode, FlowEdge>
        nodes={data.nodes}
        edges={data.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(value) => {
          instance.current = value;
        }}
        onNodeClick={(_, node) => onSelect(node.id)}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        deleteKeyCode={null}
        fitView
        colorMode="dark"
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#364453" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
