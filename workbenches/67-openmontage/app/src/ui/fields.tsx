// ABOUTME: 检查器里的数值输入：未应用文本随工作稿保存，回车或失焦后才提交到时间线。
import { createContext, useContext, useId, type ReactNode } from "react";

type NumericDraft = { text: string; base: number };
type FieldDrafts = { scope: string; values: unknown; set: (key: string, value: NumericDraft | null) => void };
const DraftContext = createContext<FieldDrafts | null>(null);
export function NumericDrafts({ children, ...value }: FieldDrafts & { children: ReactNode }) {
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 0.1,
  suffix = "秒",
  disabled,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const drafts = useContext(DraftContext);
  const key = `${drafts?.scope}:${label}`;
  const raw = drafts?.values && typeof drafts.values === "object" ? (drafts.values as Record<string, unknown>)[key] : undefined;
  const text = raw && typeof raw === "object" && "text" in raw && typeof raw.text === "string" && "base" in raw && raw.base === value ? raw.text : String(value);
  const parsed = Number(text.trim().replace(",", "."));
  const error = !text.trim() || !Number.isFinite(parsed) ? "请输入数字" : parsed < min || parsed > max ? `范围 ${min}–${max}` : "";
  function commit() {
    if (error) return;
    if (parsed !== value) onCommit(Math.round(parsed * 1000) / 1000);
    drafts?.set(key, null);
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="field-input">
        <input
          id={id}
          name={label}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id + "-e" : undefined}
          onChange={(e) => drafts?.set(key, { text: e.target.value, base: value })}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              drafts?.set(key, null);
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const v = Math.min(max, Math.max(min, Math.round((value + (e.key === "ArrowUp" ? step : -step)) * 1000) / 1000));
              onCommit(v);
              drafts?.set(key, null);
            }
          }}
        />
        <small>{suffix}</small>
      </span>
      {error ? (
        <small className="field-error" id={id + "-e"} role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format = (v: number) => Math.round(v * 100) + "%",
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field slider">
      <label htmlFor={id}>
        {label}
        <output htmlFor={id}>{format(value)}</output>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
