// ABOUTME: 图表文件的工作副本（自动保存）、AI 候选规格与渲染边界；产品自有，自动保存同步时保留。
import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { checkSpec, seed, validate, type Model } from "../contracts/model";
import { isRecord } from "../contracts/project";
import { useWorkbenchState } from "./autosave-client";
import { request } from "./requests";
export { request, download } from "./requests";

export interface Suggestion {
  spec: Record<string, unknown>;
}
const decodeSuggestion = (value: unknown): Suggestion => ({
  spec: checkSpec(isRecord(value) && isRecord(value.spec) ? value.spec : null),
});

export function useChartFiles() {
  const project = useWorkbenchState<Model>(seed, validate, "三城气温季节变化", {
    storageKey: "vega-lite-studio",
  });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<{ message: string; host: boolean } | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setAiError(null);
  }, [project.documentKey]);
  useEffect(() => {
    const raw = project.draft.__aiSuggestion;
    if (raw === undefined) {
      setSuggestion(null);
      return;
    }
    try {
      setSuggestion(decodeSuggestion(raw));
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
    setAiError(null);
    try {
      const result = decodeSuggestion(
        await request("/api/generate", {
          method: "POST",
          body: JSON.stringify({ prompt, datasets: project.data.datasets }),
        }),
      );
      if (token === generation.current) {
        setSuggestion(result);
        project.setDraft((extra) => ({ ...extra, __aiSuggestion: result }));
      }
    } catch (error) {
      if (token === generation.current)
        setAiError({
          message: error instanceof Error ? error.message : "生成失败，请重试。",
          host: typeof error === "object" && error !== null && "status" in error && error.status === 503,
        });
    } finally {
      setAiBusy(false);
    }
  }
  return { ...project, aiBusy, aiError, suggestion, generate, discardSuggestion };
}
export type ChartFiles = ReturnType<typeof useChartFiles>;

export class RenderBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="render-error">
        <p>{this.props.label}加载失败，已保存内容仍在。</p>
        <button type="button" onClick={() => location.reload()}>
          刷新重试
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
