// ABOUTME: 运行面板：连接设置与状态、当前运行进度、服务端队列、问题列表。

import { useState } from "react";
import { CircleAlert, CircleCheck, Loader2, Plug, Square, TriangleAlert, X } from "lucide-react";
import type { ConnectionConfig, ConnectionStatus, QueueEntry, RunLive } from "../contracts/run";
import type { Problem } from "../contracts/validate";

export interface ConnectionDraft {
  baseUrl: string;
  headerName: string;
  token: string;
  remember: boolean;
}

export function ConnectionForm({
  config,
  status,
  error,
  busy,
  onConnect,
  onForgetToken,
}: {
  config: ConnectionConfig | null;
  status: ConnectionStatus | null;
  error: string;
  busy: boolean;
  onConnect: (draft: ConnectionDraft) => void;
  onForgetToken: () => void;
}) {
  const [draft, setDraft] = useState<ConnectionDraft>({
    baseUrl: config?.baseUrl || "http://127.0.0.1:8188",
    headerName: config?.headerName ?? "",
    token: "",
    remember: config?.remember ?? false,
  });
  const [showAuth, setShowAuth] = useState(Boolean(config?.headerName));
  return (
    <form
      className="conn-form"
      onSubmit={(e) => {
        e.preventDefault();
        onConnect(draft);
      }}
    >
      <label className="field">
        <span>ComfyUI 服务地址</span>
        <input value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="http://127.0.0.1:8188" name="comfyui-url" autoComplete="off" spellCheck={false} inputMode="url" aria-label="ComfyUI 服务地址" />
      </label>
      <button type="button" className="link" aria-expanded={showAuth} onClick={() => setShowAuth((v) => !v)}>
        {showAuth ? "收起" : "需要请求头令牌？"}
      </button>
      {showAuth && (
        <div className="auth-fields">
          <label className="field">
            <span>请求头名称</span>
            <input value={draft.headerName} onChange={(e) => setDraft({ ...draft, headerName: e.target.value })} placeholder="Authorization" name="header-name" autoComplete="off" spellCheck={false} />
          </label>
          <label className="field">
            <span>令牌{config?.hasToken ? "（已设置，留空保持不变）" : ""}</span>
            <input type="password" value={draft.token} onChange={(e) => setDraft({ ...draft, token: e.target.value })} autoComplete="off" name="header-token" placeholder="Bearer …" />
          </label>
          <label className="field check">
            <input type="checkbox" checked={draft.remember} onChange={(e) => setDraft({ ...draft, remember: e.target.checked })} />
            <span>记住令牌（仅保存在本机数据库，不会导出）</span>
          </label>
          {config?.hasToken && (
            <button type="button" className="link" onClick={onForgetToken}>清除已保存的令牌</button>
          )}
        </div>
      )}
      <button type="submit" className="primary-soft" disabled={busy}>
        {busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <Plug size={14} aria-hidden="true" />}
        {status?.ok ? "重新检查并载入节点" : "检查连接并载入节点"}
      </button>
      <div className="conn-status" role="status" aria-live="polite">
        {status?.ok && !error && (
          <p className="ok"><CircleCheck size={14} aria-hidden="true" />已连接 · {status.nodeCount} 个节点{status.device ? ` · ${status.device}` : ""}{status.version ? ` · ${status.version}` : ""}</p>
        )}
        {error && <p className="bad"><CircleAlert size={14} aria-hidden="true" />{error}</p>}
        {!status?.ok && !error && <p className="muted">未连接。画布、校验和导出无需服务即可使用；运行需要你自己的 ComfyUI。</p>}
      </div>
      <details className="help">
        <summary>如何启动并连接 ComfyUI</summary>
        <p>在 ComfyUI 目录运行：</p>
        <pre>python main.py --listen 127.0.0.1 --port 8188</pre>
        <p>本工作台经自身服务端转发请求，一般无需 <code>--enable-cors-header</code>。经反向代理时，在上方填写需要的请求头。</p>
      </details>
    </form>
  );
}

export function RunProgress({ live, title, onInterrupt, onCancel }: { live: RunLive; title: (nodeId: string) => string; onInterrupt: () => void; onCancel: () => void }) {
  const done = live.executed.length + live.cached.filter((id) => !live.executed.includes(id)).length;
  const fraction = live.total ? Math.min(1, (done + (live.progress ? live.progress.value / Math.max(1, live.progress.max) : 0)) / live.total) : 0;
  return (
    <div className="run-card" role="status" aria-live="polite">
      <div className="run-line">
        <strong>{live.status === "queued" ? "排队中" : "运行中"}</strong>
        {live.queuePosition && <span className="muted">队列第 {live.queuePosition} 位</span>}
        <button type="button" className="ghost danger small" onClick={live.status === "queued" ? onCancel : onInterrupt}>
          <Square size={12} aria-hidden="true" />{live.status === "queued" ? "取消" : "中断"}
        </button>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-label="总进度">
        <i style={{ width: `${fraction * 100}%` }} />
      </div>
      <p className="muted">
        {live.currentNode ? `${title(live.currentNode)}${live.progress ? ` · ${live.progress.value}/${live.progress.max}` : ""}` : "等待服务端开始…"}
        {live.cached.length > 0 && ` · ${live.cached.length} 个节点命中缓存`}
      </p>
    </div>
  );
}

export function QueueList({ entries, onDelete, onInterrupt }: { entries: QueueEntry[] | null; onDelete: (e: QueueEntry) => void; onInterrupt: () => void }) {
  if (!entries) return null;
  return (
    <section className="queue" aria-label="服务端队列">
      <h4>服务端队列</h4>
      {!entries.length && <p className="muted">队列为空。</p>}
      <ul>
        {entries.map((e) => (
          <li key={e.promptId}>
            <span className={"dot " + e.state} aria-hidden="true" />
            <span className="q-title">{e.title}</span>
            <span className="muted">{e.state === "running" ? "运行中" : `#${e.number}`} · {e.nodeCount} 节点</span>
            <button type="button" className="icon-btn" aria-label={e.state === "running" ? "中断当前任务" : "移出队列"} onClick={() => (e.state === "running" ? onInterrupt() : onDelete(e))}>
              {e.state === "running" ? <Square size={13} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProblemList({ problems, onFocus }: { problems: Problem[]; onFocus: (nodeId: string) => void }) {
  if (!problems.length) return <p className="muted ok-line"><CircleCheck size={14} aria-hidden="true" />没有发现问题。</p>;
  return (
    <ul className="problem-list" aria-label="问题列表">
      {problems.map((p) => (
        <li key={p.id} className={p.severity}>
          {p.severity === "error" ? <CircleAlert size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />}
          <div>
            <span>{p.message}</span>
            <small>{p.source === "server" ? "服务端" : "本地校验"}{p.nodeId ? ` · 节点 #${p.nodeId}` : ""}</small>
          </div>
          {p.nodeId && <button type="button" className="link" onClick={() => onFocus(p.nodeId!)}>定位</button>}
        </li>
      ))}
    </ul>
  );
}
