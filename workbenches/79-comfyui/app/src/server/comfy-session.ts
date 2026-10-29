// ABOUTME: 与用户自有 ComfyUI 服务的会话：HTTP 代理、WebSocket 进度跟踪、队列、历史与产物抓取。

import { randomUUID } from "node:crypto";
import { isRecord } from "../contracts/project.ts";
import { normaliseDefs, type NodeDefs } from "../contracts/comfy.ts";
import {
  describeNetworkError,
  normaliseBaseUrl,
  normaliseHeaderName,
  normaliseToken,
} from "../contracts/connection.ts";
import { isPng, pngSize } from "../contracts/png.ts";
import {
  isFinished,
  type ConnectionConfig,
  type ConnectionStatus,
  type QueueEntry,
  type RunError,
  type RunLive,
  type RunStatus,
  type RunSummary,
} from "../contracts/run.ts";
import type { ApiPrompt } from "../contracts/convert.ts";
import type { UiWorkflow } from "../contracts/workflow.ts";
import type { RunStore } from "./runs.ts";

export class ComfyError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status = 502, body: unknown = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface HttpResult {
  status: number;
  body: unknown;
  bytes: Uint8Array;
  mime: string;
}
interface Tracker {
  live: RunLive;
  lastMessage: number;
  started: number;
  finalizing: boolean;
  preview: { bytes: Uint8Array; mime: string } | null;
}

const KEEP_FINISHED_MS = 15000;
const mimeOf = (name: string, bytes: Uint8Array): string => {
  if (isPng(bytes)) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF") return "image/webp";
  if (/\.gif$/i.test(name)) return "image/gif";
  return /\.(mp4|webm)$/i.test(name) ? "video/" + name.split(".").pop() : "application/octet-stream";
};

export function createSession(store: RunStore, options: { pollMs?: number } = {}) {
  const clientId = randomUUID();
  const trackers = new Map<string, Tracker>();
  let token = "";
  let socket: WebSocket | null = null;
  let socketState: "none" | "connecting" | "open" | "closed" = "none";
  let queueRemaining: number | null = null;
  let poller: ReturnType<typeof setInterval> | null = null;
  let defsCache: { key: string; defs: NodeDefs } | null = null;
  const pollMs = options.pollMs ?? 1500;

  const config = () => {
    const baseUrl = store.getSetting("baseUrl") ?? "";
    const remembered = store.getSetting("token");
    if (remembered !== null && !token) token = remembered;
    return { baseUrl, headerName: store.getSetting("headerName") ?? "", token, remember: remembered !== null };
  };

  function publicConfig(): ConnectionConfig {
    const c = config();
    return { baseUrl: c.baseUrl, headerName: c.headerName, hasToken: Boolean(c.token), remember: c.remember };
  }

  function setConfig(input: unknown): ConnectionConfig {
    if (!isRecord(input)) throw new Error("请求无效。");
    const previous = config();
    const baseUrl = normaliseBaseUrl(input.baseUrl);
    const headerName = normaliseHeaderName(input.headerName);
    if (baseUrl !== previous.baseUrl) {
      closeSocket();
      defsCache = null;
    }
    store.setSetting("baseUrl", baseUrl);
    store.setSetting("headerName", headerName);
    if (input.clearToken === true) token = "";
    else if (typeof input.token === "string" && input.token !== "") token = normaliseToken(input.token);
    if (input.remember === true && token) store.setSetting("token", token);
    else store.setSetting("token", null);
    return publicConfig();
  }

  function requireConfig() {
    const c = config();
    if (!c.baseUrl) throw new ComfyError("尚未配置 ComfyUI 服务地址。请在“连接”中填写并检查。", 400);
    return c;
  }

  function headers(c: ReturnType<typeof config>, extra: Record<string, string> = {}) {
    const h: Record<string, string> = { ...extra };
    if (c.headerName && c.token) h[c.headerName] = c.token;
    return h;
  }

  async function http(
    path: string,
    init: { method?: string; json?: unknown; form?: FormData; timeoutMs?: number } = {},
  ): Promise<HttpResult> {
    const c = requireConfig();
    let response: Response;
    try {
      response = await fetch(c.baseUrl + path, {
        method: init.method ?? "GET",
        headers: headers(c, init.json !== undefined ? { "content-type": "application/json" } : {}),
        body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
        signal: AbortSignal.timeout(init.timeoutMs ?? 20000),
        redirect: "manual",
      });
    } catch (error) {
      throw new ComfyError(describeNetworkError(error, c.baseUrl), 502);
    }
    if (response.status >= 300 && response.status < 400)
      throw new ComfyError(`服务返回了重定向（HTTP ${response.status}）。请使用最终地址，或检查反向代理的登录页。`, 502);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mime = response.headers.get("content-type") ?? "application/octet-stream";
    let body: unknown = null;
    if (mime.includes("json") || (bytes.length && bytes[0] === 0x7b)) {
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        body = null;
      }
    }
    return { status: response.status, body, bytes, mime };
  }

  function authHint(status: number): string {
    if (status === 401 || status === 403)
      return `服务拒绝访问（HTTP ${status}）。请检查请求头令牌；经反向代理时确认 Authorization 等头已放行。`;
    if (status === 404) return "服务没有该接口（HTTP 404）：地址可能不是 ComfyUI 根路径。";
    return `服务返回 HTTP ${status}。`;
  }

  async function connect(): Promise<{ status: ConnectionStatus; defs: NodeDefs; objectInfo: unknown }> {
    const c = requireConfig();
    const checkedAt = new Date().toISOString();
    const stats = await http("/system_stats", { timeoutMs: 10000 });
    if (stats.status !== 200 || !isRecord(stats.body))
      throw new ComfyError(stats.status === 200 ? "该地址不像是 ComfyUI（/system_stats 没有返回 JSON）。" : authHint(stats.status), 502);
    const system = isRecord(stats.body.system) ? stats.body.system : {};
    const devices = Array.isArray(stats.body.devices) ? stats.body.devices : [];
    const info = await http("/object_info", { timeoutMs: 120000 });
    if (info.status !== 200 || !isRecord(info.body)) throw new ComfyError(authHint(info.status), 502);
    const defs = normaliseDefs(info.body);
    defsCache = { key: c.baseUrl, defs };
    const device = isRecord(devices[0]) ? String(devices[0].name ?? "") : "";
    openSocket();
    return {
      status: {
        ok: true,
        message: "已连接",
        version: String(system.comfyui_version ?? system.argv?.toString?.() ?? ""),
        device,
        nodeCount: Object.keys(defs).length,
        checkedAt,
      },
      defs,
      objectInfo: info.body,
    };
  }

  function emptyLive(runId: string, promptId: string, total: number): RunLive {
    return {
      runId, promptId, status: "queued", currentNode: null, progress: null, executed: [], cached: [], total,
      previewVersion: 0, previewNode: null, error: null, queuePosition: null,
    };
  }

  // ---- WebSocket ------------------------------------------------------------------------

  function closeSocket() {
    try {
      socket?.close();
    } catch {
      /* already closed */
    }
    socket = null;
    socketState = "none";
  }

  function openSocket() {
    const c = config();
    if (!c.baseUrl || socket || socketState === "connecting") return;
    socketState = "connecting";
    const wsUrl = c.baseUrl.replace(/^http/, "ws") + "/ws?clientId=" + clientId;
    let ws: WebSocket;
    try {
      const Ctor = WebSocket as unknown as new (url: string, init?: { headers?: Record<string, string> }) => WebSocket;
      ws = new Ctor(wsUrl, { headers: headers(c) });
    } catch {
      socketState = "closed";
      return;
    }
    socket = ws;
    ws.binaryType = "arraybuffer";
    ws.addEventListener("open", () => {
      socketState = "open";
    });
    ws.addEventListener("message", (event) => {
      void handleMessage(event.data).catch(() => {});
    });
    const gone = () => {
      if (socket === ws) {
        socket = null;
        socketState = "closed";
      }
    };
    ws.addEventListener("close", gone);
    ws.addEventListener("error", gone);
  }

  /** Messages for a prompt can arrive before POST /prompt has returned; keep them for replay. */
  const early = new Map<string, string[]>();
  const byPrompt = (promptId: unknown) => (typeof promptId === "string" ? trackers.get(promptId) : undefined);

  async function handleMessage(data: unknown): Promise<void> {
    if (typeof data !== "string") {
      // Binary preview frame: 4-byte event type, 4-byte image format, then image bytes.
      if (data instanceof ArrayBuffer && data.byteLength > 8) {
        const view = new DataView(data);
        const type = view.getUint32(0);
        if (type === 1 || type === 4) {
          let offset = 8;
          let nodeId: string | null = null;
          if (type === 4) {
            const metaLength = view.getUint32(4);
            try {
              const meta: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 8, metaLength)));
              if (isRecord(meta) && meta.node_id !== undefined) nodeId = String(meta.node_id);
            } catch {
              /* ignore metadata */
            }
            offset = 8 + metaLength;
          }
          const bytes = new Uint8Array(data.slice(offset));
          const active = [...trackers.values()].filter((t) => !isFinished(t.live.status)).at(0);
          if (active) {
            active.preview = { bytes, mime: mimeOf("", bytes) === "image/png" ? "image/png" : "image/jpeg" };
            active.live.previewVersion++;
            active.live.previewNode = nodeId ?? active.live.currentNode;
          }
        }
      }
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (!isRecord(message) || typeof message.type !== "string") return;
    const d = isRecord(message.data) ? message.data : {};
    if (message.type === "status") {
      const info = isRecord(d.status) && isRecord(d.status.exec_info) ? d.status.exec_info : {};
      if (typeof info.queue_remaining === "number") queueRemaining = info.queue_remaining;
      return;
    }
    const tracker = byPrompt(d.prompt_id);
    if (!tracker) {
      if (typeof d.prompt_id === "string") {
        const list = early.get(d.prompt_id) ?? [];
        if (list.length < 400) list.push(data);
        early.set(d.prompt_id, list);
        for (const key of [...early.keys()].slice(0, Math.max(0, early.size - 12))) early.delete(key);
      }
      return;
    }
    tracker.lastMessage = Date.now();
    const live = tracker.live;
    switch (message.type) {
      case "progress_state": {
        // ComfyUI >= 0.3.4x: per-node state map alongside the legacy progress/executing events.
        const nodes = isRecord(d.nodes) ? d.nodes : {};
        for (const [id, entry] of Object.entries(nodes)) {
          if (!isRecord(entry)) continue;
          if (entry.state === "running") {
            live.status = "running";
            live.currentNode = id;
            const max = Number(entry.max);
            if (Number.isFinite(max) && max > 1) live.progress = { node: id, value: Number(entry.value), max };
          } else if (entry.state === "finished" && !live.executed.includes(id)) live.executed.push(id);
        }
        break;
      }
      case "execution_start":
        live.status = "running";
        store.setStatus(live.runId, "running");
        break;
      case "execution_cached":
        if (Array.isArray(d.nodes)) live.cached = d.nodes.map(String);
        break;
      case "executing":
        live.status = "running";
        if (d.node === null || d.node === undefined) {
          live.currentNode = null;
        } else {
          live.currentNode = String(d.node);
          live.progress = null;
          if (!live.executed.includes(live.currentNode)) live.executed.push(live.currentNode);
        }
        break;
      case "progress":
        live.progress = { node: d.node === undefined || d.node === null ? live.currentNode : String(d.node), value: Number(d.value), max: Number(d.max) };
        break;
      case "execution_success":
        void finalize(tracker, "success");
        break;
      case "execution_error":
        live.error = {
          message: String(d.exception_message ?? "执行失败").trim(),
          nodeId: d.node_id === undefined ? null : String(d.node_id),
          nodeType: typeof d.node_type === "string" ? d.node_type : null,
          details: Array.isArray(d.traceback) ? d.traceback.join("") : String(d.exception_type ?? ""),
        };
        void finalize(tracker, "error");
        break;
      case "execution_interrupted":
        void finalize(tracker, "interrupted");
        break;
      default:
        break;
    }
  }

  // ---- runs -------------------------------------------------------------------------------

  async function ingestHistory(tracker: Tracker): Promise<RunStatus | null> {
    const run = store.summary(tracker.live.runId);
    if (!run) return null;
    const result = await http("/history/" + encodeURIComponent(tracker.live.promptId), { timeoutMs: 15000 });
    const entry = isRecord(result.body) ? result.body[tracker.live.promptId] : undefined;
    if (!isRecord(entry)) return null;
    const outputs = isRecord(entry.outputs) ? entry.outputs : {};
    for (const [nodeId, out] of Object.entries(outputs)) {
      if (!isRecord(out)) continue;
      for (const group of ["images", "gifs"] as const) {
        const files = Array.isArray(out[group]) ? out[group] : [];
        for (const file of files) {
          if (!isRecord(file) || typeof file.filename !== "string") continue;
          const subfolder = typeof file.subfolder === "string" ? file.subfolder : "";
          const kind = typeof file.type === "string" ? file.type : "output";
          const query = new URLSearchParams({ filename: file.filename, subfolder, type: kind });
          const view = await http("/view?" + query.toString(), { timeoutMs: 60000 }).catch(() => null);
          if (!view || view.status !== 200 || !view.bytes.length) continue;
          let width: number | null = null,
            height: number | null = null;
          if (isPng(view.bytes)) {
            try {
              ({ width, height } = pngSize(view.bytes));
            } catch {
              /* unreadable header */
            }
          }
          store.addOutput(
            run.id,
            run.projectId,
            { nodeId, filename: file.filename, subfolder, kind, mime: mimeOf(file.filename, view.bytes), width, height },
            view.bytes,
          );
        }
      }
    }
    const status = isRecord(entry.status) ? entry.status : {};
    if (status.status_str === "error") {
      const messages = Array.isArray(status.messages) ? status.messages : [];
      const failed = messages.find((m) => Array.isArray(m) && m[0] === "execution_error");
      const detail = Array.isArray(failed) && isRecord(failed[1]) ? failed[1] : null;
      if (detail && !tracker.live.error)
        tracker.live.error = {
          message: String(detail.exception_message ?? "执行失败").trim(),
          nodeId: detail.node_id === undefined ? null : String(detail.node_id),
          nodeType: typeof detail.node_type === "string" ? detail.node_type : null,
          details: Array.isArray(detail.traceback) ? detail.traceback.join("") : "",
        };
      return "error";
    }
    return status.completed === false && status.status_str !== "success" ? "interrupted" : "success";
  }

  async function finalize(tracker: Tracker, outcome: RunStatus): Promise<void> {
    if (tracker.finalizing || isFinished(tracker.live.status)) return;
    tracker.finalizing = true;
    try {
      let status = outcome;
      if (outcome === "success" || outcome === "error") {
        // History is authoritative for outputs; retry briefly because it is written just after the event.
        for (let attempt = 0; attempt < 6; attempt++) {
          const result = await ingestHistory(tracker).catch(() => null);
          if (result) {
            status = outcome === "error" ? "error" : result;
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      }
      tracker.live.status = status;
      tracker.live.currentNode = null;
      tracker.live.progress = null;
      store.setStatus(tracker.live.runId, status, tracker.live.error);
      setTimeout(() => trackers.delete(tracker.live.promptId), KEEP_FINISHED_MS).unref?.();
    } finally {
      tracker.finalizing = false;
    }
  }

  async function poll(): Promise<void> {
    const active = [...trackers.values()].filter((t) => !isFinished(t.live.status));
    if (!active.length) {
      if (poller) clearInterval(poller);
      poller = null;
      return;
    }
    if (!socket && socketState !== "connecting") openSocket();
    let queue: { running: Set<string>; pending: string[] } | null = null;
    try {
      queue = await readQueueIds();
    } catch {
      return;
    }
    for (const tracker of active) {
      const id = tracker.live.promptId;
      const pos = queue.pending.indexOf(id);
      tracker.live.queuePosition = pos >= 0 ? pos + 1 : null;
      if (queue.running.has(id) && tracker.live.status === "queued") tracker.live.status = "running";
      if (queue.running.has(id) || pos >= 0) continue;
      // Neither running nor pending: finished (or lost). History decides.
      const status = await ingestHistory(tracker).catch(() => null);
      if (status) await finalize(tracker, status === "success" ? "success" : status);
      else if (Date.now() - tracker.started > 5000) {
        tracker.live.error ??= { message: "服务端没有这个任务的记录（可能已被清除或服务重启）。", nodeId: null, nodeType: null, details: "" };
        await finalize(tracker, "error");
      }
    }
  }

  function startPolling() {
    if (!poller) {
      poller = setInterval(() => void poll().catch(() => {}), pollMs);
      poller.unref?.();
    }
  }

  async function readQueueIds() {
    const result = await http("/queue", { timeoutMs: 8000 });
    const body = isRecord(result.body) ? result.body : {};
    // queue_pending arrives in heap order, not sorted: order by the item's number.
    const ids = (list: unknown) =>
      Array.isArray(list)
        ? [...list].filter(Array.isArray).sort((a, b) => Number(a[0]) - Number(b[0])).map((e) => String(e[1]))
        : [];
    return { running: new Set(ids(body.queue_running)), pending: ids(body.queue_pending) };
  }

  async function submit(input: {
    projectId: string;
    title: string;
    prompt: ApiPrompt;
    workflow: UiWorkflow;
  }): Promise<{ ok: true; run: RunSummary } | { ok: false; status: number; body: unknown; message: string }> {
    const c = requireConfig();
    openSocket();
    const result = await http("/prompt", {
      method: "POST",
      json: {
        prompt: input.prompt,
        client_id: clientId,
        extra_data: { extra_pnginfo: { workflow: input.workflow } },
      },
      timeoutMs: 30000,
    });
    if (result.status !== 200 || !isRecord(result.body) || typeof result.body.prompt_id !== "string") {
      const message =
        isRecord(result.body) && isRecord(result.body.error) && typeof result.body.error.message === "string"
          ? result.body.error.message
          : result.status === 200
            ? "服务返回了无法识别的响应。"
            : authHint(result.status);
      return { ok: false, status: result.status, body: result.body, message };
    }
    const run = store.create({
      projectId: input.projectId,
      promptId: result.body.prompt_id,
      server: c.baseUrl,
      title: input.title,
      prompt: input.prompt,
      workflow: input.workflow,
    });
    const live = emptyLive(run.id, run.promptId, run.nodeCount);
    trackers.set(run.promptId, { live, lastMessage: Date.now(), started: Date.now(), finalizing: false, preview: null });
    startPolling();
    for (const raw of early.get(run.promptId) ?? []) void handleMessage(raw).catch(() => {});
    early.delete(run.promptId);
    return { ok: true, run };
  }

  async function cancel(runId: string): Promise<RunSummary | null> {
    const run = store.summary(runId);
    if (!run) return null;
    const tracker = trackers.get(run.promptId);
    if (isFinished(run.status)) return run;
    const queue = await readQueueIds();
    if (queue.running.has(run.promptId)) await http("/interrupt", { method: "POST", json: {} });
    else await http("/queue", { method: "POST", json: { delete: [run.promptId] } });
    if (!queue.running.has(run.promptId)) {
      if (tracker) {
        tracker.live.status = "cancelled";
        setTimeout(() => trackers.delete(run.promptId), KEEP_FINISHED_MS).unref?.();
      }
      store.setStatus(run.id, "cancelled");
    }
    return store.summary(runId);
  }

  async function interrupt(): Promise<void> {
    await http("/interrupt", { method: "POST", json: {} });
  }

  async function queue(): Promise<QueueEntry[]> {
    const result = await http("/queue", { timeoutMs: 8000 });
    if (result.status !== 200) throw new ComfyError(authHint(result.status), 502);
    const body = isRecord(result.body) ? result.body : {};
    const known = new Map(store.active().map((r) => [r.promptId, r.id]));
    const entries: QueueEntry[] = [];
    for (const [key, state] of [["queue_running", "running"], ["queue_pending", "pending"]] as const) {
      const raw = body[key];
      const list = Array.isArray(raw) ? [...raw].sort((a, b) => Number(Array.isArray(a) ? a[0] : 0) - Number(Array.isArray(b) ? b[0] : 0)) : [];
      for (const entry of list) {
        if (!Array.isArray(entry)) continue;
        const promptId = String(entry[1]);
        const runId = known.get(promptId) ?? null;
        const run = runId ? store.summary(runId) : null;
        entries.push({
          promptId,
          number: Number(entry[0]),
          state,
          title: run?.title ?? "其他客户端的任务",
          runId,
          nodeCount: isRecord(entry[2]) ? Object.keys(entry[2]).length : 0,
        });
      }
    }
    return entries;
  }

  async function deleteQueued(promptId: string): Promise<void> {
    await http("/queue", { method: "POST", json: { delete: [promptId] } });
  }

  function state(projectId: string | null) {
    const runs: RunLive[] = [];
    for (const t of trackers.values()) {
      const s = store.summary(t.live.runId);
      if (s && (!projectId || s.projectId === projectId)) runs.push({ ...t.live });
    }
    return { socket: socketState, queueRemaining, runs, connected: Boolean(config().baseUrl) };
  }

  function preview(runId: string) {
    for (const t of trackers.values()) if (t.live.runId === runId) return t.preview;
    return null;
  }

  /** After a restart, tracked runs are gone; resume or settle those still marked active. */
  async function reconcile(): Promise<void> {
    if (!config().baseUrl) return;
    for (const run of store.active()) {
      if (trackers.has(run.promptId)) continue;
      const summary = store.summary(run.id);
      if (!summary) continue;
      const live = emptyLive(run.id, run.promptId, summary.nodeCount);
      live.status = summary.status;
      trackers.set(run.promptId, { live, lastMessage: Date.now(), started: Date.now() - 6000, finalizing: false, preview: null });
    }
    if (trackers.size) startPolling();
  }

  async function upload(name: string, bytes: Uint8Array, subfolder = ""): Promise<{ name: string; subfolder: string; type: string }> {
    const form = new FormData();
    form.set("image", new Blob([bytes.slice()]), name);
    form.set("type", "input");
    form.set("overwrite", "true");
    if (subfolder) form.set("subfolder", subfolder);
    const result = await http("/upload/image", { method: "POST", form, timeoutMs: 120000 });
    if (result.status !== 200 || !isRecord(result.body) || typeof result.body.name !== "string")
      throw new ComfyError(result.status === 200 ? "上传失败：服务返回了无法识别的响应。" : authHint(result.status), 502);
    return {
      name: result.body.name,
      subfolder: typeof result.body.subfolder === "string" ? result.body.subfolder : "",
      type: typeof result.body.type === "string" ? result.body.type : "input",
    };
  }

  async function view(query: URLSearchParams): Promise<HttpResult> {
    const allowed = new URLSearchParams();
    for (const key of ["filename", "subfolder", "type", "preview"]) {
      const v = query.get(key);
      if (v !== null) allowed.set(key, v);
    }
    return http("/view?" + allowed.toString(), { timeoutMs: 30000 });
  }

  function shutdown() {
    if (poller) clearInterval(poller);
    poller = null;
    closeSocket();
  }

  return {
    clientId, publicConfig, setConfig, connect, submit, cancel, interrupt, queue, deleteQueued, state, preview,
    reconcile, upload, view, shutdown, isConnectedConfig: () => Boolean(config().baseUrl), cachedDefs: () => defsCache?.defs ?? null,
  };
}
export type ComfySession = ReturnType<typeof createSession>;
export type { RunError };
