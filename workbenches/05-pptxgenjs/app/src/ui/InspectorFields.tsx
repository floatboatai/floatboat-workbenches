// ABOUTME: 检查器的通用表单控件：带单位的数字框、颜色角色选择、分段按钮与开关。
import { useEffect, useState, type ReactNode } from "react";
import { COLOR_ROLES, type ColorRef, type Theme } from "../contracts/domain";
import { COLOR_LABELS, resolveColor } from "../contracts/layouts";

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={"field" + (wide ? " is-wide" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function NumberField({ label, value, onChange, step = 1, min, max, unit }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);
  const invalid = !/^-?\d*\.?\d+$/.test(text.trim()) || (min !== undefined && Number(text) < min) || (max !== undefined && Number(text) > max);
  return (
    <label className="field">
      <span>
        {label}
        {unit ? <small> {unit}</small> : null}
      </span>
      <input
        inputMode="decimal"
        name={label}
        autoComplete="off"
        value={text}
        aria-invalid={invalid}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(String(value));
        }}
        onChange={(event) => {
          setText(event.target.value);
          const n = Number(event.target.value);
          if (event.target.value.trim() && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const n = Math.round((value + (event.key === "ArrowUp" ? step : -step)) * 100) / 100;
            if ((min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
          }
        }}
      />
    </label>
  );
}
export function ColorSelect({ label, value, theme, onChange, allowNone }: { label: string; value: ColorRef | null; theme: Theme; onChange: (v: ColorRef | null) => void; allowNone?: boolean }) {
  const custom = value !== null && !(COLOR_ROLES as readonly string[]).includes(value);
  return (
    <label className="field color-field">
      <span>{label}</span>
      <span className="color-row">
        <span className="color-chip" style={{ background: value ? "#" + resolveColor(value, theme) : "transparent" }} aria-hidden="true" />
        <select
          name={label}
          value={value === null ? "none" : custom ? "custom" : value}
          onChange={(event) => {
            const v = event.target.value;
            onChange(v === "none" ? null : v === "custom" ? resolveColor(value ?? "accent", theme) : v);
          }}
        >
          {allowNone ? <option value="none">无</option> : null}
          {COLOR_ROLES.map((role) => (
            <option key={role} value={role}>
              {COLOR_LABELS[role]}
            </option>
          ))}
          <option value="custom">自定义…</option>
        </select>
        {custom ? (
          <input type="color" aria-label={`${label}：自定义颜色`} value={"#" + value} onChange={(event) => onChange(event.target.value.slice(1).toUpperCase())} />
        ) : null}
      </span>
    </label>
  );
}
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

