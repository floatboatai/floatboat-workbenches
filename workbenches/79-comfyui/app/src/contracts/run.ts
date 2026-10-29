// ABOUTME: 运行记录、实时状态与连接配置的共享类型，以及从提示词提取可复现参数。

import { isRecord } from "./project.ts";
import type { ApiPrompt } from "./convert.ts";
import type { UiWorkflow } from "./workflow.ts";

export type RunStatus = "queued" | "running" | "success" | "error" | "interrupted" | "cancelled";
export const FINISHED: readonly RunStatus[] = ["success", "error", "interrupted", "cancelled"];
export const isFinished = (s: RunStatus) => FINISHED.includes(s);

export interface RunError {
  message: string;
  nodeId: string | null;
  nodeType: string | null;
  details: string;
}
export interface OutputMeta {
  id: string;
  runId: string;
  nodeId: string;
  filename: string;
  subfolder: string;
  /** ComfyUI storage type: output, temp or input. */
  kind: string;
  mime: string;
  width: number | null;
  height: number | null;
  bytes: number;
}
export interface RunFacts {
  seeds: number[];
  models: string[];
  loras: string[];
  steps: number | null;
  cfg: number | null;
  sampler: string;
  scheduler: string;
  denoise: number | null;
  width: number | null;
  height: number | null;
  positive: string;
  negative: string;
}
export interface RunSummary {
  id: string;
  projectId: string;
  title: string;
  status: RunStatus;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  promptId: string;
  server: string;
  error: RunError | null;
  outputs: OutputMeta[];
  facts: RunFacts;
  nodeCount: number;
}
export interface RunDetail extends RunSummary {
  prompt: ApiPrompt;
  workflow: UiWorkflow;
}
export interface RunLive {
  runId: string;
  promptId: string;
  status: RunStatus;
  currentNode: string | null;
  progress: { node: string | null; value: number; max: number } | null;
  executed: string[];
  cached: string[];
  total: number;
  previewVersion: number;
  previewNode: string | null;
  error: RunError | null;
  queuePosition: number | null;
}
export interface ConnectionConfig {
  baseUrl: string;
  headerName: string;
  hasToken: boolean;
  remember: boolean;
}
export interface ConnectionStatus {
  ok: boolean;
  message: string;
  version: string;
  device: string;
  nodeCount: number;
  checkedAt: string;
}
export interface QueueEntry {
  promptId: string;
  number: number;
  state: "running" | "pending";
  title: string;
  runId: string | null;
  nodeCount: number;
}

const first = <T>(arr: T[], fallback: T) => (arr.length ? arr[0] : fallback);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Pulls the parameters people compare between runs out of an API prompt. */
export function runFacts(prompt: ApiPrompt): RunFacts {
  const facts: RunFacts = {
    seeds: [], models: [], loras: [], steps: null, cfg: null, sampler: "", scheduler: "", denoise: null,
    width: null, height: null, positive: "", negative: "",
  };
  const seen = <T,>(list: T[], v: T) => (list.includes(v) ? list : [...list, v]);
  const nodes = Object.entries(prompt);
  for (const [, node] of nodes) {
    const i = node.inputs;
    if (!isRecord(i)) continue;
    for (const key of ["seed", "noise_seed"]) if (num(i[key]) !== null) facts.seeds = seen(facts.seeds, i[key] as number);
    if (str(i.ckpt_name)) facts.models = seen(facts.models, str(i.ckpt_name));
    if (str(i.unet_name)) facts.models = seen(facts.models, str(i.unet_name));
    if (str(i.lora_name)) facts.loras = seen(facts.loras, str(i.lora_name));
    if (num(i.steps) !== null && facts.steps === null) facts.steps = num(i.steps);
    if (num(i.cfg) !== null && facts.cfg === null) facts.cfg = num(i.cfg);
    if (str(i.sampler_name) && !facts.sampler) facts.sampler = str(i.sampler_name);
    if (str(i.scheduler) && !facts.scheduler) facts.scheduler = str(i.scheduler);
    if (num(i.denoise) !== null && facts.denoise === null) facts.denoise = num(i.denoise);
    if (num(i.width) !== null && facts.width === null && node.class_type.includes("Latent")) {
      facts.width = num(i.width);
      facts.height = num(i.height);
    }
  }
  // Prompt text: follow the sampler's positive / negative links to their text encoders.
  for (const [, node] of nodes) {
    if (!node.class_type.includes("KSampler") && !node.class_type.includes("Sampler")) continue;
    for (const [slot, field] of [["positive", "positive"], ["negative", "negative"]] as const) {
      const link = node.inputs[slot];
      if (Array.isArray(link)) {
        const source = prompt[String(link[0])];
        const text = source?.inputs?.text;
        if (typeof text === "string" && !facts[field]) facts[field] = text;
      }
    }
  }
  if (!facts.positive) {
    const encoder = first(nodes.filter(([, n]) => typeof n.inputs.text === "string"), null);
    if (encoder) facts.positive = String(encoder[1].inputs.text);
  }
  return facts;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;
}
