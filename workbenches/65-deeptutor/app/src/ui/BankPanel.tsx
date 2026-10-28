import type { useTutorDesk } from "./useTutorDesk.ts";
import { isRecord } from "../contracts/project.ts";
export function BankPanel({ d }: { d: ReturnType<typeof useTutorDesk> }) {
  const { p, bankOpen, busy, mutable, status, generation, generationId } = d;
  const command = isRecord(p.draft.pendingGeneration)
    ? p.draft.pendingGeneration
    : null;
  return (
    <>
      {generationId || generation ? (
        <section className="generation-panel" aria-label="出题任务">
          <div>
            <strong>
              {generation?.status === "completed"
                ? "题库已生成，等待审题"
                : generation?.status === "running"
                  ? "正在根据讲义出题…"
                  : generation?.status === "failed"
                    ? "本次出题未完成"
                    : generation?.status === "interrupted"
                      ? "出题任务已中断"
                      : "提交结果尚未确认"}
            </strong>
            <p>
              {generation?.error || "生成的题目先进入审阅区，再采用到课程。"}
              {generation && generation.lesson !== p.data.lesson
                ? "当前讲义已有修改，此题库来自提交时的讲义。"
                : ""}
            </p>
          </div>
          {generation?.status === "completed" ? (
            <>
              <ol>
                {generation.questions.map((q) => (
                  <li key={q.question_id}>
                    {q.question}
                    <small>
                      {q.correct_answer} · {q.explanation}
                    </small>
                  </li>
                ))}
              </ol>
              <button
                className="primary"
                disabled={!mutable || busy}
                onClick={() =>
                  d.adoptQuestions(generation.questions, "generated")
                }
              >
                采用这组题目
              </button>
            </>
          ) : null}
          {d.generationError ? <p role="alert">{d.generationError}</p> : null}
          <div className="generation-actions">
            {generationId ? (
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
                disabled={busy || !status.model || !status.practice}
                onClick={() => {
                  void d.submitGeneration(command);
                }}
              >
                重试提交同一任务
              </button>
            ) : null}
            {generation && generation.status !== "running" ? (
              <button
                onClick={() =>
                  p.setDraft((x) => {
                    const n = { ...x };
                    delete n.generation;
                    delete n.generationId;
                    delete n.pendingGeneration;
                    return n;
                  })
                }
              >
                收起任务
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      {bankOpen ? (
        <section className="bank-editor" aria-label="题库导入与编辑">
          <header>
            <div>
              <h2>题库工作稿</h2>
              <p>导入DeepTutor题库，或编辑题库原文后检查格式。</p>
            </div>
            <button onClick={() => d.setBankOpen(false)}>收起</button>
          </header>
          <div className="bank-toolbar">
            <button onClick={() => d.bankFile.current?.click()}>
              选择题库文件
            </button>
            <label>
              格式
              <select
                aria-label="题库格式"
                value={d.bankFormat}
                onChange={(e) =>
                  p.setDraft((x) => ({ ...x, bankFormat: e.target.value }))
                }
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="tsv">TSV</option>
              </select>
            </label>
            <button onClick={d.exportBank}>导出当前题库</button>
          </div>
          <label>
            题库原文
            <textarea
              id="bank-text"
              name="bankText"
              spellCheck={false}
              value={d.rawBank}
              maxLength={350000}
              onChange={(e) =>
                p.setDraft((x) => ({ ...x, bankText: e.target.value }))
              }
            />
          </label>
          <div className="bank-toolbar">
            <button
              className="primary"
              disabled={!mutable || busy || !status.practice}
              onClick={() => {
                void d.normalizeBank();
              }}
            >
              {busy ? "正在检查…" : "检查题库格式"}
            </button>
            <span>未完成的题库编辑也会自动保存</span>
          </div>
          {d.bank ? (
            <div className="bank-candidate">
              <strong>{d.bank.length} 道题已通过格式检查</strong>
              <ol>
                {d.bank.map((q) => (
                  <li key={q.question_id}>{q.question}</li>
                ))}
              </ol>
              <button
                disabled={!mutable || busy}
                onClick={() => d.adoptQuestions(d.bank!, "bank")}
              >
                采用检查后的题库
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      <input
        ref={d.bankFile}
        type="file"
        accept=".json,.csv,.tsv"
        hidden
        aria-label="选择题库文件"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void d.readBank(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
