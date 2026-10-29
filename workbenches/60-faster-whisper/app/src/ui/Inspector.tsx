// ABOUTME: 右侧检查器的「本句」与「说话人」页：入出点微调、字速、逐词时间与置信、拆分合并、说话人名册。
import { useEffect, useState } from "react";
import { Check, Merge, Plus, Scissors, Trash2, Crosshair } from "lucide-react";
import { clock, trySeconds, type Cue, type Speaker } from "../contracts/transcript";
import { isCjk, lowConfidence, wordsAligned } from "../contracts/edit";
import { cueError } from "./CueRow";

export const SPEAKER_COLORS = ["#66d6c4", "#f5a97f", "#a5b4fc", "#f9e2af", "#f38ba8", "#94e2d5", "#cba6f7", "#fab387"];
export const speakerColor = (speakers: Speaker[], id: string) => {
  const i = speakers.findIndex((s) => s.id === id);
  return i < 0 ? "#6f8193" : SPEAKER_COLORS[i % SPEAKER_COLORS.length];
};

function readingSpeed(cue: Cue) {
  const s = trySeconds(cue.start),
    e = trySeconds(cue.end);
  if (!(e > s)) return null;
  const chars = Array.from(cue.text).filter((c) => /[\p{L}\p{N}]/u.test(c));
  const cjk = chars.filter(isCjk).length > chars.length / 2;
  const cps = chars.length / (e - s);
  return { cps, limit: cjk ? 9 : 17, duration: e - s };
}

export function CuePanel({
  cue,
  index,
  speakers,
  time,
  onSpeaker,
  onNudge,
  onEdgeAtPlayhead,
  onSeek,
  onSplit,
  onMerge,
  onRemove,
  onReview,
}: {
  cue: Cue | null;
  index: number;
  speakers: Speaker[];
  time: number;
  onSpeaker: (speaker: string) => void;
  onNudge: (edge: "start" | "end", delta: number) => void;
  onEdgeAtPlayhead: (edge: "start" | "end") => void;
  onSeek: (t: number) => void;
  onSplit: (at?: number) => void;
  onMerge: () => void;
  onRemove: () => void;
  onReview: (value: boolean) => void;
}) {
  const [picked, setPicked] = useState(-1);
  useEffect(() => setPicked(-1), [cue?.id]);
  if (!cue)
    return <p className="panel-empty">在字幕表或波形上选一句，这里显示它的时间、逐词置信与微调工具。</p>;
  const error = cueError(cue),
    speed = readingSpeed(cue),
    aligned = wordsAligned(cue),
    low = cue.words.filter((w) => lowConfidence(w)).length;
  const start = trySeconds(cue.start),
    end = trySeconds(cue.end);
  const inside = time > start + 0.02 && time < end - 0.02;
  return (
    <div className="cue-panel">
      <div className="panel-head">
        <h3>第 {index + 1} 句</h3>
        <label className="review-check">
          <input type="checkbox" checked={cue.reviewed} onChange={(e) => onReview(e.target.checked)} />
          <span>{cue.reviewed ? "已复核" : "待复核"}</span>
        </label>
      </div>
      <label className="stack">
        说话人
        <select name="panel-speaker" value={cue.speaker} onChange={(e) => onSpeaker(e.target.value)}>
          <option value="">未标注</option>
          {speakers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || "（未命名）"}
            </option>
          ))}
        </select>
      </label>
      <div className="edge-grid" role="group" aria-label="入出点微调">
        {(["start", "end"] as const).map((edge) => (
          <div key={edge} className="edge-row">
            <span className="edge-name">{edge === "start" ? "入点" : "出点"}</span>
            <output>{cue[edge]}</output>
            <div className="nudges">
              {[-0.5, -0.1, 0.1, 0.5].map((d) => (
                <button
                  key={d}
                  disabled={!!error}
                  aria-label={`${edge === "start" ? "入点" : "出点"}${d > 0 ? "后移" : "前移"} ${Math.abs(d)} 秒`}
                  onClick={() => onNudge(edge, d)}
                >
                  {d > 0 ? "+" : "−"}
                  {Math.abs(d)}
                </button>
              ))}
              <button title={`把${edge === "start" ? "入点" : "出点"}设为播放头 ${clock(time).slice(3)}`} aria-label={`${edge === "start" ? "入点" : "出点"}设为播放头`} onClick={() => onEdgeAtPlayhead(edge)}>
                <Crosshair size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {speed ? (
        <p className={`speed ${speed.cps > speed.limit ? "over" : ""}`}>
          时长 {speed.duration.toFixed(2)} 秒 · 字速 {speed.cps.toFixed(1)} 字/秒
          {speed.cps > speed.limit ? `，超过建议的 ${speed.limit} 字/秒，可拆分或延长出点` : ""}
        </p>
      ) : (
        <p className="speed over">{error}</p>
      )}
      <div className="panel-actions">
        <button disabled={!!error} onClick={() => onSplit(inside ? time : undefined)} title={inside ? "在播放头处拆分" : "在中间词处拆分"}>
          <Scissors size={15} aria-hidden="true" />
          {inside ? "在播放头拆分" : "从中间拆分"}
        </button>
        <button disabled={!!error} onClick={onMerge}>
          <Merge size={15} aria-hidden="true" />
          合并下一句
        </button>
        <button onClick={onRemove} aria-label="删除此句">
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
      <section className="words" aria-label="逐词时间戳">
        <div className="words-head">
          <h4>逐词时间</h4>
          <span>
            {cue.words.length ? `${cue.words.length} 词${low ? ` · ${low} 个低置信` : ""}` : "无"}
          </span>
        </div>
        {cue.words.length ? (
          <>
            {!aligned ? <p className="hint warn">文字与逐词记录不一致（多为导入后改动），时间仅供参考。</p> : null}
            <div className="word-chips">
              {cue.words.map((w, i) => (
                <button
                  key={i}
                  type="button"
                  className={`chip ${lowConfidence(w) ? "low" : ""} ${w.p < 0 ? "edited" : ""} ${time >= w.s && time < w.e ? "now" : ""} ${picked === i ? "picked" : ""}`}
                  aria-pressed={picked === i}
                  title={`${clock(w.s).slice(3)}–${clock(w.e).slice(3)}${w.p >= 0 ? ` · 置信 ${Math.round(w.p * 100)}%` : " · 人工修改，时间为插值"}`}
                  onClick={() => {
                    setPicked(i);
                    onSeek(w.s);
                  }}
                >
                  {w.w.trim() || "␣"}
                </button>
              ))}
            </div>
            <div className="word-legend">
              <span className="chip low">低置信 &lt;50%</span>
              <span className="chip edited">人工修改</span>
              <button
                disabled={picked < 1 || !!error}
                onClick={() => {
                  const w = cue.words[picked];
                  if (w) onSplit(w.s);
                  setPicked(-1);
                }}
              >
                <Scissors size={14} aria-hidden="true" />
                在所选词前拆分
              </button>
            </div>
          </>
        ) : (
          <p className="hint">这句没有逐词时间。用 faster-whisper 转写时打开“逐词时间戳”，或导入含 words 的分段 JSON。</p>
        )}
      </section>
    </div>
  );
}

export function SpeakersPanel({
  speakers,
  counts,
  onRename,
  onAdd,
  onRemove,
  onAssignPending,
}: {
  speakers: Speaker[];
  counts: Map<string, number>;
  onRename: (id: string, name: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onAssignPending: (id: string) => void;
}) {
  return (
    <div className="speakers">
      <p className="hint">faster-whisper 不区分说话人；在这里维护名册，再在每句或波形上标注。导出 VTT 时写成 &lt;v 名字&gt;，SRT/TXT 写成“名字：”。</p>
      {speakers.map((s, i) => (
        <div className="speaker-row" key={s.id}>
          <span className="swatch" style={{ background: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }} aria-hidden="true" />
          <input
            aria-label={`说话人 ${i + 1} 名称`}
            name={`speaker-name-${s.id}`}
            autoComplete="off"
            maxLength={40}
            value={s.name}
            onChange={(e) => onRename(s.id, e.target.value)}
          />
          <span className="count">{counts.get(s.id) ?? 0} 句</span>
          <button title="把未标注的句子都标为此人" aria-label={`把未标注的句子标为 ${s.name}`} onClick={() => onAssignPending(s.id)}>
            <Check size={14} aria-hidden="true" />
          </button>
          <button aria-label={`移除说话人 ${s.name}`} onClick={() => onRemove(s.id)}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <p className="hint">未标注：{counts.get("") ?? 0} 句</p>
      <button onClick={onAdd} disabled={speakers.length >= 40}>
        <Plus size={15} aria-hidden="true" />
        添加说话人
      </button>
    </div>
  );
}
