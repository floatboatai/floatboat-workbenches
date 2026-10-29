import { MessagesSquare, Send } from "lucide-react";
import { HostStatus } from "./GenerationPanel.tsx";
import { answerLabel } from "./labels.ts";
import type { Desk } from "./useTutorDesk.ts";
import type { TutorTurn } from "../contracts/tutor.ts";

function Turns({ turns }: { turns: TutorTurn[] }) {
  return (
    <ol className="turns">
      {turns.map((t, i) => (
        <li key={i} className={t.role}>
          <span className="who">{t.role === "tutor" ? "导师" : "我"}</span>
          <p>{t.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** Host-model tutoring for the checked answer: first explanation, then follow-ups. */
export function TutorThread({ d }: { d: Desk }) {
  const { question, currentCheck, mutable, tutoring: t } = d;
  if (!question || !currentCheck) return null;
  const wrong = currentCheck.correct === false;
  const label = wrong
    ? "请导师讲解我错在哪"
    : currentCheck.correct === null
      ? "请导师点评我的答案"
      : "请导师延伸讲解";
  const stale = t.thread && !t.current ? t.thread : null;
  return (
    <section className={`tutor ${wrong ? "attention" : ""}`} aria-label="导师讲解">
      {stale ? (
        <details className="stale-thread">
          <summary>
            之前针对“{answerLabel(question, stale.answer)}”的讲解（{stale.turns.length}条）
          </summary>
          <Turns turns={stale.turns} />
        </details>
      ) : null}
      {t.current ? <Turns turns={t.current.turns} /> : null}
      {t.busy ? (
        <p className="tutor-wait" role="status">
          导师正在对照讲义阅读你的答案…
        </p>
      ) : null}
      {t.error ? (
        <p className="inline-error" role="alert">
          {t.error}
        </p>
      ) : null}
      {!t.current ? (
        <div className="tutor-ask">
          <button
            className={wrong ? "tutor-primary" : ""}
            disabled={!mutable || t.busy || !d.model.available}
            onClick={() => {
              void t.ask();
            }}
          >
            <MessagesSquare size={16} aria-hidden="true" />
            {t.error ? "重试讲解" : label}
          </button>
        </div>
      ) : t.canFollow ? (
        <form
          className="follow-up"
          onSubmit={(e) => {
            e.preventDefault();
            void t.ask();
          }}
        >
          <label>
            <span className="sr-only">向导师追问</span>
            <input
              name="tutorFollowUp"
              autoComplete="off"
              maxLength={1000}
              value={t.followUp}
              disabled={!mutable}
              placeholder="还没明白？追问一句，比如“为什么默认值只创建一次？”…"
              onChange={(e) => t.setFollowUp(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={!mutable || t.busy || !t.followUp.trim() || !d.model.available}
          >
            <Send size={15} aria-hidden="true" />
            追问
          </button>
        </form>
      ) : (
        <p className="hint">本题讲解已达到追问上限，可导出课程保留记录。</p>
      )}
      <HostStatus d={d} action="导师讲解" compact />
    </section>
  );
}
