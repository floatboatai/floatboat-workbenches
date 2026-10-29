import { Sparkles, RefreshCw } from "lucide-react";
import { isRecord } from "../contracts/project.ts";
import {
  QUESTION_KINDS,
  DIFFICULTIES,
  GENERATION_MAX,
  type GenerationOptions,
} from "../contracts/generation.ts";
import type { Desk } from "./useTutorDesk.ts";
import { KIND_LABEL, answerLabel } from "./labels.ts";

const STATUS: Record<string, string> = {
  completed: "题目已生成，等待审题",
  running: "正在根据讲义出题…",
  failed: "本次出题未完成",
  interrupted: "出题任务已中断",
};

export function HostStatus({
  d,
  action,
  compact = false,
}: {
  d: Desk;
  action: string;
  compact?: boolean;
}) {
  if (d.model.available) return null;
  return (
    <div className={`host-status ${compact ? "compact" : ""}`} role="status">
      <p>
        <strong>{d.model.checked ? `${action}需要Floatboat模型` : "正在检查Floatboat…"}</strong>
        {d.model.checked
          ? compact
            ? "启动并登录Floatboat客户端后重新检查；上方的参考答案和解析不受影响。"
            : "启动并登录Floatboat桌面客户端后点“重新检查”；模型与凭据由Floatboat管理，默认使用 gemini-3.8-flash。判题、复习与题库导入不受影响。"
          : null}
      </p>
      <button
        onClick={() => {
          void d.checkModel();
        }}
      >
        <RefreshCw size={14} aria-hidden="true" />
        重新检查
      </button>
    </div>
  );
}

export function GenerationPanel({ d }: { d: Desk }) {
  const { p, busy, mutable, generation, generationId, generationOptions: o } = d;
  const command = isRecord(p.draft.pendingGeneration) ? p.draft.pendingGeneration : null;
  const set = (next: Partial<GenerationOptions>) => d.setGenerationOptions(next);
  const active = !!generationId || !!generation;
  return (
    <section className="generate" aria-labelledby="generate-title">
      <h3 id="generate-title">根据讲义出题</h3>
      <div className="generate-form">
        <label>
          题数
          <select
            name="generationCount"
            value={o.count}
            disabled={!mutable}
            onChange={(e) => set({ count: Number(e.target.value) })}
          >
            {Array.from({ length: GENERATION_MAX }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} 道
              </option>
            ))}
          </select>
        </label>
        <label>
          题型
          <select
            name="generationKind"
            value={o.kind}
            disabled={!mutable}
            onChange={(e) => set({ kind: e.target.value as GenerationOptions["kind"] })}
          >
            {QUESTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "mixed" ? "混合题型" : KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          难度
          <select
            name="generationDifficulty"
            value={o.difficulty}
            disabled={!mutable}
            onChange={(e) =>
              set({ difficulty: e.target.value as GenerationOptions["difficulty"] })
            }
          >
            {DIFFICULTIES.map((k) => (
              <option key={k} value={k}>
                {k === "mixed" ? "由浅入深" : k}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-action"
          disabled={!d.model.available || busy || !mutable || !!generationId}
          onClick={() => {
            void d.submitGeneration();
          }}
        >
          <Sparkles size={16} aria-hidden="true" />
          出题
        </button>
      </div>
      <HostStatus d={d} action="出题" />
      {d.generationError && !generationId ? (
        <p className="inline-error" role="alert">
          {d.generationError}
        </p>
      ) : null}
      {active ? (
        <div className="generation" aria-live="polite">
          <strong>{generation ? STATUS[generation.status] : "提交结果尚未确认"}</strong>
          <p>
            {generation?.error ||
              (generation
                ? `${generation.options.count}道 · ${generation.options.kind === "mixed" ? "混合题型" : KIND_LABEL[generation.options.kind]} · ${generation.options.difficulty === "mixed" ? "由浅入深" : generation.options.difficulty}。生成的题先在这里审阅，再加入练习册。`
                : "可以按原操作编号核对任务，不会重复出题。")}
            {generation && generation.lesson !== p.data.lesson
              ? " 讲义在提交后有修改，这组题来自提交时的讲义。"
              : ""}
          </p>
          {generation?.status === "completed" ? (
            <>
              <ol className="generated-list">
                {generation.questions.map((q) => (
                  <li key={q.question_id}>
                    <span className="kind">{KIND_LABEL[q.question_type] ?? q.question_type}</span>
                    {q.question}
                    <small>
                      答案 {answerLabel(q, q.correct_answer)}
                      {q.explanation ? ` · ${q.explanation}` : ""}
                    </small>
                  </li>
                ))}
              </ol>
              <div className="adopt">
                <button
                  className="primary"
                  disabled={!mutable || busy}
                  onClick={() => d.adoptQuestions(generation.questions, "generated", "append")}
                >
                  追加到练习册
                </button>
                <button
                  disabled={!mutable || busy}
                  onClick={() => d.adoptQuestions(generation.questions, "generated", "replace")}
                >
                  替换整套题
                </button>
              </div>
            </>
          ) : null}
          {d.generationError && generationId ? (
            <p className="inline-error" role="alert">
              {d.generationError}
            </p>
          ) : null}
          <div className="generation-actions">
            {generationId && generation?.status !== "completed" ? (
              <button
                disabled={busy}
                onClick={() => {
                  void d.pollGeneration();
                }}
              >
                核对任务状态
              </button>
            ) : null}
            {!generation && command ? (
              <button
                disabled={busy || !d.model.available}
                onClick={() => {
                  void d.submitGeneration(command);
                }}
              >
                重试提交同一任务
              </button>
            ) : null}
            {generation && generation.status !== "running" ? (
              <button onClick={d.dismissGeneration}>收起任务</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
