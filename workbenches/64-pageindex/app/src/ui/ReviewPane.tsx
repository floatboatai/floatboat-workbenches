import type { useReader } from "./useReader.ts";
export function ReviewPane({
  desk,
  setPage,
  addNote,
}: {
  desk: ReturnType<typeof useReader>;
  setPage: (page: number) => void;
  addNote: () => void;
}) {
  const { project, mutable, pending, status } = desk;
  const data = project.data,
    doc = data.document;
  const running = desk.runs.some((r) => r.status === "running");
  return (
    <aside className="review">
      <div className="pane-label">
        <h2>审阅便笺</h2>
        <button disabled={!mutable} onClick={desk.exportReview}>
          导出审阅
        </button>
      </div>
      <section className="question-form">
        <label htmlFor="reader-question">向这份文档提问</label>
        <textarea
          id="reader-question"
          name="question"
          autoComplete="off"
          placeholder="例如：闭馆前需要检查哪些项目？"
          maxLength={2000}
          value={data.question}
          disabled={!mutable}
          onChange={(e) =>
            project.setData((d) => ({ ...d, question: e.target.value }))
          }
        />
        <div>
          <small>Gemini 3.8 · 引用回到原页</small>
          <button
            className="solid"
            disabled={
              !mutable ||
              !doc ||
              !status.model ||
              running ||
              !!pending ||
              !data.question.trim()
            }
            onClick={() => void desk.ask()}
          >
            {running ? "正在核对原文…" : "查阅原文"}
          </button>
        </div>
        {!status.model ? (
          <p className="muted">打开 Floatboat 并连接模型后可提问。</p>
        ) : null}
      </section>
      {desk.runs
        .filter((r) => !r.result)
        .map((r) => (
          <div className="question-state" key={r.id}>
            <strong>{r.question}</strong>
            <p role="status">
              {r.status === "running" ? "正在选择章节并核对引用…" : r.error}
            </p>
          </div>
        ))}
      {desk.answers
        .slice()
        .reverse()
        .map((a) => (
          <details className="answer" key={a.id} open>
            <summary>{a.question}</summary>
            <p>{a.answer}</p>
            {a.citations.map((c, i) => (
              <blockquote key={i}>
                <button onClick={() => setPage(c.page)}>
                  第 {c.page} 页 ↗
                </button>
                <p>{c.quote}</p>
              </blockquote>
            ))}
            <small>
              {data.archivedAnswers.some((x) => x.id === a.id)
                ? "导入的历史回答"
                : "依据原页生成 · 请人工复核"}
            </small>
          </details>
        ))}
      <div className="notes-heading">
        <h3>
          我的摘录 <span>{data.notes.length}</span>
        </h3>
        <button
          disabled={!doc || !mutable || data.notes.length >= 60}
          onClick={addNote}
        >
          ＋ 添加
        </button>
      </div>
      {!data.notes.length ? (
        <p className="empty-notes">
          在任一页点击“摘录本页”，把原文和你的判断放在一起。
        </p>
      ) : null}
      {data.notes.map((note, i) => (
        <article className="note" key={note.id}>
          <div className="note-heading">
            <button onClick={() => setPage(note.page)}>
              P.{String(note.page).padStart(2, "0")}
            </button>
            <button
              aria-label={`删除便笺${i + 1}`}
              disabled={!mutable}
              onClick={() => {
                if (confirm("删除这条便笺？"))
                  project.setData((d) => ({
                    ...d,
                    notes: d.notes.filter((n) => n.id !== note.id),
                  }));
              }}
            >
              删除
            </button>
          </div>
          <label>
            原文摘录
            <textarea
              aria-label={`便笺${i + 1}原文摘录`}
              autoComplete="off"
              name={`quote-${note.id}`}
              value={note.quote}
              maxLength={1000}
              disabled={!mutable}
              onChange={(e) =>
                project.setData((d) => ({
                  ...d,
                  notes: d.notes.map((n) =>
                    n.id === note.id ? { ...n, quote: e.target.value } : n,
                  ),
                }))
              }
            />
          </label>
          <label>
            审阅意见
            <textarea
              aria-label={`便笺${i + 1}审阅意见`}
              autoComplete="off"
              name={`note-${note.id}`}
              placeholder="写下需要确认的细节…"
              value={note.text}
              maxLength={1000}
              disabled={!mutable}
              onChange={(e) =>
                project.setData((d) => ({
                  ...d,
                  notes: d.notes.map((n) =>
                    n.id === note.id ? { ...n, text: e.target.value } : n,
                  ),
                }))
              }
            />
          </label>
        </article>
      ))}
    </aside>
  );
}
