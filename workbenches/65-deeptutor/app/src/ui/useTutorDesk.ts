import { useNavigation } from "./navigation.ts";
import { restoreDraftData } from "../contracts/tutor.ts";
import { decodeProjectImport } from "../contracts/import-project.ts";
import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import {
  seed,
  projectValue,
  questionsValue,
  questionValue,
  reviewValue,
  applyReview,
  courseWithQuestions,
  generationValue,
  idValue,
  type Generation,
  type Question,
} from "../contracts/tutor.ts";
export function useTutorDesk() {
  const base = useProjects(seed, projectValue, "Python · 函数与集合", {
    storageKey: "deeptutor-course-v1",
    restoreDraftData,
  });
  const navigation = useNavigation();
  const p = {
    ...base,
    busy: base.busy || navigation.transitioning,
    fresh: () => navigation.run(() => base.fresh()),
    open: (...args: Parameters<typeof base.open>) =>
      navigation.run(() => base.open(...args)),
    replace: (...args: Parameters<typeof base.replace>) =>
      navigation.run(() => base.replace(...args)),
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
  const [bankOpen, setBankOpen] = useState(false),
    [lessonEdit, setLessonEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState({
      practice: false,
      model: false,
      message: "正在检查练习服务…",
    }),
    [filter, setFilter] = useState("all"),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    setGenerationError("");
  }, [p.documentKey]);
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const operation = useRef(false),
    file = useRef<HTMLInputElement>(null),
    bankFile = useRef<HTMLInputElement>(null);
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
  const generationId =
    typeof p.draft.generationId === "string" ? p.draft.generationId : "";
  const pendingReview = isRecord(p.draft.pendingReview)
    ? p.draft.pendingReview
    : null;
  const shown = p.data.questions.filter(
    (q) =>
      filter === "all" ||
      (filter === "mistakes"
        ? p.data.checks[q.question_id]?.correct === false
        : !!p.data.schedules[q.question_id] &&
          p.data.schedules[q.question_id].due_at <= clock / 1000),
  );
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  async function checkStatus() {
    const results = await Promise.allSettled([
      request("/api/practice/status"),
      request("/api/model-status"),
    ]);
    const a = results[0].status === "fulfilled" ? results[0].value : null,
      b = results[1].status === "fulfilled" ? results[1].value : null;
    setStatus({
      practice: isRecord(a) && a.available === true,
      model: isRecord(b) && b.available === true,
      message:
        isRecord(a) && typeof a.message === "string"
          ? a.message
          : "练习服务未连接",
    });
  }
  useEffect(() => {
    void checkStatus();
  }, []);
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
    if (!generationId || (generation && generation.status !== "running"))
      return;
    const key = epoch.current;
    void pollGeneration(generationId, key);
    const timer = setInterval(() => {
      void pollGeneration(generationId, key);
    }, 2000);
    return () => clearInterval(timer);
  }, [generationId, p.documentKey, generation?.status]);
  async function normalizeBank(text = rawBank, format = bankFormat) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    const key = epoch.current;
    p.setError("");
    try {
      const raw = await request("/api/practice/import", {
        method: "POST",
        body: JSON.stringify({ text, format }),
      });
      if (!isRecord(raw)) throw new Error("题库解析响应无效");
      const q = questionsValue(raw.questions);
      if (epoch.current === key)
        p.setDraft((d) => ({ ...d, bankCandidate: q }));
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function adoptQuestions(q: Question[], kind: "bank" | "generated") {
    if (!mutable || busy) return;
    if (
      (p.data.events.length || Object.keys(p.data.answers).length) &&
      !confirm(
        "采用新题库会清空本课程的旧答案和复习计划。请先导出需要保留的课程。继续？",
      )
    )
      return;
    p.setData((d) => courseWithQuestions(d, q));
    p.setDraft((d) => {
      const n = { ...d };
      delete n.bankCandidate;
      if (kind === "generated") {
        delete n.generation;
        delete n.generationId;
        delete n.pendingGeneration;
      }
      delete n.pendingReview;
      return n;
    });
    p.setNotice("新题库已采用，可以开始练习。");
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
      "learning-course.project.json",
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
    await navigation.run(async () => {
      try {
        if (f.size > 8 * 1024 * 1024) throw new Error("课程恢复文件超过8MB");
        const imported = decodeProjectImport(JSON.parse(await f.text()));
        if (!imported)
          throw new Error("请导入完整课程或恢复工作稿；普通题库请用题库入口。");
        const ok = await base.replace(
          imported.data,
          imported.title,
          imported.extra,
        );
        if (ok)
          base.setNotice(
            imported.archived
              ? "课程已导入为新项目；旧生成与复习请求已保留为导入记录，不会执行。"
              : "课程已导入为新项目，未完成编辑已保留。",
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
      if (f.size > 350000) throw new Error("题库文件超过350KB");
      const kind = f.name.split(".").pop()?.toLowerCase();
      if (!kind || !["json", "csv", "tsv"].includes(kind))
        throw new Error("选择JSON、CSV或TSV题库");
      const text = await f.text();
      p.setDraft((d) => ({ ...d, bankText: text, bankFormat: kind }));
      setBankOpen(true);
      await normalizeBank(text, kind);
    } catch (e) {
      p.report(e);
    }
  }
  return {
    p,
    generationError,
    bankOpen,
    setBankOpen,
    lessonEdit,
    setLessonEdit,
    busy,
    status,
    checkStatus,
    filter,
    setFilter,
    clock,
    file,
    bankFile,
    mutable,
    question,
    answer,
    currentCheck,
    rawBank,
    bankFormat,
    bank,
    generation,
    generationId,
    pendingReview,
    shown,
    normalizeBank,
    adoptQuestions,
    checkAnswer,
    sendReview,
    review,
    submitGeneration,
    pollGeneration,
    exportCourse,
    exportBank,
    importCourse,
    readBank,
  };
}
