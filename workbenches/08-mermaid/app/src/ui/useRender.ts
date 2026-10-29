// ABOUTME: 源码变化后防抖渲染图形，保留上一版成功结果，并生成编辑器的行内问题标记。
import { useEffect, useMemo, useRef, useState } from "react";
import type { Look, Theme } from "../contracts/model";
import { findExternalResources } from "../contracts/mermaid-source";
import { renderDiagram, type Rendered } from "./engine";
import type { SourceProblem } from "./SourceEditor";

export interface Failure {
  line: number | null;
  column: number;
  message: string;
}

export function useDiagramRender(
  source: string,
  theme: Theme,
  look: Look,
  documentKey: string,
) {
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [result, setResult] = useState<{
    key: string;
    source: string;
    failure: Failure | null;
  } | null>(null);
  const renderKey = theme + "\u0000" + look + "\u0000" + source;
  const first = useRef(true);
  // 切换文件后不把上一个文件的图形当作“上一版”保留。
  const [shownFor, setShownFor] = useState(documentKey);
  if (shownFor !== documentKey) {
    setShownFor(documentKey);
    setRendered(null);
  }
  useEffect(() => {
    let live = true;
    const delay = first.current ? 0 : 250;
    first.current = false;
    const timer = setTimeout(() => {
      if (!source.trim()) {
        setResult({
          key: renderKey,
          source,
          failure: {
            line: null,
            column: 1,
            message: "源码为空。输入图形源码，或从「模板库」新建。",
          },
        });
        return;
      }
      void renderDiagram(source, { theme, look })
        .then((outcome) => {
          if (!live) return;
          if (outcome.ok) {
            setRendered(outcome);
            setResult({ key: renderKey, source, failure: null });
          } else
            setResult({
              key: renderKey,
              source,
              failure: {
                line: outcome.line,
                column: outcome.column,
                message: outcome.message,
              },
            });
        })
        .catch((error: unknown) => {
          if (live)
            setResult({
              key: renderKey,
              source,
              failure: {
                line: null,
                column: 1,
                message:
                  error instanceof Error ? error.message : "图形引擎加载失败。",
              },
            });
        });
    }, delay);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [renderKey, source, theme, look]);

  const failure = result?.failure ?? null;
  const ready =
    result !== null &&
    result.key === renderKey &&
    !failure &&
    rendered !== null;
  const pending = result === null || result.key !== renderKey;
  const problemSource = result?.source ?? "";
  const problems = useMemo<SourceProblem[]>(() => {
    const list: SourceProblem[] = [];
    if (failure?.line)
      list.push({
        line: failure.line,
        column: failure.column,
        message: failure.message,
        severity: "error",
      });
    for (const resource of findExternalResources(problemSource))
      list.push({
        line: resource.line,
        column: 1,
        message: `外部资源不会加载（${resource.url.slice(0, 60)}）。图形只保存为工作草稿，请改用 data: 内嵌图片或文字。`,
        severity: "warning",
      });
    return list;
  }, [failure, problemSource]);
  const external = problems.find((problem) => problem.severity === "warning");
  return {
    rendered,
    failure,
    ready,
    pending,
    problems,
    problemSource,
    external,
  };
}
