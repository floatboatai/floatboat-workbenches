import type { SavePhase } from "../contracts/autosave";
import "./autosave-status.css";
type State = { phase: SavePhase; message: string; savedAt: string };
export function AutoStatus({
  state,
  loading = false,
}: {
  state: State;
  loading?: boolean;
}) {
  const compact =
    state.phase === "conflict"
      ? "版本冲突，草稿已保留"
      : state.phase === "offline"
        ? "本机草稿待同步"
        : state.phase === "draft"
          ? "草稿已自动保存"
          : state.message;
  return (
    <span
      className="autosave-status"
      data-phase={state.phase}
      role="status"
      title={state.message}
    >
      {loading ? "正在恢复草稿…" : compact}
    </span>
  );
}
export function AutoFeedback({
  state,
  onRetry,
  onExport,
  onReload,
}: {
  state: State;
  onRetry: () => void;
  onExport: () => void;
  onReload?: () => void;
}) {
  if (!["draft", "offline", "conflict"].includes(state.phase)) return null;
  return (
    <div className="autosave-recovery" data-phase={state.phase} role="status">
      <span>{state.message}</span>
      <button onClick={onRetry}>重试同步</button>
      <button onClick={onExport}>导出恢复草稿</button>
      {state.phase === "conflict" && onReload ? (
        <button onClick={onReload}>打开服务器版本</button>
      ) : null}
    </div>
  );
}
