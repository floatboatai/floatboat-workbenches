// ABOUTME: 流水线文件的工作副本（自动保存）、AI 候选稿与渲染边界；产品自有，自动保存同步时保留。
import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { restoreFlowDraft, validateFlow, validateGeneratedFlow, type FlowDocument } from "../contracts/flow";
import { seed, seedTitle } from "../contracts/templates";
import { useWorkbenchState } from "./autosave-client";
import { request } from "./requests";
export { request, download } from "./requests";

export function usePipelineFiles() {
  const project = useWorkbenchState<FlowDocument>(seed, validateFlow, seedTitle, {
    storageKey: "react-flow",
    restoreDraftData: restoreFlowDraft,
  });
  const [aiBusy, setAiBusy] = useState(false),
    [aiError, setAiError] = useState(""),
    [suggestion, setSuggestion] = useState<FlowDocument | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setAiError("");
  }, [project.documentKey]);
  useEffect(() => {
    const raw = project.draft.__aiSuggestion;
    if (raw === undefined) {
      setSuggestion(null);
      return;
    }
    try {
      setSuggestion(validateGeneratedFlow(raw));
    } catch {
      setSuggestion(null);
    }
  }, [project.documentKey, project.draft.__aiSuggestion]);
  function discardSuggestion() {
    setSuggestion(null);
    project.setDraft((extra) => {
      const next = { ...extra };
      delete next.__aiSuggestion;
      return next;
    });
  }
  async function generate(prompt: string) {
    const token = ++generation.current;
    setAiBusy(true);
    setAiError("");
    try {
      const result = validateGeneratedFlow(await request("/api/generate", { method: "POST", body: JSON.stringify({ prompt }) }));
      if (token === generation.current) project.setDraft((extra) => ({ ...extra, __aiSuggestion: result }));
    } catch (e) {
      if (token === generation.current) setAiError(e instanceof Error ? e.message : "生成失败，请重试。");
    } finally {
      setAiBusy(false);
    }
  }
  return { ...project, aiBusy, aiError, suggestion, generate, discardSuggestion };
}

export function Notice({ error, notice, onDismiss }: { error: string; notice: string; onDismiss: () => void }) {
  if (!error && !notice) return null;
  return (
    <div className={"notice" + (error ? " error" : "")} role={error ? "alert" : "status"}>
      <span>{error || notice}</span>
      <button type="button" className="icon-button" aria-label="关闭提示" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

export class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="render-error">
        <p>画布加载失败，已保存的内容仍在。</p>
        <button onClick={() => location.reload()}>刷新重试</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
