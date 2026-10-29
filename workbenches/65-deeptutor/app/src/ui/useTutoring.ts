import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { request } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import {
  TUTOR_TURNS,
  type Check,
  type Course,
  type Question,
  type TutorTurn,
} from "../contracts/tutor.ts";

type Project = {
  data: Course;
  draft: Record<string, unknown>;
  setData: (value: (current: Course) => Course) => void;
  setDraft: (
    value: (current: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
};

/** Host-model tutoring about the learner's checked answer, persisted per question. */
export function useTutoring({
  p,
  question,
  check,
  epoch,
}: {
  p: Project;
  question: Question | undefined;
  answer: string;
  check: Check | undefined;
  epoch: MutableRefObject<string>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const running = useRef(false);
  const id = question?.question_id ?? "";
  useEffect(() => {
    setError("");
  }, [id, epoch.current]);
  const thread = id ? p.data.tutoring[id] : undefined;
  const current = thread && check && thread.answer === check.answer ? thread : undefined;
  const followDraft = isRecord(p.draft.tutorFollowUp) ? p.draft.tutorFollowUp : {};
  const followUp = typeof followDraft[id] === "string" ? (followDraft[id] as string) : "";
  const canFollow = !!current && current.turns.length <= TUTOR_TURNS - 2;
  function setFollowUp(text: string) {
    if (!id) return;
    p.setDraft((d) => ({
      ...d,
      tutorFollowUp: {
        ...(isRecord(d.tutorFollowUp) ? d.tutorFollowUp : {}),
        [id]: text,
      },
    }));
  }
  async function ask() {
    if (!question || !check || running.current) return;
    const asking = current ? followUp.trim() : "";
    if (current && !asking) return;
    running.current = true;
    setBusy(true);
    setError("");
    const key = epoch.current,
      qid = question.question_id,
      checked = check.answer;
    try {
      const r = await request("/api/tutor", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          question,
          answer: checked,
          correct: check.correct,
          lesson: p.data.lesson,
          goal: p.data.goal,
          turns: current ? current.turns.map(({ role, text }) => ({ role, text })) : [],
          followUp: asking,
        }),
      });
      if (!isRecord(r) || typeof r.text !== "string" || typeof r.at !== "number")
        throw new Error("导师回答格式无效");
      if (epoch.current !== key) return;
      const at = r.at,
        text = r.text;
      p.setData((d) => {
        const prior = d.tutoring[qid];
        const turns: TutorTurn[] = prior && prior.answer === checked ? prior.turns : [];
        const next: TutorTurn[] = [
          ...turns,
          ...(asking ? [{ role: "learner" as const, text: asking, at }] : []),
          { role: "tutor", text, at },
        ];
        return { ...d, tutoring: { ...d.tutoring, [qid]: { answer: checked, turns: next } } };
      });
      if (asking)
        p.setDraft((d) => {
          const drafts = isRecord(d.tutorFollowUp) ? { ...d.tutorFollowUp } : {};
          delete drafts[qid];
          return { ...d, tutorFollowUp: drafts };
        });
    } catch (e) {
      if (epoch.current === key)
        setError(e instanceof Error ? e.message : "导师讲解没有完成，请重试。");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { thread, current, busy, error, followUp, setFollowUp, canFollow, ask };
}
