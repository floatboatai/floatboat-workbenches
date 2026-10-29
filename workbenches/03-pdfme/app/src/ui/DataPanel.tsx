// ABOUTME: 批量数据侧栏：导入 CSV/JSON、字段与列映射、逐行校验和选择预览行、生成合并 PDF 或 ZIP。
import { memo, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileUp, Trash2 } from "lucide-react";
import type { Template } from "@pdfme/common";
import { editableFields, fieldLabel, type Dataset } from "../contracts/domain";
import { variableColumns, type RowReport, type Table } from "../contracts/dataset";

export interface BatchState {
  kind: "merged" | "zip";
  done: number;
  total: number;
}

export const DataPanel = memo(function DataPanel({
  template,
  dataset,
  table,
  tableError,
  reports,
  busy,
  batch,
  onImport,
  onTemplateCsv,
  onClear,
  onMapping,
  onFileColumn,
  onSelect,
  onGenerate,
  onCancel,
}: {
  template: Template;
  dataset: Dataset | null;
  table: Table | null;
  tableError: string;
  reports: RowReport[];
  busy: boolean;
  batch: BatchState | null;
  onImport: () => void;
  onTemplateCsv: () => void;
  onClear: () => void;
  onMapping: (field: string, column: string) => void;
  onFileColumn: (column: string) => void;
  onSelect: (row: number) => void;
  onGenerate: (kind: "merged" | "zip") => void;
  onCancel: () => void;
}) {
  const [onlyIssues, setOnlyIssues] = useState(false);
  const fields = editableFields(template);
  const invalid = reports.filter((report) => report.issues.length);
  const valid = reports.length - invalid.length;
  const selected = dataset && table ? Math.min(dataset.selected, Math.max(0, table.rows.length - 1)) : 0;
  const labelColumn = dataset?.fileColumn && table?.columns.includes(dataset.fileColumn) ? table.columns.indexOf(dataset.fileColumn) : 0;
  const visible = useMemo(
    () => (onlyIssues ? reports.filter((report) => report.issues.length) : reports).slice(0, 300),
    [onlyIssues, reports],
  );
  if (!dataset)
    return (
      <aside className="side-panel data-panel" aria-labelledby="data-panel-title">
        <header className="panel-head">
          <h2 id="data-panel-title">批量数据</h2>
        </header>
        <div className="empty-data">
          <p>导入 CSV 或 JSON，每一行生成一份 PDF。列名与字段名称相同时自动对应。</p>
          <button type="button" className="primary" onClick={onImport} disabled={busy}>
            <FileUp size={16} aria-hidden="true" />
            导入 CSV / JSON…
          </button>
          <button type="button" onClick={onTemplateCsv}>
            <Download size={16} aria-hidden="true" />
            下载空白 CSV（含 {fields.length} 个字段列）
          </button>
          <p className="panel-hint">支持 UTF-8 编码、逗号/分号/制表符分隔、带引号的多行单元格；最多 5000 行、16 MB。</p>
        </div>
      </aside>
    );
  const current = reports[selected];
  return (
    <aside className="side-panel data-panel" aria-labelledby="data-panel-title">
      <header className="panel-head">
        <h2 id="data-panel-title">批量数据</h2>
        <span title={dataset.name}>{dataset.name}</span>
      </header>
      <div className="data-actions">
        <button type="button" onClick={onImport} disabled={busy || !!batch}>
          <FileUp size={15} aria-hidden="true" />
          更换数据…
        </button>
        <button type="button" className="quiet" onClick={onClear} disabled={busy || !!batch}>
          <Trash2 size={15} aria-hidden="true" />
          移除
        </button>
      </div>
      {tableError ? (
        <p className="notice error" role="alert">
          {tableError}
        </p>
      ) : null}
      {table ? (
        <>
          {table.warnings.length ? (
            <ul className="issue-list subtle">
              {table.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <details className="mapping" open>
            <summary>
              字段映射 <span>{table.columns.length} 列 → {fields.length} 个字段</span>
            </summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">字段</th>
                  <th scope="col">数据列</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(({ field }) => {
                  const variables = variableColumns(field, table.columns);
                  return (
                    <tr key={field.name}>
                      <th scope="row">
                        <span>{field.name}</span>
                        <small>{fieldLabel(field.type)}</small>
                      </th>
                      <td>
                        <select
                          aria-label={`字段「${field.name}」对应的数据列`}
                          value={dataset.mapping[field.name] && table.columns.includes(dataset.mapping[field.name]) ? dataset.mapping[field.name] : ""}
                          onChange={(event) => onMapping(field.name, event.target.value)}
                        >
                          <option value="">{variables.length ? `按变量填充（${variables.length} 列）` : "使用模板当前值"}</option>
                          {table.columns.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
          <section className="rows" aria-labelledby="rows-title">
            <div className="rows-head">
              <h3 id="rows-title">
                数据行 <span>{valid} 行可生成{invalid.length ? ` · ${invalid.length} 行有问题` : ""}</span>
              </h3>
              <label className="check">
                <input type="checkbox" checked={onlyIssues} onChange={(event) => setOnlyIssues(event.target.checked)} disabled={!invalid.length} />
                只看有问题的行
              </label>
            </div>
            <div className="row-stepper">
              <button type="button" aria-label="上一行" onClick={() => onSelect(Math.max(0, selected - 1))} disabled={selected <= 0}>
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <label>
                预览第
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={table.rows.length}
                  value={selected + 1}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isInteger(value) && value >= 1 && value <= table.rows.length) onSelect(value - 1);
                  }}
                />
                / {table.rows.length} 行
              </label>
              <button type="button" aria-label="下一行" onClick={() => onSelect(Math.min(table.rows.length - 1, selected + 1))} disabled={selected >= table.rows.length - 1}>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            {current?.issues.length ? (
              <ul className="issue-list" aria-label={`第 ${selected + 1} 行的问题`}>
                {current.issues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
            <ol className="row-list" aria-label="数据行">
              {visible.map((report) => (
                <li key={report.index}>
                  <button
                    type="button"
                    aria-current={report.index === selected ? "true" : undefined}
                    className={report.issues.length ? "has-issues" : undefined}
                    onClick={() => onSelect(report.index)}
                  >
                    <span className="row-index">{report.index + 1}</span>
                    <span className="row-label">{table.rows[report.index]?.[labelColumn] || "（空）"}</span>
                    <span className="row-status">{report.issues.length ? `${report.issues.length} 个问题` : "可生成"}</span>
                  </button>
                </li>
              ))}
            </ol>
            {visible.length < (onlyIssues ? invalid.length : reports.length) ? <p className="panel-hint">列表显示前 300 行，可用上方行号跳到任意一行；生成包含全部行。</p> : null}
          </section>
          <section className="output" aria-labelledby="output-title">
            <h3 id="output-title">生成</h3>
            <label className="field-inline">
              ZIP 文件名
              <select value={dataset.fileColumn && table.columns.includes(dataset.fileColumn) ? dataset.fileColumn : ""} onChange={(event) => onFileColumn(event.target.value)}>
                <option value="">按序号命名</option>
                {table.columns.map((column) => (
                  <option key={column} value={column}>
                    按「{column}」
                  </option>
                ))}
              </select>
            </label>
            {invalid.length ? <p className="panel-hint">有问题的 {invalid.length} 行会被跳过，修正数据后重新导入即可补出。</p> : null}
            {batch ? (
              <div className="progress" role="status">
                <progress max={batch.total} value={batch.done} aria-label="批量生成进度" />
                <span>
                  {batch.kind === "merged" ? "合并 PDF" : "ZIP"} {batch.done}/{batch.total}
                </span>
                <button type="button" onClick={onCancel}>
                  取消
                </button>
              </div>
            ) : (
              <div className="output-actions">
                <button type="button" className="primary" disabled={busy || !valid} onClick={() => onGenerate("merged")}>
                  生成合并 PDF（{valid} 份）
                </button>
                <button type="button" disabled={busy || !valid} onClick={() => onGenerate("zip")}>
                  生成 ZIP（{valid} 个 PDF）
                </button>
              </div>
            )}
          </section>
        </>
      ) : !tableError ? (
        <p className="engine-state" role="status">
          正在读取数据…
        </p>
      ) : null}
    </aside>
  );
});
