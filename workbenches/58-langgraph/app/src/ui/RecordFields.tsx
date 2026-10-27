import type { ReviewRecord } from "../contracts/review";
export function RecordFields({
  value,
  onChange,
  prefix,
  disabled = false,
}: {
  value: ReviewRecord;
  onChange: (value: ReviewRecord) => void;
  prefix: string;
  disabled?: boolean;
}) {
  const update = (name: keyof Omit<ReviewRecord, "checklist">, text: string) =>
    onChange({ ...value, [name]: text });
  return (
    <fieldset className="record-fields" disabled={disabled}>
      <label htmlFor={prefix + "subject"}>
        资料主题
        <input
          id={prefix + "subject"}
          name="subject"
          required
          aria-invalid={!value.subject.trim()}
          aria-describedby={
            !value.subject.trim() ? prefix + "subject-error" : undefined
          }
          autoComplete="off"
          maxLength={160}
          value={value.subject}
          onChange={(e) => update("subject", e.target.value)}
        />
        {!value.subject.trim() ? (
          <span id={prefix + "subject-error"} className="field-error">
            请填写主题后再运行。
          </span>
        ) : null}
      </label>
      <div className="field-pair">
        <label htmlFor={prefix + "owner"}>
          负责人
          <input
            id={prefix + "owner"}
            name="owner"
            required
            aria-invalid={!value.owner.trim()}
            aria-describedby={
              !value.owner.trim() ? prefix + "owner-error" : undefined
            }
            autoComplete="off"
            maxLength={100}
            value={value.owner}
            onChange={(e) => update("owner", e.target.value)}
          />
          {!value.owner.trim() ? (
            <span id={prefix + "owner-error"} className="field-error">
              请填写负责人。
            </span>
          ) : null}
        </label>
        <label htmlFor={prefix + "due"}>
          交付日期
          <input
            id={prefix + "due"}
            name="dueDate"
            autoComplete="off"
            type="date"
            value={value.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
          />
        </label>
      </div>
      <label htmlFor={prefix + "summary"}>
        交付摘要
        <textarea
          id={prefix + "summary"}
          name="summary"
          autoComplete="off"
          rows={3}
          maxLength={10000}
          value={value.summary}
          onChange={(e) => update("summary", e.target.value)}
        />
      </label>
      <label htmlFor={prefix + "checks"}>
        检查事项 <span className="subtle">每行一项</span>
        <textarea
          id={prefix + "checks"}
          name="checklist"
          autoComplete="off"
          rows={4}
          maxLength={20000}
          value={value.checklist.join("\n")}
          onChange={(e) =>
            onChange({ ...value, checklist: e.target.value.split("\n") })
          }
        />
        {value.checklist.length > 40 ? (
          <span className="field-error">
            目前有 {value.checklist.length} 项，运行前请整理到 40
            项以内；草稿会完整保留。
          </span>
        ) : null}
      </label>
    </fieldset>
  );
}
