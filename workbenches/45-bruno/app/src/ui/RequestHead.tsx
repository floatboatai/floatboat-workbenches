import type { RefObject } from "react";
import { METHODS, type Receipt, type RequestModel, type SourceFile } from "../contracts/bruno";
import { syncFromUrl } from "./model";

/** Request name, method + URL + Send, and the inline outcome guards right under the action. */
export function RequestHead({
  file,
  model,
  setModel,
  locked,
  rawPending,
  running,
  syncLabel,
  syncError,
  pendingCompose,
  urlInput,
  onSend,
  onCancel,
  onDuplicate,
  onExport,
  onRemove,
  guard,
  onReconcile,
  onDismissGuard,
  sendError,
  blocked,
  warnings,
}: {
  file: SourceFile;
  model: RequestModel | null;
  setModel: (m: RequestModel) => void;
  locked: boolean;
  rawPending: boolean;
  running: boolean;
  syncLabel: string;
  syncError: boolean;
  pendingCompose: boolean;
  urlInput: RefObject<HTMLInputElement | null>;
  onSend: (force?: boolean) => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onRemove: () => void;
  guard: Receipt | null;
  onReconcile: (r: Receipt) => void;
  onDismissGuard: () => void;
  sendError: string;
  blocked: string[];
  warnings: string[];
}) {
  const editable = !locked && Boolean(model) && !rawPending;
  return (
    <div className="request-head">
      <div className="request-title">
        <h1>{model?.name ?? file.path}</h1>
        <span className="path mono" title={file.path}>
          {file.path}
        </span>
        <span className={"sync " + (syncError ? "error" : pendingCompose ? "pending" : "")}>{syncLabel}</span>
        <div className="title-actions">
          <button className="quiet" disabled={locked} onClick={onDuplicate}>
            复制
          </button>
          <button className="quiet" onClick={onExport}>
            导出 .bru
          </button>
          <button className="quiet danger" disabled={locked || running} onClick={onRemove}>
            删除
          </button>
        </div>
      </div>
      <form
        className="urlbar"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <select
          aria-label="HTTP 方法"
          className={"method-select m-" + (model?.method ?? "get").toLowerCase()}
          value={model?.method ?? "GET"}
          disabled={!editable}
          onChange={(e) => model && setModel({ ...model, method: e.target.value })}
        >
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
          {model && !(METHODS as readonly string[]).includes(model.method) ? <option>{model.method}</option> : null}
        </select>
        <input
          id="url"
          translate="no"
          ref={urlInput}
          aria-label="请求 URL"
          className="mono"
          value={model?.url ?? ""}
          disabled={!editable}
          spellCheck={false}
          autoComplete="off"
          placeholder="{{baseUrl}}/path…"
          onChange={(e) => model && setModel(syncFromUrl(model, e.target.value))}
        />
        <button className="send" type="submit" disabled={locked || running || !model}>
          {running ? "发送中…" : "发送"}
        </button>
        {running ? (
          <button type="button" className="quiet" onClick={onCancel}>
            取消
          </button>
        ) : null}
      </form>
      {guard ? (
        <div className="guard" role="alert">
          <p>上一次 {guard.method} 回执未知：服务器可能已经执行。先读取回执或在目标系统核对，再决定是否重发。</p>
          <div>
            <button onClick={() => onReconcile(guard)}>读取回执</button>
            <button className="warn" onClick={() => onSend(true)}>
              核对过，仍然发送
            </button>
            <button className="quiet" onClick={onDismissGuard}>
              取消
            </button>
          </div>
        </div>
      ) : null}
      {sendError ? (
        <p className="inline-note error" role="alert">
          {sendError}
        </p>
      ) : null}
      {blocked.length ? (
        <p className="inline-note warn" role="status">
          无法发送：{blocked.join(" ")}
        </p>
      ) : null}
      {warnings.length ? <p className="inline-note">{warnings.join(" ")}</p> : null}
    </div>
  );
}
