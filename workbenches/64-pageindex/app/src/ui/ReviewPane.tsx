// ABOUTME: 右栏审阅：带页码的摘录与意见，以及按原页回答并逐字核对引用的提问。
import type { useReader } from "./useReader.ts";
import { MAX_NOTES, textless } from "../contracts/reader.ts";

export function ReviewPane({
  desk,
  goTo,
}: {
  desk: ReturnType<typeof useReader>;
  goTo: (page: number, quote?: string) => void;
}) {
  const { project, mutable, pending, status, index } = desk;
  const data = project.data,
    doc = data.document;
  const running = desk.runs.some((r) => r.status === "running");
  const noText = !!index && textless(index);
  const blocked = !status.model
    ? "需要在 Floatboat 中打开本工作台并连接模型后才能提问；阅读、检索与摘录不受影响。"
    : noText
      ? "此PDF没有可提取文字（可能是扫描件），无法按原文提问。"
      : "";
  return (
    <aside className="review" aria-label="审阅">
      <section className="notes" aria-labelledby="notes-title">
        <div className="pane-head">
          <h2 id="notes-title">
            摘录 <span>{data.notes.length}</span>
          </h2>
          <small>选中原页文字，或用纸张上方“摘录”</small>
        </div>
        {!data.notes.length ? (
          <p className="empty-notes">
            {doc
              ? "在原页上选中一句话，点“摘录所选”，把原文和你的判断放在一起。"
              : "打开文档后，摘录会带着页码出现在这里。"}
          </p>
        ) : null}
        {data.notes.map((note, i) => (
          <article className="note" key={note.id}>
            <div className="note-heading">
              <button
                className="page-tag"
                onClick={() => goTo(note.page, note.quote)}
                aria-label={`回到第${note.page}页并标出摘录`}
              >
                P.{note.page}
              </button>
              <button
                className="quiet"
                aria-label={`删除摘录${i + 1}`}
                disabled={!mutable}
                onClick={() => {
                  if (confirm("删除这条摘录？"))
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
              <span className="sr-only">摘录{i + 1}原文</span>
              <textarea
                className="quote"
                id={`quote-${note.id}`}
                name={`quote-${note.id}`}
                autoComplete="off"
                rows={2}
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
              <span className="sr-only">摘录{i + 1}审阅意见</span>
              <textarea
                id={`note-${note.id}`}
                name={`note-${note.id}`}
                autoComplete="off"
                rows={2}
                placeholder="审阅意见：需要确认什么？"
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
        {data.notes.length >= MAX_NOTES ? (
          <p className="field-error">已达{MAX_NOTES}条摘录上限，请导出审阅后另建档案。</p>
        ) : null}
      </section>
      <section className="ask" aria-labelledby="ask-title">
        <div className="pane-head">
          <h2 id="ask-title">原页问答</h2>
          <small>先选章节，再读原页，引用逐字核对</small>
        </div>
        <label htmlFor="reader-question" className="sr-only">
          向这份文档提问
        </label>
        <textarea
          id="reader-question"
          name="question"
          autoComplete="off"
          rows={3}
          placeholder="例如：闭馆前需要检查哪些项目？"
          maxLength={2000}
          value={data.question}
          disabled={!mutable}
          onChange={(e) => project.setData((d) => ({ ...d, question: e.target.value }))}
        />
        <div className="ask-row">
          <small>Floatboat 模型 · gemini-3.8-flash</small>
          <button
            className="solid"
            disabled={
              !mutable ||
              !doc ||
              !index ||
              !!blocked ||
              running ||
              !!pending ||
              !data.question.trim()
            }
            onClick={() => void desk.ask()}
          >
            {running ? "正在核对原文…" : "查阅原文"}
          </button>
        </div>
        {blocked && status.checked ? (
          <div className="status-card" role="status">
            <p>{blocked}</p>
            {!status.model ? (
              <button onClick={() => void desk.refreshStatus()}>重新检查连接</button>
            ) : null}
          </div>
        ) : null}
        {pending ? (
          <div className="status-card" role="status">
            <p>上次提问的提交回执尚未确认，不会自动重发。</p>
            <button disabled={!mutable} onClick={() => void desk.ask()}>
              核对原提交
            </button>
          </div>
        ) : null}
        {project.draft.importedPendingQuestion ? (
          <p className="fine">导入文件包含一条未确认提问，已保留记录，不会自动执行。</p>
        ) : null}
        {/* One history, newest first: this session's runs (answer or recorded failure), then imported answers. */}
        {[
          ...desk.runs.map((r) => ({ key: r.id, run: r, answer: r.result })),
          ...data.archivedAnswers
            .filter((a) => !desk.runs.some((r) => r.id === a.id))
            .sort((x, y) => y.at.localeCompare(x.at))
            .map((a) => ({ key: a.id, run: null, answer: a })),
        ].map(({ key, run, answer }) =>
          answer ? (
            <details className="answer" key={key} open>
              <summary>{answer.question}</summary>
              <p>{answer.answer}</p>
              {answer.citations.map((c, i) => (
                <blockquote key={i}>
                  <button
                    className="page-tag cite"
                    onClick={() => goTo(c.page, c.quote)}
                    aria-label={`回到第${c.page}页并标出引用`}
                  >
                    P.{c.page}
                  </button>
                  <p>{c.quote}</p>
                </blockquote>
              ))}
              <small>
                {!run
                  ? "导入的历史回答"
                  : answer.insufficient
                    ? "原文证据不足"
                    : "引用已逐字核对原页 · 请人工复核结论"}
              </small>
            </details>
          ) : run ? (
            <div className={run.status === "running" ? "question-state" : "question-state failed"} key={key}>
              <strong>{run.question}</strong>
              <p role="status">
                {run.status === "running" ? "正在选择章节并核对引用…" : run.error}
              </p>
            </div>
          ) : null,
        )}
      </section>
    </aside>
  );
}
