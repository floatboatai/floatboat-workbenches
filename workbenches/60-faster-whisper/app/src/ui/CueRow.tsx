// ABOUTME: 字幕表中的一行：回听编号、说话人、入出点、对白、复核与置信/匹配标记。
import { memo } from "react";
import { Merge, Play, Scissors, Trash2 } from "lucide-react";
import type { Cue, Speaker } from "../contracts/transcript";
import { lowConfidence, wordsAligned } from "../contracts/edit";
import { seconds } from "../contracts/transcript";

export type Field = "start" | "end" | "text" | "reviewed" | "speaker";
export function cueError(cue: Cue) {
  try {
    if (seconds(cue.end) <= seconds(cue.start)) return "出点必须晚于入点";
    return "";
  } catch {
    return "时间格式为 00:00:00.000";
  }
}

export const CueRow = memo(function CueRow({
  cue,
  index,
  selected,
  playing,
  speakers,
  color,
  matches,
  onChange,
  onSelect,
  onSeek,
  onSplit,
  onMerge,
  onRemove,
}: {
  cue: Cue;
  index: number;
  selected: boolean;
  playing: boolean;
  speakers: Speaker[];
  color: string;
  matches: number;
  onChange: (id: string, field: Field, value: string | boolean) => void;
  onSelect: (id: string) => void;
  onSeek: (cue: Cue) => void;
  onSplit: (id: string) => void;
  onMerge: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const error = cueError(cue);
  const low = cue.words.filter((w) => lowConfidence(w)).length;
  const stale = cue.words.length > 0 && !wordsAligned(cue);
  const n = index + 1;
  return (
    <article
      id={`cue-${cue.id}`}
      className={`cue ${selected ? "selected" : ""} ${playing ? "playing" : ""} ${cue.reviewed ? "reviewed" : ""}`}
      style={{ ["--c" as string]: color }}
      aria-label={`字幕 ${n}`}
      onFocusCapture={() => {
        if (!selected) onSelect(cue.id);
      }}
      onPointerDown={() => {
        if (!selected) onSelect(cue.id);
      }}
    >
      <button className="cue-number" aria-label={`回听第 ${n} 句`} title="从此句回听" disabled={!!error} onClick={() => onSeek(cue)}>
        {String(n).padStart(2, "0")}
        <Play size={11} aria-hidden="true" />
      </button>
      <div className="cue-meta">
        <select
          className="speaker-select"
          aria-label={`第 ${n} 句说话人`}
          name={`speaker-${cue.id}`}
          value={cue.speaker}
          onChange={(e) => onChange(cue.id, "speaker", e.target.value)}
        >
          <option value="">未标注</option>
          {speakers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || "（未命名）"}
            </option>
          ))}
        </select>
        <div className="cue-times">
          {(["start", "end"] as const).map((edge) => (
            <label key={edge}>
              <span>{edge === "start" ? "入" : "出"}</span>
              <input
                aria-label={`第 ${n} 句${edge === "start" ? "入点" : "出点"}`}
                name={`${edge}-${cue.id}`}
                autoComplete="off"
                spellCheck={false}
                inputMode="decimal"
                maxLength={24}
                value={cue[edge]}
                aria-invalid={!!error}
                onChange={(e) => onChange(cue.id, edge, e.target.value)}
              />
            </label>
          ))}
        </div>
        {error ? <small className="field-error">{error}</small> : null}
      </div>
      <div className="cue-copy">
        <textarea
          aria-label={`第 ${n} 句字幕`}
          name={`text-${cue.id}`}
          autoComplete="off"
          rows={2}
          maxLength={8000}
          value={cue.text}
          onChange={(e) => onChange(cue.id, "text", e.target.value)}
        />
        <div className="cue-flags">
          <span>{Array.from(cue.text).length} 字</span>
          {low && !cue.reviewed ? <span className="flag low">低置信 {low}</span> : null}
          {stale ? <span className="flag">逐词未对齐</span> : null}
          {matches ? <span className="flag match">匹配 {matches}</span> : null}
        </div>
      </div>
      <div className="cue-actions">
        <label className="review-check">
          <input
            type="checkbox"
            aria-label={`第 ${n} 句已复核`}
            checked={cue.reviewed}
            onChange={(e) => onChange(cue.id, "reviewed", e.target.checked)}
          />
          <span>{cue.reviewed ? "已复核" : "待复核"}</span>
        </label>
        <div>
          <button title="拆分（按播放头或中间词）" aria-label={`拆分第 ${n} 句`} disabled={!!error} onClick={() => onSplit(cue.id)}>
            <Scissors size={15} aria-hidden="true" />
          </button>
          <button title="与下一句合并" aria-label={`合并第 ${n} 句与下一句`} disabled={!!error} onClick={() => onMerge(cue.id)}>
            <Merge size={15} aria-hidden="true" />
          </button>
          <button title="删除此句" aria-label={`删除第 ${n} 句`} onClick={() => onRemove(cue.id)}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
});
