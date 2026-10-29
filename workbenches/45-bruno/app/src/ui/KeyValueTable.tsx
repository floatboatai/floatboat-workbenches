import { memo } from "react";
import type { Row } from "../contracts/bruno";

export interface KeyValueTableProps {
  label: string;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  disabled?: boolean;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  nameLabel?: string;
  valueLabel?: string;
  /** Fixed rows (e.g. path params) cannot be added or removed here. */
  fixed?: boolean;
  renderStatus?: (row: Row, index: number) => React.ReactNode;
}

export const KeyValueTable = memo(function KeyValueTable({
  label,
  rows,
  onChange,
  disabled,
  namePlaceholder = "名称…",
  valuePlaceholder = "值或 {{变量}}…",
  nameLabel = "名称",
  valueLabel = "值",
  fixed,
  renderStatus,
}: KeyValueTableProps) {
  const update = (index: number, patch: Partial<Row>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  return (
    <div className="kv" role="group" aria-label={label}>
      <div className="kv-head" aria-hidden="true">
        <span />
        <span>{nameLabel}</span>
        <span>{valueLabel}</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div className={"kv-row" + (row.enabled ? "" : " off")} key={index}>
          <input
            type="checkbox"
            aria-label={`启用 ${row.name || "第 " + (index + 1) + " 行"}`}
            checked={row.enabled}
            disabled={disabled}
            onChange={(e) => update(index, { enabled: e.target.checked })}
          />
          <input
            aria-label={`${label} ${nameLabel} ${index + 1}`}
            value={row.name}
            placeholder={namePlaceholder}
            spellCheck={false}
            autoComplete="off"
            disabled={disabled || fixed}
            onChange={(e) => update(index, { name: e.target.value })}
          />
          <div className="kv-value">
            <input
              aria-label={`${label} ${row.name || nameLabel} ${valueLabel}`}
              value={row.value}
              placeholder={valuePlaceholder}
              spellCheck={false}
              autoComplete="off"
              disabled={disabled}
              onChange={(e) => update(index, { value: e.target.value })}
            />
            {renderStatus?.(row, index)}
          </div>
          {fixed ? (
            <span />
          ) : (
            <button
              type="button"
              className="icon"
              aria-label={`删除 ${row.name || "第 " + (index + 1) + " 行"}`}
              disabled={disabled}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {fixed ? null : (
        <button
          type="button"
          className="kv-add"
          disabled={disabled}
          onClick={() => onChange([...rows, { name: "", value: "", enabled: true }])}
        >
          ＋ 添加{label}
        </button>
      )}
    </div>
  );
});
