// ABOUTME: 数据窗：项目数据集页签、字段类型芯片（点按插入编码或拖进规格）与表格预览。
import { useEffect, useRef, useState } from "react";
import { fieldTypeLabel, type DatasetColumn, type DatasetRef, type FieldType } from "../contracts/datasets";
import { datasetTable } from "./data-client";

export const CHANNELS = ["x", "y", "color", "size", "shape", "opacity", "tooltip", "detail", "text", "theta", "row", "column", "facet", "xOffset"] as const;
export type Channel = (typeof CHANNELS)[number];
const suggested: Record<FieldType, Channel[]> = {
  temporal: ["x", "y", "color", "tooltip", "detail"],
  quantitative: ["y", "x", "size", "color", "theta", "opacity", "text", "tooltip"],
  nominal: ["color", "x", "y", "column", "row", "shape", "xOffset", "detail", "text", "tooltip", "facet"],
};
export interface InlineTable {
  columns: DatasetColumn[];
  rows: Record<string, unknown>[];
}

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 });
const bytes = (value: number) =>
  value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
const PREVIEW = 200;

function FieldChip({
  column,
  canInsert,
  onInsert,
}: {
  column: DatasetColumn;
  canInsert: boolean;
  onInsert: (channel: Channel) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        setOpen(false);
        button.current?.focus();
      } else if (event.target instanceof Node && !box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);
  const order = [...suggested[column.type], ...CHANNELS.filter((c) => !suggested[column.type].includes(c))];
  return (
    <div className="chip-anchor" ref={box}>
      <button
        ref={button}
        type="button"
        className={"field-chip " + column.type}
        draggable
        aria-haspopup="menu"
        aria-expanded={open}
        title={canInsert ? "点按选择编码通道，或拖入规格编辑器" : "规格需先修正为合法 JSON 才能插入"}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", JSON.stringify({ field: column.name, type: column.type }));
          event.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="type-dot" aria-hidden="true" />
        <span className="chip-name">{column.name}</span>
        <span className="chip-type">{fieldTypeLabel[column.type]}</span>
      </button>
      {open ? (
        <div className="chip-menu" role="menu" aria-label={`把 ${column.name} 用作`}>
          <p>用作编码通道</p>
          <div className="chip-channels">
            {order.map((channel, index) => (
              <button
                key={channel}
                type="button"
                role="menuitem"
                className={index < 2 ? "suggested" : ""}
                disabled={!canInsert}
                translate="no"
                onClick={() => {
                  setOpen(false);
                  onInsert(channel);
                }}
              >
                {channel}
              </button>
            ))}
          </div>
          {!canInsert ? <p className="chip-note">规格有语法错误，修正后才能插入。</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Table({ columns, rows, total }: { columns: DatasetColumn[]; rows: Record<string, unknown>[]; total: number }) {
  // 年份一类的整数列（如 opened=2021）不加千分位。
  const yearLike = new Set(
    columns
      .filter((column) => column.type === "quantitative")
      .filter((column) => {
        const values = rows.slice(0, PREVIEW).map((row) => row[column.name]).filter((v) => typeof v === "number");
        return values.length > 0 && values.every((v) => Number.isInteger(v) && (v as number) >= 1800 && (v as number) <= 2200);
      })
      .map((column) => column.name),
  );
  return (
    <div className="data-scroll" tabIndex={0} aria-label="数据预览">
      <table>
        <thead>
          <tr>
            <th scope="col" className="row-index">
              #
            </th>
            {columns.map((column) => (
              <th key={column.name} scope="col" className={column.type}>
                <span>{column.name}</span>
                <small>{fieldTypeLabel[column.type]}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, PREVIEW).map((row, index) => (
            <tr key={index}>
              <td className="row-index">{index + 1}</td>
              {columns.map((column) => {
                const value = row[column.name];
                return (
                  <td key={column.name} className={column.type}>
                    {value === null || value === undefined || value === ""
                      ? "—"
                      : typeof value === "number"
                        ? yearLike.has(column.name)
                          ? String(value)
                          : number.format(value)
                        : typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {total > PREVIEW ? (
        <p className="table-more">
          预览前 {PREVIEW} 行，共 {total.toLocaleString("zh-CN")} 行；图表使用全部数据。
        </p>
      ) : null}
    </div>
  );
}

export function DataWindow({
  datasets,
  inline,
  selected,
  used,
  canInsert,
  importing,
  onSelect,
  onImport,
  onInsert,
  onUse,
  onRemove,
  onDownload,
}: {
  datasets: DatasetRef[];
  inline: InlineTable | null;
  selected: string;
  used: Set<string>;
  canInsert: boolean;
  importing: string;
  onSelect: (name: string) => void;
  onImport: () => void;
  onInsert: (column: DatasetColumn, channel: Channel, dataset: string | null) => void;
  onUse: (ref: DatasetRef) => void;
  onRemove: (ref: DatasetRef) => void;
  onDownload: (ref: DatasetRef) => void;
}) {
  const active =
    datasets.find((item) => item.name === selected) ?? (selected === "__inline" && inline ? null : datasets[0] ?? null);
  const showInline = !active && !!inline;
  const [table, setTable] = useState<{ id: string; rows: Record<string, unknown>[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!active) return;
    let live = true;
    setError("");
    datasetTable(active).then(
      (result) => live && setTable({ id: active.id, rows: result.rows }),
      (reason: unknown) => live && setError(reason instanceof Error ? reason.message : "数据读取失败。"),
    );
    return () => {
      live = false;
    };
  }, [active]);
  const columns = active ? active.columns : inline?.columns ?? [];

  return (
    <section className="data-window" aria-labelledby="data-heading">
      <header className="data-head">
        <h2 id="data-heading">数据</h2>
        <div className="data-tabs" role="tablist" aria-label="数据集">
          {datasets.map((item) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              aria-selected={active?.name === item.name}
              onClick={() => onSelect(item.name)}
            >
              <span translate="no">{item.name}</span>
              <small>{item.rows.toLocaleString("zh-CN")} 行</small>
              {used.has(item.name) ? <span className="in-use" title="当前规格正在使用" aria-label="使用中" /> : null}
            </button>
          ))}
          {inline ? (
            <button type="button" role="tab" aria-selected={showInline} onClick={() => onSelect("__inline")}>
              <span>规格内嵌</span>
              <small>{inline.rows.length} 行</small>
            </button>
          ) : null}
        </div>
        <button type="button" className="import-data" onClick={onImport} disabled={!!importing}>
          {importing || "导入 CSV / TSV / JSON…"}
        </button>
      </header>
      {active || showInline ? (
        <>
          <div className="data-meta">
            {active ? (
              <>
                <span translate="no">{active.file}</span>
                <span>
                  {active.format.toUpperCase()} · {bytes(active.bytes)} · {active.rows.toLocaleString("zh-CN")} 行 ·{" "}
                  {active.columns.length} 列
                </span>
                <span className="data-actions">
                  {!used.has(active.name) ? (
                    <button type="button" className="link-button" disabled={!canInsert} onClick={() => onUse(active)}>
                      设为规格数据
                    </button>
                  ) : (
                    <span className="use-note">规格使用中</span>
                  )}
                  <button type="button" className="link-button" onClick={() => onDownload(active)}>
                    下载原文
                  </button>
                  <button type="button" className="link-button danger" onClick={() => onRemove(active)}>
                    移除
                  </button>
                </span>
              </>
            ) : (
              <span>规格中 data.values 的内嵌数据（只读预览）</span>
            )}
          </div>
          <div className="field-chips" aria-label="字段">
            {columns.map((column) => (
              <FieldChip
                key={column.name}
                column={column}
                canInsert={canInsert}
                onInsert={(channel) => onInsert(column, channel, active?.name ?? null)}
              />
            ))}
          </div>
          {error ? (
            <p className="data-error" role="alert">
              {error}
            </p>
          ) : active ? (
            table?.id === active.id ? (
              <Table columns={columns} rows={table.rows} total={active.rows} />
            ) : (
              <p className="data-loading" role="status">
                正在读取数据…
              </p>
            )
          ) : inline ? (
            <Table columns={columns} rows={inline.rows} total={inline.rows.length} />
          ) : null}
        </>
      ) : (
        <div className="data-empty">
          <p>当前图表还没有数据集。</p>
          <p className="hint">导入 CSV、TSV 或 JSON（最大 20 MiB），即可在规格中用 data: {"{"}"name": …{"}"} 引用，并通过字段芯片插入编码。</p>
          <button type="button" className="primary" onClick={onImport}>
            导入数据文件…
          </button>
        </div>
      )}
    </section>
  );
}
