// ABOUTME: 源码状态栏与预览错误条：显示绘制状态、错误行列，并可跳回源码对应位置。
import type { SourceProblem } from "./SourceEditor";
import type { Failure } from "./useRender";

export function StatusBar({
  source,
  pending,
  failure,
  external,
  onLocate,
}: {
  source: string;
  pending: boolean;
  failure: Failure | null;
  external: SourceProblem | undefined;
  onLocate: (line: number, column: number) => void;
}) {
  const status = pending
    ? "正在绘制…"
    : failure
      ? failure.line
        ? `第 ${failure.line} 行：${failure.message}`
        : failure.message
      : external
        ? `第 ${external.line} 行引用外部资源，已在预览中移除`
        : "图形已同步";
  return (
    <footer className="statusbar">
      <span
        className={"state " + (pending ? "pending" : failure ? "error" : "ok")}
        title={status}
      >
        {status}
      </span>
      {failure?.line ? (
        <button
          type="button"
          className="link-button"
          onClick={() => onLocate(failure.line!, failure.column)}
        >
          定位
        </button>
      ) : null}
      <span className="counts">
        {source.split("\n").length} 行 · {source.length.toLocaleString("zh-CN")}{" "}
        字符
      </span>
    </footer>
  );
}

export function ErrorBanner({
  failure,
  hasPrevious,
  onLocate,
}: {
  failure: Failure;
  hasPrevious: boolean;
  onLocate: (line: number, column: number) => void;
}) {
  return (
    <div className="error-banner" role="alert">
      <strong>{failure.line ? `第 ${failure.line} 行` : "无法绘制"}</strong>
      <span>{failure.message}</span>
      {failure.line ? (
        <button
          type="button"
          onClick={() => onLocate(failure.line!, failure.column)}
        >
          到源码中修改
        </button>
      ) : null}
      {hasPrevious ? <em>下方保留上一版图形</em> : null}
    </div>
  );
}
