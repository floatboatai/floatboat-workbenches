// ABOUTME: 底部运行控制台：收起时一行摘要，展开为逐节点日志（状态、耗时、结果或错误），点击定位节点。
import { ChevronDown, ChevronUp } from "lucide-react";
import type { FlowDocument } from "../contracts/flow";
import { formatMs, type NodeView } from "./view";

export function RunConsole({
  doc,
  views,
  order,
  open,
  onToggle,
  running,
  savedAt,
  totalMs,
  onSelect,
}: {
  doc: FlowDocument;
  views: Record<string, NodeView>;
  order: string[];
  open: boolean;
  onToggle: () => void;
  running: boolean;
  savedAt?: string;
  totalMs?: number;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  const ids = [...order.filter((id) => byId.has(id)), ...doc.nodes.map((n) => n.id).filter((id) => !order.includes(id))];
  const errors = ids.filter((id) => views[id]?.status === "error").length;
  const stale = ids.filter((id) => views[id]?.stale).length;
  const ran = ids.filter((id) => views[id] && views[id].status !== "idle").length;
  const summary = running
    ? "正在运行…"
    : !ran
      ? "尚未运行"
      : errors
        ? `${errors} 个节点失败`
        : stale
          ? `${stale} 个节点结果已过期`
          : `${ids.length} 个节点全部成功`;
  return (
    <section className="run-console" data-open={open || undefined} aria-label="运行控制台">
      <button type="button" className="console-bar" aria-expanded={open} aria-controls="console-log" onClick={onToggle}>
        <span className="console-title">运行</span>
        <span className="console-summary" data-state={running ? "running" : errors ? "error" : stale ? "stale" : ran ? "ok" : "idle"} role="status">
          {summary}
          {totalMs !== undefined && !running && ran ? ` · ${formatMs(totalMs)}` : ""}
        </span>
        {savedAt ? <span className="console-saved">已记录 {new Date(savedAt).toLocaleString("zh-CN", { hour12: false })}</span> : null}
        {open ? <ChevronDown aria-hidden="true" size={14} /> : <ChevronUp aria-hidden="true" size={14} />}
      </button>
      {open ? (
        <ol className="console-log" id="console-log">
          {ids.map((id, index) => {
            const node = byId.get(id)!;
            const view = views[id];
            return (
              <li key={id} data-status={view?.status ?? "idle"} data-stale={view?.stale || undefined}>
                <button type="button" onClick={() => onSelect(id)}>
                  <span className="log-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="log-status">{view?.status === "ok" ? "✓" : view?.status === "error" ? "✕" : view?.status === "skipped" ? "–" : view?.status === "running" ? "…" : "○"}</span>
                  <span className="log-label">{node.data.label || "（未命名）"}</span>
                  <span className="log-detail">{view?.status === "error" || view?.status === "skipped" ? view.error : view?.summary}</span>
                  <span className="log-ms">{view?.status === "ok" ? formatMs(view.ms) : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
