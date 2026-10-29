import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Desk } from "./useTutorDesk.ts";
import { KIND_LABEL, TRUE_FALSE, answerLabel } from "./labels.ts";
import { TutorThread } from "./TutorThread.tsx";
import { schedule as preview } from "../contracts/deeptutor/scheduler.ts";

const RATINGS = [
  ["again", "再练一次"],
  ["hard", "有点难"],
  ["good", "已掌握"],
  ["easy", "很轻松"],
] as const;
/** Same deterministic scheduler the server applies, used only to label the choices. */
function interval(days: number) {
  if (days < 1) return `${Math.round(days * 1440)}分钟后`;
  if (days < 30) return `${Math.round(days * 10) / 10}天后`;
  return `${Math.round(days / 3) / 10}个月后`;
}
const dateTime = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** The current question card: answer → check → explanation/tutor → review rating. */
export function QuestionPanel({ d }: { d: Desk }) {
  const { p, question, answer, currentCheck, busy, mutable, pendingReview } = d;
  if (!question) return null;
  const at = p.data.questions.findIndex((q) => q.question_id === question.question_id),
    total = p.data.questions.length,
    schedule = p.data.schedules[question.question_id],
    keys = Object.keys(question.options),
    multi = question.question_type === "multi_choice",
    chosen = answer.split(",").filter(Boolean);
  function setAnswer(value: string) {
    if (!question) return;
    p.setData((s) => ({
      ...s,
      answers: { ...s.answers, [question.question_id]: value },
    }));
  }
  function go(offset: number) {
    const next = p.data.questions[at + offset];
    if (next) p.setData((s) => ({ ...s, selected: next.question_id }));
  }
  const verdict = currentCheck
    ? currentCheck.correct === true
      ? "correct"
      : currentCheck.correct === false
        ? "incorrect"
        : "self"
    : "";
  return (
    <article className="question-card" aria-labelledby="question-stem">
      <div className="question-meta">
        <span className="question-no">
          第 {String(at + 1).padStart(2, "0")} 题 <small>/ {total}</small>
        </span>
        <span>{KIND_LABEL[question.question_type] ?? question.question_type}</span>
        {question.difficulty ? <span>{question.difficulty}</span> : null}
        {question.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <h2 id="question-stem">{question.question}</h2>
      <fieldset disabled={!mutable} className="answer">
        <legend>
          {multi
            ? "选择所有正确选项"
            : keys.length
              ? "选择一个答案"
              : question.question_type === "fill_blank"
                ? "填写空格处的内容"
                : "用自己的话写下答案"}
        </legend>
        {keys.length ? (
          <div className={`options ${question.question_type === "true_false" ? "binary" : ""}`}>
            {Object.entries(question.options).map(([key, text]) => (
              <label key={key} className={chosen.includes(key) ? "chosen" : ""}>
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={`answer-${question.question_id}`}
                  value={key}
                  checked={chosen.includes(key)}
                  onChange={(e) => {
                    if (multi) {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(key);
                      else next.delete(key);
                      setAnswer([...next].sort().join(","));
                    } else setAnswer(key);
                  }}
                />
                {question.question_type === "true_false" ? (
                  <span className="option-text">{TRUE_FALSE[key] ?? text}</span>
                ) : (
                  <>
                    <b>{key}</b>
                    <span className="option-text">{text}</span>
                  </>
                )}
              </label>
            ))}
          </div>
        ) : question.question_type === "fill_blank" ? (
          <input
            id="answer-text"
            aria-label="我的答案"
            name="answer"
            autoComplete="off"
            value={answer}
            maxLength={5000}
            placeholder="填写答案…"
            onChange={(e) => setAnswer(e.target.value)}
          />
        ) : (
          <textarea
            id="answer-text"
            aria-label="我的答案"
            name="answer"
            rows={4}
            value={answer}
            maxLength={5000}
            placeholder="试着用自己的话解释…"
            onChange={(e) => setAnswer(e.target.value)}
          />
        )}
      </fieldset>
      <div className="check-row">
        <button
          className={currentCheck ? "checked" : "primary"}
          disabled={!mutable || busy || !answer.trim() || !!currentCheck}
          onClick={() => {
            void d.checkAnswer();
          }}
        >
          {busy ? "正在核对…" : currentCheck ? "已核对" : "核对答案"}
        </button>
        <span>
          {currentCheck
            ? "修改答案后可以重新核对"
            : answer.trim()
              ? "作答已自动保存"
              : keys.length
                ? "选好后核对"
                : "写完后核对，主观题由你对照参考答案自评"}
        </span>
      </div>
      {currentCheck ? (
        <section className={`feedback ${verdict}`} aria-live="polite">
          <strong className="verdict">
            {verdict === "correct"
              ? "回答正确"
              : verdict === "incorrect"
                ? "答错了，先看看解析"
                : "对照参考答案自评"}
          </strong>
          <dl>
            {verdict !== "correct" ? (
              <>
                <dt>你的答案</dt>
                <dd>{answerLabel(question, currentCheck.answer)}</dd>
              </>
            ) : null}
            <dt>参考答案</dt>
            <dd>{answerLabel(question, question.correct_answer)}</dd>
            {question.explanation ? (
              <>
                <dt>解析</dt>
                <dd>{question.explanation}</dd>
              </>
            ) : null}
          </dl>
          <TutorThread d={d} />
          <div className="rating">
            <span id="rating-label">
              {verdict === "self" ? "自评后安排复习" : "安排下次复习"}
            </span>
            <div role="group" aria-labelledby="rating-label">
              {RATINGS.map(([value, text]) => (
                <button
                  key={value}
                  disabled={!mutable || busy || !!pendingReview}
                  onClick={() => {
                    void d.review(value);
                  }}
                >
                  {text}
                  <small>
                    {interval(preview(schedule ?? {}, value, d.clock / 1000).interval_days)}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {pendingReview ? (
        <div className="review-pending" role="status">
          复习提交尚待确认。
          <button
            disabled={busy}
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
          下次复习 {dateTime.format(schedule.due_at * 1000)} · 已复习 {schedule.review_count} 次
          {schedule.lapses ? ` · 遗忘 ${schedule.lapses} 次` : ""}
        </p>
      ) : null}
      <nav className="turn" aria-label="切换题目">
        <button disabled={at <= 0 || !mutable} onClick={() => go(-1)}>
          <ChevronLeft size={16} aria-hidden="true" />
          上一题
        </button>
        <button disabled={at >= total - 1 || !mutable} onClick={() => go(1)}>
          下一题
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
    </article>
  );
}
