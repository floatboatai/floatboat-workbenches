import { LessonProse } from "./LessonProse.tsx";
import { GenerationPanel } from "./GenerationPanel.tsx";
import type { Desk } from "./useTutorDesk.ts";

/** Left page: the handout, the learner's goal and margin notes, then question generation. */
export function LessonPage({ d }: { d: Desk }) {
  const { p, mutable } = d;
  return (
    <section className="lesson-page" id="lesson-page" aria-label="课程讲义">
      <header className="page-head">
        <span className="page-label">讲义</span>
        <div role="group" aria-label="讲义视图" className="segmented">
          <button aria-pressed={!d.lessonEdit} onClick={() => d.setLessonEdit(false)}>
            阅读
          </button>
          <button aria-pressed={d.lessonEdit} onClick={() => d.setLessonEdit(true)}>
            编辑
          </button>
        </div>
      </header>
      <div className="page-scroll">
        {d.lessonEdit ? (
          <label className="lesson-editor">
            <span className="sr-only">讲义内容（支持 # 标题、- 列表、```代码块）</span>
            <textarea
              id="lesson-text"
              name="lesson"
              maxLength={80000}
              disabled={!mutable}
              spellCheck={false}
              value={p.data.lesson}
              onChange={(e) => p.setData((s) => ({ ...s, lesson: e.target.value }))}
            />
            <small>支持 # 标题、- 列表、`代码` 和 ``` 代码块；编辑会自动保存。</small>
          </label>
        ) : (
          <LessonProse text={p.data.lesson} />
        )}
        <div className="margin">
          <label>
            学习目标
            <textarea
              id="learning-goal"
              name="learningGoal"
              rows={2}
              maxLength={2000}
              disabled={!mutable}
              value={p.data.goal}
              placeholder="这一讲学完后要能做到什么…"
              onChange={(e) => p.setData((s) => ({ ...s, goal: e.target.value }))}
            />
          </label>
          <label>
            我的课堂笔记
            <textarea
              id="lesson-notes"
              name="lessonNotes"
              rows={4}
              maxLength={12000}
              disabled={!mutable}
              value={p.data.notes}
              placeholder="记下自己的例子和还没理解的地方…"
              onChange={(e) => p.setData((s) => ({ ...s, notes: e.target.value }))}
            />
          </label>
        </div>
        <GenerationPanel d={d} />
      </div>
    </section>
  );
}
