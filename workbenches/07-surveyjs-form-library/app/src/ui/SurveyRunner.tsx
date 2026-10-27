import { useEffect, useMemo, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import DOMPurify from "dompurify";
import type { FormSchema } from "../contracts/form";
import "survey-core/survey-core.css";
import "survey-core/i18n/simplified-chinese";

export function SurveyRunner({
  schema,
  onSubmit,
  onDirty,
  onAgain,
}: {
  schema: FormSchema;
  onSubmit: (answers: unknown, id: string) => Promise<void>;
  onDirty: (dirty: boolean) => void;
  onAgain: () => void;
}) {
  const model = useMemo(
    () =>
      new Model({
        ...schema,
        locale: "zh-cn",
        textUpdateMode: "onTyping",
        completeText: "提交答卷",
        completedHtml: "<h3>感谢你的回答</h3><p>请查看下方的保存状态。</p>",
      }),
    [schema],
  );
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  const pending = useRef<{ answers: unknown; id: string } | null>(null),
    submit = useRef(onSubmit),
    dirty = useRef(onDirty),
    alive = useRef(true);
  submit.current = onSubmit;
  dirty.current = onDirty;
  async function persist() {
    if (!pending.current) return;
    setSaving(true);
    setError("");
    try {
      await submit.current(pending.current.answers, pending.current.id);
      if (alive.current) {
        setSaved(true);
        dirty.current(false);
      }
    } catch (value) {
      if (alive.current)
        setError(value instanceof Error ? value.message : "保存失败，请重试。");
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    const valueChanged = () => dirty.current(true);
    const complete: Parameters<typeof model.onComplete.add>[0] = (
      sender,
      options,
    ) => {
      pending.current = {
        answers: structuredClone(sender.data as unknown),
        id: pending.current?.id ?? crypto.randomUUID(),
      };
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
    model.onValueChanged.add(valueChanged);
    model.onComplete.add(complete);
    model.onProcessHtml.add(html);
    return () => {
      alive.current = false;
      model.onValueChanged.remove(valueChanged);
      model.onComplete.remove(complete);
      model.onProcessHtml.remove(html);
      model.dispose();
    };
  }, [model]);
  return (
    <div className="survey-paper">
      <Survey model={model} />
      <div className="submission-status" aria-live="polite">
        {saving ? (
          <p>正在保存答卷…</p>
        ) : saved ? (
          <>
            <p>答卷已保存到当前项目。</p>
            <button onClick={onAgain}>再填写一份</button>
          </>
        ) : error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void persist()}>重试提交</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
