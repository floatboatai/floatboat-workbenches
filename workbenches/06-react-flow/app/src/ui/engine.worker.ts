// ABOUTME: 在独立 Worker 中执行流水线，逐节点回传结果；主线程可在超时后终止整个 Worker。
import { runPipeline } from "../contracts/engine";
import type { FlowDocument } from "../contracts/flow";

type Scope = {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<{ id: number; doc: FlowDocument }>) => void) | null;
};
const scope = self as unknown as Scope;

scope.onmessage = (event) => {
  const { id, doc } = event.data;
  try {
    const report = runPipeline(doc, {
      onNodeStart: (node) => scope.postMessage({ id, type: "start", node }),
      onNodeDone: (node, result) => scope.postMessage({ id, type: "node", node, result }),
    });
    scope.postMessage({ id, type: "done", at: report.at, ms: report.ms, order: report.order, sigs: report.sigs });
  } catch (error) {
    scope.postMessage({ id, type: "fail", message: error instanceof Error ? error.message : "运行失败。" });
  }
};
