// ABOUTME: 字幕表上方的查找替换条：大小写/正则、逐个定位、替换当前与全部替换（逐词时间随之重对齐）。
import type { RefObject } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

export function FindBar({
  inputRef,
  find,
  replace,
  matchCase,
  regex,
  count,
  current,
  error,
  onChange,
  onStep,
  onReplaceOne,
  onReplaceAll,
  onClose,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  find: string;
  replace: string;
  matchCase: boolean;
  regex: boolean;
  count: number;
  current: number;
  error: string;
  onChange: (patch: { find?: string; replace?: string; matchCase?: boolean; regex?: boolean }) => void;
  onStep: (delta: number) => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="find-bar"
      role="search"
      aria-label="查找替换"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <input
        ref={inputRef}
        aria-label="查找"
        name="find"
        placeholder="查找"
        autoComplete="off"
        spellCheck={false}
        maxLength={400}
        value={find}
        onChange={(e) => onChange({ find: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onStep(e.shiftKey ? -1 : 1);
          }
        }}
      />
      <input
        aria-label="替换为"
        name="replace"
        placeholder="替换为"
        autoComplete="off"
        spellCheck={false}
        maxLength={400}
        value={replace}
        onChange={(e) => onChange({ replace: e.target.value })}
      />
      <label className="toggle" title="区分大小写">
        <input type="checkbox" checked={matchCase} onChange={(e) => onChange({ matchCase: e.target.checked })} />
        Aa
      </label>
      <label className="toggle" title="正则表达式（替换中可用 $1）">
        <input type="checkbox" checked={regex} onChange={(e) => onChange({ regex: e.target.checked })} />
        .*
      </label>
      <span className={`find-count ${error ? "bad" : ""}`} aria-live="polite">
        {error || (find ? (count ? `${current + 1} / ${count}` : "无匹配") : "")}
      </span>
      <button aria-label="上一个匹配" disabled={!count} onClick={() => onStep(-1)}>
        <ChevronUp size={15} aria-hidden="true" />
      </button>
      <button aria-label="下一个匹配" disabled={!count} onClick={() => onStep(1)}>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <button disabled={!count} onClick={onReplaceOne}>
        替换
      </button>
      <button disabled={!count} onClick={onReplaceAll}>
        全部替换
      </button>
      <button aria-label="关闭查找" onClick={onClose}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
