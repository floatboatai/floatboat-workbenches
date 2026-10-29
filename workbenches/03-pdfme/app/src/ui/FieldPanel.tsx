// ABOUTME: 填写视图右栏：按页列出可填写字段，中文名称可直接改名，标记必填并显示当前值的校验问题。
import { memo, useState } from "react";
import type { Template } from "@pdfme/common";
import { editableFields, fieldLabel } from "../contracts/domain";
import type { FieldIssue } from "../contracts/dataset";

export const FieldPanel = memo(function FieldPanel({
  template,
  issues,
  onRename,
  onRequired,
  onPage,
}: {
  template: Template;
  issues: FieldIssue[];
  onRename: (from: string, to: string) => string | null;
  onRequired: (name: string, required: boolean) => void;
  onPage: (page: number) => void;
}) {
  const fields = editableFields(template);
  return (
    <aside className="side-panel field-panel" aria-labelledby="field-panel-title">
      <header className="panel-head">
        <h2 id="field-panel-title">字段</h2>
        <span>{fields.length} 个可填写</span>
      </header>
      <p className="panel-hint">在纸面上直接填写；这里修改字段名称（也是批量数据的列名）和必填要求。</p>
      {issues.length ? (
        <ul className="issue-list" aria-label="当前填写的问题">
          {issues.map((issue) => (
            <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
      <ol className="field-list">
        {fields.map(({ field, pageIndex }) => (
          <FieldRow
            key={`${pageIndex}-${field.name}`}
            name={field.name}
            type={field.type}
            page={pageIndex}
            required={!!field.required}
            invalid={issues.some((issue) => issue.field === field.name)}
            onRename={onRename}
            onRequired={onRequired}
            onPage={onPage}
          />
        ))}
      </ol>
    </aside>
  );
});

function FieldRow({
  name,
  type,
  page,
  required,
  invalid,
  onRename,
  onRequired,
  onPage,
}: {
  name: string;
  type: string;
  page: number;
  required: boolean;
  invalid: boolean;
  onRename: (from: string, to: string) => string | null;
  onRequired: (name: string, required: boolean) => void;
  onPage: (page: number) => void;
}) {
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState("");
  const commit = () => {
    if (draft === name) return setError("");
    const problem = onRename(name, draft);
    setError(problem ?? "");
  };
  const errorId = `field-error-${page}-${name}`;
  return (
    <li className={invalid ? "invalid" : undefined}>
      <div className="field-row">
        <label className="sr-only" htmlFor={`field-${page}-${name}`}>
          字段名称
        </label>
        <input
          id={`field-${page}-${name}`}
          value={draft}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setDraft(name);
              setError("");
            }
          }}
        />
        <button type="button" className="page-chip" onClick={() => onPage(page)} aria-label={`跳到第 ${page + 1} 页`}>
          第 {page + 1} 页
        </button>
      </div>
      <div className="field-meta">
        <span className="type-chip">{fieldLabel(type)}</span>
        <label className="check">
          <input type="checkbox" checked={required} onChange={(event) => onRequired(name, event.target.checked)} />
          必填
        </label>
      </div>
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
