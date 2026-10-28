import type { useTutorDesk } from "./useTutorDesk.ts";
export function QuestionPanel({ d }: { d: ReturnType<typeof useTutorDesk> }) {
  const {
    p,
    question,
    answer,
    currentCheck,
    busy,
    status,
    mutable,
    pendingReview,
  } = d;
  if (!question)
    return (
      <section className="question-sheet">
        <h2>准备第一组练习</h2>
        <p>导入题库，或根据左侧讲义生成练习题。</p>
        <button onClick={() => d.setBankOpen(true)}>打开题库</button>
      </section>
    );
  const at = p.data.questions.findIndex(
      (q) => q.question_id === question.question_id,
    ),
    schedule = p.data.schedules[question.question_id];
  function setAnswer(value: string) {
    if (!question) return;
    p.setData((s) => ({
      ...s,
      answers: { ...s.answers, [question.question_id]: value },
    }));
  }
  return (
    <section className="question-sheet" aria-label="当前练习题">
      <div className="question-top">
        <span>
          练习 {String(at + 1).padStart(2, "0")} /{" "}
          {String(p.data.questions.length).padStart(2, "0")}
        </span>
        <span>{question.difficulty || "自选难度"}</span>
      </div>
      <div className="question-tags">
        {question.tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <h2>{question.question}</h2>
      <fieldset disabled={!mutable} className="answer-options">
        <legend>
          {question.question_type === "multi_choice"
            ? "选择所有正确选项"
            : Object.keys(question.options).length
              ? "选择一个答案"
              : "写下你的思路"}
        </legend>
        {Object.keys(question.options).length ? (
          Object.entries(question.options).map(([key, text]) => (
            <label
              key={key}
              className={answer.split(",").includes(key) ? "selected" : ""}
            >
              <input
                type={
                  question.question_type === "multi_choice"
                    ? "checkbox"
                    : "radio"
                }
                name="answer-option"
                value={key}
                checked={answer.split(",").includes(key)}
                onChange={(e) => {
                  if (question.question_type === "multi_choice") {
                    const keys = new Set(answer.split(",").filter(Boolean));
                    if (e.target.checked) keys.add(key);
                    else keys.delete(key);
                    setAnswer([...keys].sort().join(","));
                  } else setAnswer(key);
                }}
              />
              <b>{key}</b>
              <span>{text}</span>
            </label>
          ))
        ) : (
          <textarea
            id="answer-text"
            aria-label="我的答案"
            name="answer"
            value={answer}
            maxLength={5000}
            placeholder="试着用自己的话解释…"
            onChange={(e) => setAnswer(e.target.value)}
          />
        )}
      </fieldset>
      <div className="answer-actions">
        <button
          className="primary"
          disabled={!mutable || busy || !status.practice || !answer.trim()}
          onClick={() => {
            void d.checkAnswer();
          }}
        >
          {busy ? "正在处理…" : "核对答案"}
        </button>
        <span>{currentCheck ? "已核对当前答案" : "作答会自动保存"}</span>
      </div>
      {currentCheck ? (
        <div
          className={`feedback ${currentCheck.correct === true ? "correct" : currentCheck.correct === false ? "incorrect" : "self"}`}
          role="status"
        >
          <strong>
            {currentCheck.correct === true
              ? "回答正确"
              : currentCheck.correct === false
                ? "再看一看这个知识点"
                : "请对照参考答案自评"}
          </strong>
          <p>
            <b>参考答案</b> {question.correct_answer}
            {question.options[question.correct_answer]
              ? ` · ${question.options[question.correct_answer]}`
              : ""}
          </p>
          <p>{question.explanation}</p>
          <div className="rating">
            <span>下次复习安排</span>
            <div>
              {[
                ["again", "再练一次"],
                ["hard", "有点难"],
                ["good", "已掌握"],
                ["easy", "很轻松"],
              ].map(([value, text]) => (
                <button
                  key={value}
                  disabled={
                    !mutable || busy || !status.practice || !!pendingReview
                  }
                  onClick={() => {
                    void d.review(value);
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {pendingReview ? (
        <div className="pending" role="status">
          复习提交尚待确认。
          <button
            disabled={busy || !status.practice}
            onClick={() => {
              void d.sendReview(pendingReview);
            }}
          >
            核对并重试原操作
          </button>
          <button onClick={p.exportDraft}>导出工作稿</button>
        </div>
      ) : null}
      {schedule ? (
        <p className="next-review">
          下次复习：
          {new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(schedule.due_at * 1000)}{" "}
          · 已复习 {schedule.review_count} 次
        </p>
      ) : null}
      <nav className="question-turn" aria-label="切换题目">
        <button
          disabled={at <= 0 || !mutable}
          onClick={() =>
            p.setData((s) => ({
              ...s,
              selected: s.questions[at - 1].question_id,
            }))
          }
        >
          上一题
        </button>
        <span>
          {at + 1} / {p.data.questions.length}
        </span>
        <button
          disabled={at >= p.data.questions.length - 1 || !mutable}
          onClick={() =>
            p.setData((s) => ({
              ...s,
              selected: s.questions[at + 1].question_id,
            }))
          }
        >
          下一题
        </button>
      </nav>
    </section>
  );
}
