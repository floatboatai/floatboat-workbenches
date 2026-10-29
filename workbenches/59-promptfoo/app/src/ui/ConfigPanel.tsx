// ABOUTME: promptfooconfig.yaml 编辑面板：原文编辑（未生效输入也自动保存）、逐行错误、结构摘要与常用插入。
import { useRef } from "react";
import { X, FileSpreadsheet, Plus, Undo2 } from "lucide-react";
import type { Suite } from "../contracts/config";

const kindText: Record<string, string> = { replay: "回放录制", echo: "echo", script: "本机脚本", host: "Floatboat 模型" };
export function ConfigPanel({
  text,
  applied,
  suite,
  error,
  errorLine,
  hostModel,
  onChange,
  onRevert,
  onClose,
  onImportCsv,
  onAddHost,
}: {
  text: string;
  applied: boolean;
  suite: Suite | null;
  error: string;
  errorLine: number | null;
  hostModel: string;
  onChange: (v: string) => void;
  onRevert: () => void;
  onClose: () => void;
  onImportCsv: () => void;
  onAddHost: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const jump = (line: number) => {
    const el = area.current;
    if (!el) return;
    const lines = text.split("\n");
    const start = lines.slice(0, line - 1).reduce((s, l) => s + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    el.scrollTop = Math.max(0, (line - 4) * 19);
  };
  const lineCount = text.split("\n").length;
  return (
    <section className="config" aria-label="评测配置" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <header className="insp-head">
        <div>
          <p className="eyebrow">promptfooconfig.yaml · {lineCount} 行</p>
          <h2>评测配置</h2>
        </div>
        <button className="ghost small close" onClick={onClose} aria-label="关闭配置">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <p className={error ? "config-state bad" : "config-state ok"} role="status">
        {error ? (
          <>
            未生效：{error}
            {errorLine ? (
              <button className="link" onClick={() => jump(errorLine)}>
                跳到第 {errorLine} 行
              </button>
            ) : null}
          </>
        ) : applied ? (
          "已生效，下一次运行使用此配置。"
        ) : (
          "检查中…"
        )}
      </p>
      <label className="sr-only" htmlFor="config-yaml">
        配置 YAML
      </label>
      <textarea
        id="config-yaml"
        ref={area}
        name="config"
        className="yaml"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        wrap="off"
        maxLength={600000}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="config-actions">
        <button onClick={onImportCsv}>
          <FileSpreadsheet size={15} aria-hidden="true" />
          追加用例 CSV…
        </button>
        <button onClick={onAddHost}>
          <Plus size={15} aria-hidden="true" />
          添加 Floatboat 模型列
        </button>
        {error ? (
          <button onClick={onRevert}>
            <Undo2 size={15} aria-hidden="true" />
            恢复已生效版本
          </button>
        ) : null}
      </div>
      {suite ? (
        <div className="config-summary">
          <p>
            {suite.prompts.length} 个提示版本 × {suite.providers.length} 个 provider → {suite.columns.length} 列；{suite.tests.length} 个用例，共 {suite.columns.length * suite.tests.length} 格。
          </p>
          <ul className="providers">
            {suite.providers.map((p) => (
              <li key={p.label}>
                <span className={`kind k-${p.kind}`}>{kindText[p.kind]}</span>
                <span>{p.label}</span>
                {p.kind === "host" ? <small>{p.model} · 运行前需确认</small> : p.kind === "replay" ? <small>录制库：{p.replayOf}</small> : null}
                {p.prompts ? <small>仅 {p.prompts.join("、")}</small> : null}
              </li>
            ))}
          </ul>
          {suite.warnings.length ? (
            <details className="warnings">
              <summary>{suite.warnings.length} 条提示</summary>
              <ul>
                {suite.warnings.slice(0, 40).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="muted small">
            本机执行：equals、contains/icontains(-any/-all)、regex、starts-with、is-json、contains-json、is-valid-openai-tools-call、javascript（隔离沙箱）、levenshtein、rouge-n、bleu、latency、cost、word-count、finish-reason，均可加 not- 前缀，支持 weight、threshold、metric、transform 与 assert-set。llm-rubric 等模型评分断言保留但标为未执行。Floatboat 模型写作 floatboat:{hostModel || "<模型>"}。
          </p>
        </div>
      ) : null}
    </section>
  );
}
