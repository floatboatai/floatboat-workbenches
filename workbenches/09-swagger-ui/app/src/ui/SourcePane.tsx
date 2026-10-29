import type { RefObject } from "react";
import { PanelLeft, X } from "lucide-react";
import type { Diagnostic, SpecFormat } from "../contracts/openapi";
import { SourceEditor, type EditorHandle } from "./SourceEditor";

/** 并排源码：文件名、检查状态、编辑器与可跳行的诊断列表。 */
export function SourcePane({
  editorRef,
  fileLabel,
  format,
  text,
  onChange,
  diagnostics,
  checking,
  canConvert,
  onConvert,
  onClose,
}: {
  editorRef: RefObject<EditorHandle | null>;
  fileLabel: string;
  format: SpecFormat;
  text: string;
  onChange: (value: string) => void;
  diagnostics: Diagnostic[];
  checking: boolean;
  canConvert: boolean;
  onConvert: () => void;
  onClose: () => void;
}) {
  const errors = diagnostics.filter((item) => item.severity === "error").length;
  const warnings = diagnostics.length - errors;
  return (
    <section className="source-pane" aria-label="规格源码">
      <div className="pane-head">
        <span className="file-name">
          <PanelLeft size={14} aria-hidden="true" />
          {fileLabel}
        </span>
        <span
          className={"check-state " + (checking ? "busy" : errors ? "error" : warnings ? "warn" : "ok")}
        >
          {checking
            ? "检查中…"
            : errors
              ? `${errors} 错误${warnings ? ` · ${warnings} 警告` : ""}`
              : warnings
                ? `通过 · ${warnings} 警告`
                : "通过检查"}
        </span>
        <button
          className="link"
          disabled={!canConvert}
          title={canConvert ? undefined : "修正错误后才能转换"}
          onClick={onConvert}
        >
          转为 {format === "yaml" ? "JSON" : "YAML"}
        </button>
        <button className="icon-button close-source" aria-label="关闭源码" onClick={onClose}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <SourceEditor
        ref={editorRef}
        value={text}
        onChange={onChange}
        label={`OpenAPI ${format === "yaml" ? "YAML" : "JSON"} 源码`}
        diagnostics={diagnostics}
        describedBy="diagnostics-summary"
      />
      <div className="diagnostics">
        <p id="diagnostics-summary" className="diagnostics-summary" aria-live="polite">
          {checking
            ? "停止输入后自动检查。"
            : errors
              ? `有 ${errors} 处错误，文档保持上次有效版本；修正后自动更新。`
              : warnings
                ? `可以预览，另有 ${warnings} 条建议。`
                : "规格通过检查，文档已是最新。"}
        </p>
        {diagnostics.length ? (
          <ul>
            {diagnostics.map((item, index) => (
              <li key={index} className={item.severity}>
                <button
                  className="diagnostic"
                  disabled={!item.line}
                  onClick={() => item.line && editorRef.current?.jump(item.line, item.column)}
                >
                  <span className="diag-line">{item.line ? `第 ${item.line} 行` : "全局"}</span>
                  <span className="sr-only">{item.severity === "error" ? "错误" : "警告"}：</span>
                  <span>{item.message}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
