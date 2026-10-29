// ABOUTME: 工程 JSON 对话框：直接编辑工程结构；未应用文本作为草稿自动保存，应用前完整校验。
import { useEffect, useRef, useState } from "react";
import { timelineValue, type Timeline } from "../contracts/timeline";

export function JsonDialog({ open, onClose, raw, mutable, onDraft, onApply }: { open: boolean; onClose: () => void; raw: string; mutable: boolean; onDraft: (text: string | null) => void; onApply: (t: Timeline) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const d = ref.current;
    if (d && open && !d.open) d.showModal();
    if (d && !open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="json-dialog" aria-labelledby="json-title" onClose={onClose}>
      <header>
        <h2 id="json-title">工程 JSON</h2>
        <button onClick={onClose}>关闭</button>
      </header>
      <p className="hint">直接编辑工程结构。未应用的修改会作为草稿自动保存，刷新后仍在。</p>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      <label className="sr-only" htmlFor="json-draft">
        工程 JSON 草稿
      </label>
      <textarea id="json-draft" spellCheck={false} disabled={!mutable} value={raw} onChange={(e) => onDraft(e.target.value)} />
      <div className="dialog-actions">
        <button
          onClick={() => {
            onDraft(null);
            setError("");
          }}
        >
          放弃修改
        </button>
        <button
          className="primary"
          disabled={!mutable}
          onClick={() => {
            try {
              onApply(timelineValue(JSON.parse(raw)));
              onDraft(null);
              setError("");
              onClose();
            } catch (e) {
              setError(e instanceof SyntaxError ? "JSON 语法错误：" + e.message : e instanceof Error ? e.message : "无法应用。");
            }
          }}
        >
          应用 JSON
        </button>
      </div>
    </dialog>
  );
}
