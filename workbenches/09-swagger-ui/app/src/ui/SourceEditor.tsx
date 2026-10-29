import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import type { Diagnostic } from "../contracts/openapi";

export interface EditorHandle {
  jump(line: number, column?: number): void;
}
const LINE = 20;
const PAD = 10;

function lineOffset(text: string, line: number) {
  let offset = 0;
  for (let current = 1; current < line; current++) {
    const next = text.indexOf("\n", offset);
    if (next < 0) return text.length;
    offset = next + 1;
  }
  return offset;
}

/** 无折行的源码区：行号槽只渲染可见范围，诊断行在槽中标色。 */
export function SourceEditor({
  value,
  onChange,
  label,
  diagnostics,
  describedBy,
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  diagnostics: Diagnostic[];
  describedBy: string;
  ref?: Ref<EditorHandle>;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const escaped = useRef(false);
  const [view, setView] = useState({ top: 0, height: 600 });
  useEffect(() => {
    const node = area.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setView({ top: node.scrollTop, height: node.clientHeight }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const lines = useMemo(() => {
    let count = 1;
    for (let index = 0; index < value.length; index++)
      if (value.charCodeAt(index) === 10) count++;
    return count;
  }, [value]);
  const marks = useMemo(() => {
    const map = new Map<number, Diagnostic["severity"]>();
    for (const item of diagnostics)
      if (item.line && map.get(item.line) !== "error") map.set(item.line, item.severity);
    return map;
  }, [diagnostics]);
  useImperativeHandle(
    ref,
    () => ({
      jump(line, column = 1) {
        const node = area.current;
        if (!node) return;
        const start = lineOffset(node.value, line);
        const end = node.value.indexOf("\n", start);
        node.focus({ preventScroll: true });
        node.setSelectionRange(
          Math.min(start + Math.max(0, column - 1), end < 0 ? node.value.length : end),
          end < 0 ? node.value.length : end,
        );
        node.scrollTop = Math.max(0, (line - 1) * LINE - node.clientHeight / 3);
        setView({ top: node.scrollTop, height: node.clientHeight });
      },
    }),
    [],
  );
  const first = Math.max(1, Math.floor((view.top - PAD) / LINE) - 4);
  const last = Math.min(lines, first + Math.ceil(view.height / LINE) + 10);
  const numbers = [];
  for (let line = first; line <= last; line++) {
    const mark = marks.get(line);
    numbers.push(
      <span
        key={line}
        className={mark ? "gutter-line " + mark : "gutter-line"}
        style={{ top: PAD + (line - 1) * LINE }}
      >
        {line}
      </span>,
    );
  }
  return (
    <div className="code-area">
      <div className="gutter" aria-hidden="true">
        <div
          className="gutter-track"
          style={{ height: PAD * 2 + lines * LINE, transform: `translateY(${-view.top}px)` }}
        >
          {numbers}
        </div>
      </div>
      <textarea
        ref={area}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={diagnostics.some((item) => item.severity === "error")}
        name="openapi-source"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        wrap="off"
        value={value}
        onChange={(event) => {
          escaped.current = false;
          onChange(event.target.value);
        }}
        onScroll={(event) =>
          setView({ top: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight })
        }
        onFocus={(event) =>
          setView({ top: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight })
        }
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            escaped.current = true;
            return;
          }
          if (event.key !== "Tab" || event.shiftKey || escaped.current) return;
          event.preventDefault();
          // execCommand 保留浏览器原生撤销栈。
          if (!document.execCommand("insertText", false, "  ")) {
            const node = event.currentTarget;
            node.setRangeText("  ", node.selectionStart, node.selectionEnd, "end");
            onChange(node.value);
          }
        }}
      />
    </div>
  );
}
