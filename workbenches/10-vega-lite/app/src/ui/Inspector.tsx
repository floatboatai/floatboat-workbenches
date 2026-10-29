// ABOUTME: 规格检查器：JSON 编辑器、schema 校验状态、格式化与可点击定位的问题列表；以及图表组成摘要。
import type { Ref } from "react";
import type { DatasetRef } from "../contracts/datasets";
import { isRecord } from "../contracts/project";
import type { SpecAnalysis } from "../contracts/spec-analysis";
import { SpecEditor, type EditorHandle } from "./SpecEditor";
import { RenderBoundary } from "./workspace";

export function summarize(spec: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const markOf = (view: unknown): string[] => {
    if (!isRecord(view)) return [];
    if (view.mark !== undefined) return [String(isRecord(view.mark) ? view.mark.type : view.mark)];
    if (Array.isArray(view.layer)) return view.layer.flatMap(markOf);
    if (isRecord(view.spec)) return markOf(view.spec);
    for (const key of ["concat", "hconcat", "vconcat"]) if (Array.isArray(view[key])) return (view[key] as unknown[]).flatMap(markOf);
    return [];
  };
  for (const key of ["layer", "hconcat", "vconcat", "concat"])
    if (Array.isArray(spec[key])) parts.push(`${key} ×${(spec[key] as unknown[]).length}`);
  if (spec.facet !== undefined) parts.push("facet");
  if (spec.repeat !== undefined) parts.push("repeat");
  parts.push(...[...new Set(markOf(spec))].slice(0, 4));
  const params = JSON.stringify(spec).match(/"params"\s*:/g)?.length ?? 0;
  if (params) parts.push("params");
  return parts;
}

export function Inspector({
  text,
  resetKey,
  analysis: current,
  problemSource,
  schema,
  schemaError,
  datasets,
  canFormat,
  onFormat,
  onChange,
  onFocusProblem,
  handle,
}: {
  text: string;
  resetKey: string;
  analysis: SpecAnalysis | null;
  problemSource: string;
  schema: Record<string, unknown> | null;
  schemaError: string;
  datasets: DatasetRef[];
  canFormat: boolean;
  onFormat: () => void;
  onChange: (text: string) => void;
  onFocusProblem: (from: number, to: number) => void;
  handle: Ref<EditorHandle>;
}) {
  const errors = current?.problems.filter((item) => item.severity === "error") ?? [];
  const warnings = current?.problems.filter((item) => item.severity === "warning") ?? [];
  const unapplied = !current || errors.length > 0 || !current.schemaChecked;
  return (
    <section className="inspector" id="spec" aria-labelledby="spec-heading">
      <div className="inspector-head">
        <h2 id="spec-heading">规格</h2>
        <span className="lang" translate="no">
          Vega-Lite v6 JSON
        </span>
        <span className={"spec-state " + (errors.length ? "error" : unapplied ? "pending" : "ok")}>
          {schemaError
            ? "schema 未加载"
            : !current
              ? "检查中…"
              : !current.schemaChecked
                ? errors.length
                  ? `${errors.length} 处错误`
                  : "正在加载 schema…"
                : errors.length
                  ? `${errors.length} 处错误`
                  : warnings.length
                    ? `通过 schema · ${warnings.length} 条提醒`
                    : "通过 schema"}
        </span>
        <button
          type="button"
          disabled={!canFormat}
          onClick={onFormat}
        >
          格式化
        </button>
      </div>
      <RenderBoundary label="规格编辑器">
        <SpecEditor
          value={text}
          resetKey={resetKey}
          problems={current?.problems ?? []}
          problemSource={problemSource}
          assist={{ schema, datasets }}
          onChange={onChange}
          handle={handle}
        />
      </RenderBoundary>
      {current?.problems.length ? (
        <ul className="problems" aria-label="规格问题">
          {current.problems.slice(0, 12).map((item, index) => (
            <li key={index} className={item.severity}>
              <button type="button" onClick={() => onFocusProblem(item.from, item.to)}>
                <span className="where">
                  {item.line}:{item.column}
                </span>
                <span className="src">{item.source}</span>
                <span className="msg">{item.message}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="inspector-foot">
          Ctrl+Space 补全属性与字段，悬停属性名查看 schema 说明。数据只来自本图表导入的数据集与内嵌值，外部 URL 不会被请求。
        </p>
      )}
    </section>
  );
}
