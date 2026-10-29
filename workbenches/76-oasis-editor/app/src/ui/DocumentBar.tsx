import type { Panel } from "./DocumentChrome";

/** Compact file bar: document menu, title with quiet save state, notes and the PDF proof. */
export function DocumentBar({
  title,
  titleDisabled,
  onTitle,
  status,
  phase,
  panel,
  showPanel,
  hasNotes,
  pdfDisabled,
  onPdf,
}: {
  title: string;
  titleDisabled: boolean;
  onTitle: (value: string) => void;
  status: string;
  phase: string;
  panel: Panel;
  showPanel: (next: Panel, trigger: HTMLElement) => void;
  hasNotes: boolean;
  pdfDisabled: boolean;
  onPdf: () => void;
}) {
  return (
    <header className="document-bar">
      <div className="file-anchor">
        <span className="wordmark" aria-hidden="true">
          oasis
        </span>
        <button
          className="file-trigger"
          aria-haspopup="dialog"
          aria-expanded={panel === "file" || panel === "info"}
          onClick={(event) => showPanel("file", event.currentTarget)}
        >
          文稿 <span aria-hidden="true">⌄</span>
        </button>
      </div>
      <div className="document-heading">
        <h1 className="sr-only">文稿编辑器</h1>
        <label className="sr-only" htmlFor="document-title">
          文稿名称
        </label>
        <input
          id="document-title"
          name="document-title"
          autoComplete="off"
          disabled={titleDisabled}
          value={title}
          maxLength={120}
          onChange={(event) => onTitle(event.target.value)}
          placeholder="未命名文稿…"
        />
        <span className={"save-state " + phase} role="status">
          {status}
        </span>
      </div>
      <div className="document-output">
        <button
          className="notes-trigger"
          aria-haspopup="dialog"
          aria-expanded={panel === "notes"}
          onClick={(event) => showPanel("notes", event.currentTarget)}
        >
          笔记
          {hasNotes && <span className="note-dot" aria-hidden="true" />}
        </button>
        <button className="pdf-action" disabled={pdfDisabled} onClick={onPdf}>
          PDF 校样 <span aria-hidden="true">↗</span>
        </button>
      </div>
    </header>
  );
}

export function MessageBar({
  error,
  notice,
  dismiss,
}: {
  error: string;
  notice: string;
  dismiss: () => void;
}) {
  if (!error && !notice) return null;
  return (
    <div className={"message " + (error ? "error" : "")} role={error ? "alert" : "status"}>
      <span>{error || notice}</span>
      <button aria-label="关闭提示" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
