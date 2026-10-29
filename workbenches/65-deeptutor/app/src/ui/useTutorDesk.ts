import { useNavigation } from "./navigation.ts";
import { decodeProjectImport } from "../contracts/import-project.ts";
import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import {
  seed,
  projectValue,
  restoreDraftData,
  questionsValue,
  questionValue,
  reviewValue,
  applyReview,
  courseWithQuestions,
  courseAppendingQuestions,
  idValue,
  type Course,
  type Question,
} from "../contracts/tutor.ts";
import {
  generationValue,
  generationOptionsValue,
  defaultGenerationOptions,
  type Generation,
  type GenerationOptions,
} from "../contracts/generation.ts";
import { useTutoring } from "./useTutoring.ts";
import { decodeBankFile, BANK_DRAFT_LIMIT } from "./bank-file.ts";

export type Filter = "all" | "mistakes" | "due";
export type QuestionState = "new" | "answered" | "correct" | "wrong" | "self" | "due" | "planned";
export const blankCourse: Course = {
  lesson: "# 新课程\n\n把讲义粘贴到这里，或在右侧导入题库。",
  goal: "",
  notes: "",
  questions: [],
  selected: "",
  answers: {},
  checks: {},
  schedules: {},
  events: [],
  tutoring: {},
};

export function useTutorDesk() {
  const base = useProjects(seed, projectValue, "Python · 函数与集合", {
    storageKey: "deeptutor-course-v1",
    restoreDraftData,
  });
  const navigation = useNavigation();
  const p = {
    ...base,
    busy: base.busy || navigation.transitioning,
    fresh: () =>
      navigation.run(async () => {
        const ok = await base.fresh();
        if (ok) {
          base.setData(structuredClone(blankCourse));
          base.setTitle("新课程");
        }
        return ok;
      }),
    open: (...args: Parameters<typeof base.open>) =>
      navigation.run(() => base.open(...args)),
    setData: (value: Parameters<typeof base.setData>[0]) => {
      if (!navigation.active.current) base.setData(value);
    },
    setDraft: (value: Parameters<typeof base.setDraft>[0]) => {
      if (!navigation.active.current) base.setDraft(value);
    },
    setTitle: (value: Parameters<typeof base.setTitle>[0]) => {
      if (!navigation.active.current) base.setTitle(value);
    },
    save: (...args: Parameters<typeof base.save>) =>
      navigation.active.current ? Promise.resolve(null) : base.save(...args),
  };

  const [generationError, setGenerationError] = useState("");
  const [bankErrors, setBankErrors] = useState<{ row: number; message: string }[]>([]);
  const [lessonEdit, setLessonEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [model, setModel] = useState({ available: false, checked: false }),
    [filter, setFilter] = useState<Filter>("all"),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    setGenerationError("");
    setBankErrors([]);
  }, [p.documentKey]);
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const operation = useRef(false);
  const mutable = !p.loading && !p.busy;
  const question =
    p.data.questions.find((q) => q.question_id === p.data.selected) ??
    p.data.questions[0];
  const answer = question ? (p.data.answers[question.question_id] ?? "") : "";
  const check = question ? p.data.checks[question.question_id] : undefined;
  const currentCheck = check?.answer === answer ? check : undefined;
  const bankFormat = ["json", "csv", "tsv"].includes(String(p.draft.bankFormat))
    ? String(p.draft.bankFormat)
    : "json";
  const rawBank =
    typeof p.draft.bankText === "string"
      ? p.draft.bankText
      : JSON.stringify(
          p.data.questions.map((q) => ({
            ...q,
            user_answer: p.data.answers[q.question_id] ?? "",
          })),
          null,
          2,
        );
  let bank: Question[] | null = null;
  try {
    if (p.draft.bankCandidate) bank = questionsValue(p.draft.bankCandidate);
  } catch {}
  let generation: Generation | null = null;
  try {
    if (p.draft.generation) generation = generationValue(p.draft.generation);
  } catch {}
  let generationOptions: GenerationOptions = defaultGenerationOptions;
  try {
    generationOptions = generationOptionsValue(p.draft.generationOptions);
  } catch {}
  const generationId =
    typeof p.draft.generationId === "string" ? p.draft.generationId : "";
  const pendingReview = isRecord(p.draft.pendingReview)
    ? p.draft.pendingReview
    : null;
  const now = clock / 1000;
  function stateOf(q: Question): QuestionState {
    const plan = p.data.schedules[q.question_id],
      c = p.data.checks[q.question_id],
      last = [...p.data.events].reverse().find((e) => e.questionId === q.question_id);
    if (plan && plan.due_at <= now) return "due";
    if (c?.correct === false || last?.rating === "again") return "wrong";
    if (plan) return "planned";
    if (c?.correct === true) return "correct";
    if (c) return "self";
    return p.data.answers[q.question_id] ? "answered" : "new";
  }
  const states = new Map(p.data.questions.map((q) => [q.question_id, stateOf(q)]));
  const shown = p.data.questions.filter((q) => {
    const s = states.get(q.question_id);
    return filter === "all" || (filter === "mistakes" ? s === "wrong" : s === "due");
  });
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  async function checkModel() {
    try {
      const r = await request("/api/model-status");
      setModel({ available: isRecord(r) && r.available === true, checked: true });
    } catch {
      setModel({ available: false, checked: true });
    }
  }
  useEffect(() => {
    void checkModel();
  }, []);
  const tutoring = useTutoring({ p, question, answer, check: currentCheck, epoch });

  async function pollGeneration(id = generationId, key = epoch.current) {
    if (!id) return;
    try {
      const result = generationValue(
        await request("/api/generations/" + idValue(id)),
      );
      if (epoch.current === key) {
        setGenerationError("");
        p.setDraft((d) => ({ ...d, generation: result }));
      }
    } catch (e) {
      if (epoch.current === key && !(isRecord(e) && e.status === 404))
        setGenerationError(e instanceof Error ? e.message : "无法核对出题状态");
    }
  }
  useEffect(() => {
    // While the submit request is in flight the task may not exist yet.
    if (!generationId || (!generation && busy) || (generation && generation.status !== "running"))
      return;
    const key = epoch.current;
    void pollGeneration(generationId, key);
    const timer = setInterval(() => {
      void pollGeneration(generationId, key);
    }, 2000);
    return () => clearInterval(timer);
  }, [generationId, p.documentKey, generation?.status, !generation && busy]);

  async function normalizeBank(text = rawBank, format = bankFormat) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setBankErrors([]);
    const key = epoch.current;
    p.setError("");
    try {
      const raw = await request("/api/practice/import", {
        method: "POST",
        body: JSON.stringify({ text, format }),
      });
      if (!isRecord(raw) || !Array.isArray(raw.errors)) throw new Error("题库解析响应无效");
      if (epoch.current !== key) return;
      if (raw.errors.length) {
        setBankErrors(
          raw.errors.filter(isRecord).map((e) => ({
            row: Number(e.row),
            message: String(e.message),
          })),
        );
        p.setDraft((d) => {
          const n = { ...d };
          delete n.bankCandidate;
          return n;
        });
        return;
      }
      const q = questionsValue(raw.questions);
      p.setDraft((d) => ({ ...d, bankCandidate: q }));
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function adoptQuestions(
    q: Question[],
    kind: "bank" | "generated",
    mode: "append" | "replace",
  ) {
    if (!mutable || busy) return false;
    if (
      mode === "replace" &&
      (p.data.events.length || Object.keys(p.data.answers).length) &&
      !confirm(
        "替换整套题会清空本课程的旧答案、讲解和复习计划。请先导出需要保留的课程。继续？",
      )
    )
      return false;
    let added = q.length;
    try {
      const next =
        mode === "append"
          ? courseAppendingQuestions(p.data, q)
          : courseWithQuestions(p.data, q);
      added = next.questions.length - (mode === "append" ? p.data.questions.length : 0);
      p.setData(() => next);
    } catch (e) {
      p.report(e);
      return false;
    }
    p.setDraft((d) => {
      const n = { ...d };
      if (kind === "bank") delete n.bankCandidate;
      if (kind === "generated") {
        delete n.generation;
        delete n.generationId;
        delete n.pendingGeneration;
      }
      if (mode === "replace") delete n.pendingReview;
      return n;
    });
    p.setNotice(
      mode === "append"
        ? added
          ? `已追加${added}道题${added < q.length ? `（${q.length - added}道与现有题目重复，已跳过）` : ""}，原有作答与复习保留。`
          : "这些题目都已在练习册中，没有新增。"
        : "新题库已采用，可以开始练习。",
    );
    setFilter("all");
    return true;
  }
  async function checkAnswer() {
    if (!question || operation.current || !answer.trim()) return;
    p.setError("");
    operation.current = true;
    setBusy(true);
    const key = epoch.current,
      snapshot = { question, answer };
    try {
      const raw = await request("/api/practice/check", {
        method: "POST",
        body: JSON.stringify(snapshot),
      });
      if (
        !isRecord(raw) ||
        raw.questionId !== question.question_id ||
        raw.answer !== answer ||
        (raw.correct !== null && typeof raw.correct !== "boolean")
      )
        throw new Error("核对结果无效");
      const result = {
        answer,
        correct: raw.correct as boolean | null,
        at: Date.now() / 1000,
      };
      if (epoch.current === key)
        p.setData((d) => ({
          ...d,
          checks: { ...d.checks, [question.question_id]: result },
        }));
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function sendReview(command: Record<string, unknown>) {
    if (operation.current) return;
    p.setError("");
    operation.current = true;
    setBusy(true);
    const key = epoch.current;
    try {
      idValue(command.id);
      questionValue(command.question);
      const raw = reviewValue(
        await request("/api/practice/review", {
          method: "POST",
          body: JSON.stringify(command),
        }),
      );
      if (raw.id !== command.id) throw new Error("复习操作不匹配");
      if (epoch.current !== key) return;
      p.setData((d) => applyReview(d, raw));
      p.setDraft((d) => {
        const n = { ...d };
        delete n.pendingReview;
        return n;
      });
      p.setNotice("复习计划已更新。");
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function review(rating: string) {
    if (!question || !currentCheck || pendingReview || operation.current)
      return;
    const command = {
      id: crypto.randomUUID(),
      question,
      answer,
      state: p.data.schedules[question.question_id] ?? {},
      rating,
      at: Date.now() / 1000,
    };
    p.setDraft((d) => ({ ...d, pendingReview: command }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = await p.save();
    if (!saved) {
      p.setError("请先解决课程保存问题，再提交复习记录。");
      return;
    }
    await sendReview(command);
  }
  function setGenerationOptions(next: Partial<GenerationOptions>) {
    p.setDraft((d) => ({
      ...d,
      generationOptions: { ...generationOptions, ...next },
    }));
  }
  async function submitGeneration(command?: Record<string, unknown>) {
    if (operation.current) return;
    setGenerationError("");
    operation.current = true;
    setBusy(true);
    const key = epoch.current;
    try {
      const payload = command ?? {
        id: crypto.randomUUID(),
        lesson: p.data.lesson,
        goal: p.data.goal,
        options: generationOptions,
        avoid: p.data.questions.slice(0, 60).map((q) => q.question.slice(0, 400)),
      };
      idValue(payload.id);
      if (
        typeof payload.lesson !== "string" ||
        !payload.lesson.trim() ||
        payload.lesson.length > 40000
      )
        throw new Error("请提供1–40000字符的讲义用于出题。");
      p.setDraft((d) => ({
        ...d,
        pendingGeneration: payload,
        generationId: payload.id,
      }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const saved = await p.save();
      if (!saved) throw new Error("请先解决课程保存问题，再提交出题任务。");
      const result = generationValue(
        await request("/api/generations", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      if (epoch.current === key)
        p.setDraft((d) => ({
          ...d,
          generation: result,
          generationId: result.id,
          pendingGeneration: payload,
        }));
    } catch (e) {
      if (epoch.current === key)
        setGenerationError(e instanceof Error ? e.message : "出题请求未完成");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function dismissGeneration() {
    p.setDraft((x) => {
      const n = { ...x };
      delete n.generation;
      delete n.generationId;
      delete n.pendingGeneration;
      return n;
    });
  }
  function exportCourse() {
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "floatboat.deeptutor.course",
              version: 1,
              title: p.title,
              data: p.data,
              extra: p.draft,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `${p.title.replace(/[\\/:*?"<>|]+/g, "-") || "course"}.course.json`,
    );
  }
  function exportBank() {
    download(
      new Blob(
        [
          JSON.stringify(
            p.data.questions.map((q) => ({
              ...q,
              user_answer: p.data.answers[q.question_id] ?? "",
            })),
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "deeptutor-question-bank.json",
    );
  }
  async function importCourse(f: File) {
    return navigation.run(async () => {
      try {
        if (f.size > 8 * 1024 * 1024) throw new Error("课程恢复文件超过8MB");
        const imported = decodeProjectImport(JSON.parse(await f.text()));
        if (!imported)
          throw new Error("请导入完整课程或恢复工作稿；题库请在“题库”中导入。");
        const ok = await base.replace(
          imported.data,
          imported.title,
          imported.extra,
        );
        if (ok)
          base.setNotice(
            imported.archived
              ? "课程已导入为新课程；旧生成与复习请求已保留为导入记录，不会执行。"
              : "课程已导入为新课程，未完成编辑已保留。",
          );
        return ok;
      } catch (e) {
        base.report(e);
        return false;
      }
    });
  }
  async function readBank(f: File) {
    try {
      const { text, format, encoding } = await decodeBankFile(f);
      setBankErrors([]);
      if (text.length <= BANK_DRAFT_LIMIT)
        p.setDraft((d) => {
          const n: Record<string, unknown> = { ...d, bankText: text, bankFormat: format };
          delete n.bankTextOmitted;
          return n;
        });
      else
        p.setDraft((d) => {
          const n: Record<string, unknown> = { ...d, bankFormat: format, bankTextOmitted: f.name.slice(0, 200) };
          delete n.bankText;
          return n;
        });
      if (encoding === "gb18030") p.setNotice("已按GB18030编码读取题库。");
      await normalizeBank(text, format);
    } catch (e) {
      p.report(e);
    }
  }
  return {
    p,
    generationError,
    bankErrors,
    lessonEdit,
    setLessonEdit,
    busy,
    model,
    checkModel,
    filter,
    setFilter,
    clock,
    mutable,
    question,
    answer,
    currentCheck,
    rawBank,
    bankFormat,
    bank,
    generation,
    generationId,
    generationOptions,
    setGenerationOptions,
    pendingReview,
    shown,
    states,
    tutoring,
    normalizeBank,
    adoptQuestions,
    checkAnswer,
    sendReview,
    review,
    submitGeneration,
    dismissGeneration,
    pollGeneration,
    exportCourse,
    exportBank,
    importCourse,
    readBank,
  };
}
export type Desk = ReturnType<typeof useTutorDesk>;
