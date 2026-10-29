import { useRef, useState } from "react";
import { BookOpen, ChevronDown, Library } from "lucide-react";
import { useTutorDesk } from "./useTutorDesk.ts";
import { Notice } from "./workspace.tsx";
import { CourseShelf } from "./CourseShelf.tsx";
import { LessonPage } from "./LessonPage.tsx";
import { PracticePage } from "./PracticePage.tsx";
import { BankDialog } from "./BankDialog.tsx";

export function App() {
  const d = useTutorDesk(),
    { p, mutable } = d;
  const [shelfOpen, setShelfOpen] = useState(false),
    [bankOpen, setBankOpen] = useState(false),
    [page, setPage] = useState<"practice" | "lesson">("practice");
  const shelfButton = useRef<HTMLButtonElement>(null),
    bankButton = useRef<HTMLButtonElement>(null);
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在恢复课程与答题记录…
      </main>
    );
  const total = p.data.questions.length;
  const reviewed = new Set(p.data.events.map((x) => x.questionId)).size;
  const due = [...d.states.values()].filter((s) => s === "due").length;
  const wrong = [...d.states.values()].filter((s) => s === "wrong").length;
  const attention = ["offline", "conflict", "draft"].includes(p.autoState.phase);
  return (
    <div className="desk" data-page={page}>
      <a className="skip" href="#practice-page">
        跳到当前练习
      </a>
      <header className="filebar">
        <button
          ref={shelfButton}
          className="shelf-button"
          aria-haspopup="dialog"
          aria-expanded={shelfOpen}
          onClick={() => setShelfOpen(true)}
        >
          <BookOpen size={18} aria-hidden="true" />
          <span>课程</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <div className="course-title">
          <input
            aria-label="课程名称"
            name="courseName"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            disabled={!mutable}
            onChange={(e) => p.setTitle(e.target.value)}
          />
          <span className={`save-state ${p.autoState.phase}`} role="status">
            {p.autoState.message}
          </span>
          {attention ? (
            <span className="save-actions">
              <button
                onClick={() => {
                  void p.save();
                }}
              >
                重试保存
              </button>
              <button onClick={p.exportDraft}>导出工作稿</button>
              {p.current ? (
                <button
                  onClick={() => {
                    void p.open(p.current!.id);
                  }}
                >
                  读取服务器版本
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="progress-meter" aria-label="复习进度">
          <span>
            已复习 <b>{reviewed}</b>/{total}
          </span>
          {wrong ? <span className="wrong">待巩固 {wrong}</span> : null}
          {due ? <span className="due">到期 {due}</span> : null}
          <progress value={reviewed} max={Math.max(1, total)} aria-label="已复习题目比例" />
        </div>
        <button
          ref={bankButton}
          className="bank-button"
          aria-haspopup="dialog"
          aria-expanded={bankOpen}
          onClick={() => setBankOpen(true)}
        >
          <Library size={16} aria-hidden="true" />
          题库
          {d.bank ? <span className="badge">待采用</span> : null}
        </button>
      </header>
      <Notice error={p.error} notice={p.notice} />
      <nav className="page-switch" aria-label="切换对页">
        <button aria-pressed={page === "practice"} onClick={() => setPage("practice")}>
          练习
        </button>
        <button aria-pressed={page === "lesson"} onClick={() => setPage("lesson")}>
          讲义
        </button>
      </nav>
      <main className="workbook" inert={!mutable}>
        <LessonPage d={d} />
        <PracticePage
          d={d}
          openBank={() => setBankOpen(true)}
          openGenerate={() => {
            setPage("lesson");
            requestAnimationFrame(() => {
              const target = document.getElementById("generate-title");
              target?.scrollIntoView({ block: "start" });
              document.querySelector<HTMLSelectElement>('select[name="generationCount"]')?.focus();
            });
          }}
        />
      </main>
      <CourseShelf
        d={d}
        open={shelfOpen}
        close={() => {
          setShelfOpen(false);
          shelfButton.current?.focus();
        }}
      />
      <BankDialog
        d={d}
        open={bankOpen}
        close={() => {
          setBankOpen(false);
          bankButton.current?.focus();
        }}
      />
    </div>
  );
}
