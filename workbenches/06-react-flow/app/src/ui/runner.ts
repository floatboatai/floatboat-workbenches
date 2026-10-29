// ABOUTME: 主线程运行器：复用一个执行 Worker，新运行取消旧运行，单节点超时则终止 Worker 并把超时钉在该节点。
import { nodeSignatures, type NodeResult, type RunReport } from "../contracts/engine";
import type { FlowDocument } from "../contracts/flow";

export const NODE_TIMEOUT_MS = 5000;

type Message =
  | { id: number; type: "start"; node: string }
  | { id: number; type: "node"; node: string; result: NodeResult }
  | { id: number; type: "done"; at: string; ms: number; order: string[]; sigs: Record<string, string> }
  | { id: number; type: "fail"; message: string };

export interface RunProgress {
  current: string | null;
  results: Record<string, NodeResult>;
}

export class CancelledRun extends Error {}

let worker: Worker | null = null;
let sequence = 0;
let cancelActive: (() => void) | null = null;

function spawn() {
  worker ??= new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/** 运行流水线。onProgress 在每个节点开始/结束时回调，便于节点逐个点亮。 */
export function runInWorker(doc: FlowDocument, onProgress: (progress: RunProgress) => void): Promise<RunReport> {
  cancelActive?.();
  const id = ++sequence;
  const started = performance.now();
  const results: Record<string, NodeResult> = {};
  let current: string | null = null;
  return new Promise<RunReport>((resolve, reject) => {
    const target = spawn();
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener("message", listen);
      target.removeEventListener("error", crashed);
      if (cancelActive === cancel) cancelActive = null;
    };
    const arm = () => {
      clearTimeout(timer);
      timer = window.setTimeout(timeout, NODE_TIMEOUT_MS);
    };
    const finish = (at: string, order: string[], sigs: Record<string, string>) => {
      cleanup();
      resolve({ at, ms: performance.now() - started, order, results, sigs });
    };
    function timeout() {
      // 同步执行无法中断，只能终止 Worker；把超时记在当前节点，其余未完成节点标记为中断。
      target.terminate();
      worker = null;
      const sigs = nodeSignatures(doc);
      for (const node of doc.nodes)
        if (!results[node.id])
          results[node.id] =
            node.id === current
              ? { status: "error", ms: NODE_TIMEOUT_MS, outputs: {}, summary: "超时", error: `运行超过 ${NODE_TIMEOUT_MS / 1000} 秒已终止。若使用了正则，请简化写法或缩小数据。` }
              : { status: "skipped", ms: 0, outputs: {}, summary: "已跳过", error: "运行因超时中断。" };
      finish(new Date().toISOString(), doc.nodes.map((node) => node.id), sigs);
    }
    function listen(event: MessageEvent<Message>) {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === "start") {
        current = message.node;
        arm();
        onProgress({ current, results: { ...results } });
      } else if (message.type === "node") {
        results[message.node] = message.result;
        current = null;
        onProgress({ current, results: { ...results } });
      } else if (message.type === "done") finish(message.at, message.order, message.sigs);
      else {
        cleanup();
        reject(new Error(message.message));
      }
    }
    function crashed() {
      cleanup();
      target.terminate();
      worker = null;
      reject(new Error("执行器意外停止，请重试。"));
    }
    function cancel() {
      cleanup();
      target.terminate();
      worker = null;
      reject(new CancelledRun("已被新的运行取代。"));
    }
    cancelActive = cancel;
    target.addEventListener("message", listen);
    target.addEventListener("error", crashed);
    arm();
    target.postMessage({ id, doc });
  });
}
