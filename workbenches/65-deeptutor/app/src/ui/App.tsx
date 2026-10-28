import { RecoveryHistory } from "./RecoveryHistory.tsx";
import {
  BookOpen,
  Plus,
  Upload,
  Download,
  RefreshCw,
  Check,
  Clock3,
} from "lucide-react";
import { useTutorDesk } from "./useTutorDesk.ts";
import { ProjectPicker, Notice } from "./workspace.tsx";
import { QuestionPanel } from "./QuestionPanel.tsx";
import { BankPanel } from "./BankPanel.tsx";
export function App() {
  const d = useTutorDesk(),
    { p, mutable, busy, status } = d;
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在恢复课程与答题记录…
      </main>
    );
  const reviewed = new Set(p.data.events.map((x) => x.questionId)).size;
  return (
    <>
      <a className="skip" href="#lesson-main">
        跳到课程练习
      </a>
      <header className="topbar">
        <div className="brand">
          <BookOpen aria-hidden="true" />
          <div>
            <strong>课程练习册</strong>
            <span>DEEPTUTOR</span>
          </div>
        </div>
        <input
          aria-label="课程名称"
          name="courseName"
          autoComplete="off"
          value={p.title}
          maxLength={120}
          disabled={!mutable}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable}
          onOpen={(id) => {
            void p.open(id);
          }}
        />
        <div className="file-actions">
          <button
            disabled={!mutable}
            onClick={() => {
              void p.fresh();
            }}
          >
            <Plus size={16} aria-hidden="true" />
            新课程
          </button>
          <button disabled={!mutable} onClick={() => d.file.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            导入课程
          </button>
          <button onClick={d.exportCourse}>
            <Download size={16} aria-hidden="true" />
            导出课程
          </button>
        </div>
        <input
          ref={d.file}
          type="file"
          accept=".json"
          hidden
          aria-label="导入完整课程"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void d.importCourse(f);
            e.target.value = "";
          }}
        />
      </header>
      <div className="savebar">
        <span className={`save-state ${p.autoState.phase}`} role="status">
          {p.autoState.message}
        </span>
        <span>讲义、答案与复习计划</span>
        {["offline", "conflict", "draft"].includes(p.autoState.phase) ? (
          <>
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
          </>
        ) : null}
      </div>
      <Notice error={p.error} notice={p.notice} />
      <main id="lesson-main" inert={!mutable}>
        <fieldset className="control-guard" disabled={!mutable}>
          <div className="course-heading">
            <div>
              <span>LEARNING NOTEBOOK</span>
              <h1>读懂一页，练透一题。</h1>
            </div>
            <div className="progress">
              <span>
                已复习 {reviewed} / {p.data.questions.length} 题
              </span>
              <progress
                value={reviewed}
                max={Math.max(1, p.data.questions.length)}
                aria-label="课程复习进度"
              />
            </div>
            <button onClick={() => d.setBankOpen((v) => !v)}>管理题库</button>
          </div>
          <div className="study-desk">
            <section className="lesson-sheet">
              <div className="paper-heading">
                <span>课程讲义</span>
                <button onClick={() => d.setLessonEdit((v) => !v)}>
                  {d.lessonEdit ? "阅读讲义" : "编辑讲义"}
                </button>
              </div>
              {d.lessonEdit ? (
                <label className="lesson-editor">
                  讲义内容
                  <textarea
                    id="lesson-text"
                    name="lesson"
                    maxLength={80000}
                    value={p.data.lesson}
                    onChange={(e) =>
                      p.setData((s) => ({ ...s, lesson: e.target.value }))
                    }
                  />
                </label>
              ) : (
                <article className="lesson-prose">
                  {p.data.lesson
                    .split("\n\n")
                    .map((part, i) =>
                      part.startsWith("# ") ? (
                        <h2 key={i}>{part.slice(2)}</h2>
                      ) : part.startsWith("## ") ? (
                        <h3 key={i}>{part.slice(3)}</h3>
                      ) : (
                        <p key={i}>{part}</p>
                      ),
                    )}
                </article>
              )}
              <label className="learning-goal">
                学习目标
                <textarea
                  id="learning-goal"
                  name="learningGoal"
                  maxLength={2000}
                  value={p.data.goal}
                  onChange={(e) =>
                    p.setData((s) => ({ ...s, goal: e.target.value }))
                  }
                />
              </label>
              <label className="margin-notes">
                我的课堂笔记
                <textarea
                  id="lesson-notes"
                  name="lessonNotes"
                  maxLength={12000}
                  value={p.data.notes}
                  placeholder="记下自己的例子和还没理解的地方…"
                  onChange={(e) =>
                    p.setData((s) => ({ ...s, notes: e.target.value }))
                  }
                />
              </label>
              <div className="generate-controls">
                <button
                  disabled={
                    !status.model ||
                    !status.practice ||
                    busy ||
                    !!d.generationId
                  }
                  onClick={() => {
                    void d.submitGeneration();
                  }}
                >
                  根据讲义出题
                </button>
                <span>
                  {status.model ? "Gemini 3.8 Flash" : "Floatboat模型未连接"}
                </span>
              </div>
              {d.generationError && !d.generationId ? (
                <p role="alert">{d.generationError}</p>
              ) : null}
            </section>
            <QuestionPanel d={d} />
          </div>
          <section className="review-shelf">
            <div className="shelf-heading">
              <h2>练习与复习</h2>
              <div role="group" aria-label="筛选练习">
                {[
                  ["all", "全部题目"],
                  ["mistakes", "错题"],
                  ["due", "到期复习"],
                ].map(([value, text]) => (
                  <button
                    key={value}
                    aria-pressed={d.filter === value}
                    className={d.filter === value ? "active" : ""}
                    onClick={() => d.setFilter(value)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <div className="question-list">
              {d.shown.map((q, i) => {
                const plan = p.data.schedules[q.question_id],
                  check = p.data.checks[q.question_id];
                return (
                  <button
                    key={q.question_id}
                    className={
                      p.data.selected === q.question_id ? "selected" : ""
                    }
                    onClick={() =>
                      p.setData((s) => ({ ...s, selected: q.question_id }))
                    }
                  >
                    <span className="question-number">
                      {String(p.data.questions.indexOf(q) + 1).padStart(2, "0")}
                    </span>
                    <span className="question-name">
                      <strong>{q.question}</strong>
                      <small>{q.tags.join(" · ") || q.question_type}</small>
                    </span>
                    <span className="question-state">
                      {plan ? (
                        <>
                          <Clock3 size={14} aria-hidden="true" />
                          {plan.due_at <= d.clock / 1000
                            ? "待复习"
                            : new Intl.DateTimeFormat(undefined, {
                                month: "short",
                                day: "numeric",
                              }).format(plan.due_at * 1000)}
                        </>
                      ) : check?.correct === true ? (
                        <>
                          <Check size={14} aria-hidden="true" />
                          已答对
                        </>
                      ) : check?.correct === false ? (
                        "待巩固"
                      ) : (
                        "未练习"
                      )}
                    </span>
                  </button>
                );
              })}
              {!d.shown.length ? (
                <p className="empty">
                  这里暂时没有题目。可以切换筛选，或导入一组练习。
                </p>
              ) : null}
            </div>
          </section>
          <BankPanel d={d} />
          <RecoveryHistory
            history={p.draft.importHistory}
            onExport={d.exportCourse}
          />
        </fieldset>
      </main>
      <footer>
        <span className={status.practice ? "connected" : ""}>
          {status.message}
        </span>
        <button
          aria-label="重新检查服务"
          onClick={() => {
            void d.checkStatus();
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
        <span>课程资料始终随项目保存</span>
      </footer>
    </>
  );
}
