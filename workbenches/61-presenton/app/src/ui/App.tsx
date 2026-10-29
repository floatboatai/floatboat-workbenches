// ABOUTME: 工作台外壳：文稿菜单、标题与保存状态、资料 → 大纲 → 成稿三步，以及自动保存的恢复入口。
import { useEffect, useRef } from "react";
import { EXAMPLE_TITLE, example } from "../contracts/deck";
import { restoreDeck, validateDeck, type Deck } from "../contracts/model";
import { useWorkbenchState } from "./autosave-client";
import { BriefStep } from "./BriefStep";
import { DeckStep } from "./DeckStep";
import { FileMenu } from "./FileMenu";
import { OutlineStep } from "./OutlineStep";
import { Notice, RenderBoundary } from "./workspace";

export type Doc = ReturnType<typeof useWorkbenchState<Deck>>;
export type Step = "brief" | "outline" | "deck";
const STEPS: { id: Step; label: string }[] = [
  { id: "brief", label: "资料" },
  { id: "outline", label: "大纲" },
  { id: "deck", label: "成稿" },
];

export function currentStep(doc: Doc): Step {
  const s = doc.draft.step;
  if (s === "brief" || s === "outline" || s === "deck") return s;
  return doc.data.slides.length ? "deck" : doc.data.outline.length ? "outline" : "brief";
}

export function App() {
  const doc = useWorkbenchState(example, validateDeck, EXAMPLE_TITLE, { storageKey: "presenton-studio-v1", restoreDraftData: restoreDeck });
  const step = currentStep(doc);
  const setStep = (s: Step) => doc.setDraft((d) => ({ ...d, step: s }));
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.scrollTo?.({ top: 0 });
  }, [step, doc.documentKey]);
  const counts: Record<Step, string> = {
    brief: doc.data.brief.source.trim() ? `${doc.data.brief.source.length.toLocaleString()} 字` : "待填写",
    outline: doc.data.outline.length ? `${doc.data.outline.length} 页` : "未生成",
    deck: doc.data.slides.length ? `${doc.data.slides.length} 页` : "未生成",
  };
  const phase = doc.autoState.phase;
  return (
    <div className="studio" data-step={step}>
      <a href="#work" className="skip">
        跳至工作区
      </a>
      <header className="topbar">
        <FileMenu doc={doc} onOpened={() => undefined} />
        <label className="doc-title">
          <span className="sr-only">文稿名称</span>
          <input name="document-title" autoComplete="off" value={doc.title} maxLength={120} onChange={(e) => doc.setTitle(e.target.value)} />
        </label>
        <div className="save-state" data-phase={phase} role="status" aria-live="polite">
          <span className="dot" aria-hidden="true" />
          <span className="save-text">{doc.autoState.message || "编辑后自动保存"}</span>
        </div>
        <nav className="steps" aria-label="制作步骤">
          {STEPS.map((s, i) => (
            <button key={s.id} type="button" className={step === s.id ? "step current" : "step"} aria-current={step === s.id ? "step" : undefined} onClick={() => setStep(s.id)}>
              <b>{i + 1}</b>
              <span>{s.label}</span>
              <small>{counts[s.id]}</small>
            </button>
          ))}
        </nav>
      </header>
      <Notice error={doc.error} notice={doc.notice} onClose={() => (doc.error ? doc.setError("") : doc.setNotice(""))} />
      {(phase === "conflict" || phase === "offline" || phase === "draft") && (
        <div className="recovery" role="group" aria-label="保存恢复">
          <span>{phase === "conflict" ? "另一窗口已改动此文稿。" : phase === "offline" ? "服务端暂未确认保存，内容保存在本机。" : "当前内容作为草稿保存。"}</span>
          <button type="button" onClick={doc.exportDraft}>
            导出完整工作副本
          </button>
          {doc.current && phase === "conflict" && (
            <button
              type="button"
              onClick={() => {
                if (confirm("打开服务器上的版本？当前修改请先导出。")) void doc.open(doc.current!.id);
              }}
            >
              打开服务器版本
            </button>
          )}
          {phase === "offline" && (
            <button type="button" onClick={() => void doc.save()}>
              重试保存
            </button>
          )}
        </div>
      )}
      <main id="work" ref={main} className="work" tabIndex={-1}>
        {doc.loading ? (
          <p className="loading" role="status">
            正在恢复文稿…
          </p>
        ) : (
          <RenderBoundary>
            {step === "brief" && <BriefStep key={doc.documentKey} doc={doc} go={setStep} />}
            {step === "outline" && <OutlineStep key={doc.documentKey} doc={doc} go={setStep} />}
            {step === "deck" && <DeckStep key={doc.documentKey} doc={doc} go={setStep} />}
          </RenderBoundary>
        )}
      </main>
    </div>
  );
}
