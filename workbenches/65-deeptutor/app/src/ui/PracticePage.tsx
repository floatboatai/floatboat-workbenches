import { useEffect, useRef } from "react";
import { Library, Sparkles } from "lucide-react";
import { QuestionPanel } from "./QuestionPanel.tsx";
import type { Desk, Filter, QuestionState } from "./useTutorDesk.ts";

const STATE_TEXT: Record<QuestionState, string> = {
  new: "未练习",
  answered: "已作答未核对",
  correct: "答对",
  wrong: "待巩固",
  self: "已自评",
  due: "到期复习",
  planned: "已排复习",
};
const FILTERS: [Filter, string][] = [
  ["all", "全部"],
  ["mistakes", "错题"],
  ["due", "到期"],
];

/** Right page: the question index strip and the single current question. */
export function PracticePage({
  d,
  openBank,
  openGenerate,
}: {
  d: Desk;
  openBank: () => void;
  openGenerate: () => void;
}) {
  const { p, states, mutable } = d;
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Keep the current number visible inside the strip only; never scroll the page.
    const chip = current.current,
      strip = chip?.parentElement;
    if (!chip || !strip) return;
    if (chip.offsetLeft < strip.scrollLeft) strip.scrollLeft = chip.offsetLeft - 8;
    else if (chip.offsetLeft + chip.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = chip.offsetLeft + chip.offsetWidth - strip.clientWidth + 8;
    if (chip.offsetTop < strip.scrollTop) strip.scrollTop = chip.offsetTop - 6;
    else if (chip.offsetTop + chip.offsetHeight > strip.scrollTop + strip.clientHeight)
      strip.scrollTop = chip.offsetTop + chip.offsetHeight - strip.clientHeight + 6;
  }, [p.data.selected, d.filter]);
  const counts = {
    all: p.data.questions.length,
    mistakes: [...states.values()].filter((s) => s === "wrong").length,
    due: [...states.values()].filter((s) => s === "due").length,
  };
  if (!p.data.questions.length)
    return (
      <section className="practice-page" id="practice-page" aria-label="练习">
        <div className="empty-workbook">
          <h2>这份讲义还没有练习题</h2>
          <p>
            导入已有题库（JSON、CSV或TSV，支持中文表头与GB18030编码），或在讲义页设置题数、题型与难度后由Floatboat模型出题。
          </p>
          <div>
            <button className="primary" onClick={openBank}>
              <Library size={16} aria-hidden="true" />
              导入题库
            </button>
            <button onClick={openGenerate}>
              <Sparkles size={16} aria-hidden="true" />
              根据讲义出题
            </button>
          </div>
        </div>
      </section>
    );
  return (
    <section className="practice-page" id="practice-page" aria-label="练习">
      <header className="page-head strip-head">
        <span className="page-label">练习</span>
        <div role="group" aria-label="筛选题目" className="segmented">
          {FILTERS.map(([value, text]) => (
            <button
              key={value}
              aria-pressed={d.filter === value}
              onClick={() => d.setFilter(value)}
            >
              {text}
              <small>{counts[value]}</small>
            </button>
          ))}
        </div>
      </header>
      <nav className="question-strip" aria-label="题号">
        {d.shown.length ? (
          d.shown.map((q) => {
            const n = p.data.questions.indexOf(q) + 1,
              state = states.get(q.question_id) ?? "new",
              selected = q.question_id === p.data.selected;
            return (
              <button
                key={q.question_id}
                ref={selected ? current : undefined}
                className={`chip ${state}`}
                aria-current={selected ? "true" : undefined}
                aria-label={`第${n}题，${STATE_TEXT[state]}：${q.question.slice(0, 40)}`}
                title={q.question}
                disabled={!mutable}
                onClick={() => p.setData((s) => ({ ...s, selected: q.question_id }))}
              >
                {String(n).padStart(2, "0")}
              </button>
            );
          })
        ) : (
          <p className="strip-empty">
            {d.filter === "mistakes" ? "没有待巩固的题。" : "现在没有到期的复习。"}
            <button onClick={() => d.setFilter("all")}>查看全部题目</button>
          </p>
        )}
      </nav>
      <div className="page-scroll">
        <QuestionPanel d={d} />
      </div>
    </section>
  );
}
