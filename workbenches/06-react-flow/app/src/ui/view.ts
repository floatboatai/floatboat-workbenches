// ABOUTME: 把实时运行结果与已保存运行记录合成为每个节点的显示状态（状态、耗时、预览、是否过期）。
import { createContext } from "react";
import type { NodeResult } from "../contracts/engine";
import type { FlowDocument, NodeRun } from "../contracts/flow";
import { preview, type PortType, type Preview, type Value } from "../contracts/values";

export type ViewStatus = "idle" | "running" | "ok" | "error" | "skipped";
export interface NodeView {
  status: ViewStatus;
  stale: boolean;
  ms?: number;
  summary?: string;
  error?: string;
  preview?: Preview;
  /** 本次会话中可下载/查看的完整值。 */
  live?: NodeResult;
}

export interface LiveRun {
  at: string;
  ms: number;
  results: Record<string, NodeResult>;
  sigs: Record<string, string>;
  order: string[];
}

export const shownValue = (result: NodeResult): Value | undefined =>
  result.view ?? result.outputs.out ?? Object.values(result.outputs)[0];

const previewCache = new WeakMap<object, Preview>();
function smallPreview(value: Value): Preview {
  let cached = previewCache.get(value);
  if (!cached) {
    cached = preview(value, 4, 240);
    previewCache.set(value, cached);
  }
  return cached;
}

export function nodeView(
  id: string,
  sig: string,
  live: LiveRun | null,
  progress: { running: boolean; current: string | null; results: Record<string, NodeResult> } | null,
  saved: NodeRun | undefined,
): NodeView {
  if (progress?.running && progress.current === id) return { status: "running", stale: false };
  const fromProgress = progress?.running ? progress.results[id] : undefined;
  const result = fromProgress ?? live?.results[id];
  if (result) {
    const value = shownValue(result);
    return {
      status: result.status,
      stale: !fromProgress && live?.sigs[id] !== sig,
      ms: result.ms,
      summary: result.summary,
      error: result.error,
      ...(value && result.status === "ok" ? { preview: smallPreview(value) } : {}),
      live: result,
    };
  }
  if (progress?.running) return { status: "idle", stale: true };
  if (saved)
    return {
      status: saved.status,
      stale: saved.sig !== sig,
      ms: saved.ms,
      summary: saved.summary,
      error: saved.error,
      preview: saved.preview,
    };
  return { status: "idle", stale: false };
}

export interface CanvasActions {
  select: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  showOutput: (id: string) => void;
  download: (id: string) => void;
}
export const ActionsContext = createContext<CanvasActions | null>(null);

export interface OpNodeData extends Record<string, unknown> {
  node: FlowDocument["nodes"][number];
  view: NodeView;
  inTypes: Record<string, PortType | null>;
  outTypes: Record<string, PortType | null>;
  connected: Record<string, boolean>;
}

export const formatMs = (ms: number | undefined) =>
  ms === undefined ? "" : ms < 1 ? "<1 ms" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
