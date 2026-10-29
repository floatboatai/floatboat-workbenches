// ABOUTME: 右侧批注账本：当前位置与添加入口、按乐谱顺序编号的批注、筛选与核对状态。
import { memo, useState, type RefObject } from "react";
import { MessageSquarePlus } from "lucide-react";
import { ANNOTATION_KINDS, type Annotation, type AnnotationKind, type Focus } from "../contracts/domain";
import { beatLabel, type ScoreIndex } from "../contracts/musicxml";

export type LedgerFilter = "all" | "open" | "here";
export interface NumberedAnnotation extends Annotation {
  number: number;
}

export function locationLabel(index: ScoreIndex, partId: string, measureIndex: number, beat: Annotation["beat"]) {
  const measure = index.measures[measureIndex];
  const part = index.parts.find((item) => item.id === partId);
  const b = beatLabel(beat, measure?.t ?? "");
  return `${part?.name ?? partId} · 第 ${measure?.n ?? measureIndex + 1} 小节${b ? ` 第 ${b} 拍` : ""}`;
}

const Entry = memo(function Entry({
  note,
  index,
  selected,
  locked,
  onSelect,
  onUpdate,
  onRemove,
}: {
  note: NumberedAnnotation;
  index: ScoreIndex;
  selected: boolean;
  locked: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Annotation, "text" | "resolved" | "kind">>) => void;
  onRemove: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const where = locationLabel(index, note.partId, note.measureIndex, note.beat);
  return (
    <li className={`entry ${note.resolved ? "resolved" : ""} ${selected ? "selected" : ""}`} data-entry={note.id}>
      <div className="entry-head">
        <button type="button" className="entry-number" aria-label={`在谱面上定位批注 ${note.number}：${where}`} onClick={() => onSelect(note.id)}>
          {note.number}
        </button>
        <button type="button" className="entry-where" onClick={() => onSelect(note.id)}>
          {where}
        </button>
        <label className="sr-only" htmlFor={`kind-${note.id}`}>
          批注类别
        </label>
        <select id={`kind-${note.id}`} name="annotationKind" value={note.kind} disabled={locked} onChange={(event) => onUpdate(note.id, { kind: event.target.value as AnnotationKind })}>
          {Object.entries(ANNOTATION_KINDS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <label className="sr-only" htmlFor={`note-${note.id}`}>
        批注 {note.number} 内容
      </label>
      <textarea
        id={`note-${note.id}`}
        name="annotationText"
        value={note.text}
        rows={3}
        maxLength={2000}
        disabled={locked}
        autoComplete="off"
        placeholder="例如：第二拍的升号需要更清楚…"
        onFocus={() => onSelect(note.id)}
        onChange={(event) => onUpdate(note.id, { text: event.target.value })}
      />
      {!note.text.trim() ? <small className="required-note">填写内容后才会正式保存（草稿已保留）。</small> : null}
      <div className="entry-foot">
        <label className="check">
          <input type="checkbox" checked={note.resolved} disabled={locked} onChange={(event) => onUpdate(note.id, { resolved: event.target.checked })} />
          已核对
        </label>
        {confirming ? (
          <span className="confirm">
            <button type="button" className="danger" onClick={() => onRemove(note.id)}>
              确认删除
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              取消
            </button>
          </span>
        ) : (
          <button type="button" className="quiet" disabled={locked} aria-label={`删除批注 ${note.number}`} onClick={() => setConfirming(true)}>
            删除
          </button>
        )}
      </div>
    </li>
  );
});

export function Ledger({
  index,
  annotations,
  focus,
  playhead,
  selectedId,
  filter,
  locked,
  listRef,
  onFocus,
  onAdd,
  onSelect,
  onUpdate,
  onRemove,
  onFilter,
}: {
  index: ScoreIndex;
  annotations: NumberedAnnotation[];
  focus: Focus;
  playhead: { measureIndex: number } | null;
  selectedId: string | null;
  filter: LedgerFilter;
  locked: boolean;
  listRef: RefObject<HTMLOListElement | null>;
  onFocus: (focus: Focus) => void;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Annotation, "text" | "resolved" | "kind">>) => void;
  onRemove: (id: string) => void;
  onFilter: (filter: LedgerFilter) => void;
}) {
  const [measureText, setMeasureText] = useState<string | null>(null);
  const part = index.parts.find((item) => item.id === focus.partId) ?? index.parts[0];
  const measure = index.measures[focus.measureIndex];
  const open = annotations.filter((note) => !note.resolved).length;
  const here = annotations.filter((note) => note.measureIndex === focus.measureIndex);
  const shown = filter === "open" ? annotations.filter((note) => !note.resolved) : filter === "here" ? here : annotations;
  const go = (text: string) => {
    const value = text.trim();
    let target = index.measures.findIndex((item, i) => item.n === value && i < part.measures);
    if (target < 0 && /^\d+$/.test(value)) target = Math.min(part.measures, Math.max(1, Number(value))) - 1;
    if (target >= 0) onFocus({ partId: part.id, measureIndex: target, beat: null });
    setMeasureText(null);
  };
  return (
    <aside className="ledger" aria-label="审校批注">
      <section className="position" aria-labelledby="position-title">
        <p className="eyebrow" id="position-title">
          {playhead ? "正在回放" : "当前位置"}
        </p>
        <p className="position-main">
          第 {index.measures[playhead?.measureIndex ?? focus.measureIndex]?.n ?? focus.measureIndex + 1} 小节
          {!playhead && focus.beat ? <span> · 第 {beatLabel(focus.beat, measure?.t ?? "")} 拍</span> : null}
          {measure?.t ? <small>{measure.t}</small> : null}
        </p>
        <div className="position-controls">
          {index.parts.length > 1 ? (
            <label>
              <span>声部</span>
              <select
                name="focusPart"
                value={part.id}
                onChange={(event) => {
                  const next = index.parts.find((item) => item.id === event.target.value)!;
                  onFocus({ partId: next.id, measureIndex: Math.min(focus.measureIndex, next.measures - 1), beat: focus.beat });
                }}
              >
                {index.parts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="single-part" translate="no">
              {part.name}
            </span>
          )}
          <label className="measure-go">
            <span>转到小节</span>
            <input
              name="measureNumber"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              value={measureText ?? measure?.n ?? ""}
              onChange={(event) => setMeasureText(event.target.value)}
              onBlur={() => measureText !== null && go(measureText)}
              onKeyDown={(event) => {
                if (event.key === "Enter") go(event.currentTarget.value);
                if (event.key === "Escape") setMeasureText(null);
              }}
            />
          </label>
        </div>
        <div className="anchor-row">
          <span>{focus.beat ? `批注锚定到第 ${beatLabel(focus.beat, measure?.t ?? "")} 拍的音符` : "批注锚定到整个小节"}</span>
          {focus.beat ? (
            <button type="button" className="link" onClick={() => onFocus({ ...focus, beat: null })}>
              改为整小节
            </button>
          ) : null}
        </div>
        <button type="button" className="primary add" disabled={locked} onClick={onAdd}>
          <MessageSquarePlus aria-hidden="true" size={17} /> 在此添加批注
        </button>
        <p className="hint">在谱面上点击音符或小节定位；← → 逐音移动光标，空格回放，N 添加批注。</p>
      </section>
      <section className="entries" aria-labelledby="entries-title">
        <div className="entries-head">
          <h2 id="entries-title">批注账本</h2>
          <span className="tally">
            <b>{open}</b> 待核对 · 共 {annotations.length}
          </span>
        </div>
        <div className="filters" role="radiogroup" aria-label="筛选批注">
          {(
            [
              ["all", `全部 ${annotations.length}`],
              ["open", `待核对 ${open}`],
              ["here", `本小节 ${here.length}`],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={filter === key} className={filter === key ? "on" : ""} onClick={() => onFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        {shown.length ? (
          <ol className="entry-list" ref={listRef}>
            {shown.map((note) => (
              <Entry key={note.id} note={note} index={index} selected={note.id === selectedId} locked={locked} onSelect={onSelect} onUpdate={onUpdate} onRemove={onRemove} />
            ))}
          </ol>
        ) : (
          <div className="empty-notes">
            <p>{filter === "here" ? "这一小节还没有批注。" : filter === "open" ? "没有待核对的批注。" : "还没有批注。"}</p>
            <small>点击谱面上的音符，再“在此添加批注”。批注会以编号标在谱面上，并随 PDF/PNG/SVG 一起导出。</small>
          </div>
        )}
      </section>
    </aside>
  );
}
