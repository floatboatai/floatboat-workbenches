import { memo, useMemo, useRef } from "react";
import { codepointRange, sliceCodepoints } from "../contracts/align";
import {
  finalClass,
  finalText,
  isStale,
  recordSpan,
  type EvidenceDocument,
  type Span,
} from "../contracts/evidence";
import { segments } from "../contracts/visualize";

export interface Selection extends Span {
  quote: string;
}

/** Original text with every grounded record highlighted; selecting text reports a codepoint range. */
export const SourceText = memo(function SourceText({
  doc,
  selected,
  colorOf,
  hiddenClasses,
  onPick,
  onSelect,
}: {
  doc: EvidenceDocument;
  selected: number;
  colorOf: (cls: string) => string;
  hiddenClasses: Set<string>;
  onPick: (i: number) => void;
  onSelect: (s: Selection | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const parts = useMemo(() => {
    const spans = doc.extractions.flatMap((_, i) => {
      const s = recordSpan(doc, i);
      return s && (i === selected || (doc.reviews[i].status !== "rejected" && !hiddenClasses.has(finalClass(doc, i))))
        ? [{ ...s, index: i }]
        : [];
    });
    // The selected record is drawn on top of any overlapping record.
    return segments(doc.originalText, spans, selected);
  }, [doc, selected, hiddenClasses]);
  function readSelection() {
    const el = box.current,
      sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return onSelect(null);
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return onSelect(null);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const a = pre.toString().length,
      b = a + range.toString().length;
    // Trim surrounding whitespace so the interval covers only the selected words.
    let { start, end } = codepointRange(doc.originalText, a, b);
    const chars = Array.from(doc.originalText);
    while (start < end && /\s/.test(chars[start])) start++;
    while (end > start && /\s/.test(chars[end - 1])) end--;
    if (end <= start) return onSelect(null);
    onSelect({ start, end, quote: sliceCodepoints(doc.originalText, start, end) });
  }
  if (isStale(doc)) return <div className="source-copy">{doc.text}</div>;
  return (
    <div
      className="source-copy"
      ref={box}
      onMouseUp={readSelection}
      onKeyUp={(e) => {
        if (e.shiftKey || e.key.startsWith("Arrow")) readSelection();
      }}
      onTouchEnd={() => setTimeout(readSelection, 0)}
    >
      {parts.map((seg, k) =>
        seg.index === null ? (
          <span key={k}>{seg.text}</span>
        ) : (
          <mark
            key={k}
            data-testid={seg.index === selected ? "evidence-highlight" : undefined}
            className={
              "ev " +
              doc.reviews[seg.index].status +
              (seg.index === selected ? " current" : "")
            }
            style={{ background: colorOf(finalClass(doc, seg.index)) }}
            title={finalClass(doc, seg.index) + "：" + finalText(doc, seg.index)}
            onClick={() => {
              if (window.getSelection()?.isCollapsed !== false) onPick(seg.index!);
            }}
          >
            {seg.last ? (
              <>
                {Array.from(seg.text).slice(0, -1).join("")}
                {/* The record number stays on the same line as the final character. */}
                <span className="tail" data-n={String(seg.index + 1)}>
                  {Array.from(seg.text).at(-1)}
                </span>
              </>
            ) : (
              seg.text
            )}
          </mark>
        ),
      )}
    </div>
  );
});
