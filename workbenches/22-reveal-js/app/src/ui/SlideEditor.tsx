import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Trash2,
  RotateCcw,
  X,
} from "lucide-react";
import {
  type Slide,
  LIMITS,
  toSource,
  portableSource,
  parseSource,
  moveSlide,
} from "../contracts/deck.ts";
import type { Projects } from "./App";
export function SlideEditor({
  p,
  index,
  onCopy,
}: {
  p: Projects;
  index: number;
  onCopy: () => void;
}) {
  const [undo, setUndo] = useState<{ slide: Slide; index: number } | null>(
    null,
  );
  const slide = p.data.slides[index];
  const sourceOpen = p.draft.sourceOpen === true;
  const hasDraft =
    typeof p.draft.source === "string" && p.draft.source !== toSource(p.data);
  const select = (n: number) => {
    const target = p.data.slides[n];
    if (target) p.setDraft((d) => ({ ...d, selected: target.id }));
  };
  const source =
    typeof p.draft.source === "string" && p.draft.source.length <= LIMITS.source
      ? p.draft.source
      : toSource(p.data);
  const change = (field: "markdown" | "notes", value: string) =>
    p.setData((d) => ({
      ...d,
      slides: d.slides.map((row) =>
        row.id === slide.id ? { ...row, [field]: value } : row,
      ),
    }));
  const remove = () => {
    setUndo({ slide, index });
    p.setData((d) => ({
      ...d,
      slides: d.slides.filter((row) => row.id !== slide.id),
    }));
    select(Math.max(0, index - 1));
  };
  const restore = () => {
    if (!undo) return;
    p.setData((d) => ({
      ...d,
      slides: [
        ...d.slides.slice(0, undo.index),
        undo.slide,
        ...d.slides.slice(undo.index),
      ],
    }));
    p.setDraft((d) => ({ ...d, selected: undo.slide.id }));
    setUndo(null);
  };
  const apply = () => {
    try {
      const next = parseSource(source, p.data);
      p.setData(next);
      p.setDraft((d) => ({
        ...d,
        source: undefined,
        sourceOpen: false,
        selected: next.slides[0].id,
      }));
      p.setError("");
      p.setNotice("整套源稿已应用。");
    } catch (e) {
      p.report(e);
      document.getElementById("deck-source")?.focus();
    }
  };
  return (
    <section
      className="writing-column"
      aria-label={sourceOpen ? "整套源稿" : "当前页编辑"}
    >
      {sourceOpen ? (
        <>
          <div className="section-heading">
            <h2>整套 Markdown</h2>
            <button
              aria-label="收起源稿"
              className="icon-button"
              onClick={() => p.setDraft((d) => ({ ...d, sourceOpen: false }))}
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <p className="source-help">
            独立一行 <code>---</code> 分页，<code>Notes:</code>{" "}
            后写讲者备注。应用后会替换当前页序。未应用文字会保留。
          </p>
          <label className="sr-only" htmlFor="deck-source">
            整套 Markdown 源稿
          </label>
          <textarea
            id="deck-source"
            name="deck-source"
            autoComplete="off"
            className="full-source"
            value={source}
            maxLength={LIMITS.source}
            spellCheck={false}
            onChange={(e) =>
              p.setDraft((d) => ({ ...d, source: e.target.value }))
            }
          />
          <div className="source-actions">
            <button className="primary" onClick={apply}>
              应用到演示
            </button>
            <button
              onClick={() => {
                if (
                  !hasDraft ||
                  confirm("用当前页面重新生成源稿？待应用文字将被替换。")
                ) {
                  try {
                    const generated = portableSource(p.data);
                    p.setDraft((d) => ({ ...d, source: generated }));
                  } catch (e) {
                    p.report(e);
                  }
                }
              }}
            >
              从页面重新生成
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="section-heading">
            <h2>第 {String(index + 1).padStart(2, "0")} 页 · 讲稿</h2>
            <span className="source-badge">Markdown</span>
          </div>
          <div className="slide-tools">
            <button
              aria-label="前移当前页"
              disabled={index === 0}
              onClick={() => p.setData((d) => moveSlide(d, index, -1))}
            >
              <ArrowLeft aria-hidden="true" size={15} />
            </button>
            <button
              aria-label="后移当前页"
              disabled={index === p.data.slides.length - 1}
              onClick={() => p.setData((d) => moveSlide(d, index, 1))}
            >
              <ArrowRight aria-hidden="true" size={15} />
            </button>
            <button
              aria-label="复制当前页"
              disabled={p.data.slides.length >= LIMITS.slides}
              onClick={onCopy}
            >
              <Copy aria-hidden="true" size={15} />
            </button>
            <button
              aria-label="删除当前页"
              disabled={p.data.slides.length === 1}
              onClick={remove}
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
            <span>
              {slide.markdown.length} / {LIMITS.markdown}
            </span>
          </div>
          <label className="sr-only" htmlFor="slide-markdown">
            当前页 Markdown
          </label>
          <textarea
            id="slide-markdown"
            name="slide-markdown"
            autoComplete="off"
            className="markdown-editor"
            value={slide.markdown}
            maxLength={LIMITS.markdown}
            spellCheck={false}
            onChange={(e) => change("markdown", e.target.value)}
          />
          <p className="syntax-help">
            <code># 标题</code>
            <code>**重点**</code>
            <code>- 列表</code>
            <code>&gt; 引言</code>
          </p>
          <div className="notes-heading">
            <label htmlFor="speaker-notes">讲者备注</label>
            <span>仅自己可见*</span>
          </div>
          <textarea
            id="speaker-notes"
            name="speaker-notes"
            autoComplete="off"
            className="notes-editor"
            value={slide.notes}
            maxLength={LIMITS.notes}
            placeholder="下一句话，想怎么说？"
            onChange={(e) => change("notes", e.target.value)}
          />
          <p className="notes-foot">* 放映时隐藏；导出文件包含备注。</p>
          {undo ? (
            <div className="undo" role="status">
              已删除一页
              <button
                disabled={p.data.slides.length >= LIMITS.slides}
                onClick={restore}
              >
                <RotateCcw aria-hidden="true" size={14} />
                撤销
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
