// ABOUTME: 页面到应用服务的类型化请求；二进制产物通过页面连接取回为 Blob。

import { isRecord } from "../contracts/project";
import { normaliseDefs, type NodeDefs } from "../contracts/comfy";
import type {
  ConnectionConfig,
  ConnectionStatus,
  QueueEntry,
  RunDetail,
  RunLive,
  RunSummary,
} from "../contracts/run";
import type { ApiPrompt } from "../contracts/convert";
import type { UiWorkflow } from "../contracts/workflow";
import { getPageConnection } from "./connection";
import { request } from "./requests";

export interface RunRejected {
  ok: false;
  status: number;
  message: string;
  error: unknown;
  node_errors: unknown;
}
export type RunResult = { ok: true; run: RunSummary } | RunRejected;
export interface StateResponse {
  socket: string;
  queueRemaining: number | null;
  runs: RunLive[];
  connected: boolean;
}
const json = (body: unknown) => ({ body: JSON.stringify(body) });

/** The page CSP allows data: but not blob: images. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(blob);
  });
}

export const api = {
  config: () => request("/api/comfy/config") as Promise<ConnectionConfig>,
  setConfig: (body: { baseUrl: string; headerName: string; token?: string; clearToken?: boolean; remember: boolean }) =>
    request("/api/comfy/config", { method: "PUT", ...json(body) }) as Promise<ConnectionConfig>,
  async connect(): Promise<{ status: ConnectionStatus; defs: NodeDefs }> {
    const raw = await request("/api/comfy/connect", { method: "POST", ...json({}) });
    if (!isRecord(raw) || !isRecord(raw.status)) throw new Error("连接响应无效。");
    return { status: raw.status as unknown as ConnectionStatus, defs: normaliseDefs(raw.objectInfo) };
  },
  state: (project: string | null) =>
    request("/api/comfy/state" + (project ? "?project=" + encodeURIComponent(project) : "")) as Promise<StateResponse>,
  queue: async () => ((await request("/api/comfy/queue")) as { entries: QueueEntry[] }).entries,
  run: (body: { projectId: string; title: string; prompt: ApiPrompt; workflow: UiWorkflow }) =>
    request("/api/comfy/run", { method: "POST", ...json(body) }) as Promise<RunResult>,
  cancel: (id: string) => request(`/api/comfy/runs/${id}/cancel`, { method: "POST", ...json({}) }),
  interrupt: () => request("/api/comfy/interrupt", { method: "POST", ...json({}) }),
  deleteQueued: (promptId: string) => request("/api/comfy/queue/delete", { method: "POST", ...json({ promptId }) }),
  runs: async (project: string) =>
    ((await request("/api/comfy/runs?project=" + encodeURIComponent(project))) as { runs: RunSummary[] }).runs,
  runDetail: (id: string) => request(`/api/comfy/runs/${id}`) as Promise<RunDetail>,
  deleteRun: (id: string) => request(`/api/comfy/runs/${id}`, { method: "DELETE", ...json({}) }),
  async blob(path: string): Promise<Blob> {
    const page = await getPageConnection();
    const response = await page.fetch(path);
    if (!response.ok) throw new Error("文件读取失败。");
    return response.blob();
  },
  outputBlob: (id: string, embed = false) => api.blob(`/api/comfy/outputs/${id}${embed ? "?embed=1" : ""}`),
  inputBlob: (file: string, subfolder = "") =>
    api.blob("/api/comfy/view?" + new URLSearchParams({ filename: file, subfolder, type: "input" }).toString()),
  previewBlob: (runId: string) => api.blob(`/api/comfy/runs/${runId}/preview`),
  async upload(file: File): Promise<{ name: string; subfolder: string; type: string }> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const chunk = 900_000,
      total = Math.max(1, Math.ceil(bytes.length / chunk));
    let uploadId: string | undefined;
    for (let i = 0; i < total; i++) {
      let bin = "";
      const part = bytes.subarray(i * chunk, (i + 1) * chunk);
      for (let o = 0; o < part.length; o += 8192) bin += String.fromCharCode(...part.subarray(o, o + 8192));
      const reply = (await request("/api/comfy/upload", {
        method: "POST",
        ...json({ name: file.name, data: btoa(bin), index: i, total, uploadId }),
      })) as { uploadId: string; complete: boolean; file?: { name: string; subfolder: string; type: string } };
      uploadId = reply.uploadId;
      if (reply.complete && reply.file) return reply.file;
    }
    throw new Error("上传未完成。");
  },
};
