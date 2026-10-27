import { isRecord, boundedText } from "./project.ts";
export type Operation = "input" | "uppercase" | "prefix" | "output";
export type StepData = { label: string; operation: Operation; value: string };
export type StepNode = {
  id: string;
  type: "step";
  position: { x: number; y: number };
  data: StepData;
};
export type FlowEdge = { id: string; source: string; target: string };
export interface RunResult {
  at: string;
  signature: string;
  output: string;
  steps: { id: string; label: string; input: string; output: string }[];
}
export interface FlowDocument {
  nodes: StepNode[];
  edges: FlowEdge[];
  lastRun?: RunResult;
}
const operations = new Set(["input", "uppercase", "prefix", "output"]);
const identifier = (value: unknown) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value))
    throw new Error("步骤标识无效。");
  return value;
};
export function validateFlow(value: unknown): FlowDocument {
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges) ||
    value.nodes.length < 2 ||
    value.nodes.length > 30 ||
    value.edges.length > 60
  )
    throw new Error("流程需要 2–30 个步骤，最多 60 条连接。");
  const nodes = value.nodes.map((node): StepNode => {
    if (
      !isRecord(node) ||
      !isRecord(node.data) ||
      !isRecord(node.position) ||
      typeof node.position.x !== "number" ||
      typeof node.position.y !== "number" ||
      !Number.isFinite(node.position.x) ||
      !Number.isFinite(node.position.y) ||
      Math.abs(node.position.x) > 100000 ||
      Math.abs(node.position.y) > 100000
    )
      throw new Error("步骤位置或配置无效。");
    if (
      typeof node.data.operation !== "string" ||
      !operations.has(node.data.operation)
    )
      throw new Error("只支持输入、大写、添加前缀和输出。");
    const label = boundedText(node.data.label, 80);
    if (!label.trim()) throw new Error("步骤名称不能为空。");
    return {
      id: identifier(node.id),
      type: "step",
      position: { x: node.position.x, y: node.position.y },
      data: {
        label,
        operation: node.data.operation as Operation,
        value: boundedText(node.data.value ?? "", 10000),
      },
    };
  });
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) throw new Error("步骤标识重复。");
  const edges = value.edges.map((edge): FlowEdge => {
    if (
      !isRecord(edge) ||
      !ids.has(String(edge.source)) ||
      !ids.has(String(edge.target)) ||
      edge.source === edge.target
    )
      throw new Error("连接必须引用两个已有步骤。");
    return {
      id: identifier(edge.id),
      source: String(edge.source),
      target: String(edge.target),
    };
  });
  if (new Set(edges.map((edge) => edge.id)).size !== edges.length)
    throw new Error("连接标识重复。");
  let lastRun: RunResult | undefined;
  if (value.lastRun !== undefined) {
    const run = value.lastRun;
    if (
      !isRecord(run) ||
      typeof run.at !== "string" ||
      !Array.isArray(run.steps) ||
      run.steps.length > 30
    )
      throw new Error("运行记录无效。");
    lastRun = {
      at: run.at,
      signature: boundedText(run.signature, 50000),
      output: boundedText(run.output, 20000),
      steps: run.steps.map((step) => {
        if (!isRecord(step)) throw new Error("运行步骤无效。");
        return {
          id: identifier(step.id),
          label: boundedText(step.label, 80),
          input: boundedText(step.input, 20000),
          output: boundedText(step.output, 20000),
        };
      }),
    };
  }
  return { nodes, edges, ...(lastRun ? { lastRun } : {}) };
}
export function signature(flow: FlowDocument) {
  return JSON.stringify({
    nodes: flow.nodes.map(({ id, data }) => ({ id, data })),
    edges: flow.edges.map(({ source, target }) => ({ source, target })),
  });
}
export function executeFlow(value: unknown): RunResult {
  const flow = validateFlow(value),
    input = flow.nodes.filter((node) => node.data.operation === "input"),
    output = flow.nodes.filter((node) => node.data.operation === "output");
  if (input.length !== 1 || output.length !== 1)
    throw new Error("流程必须恰好有一个输入和一个输出步骤。");
  const next = new Map<string, string>(),
    incoming = new Map<string, number>();
  for (const edge of flow.edges) {
    if (next.has(edge.source))
      throw new Error("当前仅支持单链流程，一个步骤只能有一个后续步骤。");
    next.set(edge.source, edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  }
  if (incoming.has(input[0].id) || next.has(output[0].id))
    throw new Error("输入不能有前置步骤，输出不能有后续步骤。");
  for (const node of flow.nodes) {
    if (node.id !== input[0].id && incoming.get(node.id) !== 1)
      throw new Error("每个非输入步骤都需要且只能有一个前置步骤。");
    if (node.id !== output[0].id && !next.has(node.id))
      throw new Error("存在没有连接到输出的步骤。");
  }
  const lookup = new Map(flow.nodes.map((node) => [node.id, node])),
    seen = new Set<string>(),
    steps: RunResult["steps"] = [];
  let id: string | undefined = input[0].id,
    text = "";
  while (id) {
    if (seen.has(id)) throw new Error("流程中存在循环，请删除回路。");
    seen.add(id);
    const node = lookup.get(id)!;
    const before = text;
    switch (node.data.operation) {
      case "input":
        text = node.data.value;
        break;
      case "uppercase":
        text = text.toUpperCase();
        break;
      case "prefix":
        text = node.data.value + text;
        break;
      case "output":
        break;
    }
    if (text.length > 20000) throw new Error("运行结果超过 20,000 字符。");
    steps.push({ id, label: node.data.label, input: before, output: text });
    id = next.get(id);
  }
  if (seen.size !== flow.nodes.length)
    throw new Error("有未连入主链的步骤或回路。");
  return {
    at: new Date().toISOString(),
    signature: signature(flow),
    output: text,
    steps,
  };
}
export const seed: FlowDocument = {
  nodes: [
    {
      id: "input",
      type: "step",
      position: { x: 50, y: 170 },
      data: { label: "输入文本", operation: "input", value: "hello floatboat" },
    },
    {
      id: "upper",
      type: "step",
      position: { x: 290, y: 170 },
      data: { label: "转为大写", operation: "uppercase", value: "" },
    },
    {
      id: "prefix",
      type: "step",
      position: { x: 530, y: 170 },
      data: { label: "添加前缀", operation: "prefix", value: "结果：" },
    },
    {
      id: "output",
      type: "step",
      position: { x: 770, y: 170 },
      data: { label: "输出结果", operation: "output", value: "" },
    },
  ],
  edges: [
    { id: "e1", source: "input", target: "upper" },
    { id: "e2", source: "upper", target: "prefix" },
    { id: "e3", source: "prefix", target: "output" },
  ],
};

export function validateGeneratedFlow(value: unknown): FlowDocument {
  if (!isRecord(value)) throw new Error("流程配置无效。");
  return validateFlow({ nodes: value.nodes, edges: value.edges });
}
