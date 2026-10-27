import type { RefObject } from "react";
import type { Annotation } from "../contracts/domain";
import type { PartInfo } from "../contracts/musicxml";
export function AnnotationBook({
  notesRef,
  allNotes,
  part,
  measureIndex,
  annotations,
  parts,
  locked,
  addNote,
  updateNote,
  removeNote,
  onSelect,
}: {
  notesRef: RefObject<HTMLElement | null>;
  allNotes: boolean;
  part: PartInfo;
  measureIndex: number;
  annotations: Annotation[];
  parts: PartInfo[];
  locked: boolean;
  addNote: () => void;
  updateNote: (
    id: string,
    patch: { text?: string; resolved?: boolean },
  ) => void;
  removeNote: (id: string) => void;
  onSelect: (partId: string, measureIndex: number) => void;
}) {
  return (
    <section
      id="review-notes"
      tabIndex={-1}
      className="annotation-book"
      ref={notesRef}
      aria-label="小节批注"
    >
      <div className="annotation-title">
        <p className="eyebrow">EDITOR'S NOTES</p>
        <h2>
          {allNotes
            ? "全部审校记录"
            : `第 ${part.measures[measureIndex].number} 小节`}
        </h2>
        <p>{allNotes ? "点击位置回到对应小节" : part.name}</p>
      </div>
      <button className="add-note" disabled={locked} onClick={addNote}>
        ＋ 添加当前小节批注
      </button>
      {annotations.length === 0 ? (
        <div className="empty-notes">
          <span aria-hidden="true">—</span>
          <p>{allNotes ? "还没有审校记录" : "这一小节还没有批注"}</p>
          <small>记录连线、力度、排版或需要向演奏者确认的细节。</small>
        </div>
      ) : (
        annotations.map((note) => {
          const notePart = parts.find((part) => part.id === note.partId)!;
          return (
            <article
              className={`annotation ${note.resolved ? "resolved" : ""}`}
              key={note.id}
            >
              <div className="annotation-meta">
                <button
                  disabled={locked}
                  onClick={() => {
                    onSelect(note.partId, note.measureIndex);
                  }}
                >
                  {notePart.name} ·{" "}
                  {notePart.measures[note.measureIndex].number}
                </button>
                <button
                  disabled={locked}
                  aria-label={`删除批注 ${notePart.name} 第 ${notePart.measures[note.measureIndex].number} 小节`}
                  onClick={() => removeNote(note.id)}
                >
                  删除
                </button>
              </div>
              <label className="sr-only" htmlFor={"note-" + note.id}>
                批注内容
              </label>
              <textarea
                id={"note-" + note.id}
                name="annotationText"
                disabled={locked}
                autoComplete="off"
                value={note.text}
                maxLength={1000}
                rows={4}
                placeholder="例如：请确认此处的力度标记…"
                onChange={(event) =>
                  updateNote(note.id, { text: event.target.value })
                }
              />
              <label className="resolved-toggle">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={note.resolved}
                  onChange={(event) =>
                    updateNote(note.id, { resolved: event.target.checked })
                  }
                />
                已核对
              </label>
              {!note.text.trim() ? (
                <small className="required-note">
                  填写内容后才能保存或导出报告。
                </small>
              ) : null}
            </article>
          );
        })
      )}
    </section>
  );
}
