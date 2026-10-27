import { useEffect, useMemo, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import DOMPurify from "dompurify";
import type { FormSchema, Answer } from "../contracts/form";
import "survey-core/survey-core.css";
import "survey-core/i18n/simplified-chinese";
export function SurveyRunner({
  schema,
  initialAnswers = {},
  initialId,
  initialSubmitted = false,
  onSubmit,
  onDraft,
  onAgain,
}: {
  schema: FormSchema;
  initialAnswers?: Record<string, Answer>;
  initialId?: string;
  initialSubmitted?: boolean;
  onSubmit: (answers: unknown, id: string) => Promise<void>;
  onDraft: (answers: unknown, id: string) => void;
  onAgain: () => void;
}) {
  const [responseId] = useState(() => initialId ?? crypto.randomUUID());
  const schemaKey = JSON.stringify(schema);
  const model = useMemo(() => {
    const next = new Model({
      ...schema,
      locale: "zh-cn",
      textUpdateMode: "onTyping",
      completeText: "提交答卷",
      completedHtml: "<h3>感谢你的回答</h3><p>请查看下方的保存状态。</p>",
    });
    next.data = initialAnswers;
    return next;
  }, [schemaKey]);
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(initialSubmitted);
  const pending = useRef<{ answers: unknown; id: string } | null>(null),
    submit = useRef(onSubmit),
    draft = useRef(onDraft),
    alive = useRef(true);
  submit.current = onSubmit;
  draft.current = onDraft;
  async function persist() {
    if (!pending.current) return;
    setSaving(true);
    setError("");
    try {
      await submit.current(pending.current.answers, pending.current.id);
      if (alive.current) setSaved(true);
    } catch (error) {
      if (alive.current)
        setError(error instanceof Error ? error.message : "提交失败，请重试。");
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    const changed: Parameters<typeof model.onValueChanged.add>[0] = (sender) =>
      draft.current(structuredClone(sender.data as unknown), responseId);
    const complete: Parameters<typeof model.onComplete.add>[0] = (
      sender,
      options,
    ) => {
      pending.current = {
        answers: structuredClone(sender.data as unknown),
        id: responseId,
      };
      draft.current(pending.current.answers, responseId);
      options.showSaveInProgress("正在保存…");
      void persist().then(() => {
        if (alive.current) options.clearSaveMessages();
      });
    };
    const html: Parameters<typeof model.onProcessHtml.add>[0] = (
      _,
      options,
    ) => {
      options.html = DOMPurify.sanitize(options.html, {
        ALLOWED_TAGS: ["h3", "p", "strong", "em", "br"],
        ALLOWED_ATTR: [],
      });
    };
    model.onValueChanged.add(changed);
    model.onComplete.add(complete);
    model.onProcessHtml.add(html);
    return () => {
      alive.current = false;
      model.onValueChanged.remove(changed);
      model.onComplete.remove(complete);
      model.onProcessHtml.remove(html);
      model.dispose();
    };
  }, [model, responseId]);
  return (
    <div className="survey-paper">
      {saved ? (
        <div className="submitted-answer">
          <h2>答卷已提交</h2>
          <p>这份回答已保存，可在答卷页查看。</p>
          <button onClick={onAgain}>再填写一份</button>
        </div>
      ) : (
        <Survey model={model} />
      )}
      <div className="submission-status" aria-live="polite">
        {saving ? (
          <p>正在保存答卷…</p>
        ) : error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void persist()}>重试提交</button>
          </>
        ) : saved ? (
          <p>答卷已保存到当前项目。</p>
        ) : (
          <p>填写内容会自动保留为草稿，点击提交后才进入答卷列表。</p>
        )}
      </div>
    </div>
  );
}
