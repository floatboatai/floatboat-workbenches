// ABOUTME: 应用自有的工作区封装：自动保存状态 + AI 大纲候选稿（保存在工作副本 extra 中，采用前不改动文稿）。
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { isRecord } from "../contracts/project";
import { validateDeck, type Deck } from "../contracts/domain";
import type { OutlineSuggestion } from "../contracts/outline";
import { useWorkbenchState, type AutosaveOptions } from "./autosave-client";
import { request } from "./requests";
export { request, download } from "./requests";

function decodeSuggestion(raw: unknown): OutlineSuggestion | null {
  if (!isRecord(raw) || typeof raw.title !== "string") return null;
  try {
    return { title: raw.title.slice(0, 120), deck: validateDeck(raw.deck) };
  } catch {
    return null;
  }
}

export function useProjects(seed: Deck, validate: (value: unknown) => Deck, defaultTitle: string, options: AutosaveOptions<Deck> = {}) {
  const project = useWorkbenchState(seed, validate, defaultTitle, options);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const generation = useRef(0);
  const rawSuggestion = project.draft.__aiSuggestion;
  const suggestion = useMemo(() => decodeSuggestion(rawSuggestion), [rawSuggestion]);
  useEffect(() => {
    generation.current++;
    setAiBusy(false);
    setAiError("");
  }, [project.documentKey]);
  function discardSuggestion() {
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
      const value = await request("/api/generate", { method: "POST", body: JSON.stringify({ prompt, theme: project.data.theme }) });
      const result = decodeSuggestion(value);
      if (!result) throw new Error("模型返回的大纲无法使用，请调整要求重试。");
      if (token === generation.current) project.setDraft((extra) => ({ ...extra, __aiSuggestion: result }));
    } catch (error) {
      if (token === generation.current) setAiError(error instanceof Error ? error.message : "生成失败，请重试。");
    } finally {
      if (token === generation.current) setAiBusy(false);
    }
  }
  /** Replaces the slides with the suggestion while keeping the current theme. Returns the new deck. */
  function applySuggestion(update: (next: Deck) => void) {
    if (!suggestion) return;
    const deck: Deck = { ...suggestion.deck, theme: project.data.theme };
    update(deck);
    discardSuggestion();
    project.setNotice("已采用 AI 大纲，主题保持不变。");
  }
  return { ...project, aiBusy, aiError, suggestion, generate, applySuggestion, discardSuggestion };
}

export function Notice({ error, notice, onDismiss }: { error: string; notice: string; onDismiss: () => void }) {
  if (!error && !notice) return null;
  return (
    <div className={"notice" + (error ? " is-error" : "")} role={error ? "alert" : "status"}>
      <span>{error || notice}</span>
      <button type="button" aria-label="关闭提示" onClick={onDismiss}>
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
        <p>编辑器加载失败，已保存内容仍在。</p>
        <button onClick={() => location.reload()}>刷新重试</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
