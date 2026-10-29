// ABOUTME: 分析编辑器中的规格原文：JSON 语法、结构、官方 schema、外部资源与数据集引用，给出带源码位置的问题列表。
import type { DatasetRef } from "./datasets.ts";
import { lineColumn, locatePointer, parseJsonSource, type Span } from "./json-source.ts";
import { checkSpec } from "./model.ts";
import { isRecord } from "./project.ts";
import { findExternalRefs, referencedDatasets } from "./render-spec.ts";
import type { SpecChecker } from "./spec-schema.ts";

export interface SpecProblem extends Span {
  severity: "error" | "warning";
  message: string;
  line: number;
  column: number;
  source: "JSON" | "结构" | "Schema" | "资源" | "数据";
}
export interface SpecAnalysis {
  /** 可以作为正式模型应用的规格；有错误时为 null。 */
  spec: Record<string, unknown> | null;
  problems: SpecProblem[];
  /** schema 尚未加载时为 false，此时不应用规格。 */
  schemaChecked: boolean;
}

function problem(
  text: string,
  span: Span,
  severity: SpecProblem["severity"],
  source: SpecProblem["source"],
  message: string,
): SpecProblem {
  const from = Math.max(0, Math.min(span.from, text.length));
  const to = Math.max(from, Math.min(span.to, text.length));
  return { from, to, severity, source, message, ...lineColumn(text, from) };
}

export function analyzeSpecText(
  text: string,
  datasets: DatasetRef[],
  check: SpecChecker | null,
): SpecAnalysis {
  const parsed = parseJsonSource(text);
  if (!parsed.ok)
    return {
      spec: null,
      problems: [problem(text, parsed, "error", "JSON", parsed.message)],
      schemaChecked: false,
    };
  const at = (pointer: string, preferKey = false): Span => {
    const span = locatePointer(parsed.pointers, pointer, preferKey);
    // 多行对象/数组只标记开头，避免整段波浪线。
    if (span.to - span.from > 120) return { from: span.from, to: span.from + 1 };
    return span;
  };
  let spec: Record<string, unknown>;
  try {
    spec = checkSpec(parsed.value);
  } catch (error) {
    return {
      spec: null,
      problems: [
        problem(text, at(""), "error", "结构", error instanceof Error ? error.message : "规格结构无效。"),
      ],
      schemaChecked: false,
    };
  }
  const problems: SpecProblem[] = [];
  if (check)
    for (const issue of check(spec))
      problems.push(problem(text, at(issue.pointer, issue.atKey), "error", "Schema", issue.message));

  for (const ref of findExternalRefs(spec, datasets))
    problems.push(
      problem(
        text,
        at(ref.pointer),
        "warning",
        "资源",
        ref.kind === "data"
          ? `外部数据 ${ref.url} 不会被加载。请在数据窗导入该文件，再用 data: {"name": …} 或同名文件引用。`
          : ref.kind === "image"
            ? `外部图片 ${ref.url} 不会被加载，只允许 data:image 内嵌图片。`
            : `链接 ${ref.url} 已禁用，点击图形不会打开外部页面。`,
      ),
    );

  const inline = isRecord(spec.datasets) ? Object.keys(spec.datasets) : [];
  const known = new Set([...datasets.map((item) => item.name), ...inline]);
  for (const name of referencedDatasets(spec, datasets))
    if (!known.has(name)) {
      const pointer = [...parsed.pointers.keys()].find(
        (key) => /\/data\/name$/.test(key) && valueIs(parsed.value, key, name),
      );
      problems.push(
        problem(
          text,
          at(pointer ?? ""),
          "warning",
          "数据",
          `数据集 "${name}" 不在当前图表中，图形会没有数据。可用：${[...known].join("、") || "（无，请先导入数据）"}。`,
        ),
      );
    }
  problems.sort((a, b) => a.from - b.from);
  return {
    spec: check && !problems.some((item) => item.severity === "error") ? spec : null,
    problems,
    schemaChecked: !!check,
  };
}

function valueIs(root: unknown, pointer: string, expected: string): boolean {
  let current = root;
  for (const part of pointer.split("/").slice(1)) {
    const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(current)) current = current[Number(key)];
    else if (isRecord(current)) current = current[key];
    else return false;
  }
  return current === expected;
}
