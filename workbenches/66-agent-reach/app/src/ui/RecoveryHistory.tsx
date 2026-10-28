import { isRecord } from "../contracts/project.ts";
export function RecoveryHistory({
  history,
  onExport,
}: {
  history: unknown;
  onExport: () => void;
}) {
  if (!Array.isArray(history) || !history.length) return null;
  const pending = history.filter(
    (x) =>
      isRecord(x) &&
      (x.pendingQuery || x.pendingReview || x.pendingGeneration || x.autosave),
  ).length;
  return (
    <details className="import-history">
      <summary>导入记录 · {history.length} 次</summary>
      <p>
        原工作稿和未完成编辑已保留。
        {pending
          ? "旧保存、采集或生成操作仅作为历史记录保留，不会自动执行；请回原项目核对未确认的任务。"
          : "这个副本使用新的项目编号。"}
      </p>
      <button onClick={onExport}>导出包含记录的项目</button>
    </details>
  );
}
