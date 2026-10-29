// ABOUTME: 检查器中的完整输出：表格（最多渲染 500 行）、文本、JSON 与柱状图，以及按格式下载。
import { Download } from "lucide-react";
import { useState } from "react";
import { cellText, typeLabels, type Preview, type Value } from "../contracts/values";
import { downloadValue } from "./files";

const ROWS = 500;
const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 });
const CHARS = 200_000;

export function ChartView({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <figure className="bar-chart">
      {rows.map((row, index) => (
        <div className="bar-row" key={index}>
          <span className="bar-label" title={row.label}>
            {row.label || "（空）"}
          </span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(Math.abs(row.value) / max) * 100}%` }} />
          </span>
          <span className="bar-value">{row.value.toLocaleString("zh-CN")}</span>
        </div>
      ))}
    </figure>
  );
}

export function TableView({ columns, rows, total }: { columns: string[]; rows: unknown[][]; total: number }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="结果表格">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col" className="row-number">
              #
            </th>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="row-number">{index + 1}</td>
              {row.map((cell, column) => (
                <td key={column} data-numeric={typeof cell === "number" || undefined}>
                  {cell === null ? <span className="null">∅</span> : typeof cell === "number" ? numberFormat.format(cell) : cellText(cell as string)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {total > rows.length ? (
        <p className="table-more">
          显示前 {rows.length.toLocaleString("zh-CN")} 行，共 {total.toLocaleString("zh-CN")} 行；下载可得到完整结果。
        </p>
      ) : null}
    </div>
  );
}

export function ValueView({ value, chart, name }: { value: Value; chart?: boolean; name: string }) {
  const formats: ("csv" | "json" | "txt")[] = value.type === "table" ? ["csv", "json"] : value.type === "json" ? ["json", "txt"] : ["txt", "json"];
  const [error, setError] = useState("");
  return (
    <div className="value-view">
      <div className="value-actions">
        <span className="value-type">{typeLabels[value.type]}</span>
        {formats.map((format) => (
          <button
            type="button"
            key={format}
            onClick={() => {
              try {
                setError("");
                downloadValue(value, format, name);
              } catch (e) {
                setError(e instanceof Error ? e.message : "下载失败。");
              }
            }}
          >
            <Download aria-hidden="true" size={13} />
            {format.toUpperCase()}
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="field-error">{error}</p> : null}
      {chart && value.type === "table" ? (
        <ChartView rows={value.rows.map((row) => ({ label: cellText(row.label), value: Number(row.value) || 0 }))} />
      ) : null}
      {value.type === "table" ? (
        <TableView
          columns={value.columns}
          rows={value.rows.slice(0, ROWS).map((row) => value.columns.map((column) => row[column] ?? null))}
          total={value.rows.length}
        />
      ) : (
        <pre className="text-output" translate="no">
          {(value.type === "text" ? value.text : JSON.stringify(value.value, null, 2)).slice(0, CHARS) || "（空）"}
        </pre>
      )}
    </div>
  );
}

export function PreviewView({ preview, chart }: { preview: Preview; chart?: boolean }) {
  return (
    <div className="value-view">
      <p className="muted">这是上次保存的运行预览。重新运行后可查看完整结果并下载。</p>
      {chart && preview.type === "table" ? (
        <ChartView rows={preview.rows.map((row) => ({ label: cellText(row[0]), value: Number(row[1]) || 0 }))} />
      ) : null}
      {preview.type === "table" ? (
        <TableView columns={preview.columns} rows={preview.rows} total={preview.total} />
      ) : (
        <pre className="text-output">{preview.text}</pre>
      )}
    </div>
  );
}
