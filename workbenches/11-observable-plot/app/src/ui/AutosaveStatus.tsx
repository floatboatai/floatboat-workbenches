import type { SavePhase } from "../contracts/autosave";
interface Props {
  state: { phase: SavePhase; message: string; savedAt: string };
  onRetry: () => void;
  onExport: () => void;
  onReload?: () => void;
}
export function AutosaveStatus({ state, onRetry, onExport, onReload }: Props) {
  const attention = state.phase === "offline" || state.phase === "conflict";
  return (
    <div
      className={"autosave-state " + state.phase}
      data-autosave-phase={state.phase}
    >
      <span role="status" className="autosave-message">
        {state.phase === "pending" ? "等待自动保存…" : state.message}
      </span>
      {state.phase === "offline" ? (
        <button onClick={onRetry}>重试自动保存</button>
      ) : null}
      {attention || state.phase === "draft" ? (
        <button onClick={onExport}>导出恢复草稿</button>
      ) : null}
      {state.phase === "conflict" && onReload ? (
        <button onClick={onReload}>打开服务器版本</button>
      ) : null}
    </div>
  );
}
