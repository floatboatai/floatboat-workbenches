import { useEffect, useId, useState } from "react";
import type { Control } from "./engine";
import type { PointField } from "./NativeBench";

const show = (v: unknown) => (typeof v === "number" ? String(Math.round(v * 1e6) / 1e6) : String(v ?? ""));
const numberText = (t: string) => /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t.trim()) && Number.isFinite(Number(t));

/** Local text that follows the native value unless the user is editing or a draft is pending. */
function useEditable(value: unknown, draft: string | undefined) {
  const [text, setText] = useState(draft ?? show(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(draft ?? show(value));
  }, [value, draft, editing]);
  return { text, setText, editing, setEditing };
}

interface FieldProps {
  control: Control;
  draft?: string;
  disabled: boolean;
  /** Returns true when the value was applied to the native element. */
  commit(raw: string | boolean): boolean;
  setDraft(text: string | null): void;
}
export function ControlField({ control, draft, disabled, commit, setDraft }: FieldProps) {
  const id = useId();
  const { text, setText, setEditing } = useEditable(control.value, draft);
  const pending = draft !== undefined;
  const label = control.label || "选项";
  if (control.kind === "info")
    return control.info ? <p className="control-info">{control.info}</p> : null;
  if (control.kind === "note") return <p className="control-info">{control.label}</p>;
  if (control.kind === "button")
    return (
      <button type="button" className="control-button" disabled={disabled} onClick={() => commit("")}>
        {label}
      </button>
    );
  if (control.kind === "boolean")
    return (
      <label className="control check" title={control.info || undefined}>
        <input type="checkbox" checked={Boolean(control.value)} disabled={disabled} onChange={(e) => commit(e.target.checked)} />
        <span>{label}</span>
      </label>
    );
  if (control.kind === "dropdown")
    return (
      <label className="control" title={control.info || undefined}>
        <span>{label === "选项" ? "定义方式" : label}</span>
        <select value={String(control.value)} disabled={disabled} onChange={(e) => commit(e.target.value)}>
          {control.options?.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
    );
  if (control.kind === "number") {
    const slider = control.slider && typeof control.min === "number" && typeof control.max === "number" && control.max > control.min;
    return (
      <div className={"control number" + (pending ? " pending" : "")} title={control.info || undefined}>
        <label htmlFor={id}>
          {label}
          {pending ? <em>未应用</em> : null}
        </label>
        <input
          id={id}
          name={control.id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={text}
          disabled={disabled}
          aria-invalid={pending}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const ok = numberText(next) && commit(next);
            setDraft(ok ? null : next);
          }}
        />
        {slider ? (
          <input
            type="range"
            aria-label={label + "滑杆"}
            min={control.min}
            max={control.max}
            step={control.step || "any"}
            value={Math.min(control.max!, Math.max(control.min!, Number(control.value) || 0))}
            disabled={disabled}
            onChange={(e) => {
              if (commit(e.target.value)) setDraft(null);
            }}
          />
        ) : null}
        {control.info ? <Info text={control.info} /> : null}
      </div>
    );
  }
  const apply = () => {
    if (draft === undefined) return;
    if (commit(text)) setDraft(null);
  };
  return (
    <div className={"control text" + (pending ? " pending" : "")}>
      <label htmlFor={id}>
        {label}
        {pending ? <em>未应用</em> : null}
      </label>
      <input
        id={id}
        name={control.id}
        autoComplete="off"
        spellCheck={false}
        className={control.kind === "equation" ? "mono" : ""}
        value={text}
        disabled={disabled}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          apply();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
        }}
        onChange={(e) => {
          setText(e.target.value);
          setDraft(e.target.value === show(control.value) ? null : e.target.value);
        }}
      />
      {control.kind === "equation" ? <small>LaTeX 写法，例如 0.5\sqrt{"{1-x^2}"}；回车或离开输入框后应用。</small> : null}
      {control.info ? <Info text={control.info} /> : null}
    </div>
  );
}

function Info({ text }: { text: string }) {
  return (
    <details className="info">
      <summary>说明</summary>
      <small>{text}</small>
    </details>
  );
}

interface PointProps {
  point: PointField;
  drafts: { x?: string; y?: string };
  disabled: boolean;
  commit(x: number, y: number): void;
  setDraft(axis: "x" | "y", text: string | null): void;
}
export function PointRow({ point, drafts, disabled, commit, setDraft }: PointProps) {
  const x = useEditable(point.x, drafts.x),
    y = useEditable(point.y, drafts.y);
  const change = (axis: "x" | "y", value: string) => {
    const other = axis === "x" ? y.text : x.text;
    (axis === "x" ? x : y).setText(value);
    const nx = axis === "x" ? value : other,
      ny = axis === "y" ? value : other;
    if (numberText(nx) && numberText(ny)) {
      commit(Number(nx), Number(ny));
      setDraft("x", null);
      setDraft("y", null);
    } else setDraft(axis, value);
  };
  const pending = drafts.x !== undefined || drafts.y !== undefined;
  return (
    <fieldset className={"point-row" + (pending ? " pending" : "")} disabled={disabled}>
      <legend>
        {point.label}
        {pending ? <em>未应用</em> : null}
      </legend>
      {(["x", "y"] as const).map((axis) => {
        const s = axis === "x" ? x : y;
        return (
          <label key={axis}>
            <span>{axis.toUpperCase()}</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              name={point.key + "." + axis}
              aria-label={point.label + " " + axis.toUpperCase()}
              value={s.text}
              onFocus={() => s.setEditing(true)}
              onBlur={() => s.setEditing(false)}
              onChange={(e) => change(axis, e.target.value)}
            />
          </label>
        );
      })}
    </fieldset>
  );
}
