import type { Annotation } from "../contracts/domain";
import type { PartInfo } from "../contracts/musicxml";
export function MeasureIndex({
  parts,
  part,
  measureIndex,
  annotations,
  allNotes,
  locked,
  onSelect,
  onToggleAll,
}: {
  parts: PartInfo[];
  part: PartInfo;
  measureIndex: number;
  annotations: Annotation[];
  allNotes: boolean;
  locked: boolean;
  onSelect: (partId: string, index: number) => void;
  onToggleAll: () => void;
}) {
  const unresolved = annotations.filter((note) => !note.resolved).length;
  return (
    <aside className="measure-index" aria-label="小节索引">
      <p className="eyebrow">REVIEW INDEX</p>
      <h2>逐节核对</h2>
      <label htmlFor="review-part">批注声部</label>
      <select
        id="review-part"
        name="reviewPart"
        disabled={locked}
        value={part.id}
        onChange={(event) => {
          onSelect(event.target.value, 0);
        }}
      >
        {parts.map((part) => (
          <option key={part.id} value={part.id}>
            {part.name}
          </option>
        ))}
      </select>
      <label htmlFor="measure-index">小节</label>
      <select
        id="measure-index"
        name="measureIndex"
        disabled={locked}
        value={measureIndex}
        onChange={(event) => {
          onSelect(part.id, Number(event.target.value));
        }}
      >
        {part.measures.map((item) => (
          <option key={item.index} value={item.index}>
            第 {item.number} 小节
            {annotations.some(
              (note) =>
                note.partId === part.id && note.measureIndex === item.index,
            )
              ? " · 有批注"
              : ""}
          </option>
        ))}
      </select>
      <div className="measure-arrows">
        <button
          aria-label="上一小节"
          disabled={locked || measureIndex === 0}
          onClick={() => {
            onSelect(part.id, measureIndex - 1);
          }}
        >
          ← 上一节
        </button>
        <button
          aria-label="下一小节"
          disabled={locked || measureIndex >= part.measures.length - 1}
          onClick={() => {
            onSelect(part.id, measureIndex + 1);
          }}
        >
          下一节 →
        </button>
      </div>
      <div className="index-summary">
        <span>{unresolved}</span>
        <p>
          条待核对批注
          <br />共 {annotations.length} 条记录
        </p>
      </div>
      <button
        className="all-notes"
        aria-pressed={allNotes}
        onClick={onToggleAll}
      >
        {allNotes ? "返回当前小节" : "查看全部批注"}
      </button>
      <a className="notes-jump" href="#review-notes">
        转到批注区 ↓
      </a>
      <p className="small-note">
        支持最多 12 声部、每声部 200 小节。渲染器不修改音符或播放声音。
      </p>
    </aside>
  );
}
