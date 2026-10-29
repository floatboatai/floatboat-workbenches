// ABOUTME: 监看台的走带条（播放、时间、倍速、波形缩放）与按逐词时间点亮的当前字幕。
import { Pause, Play, ZoomIn, ZoomOut } from "lucide-react";
import { clock, type AudioSource, type Cue, type Speaker } from "../contracts/transcript";
import { ZOOMS } from "./Timeline";
import { speakerColor } from "./Inspector";

export function Transport({ playing, canPlay, time, span, source, rate, zoom, onToggle, onRate, onZoom }: {
  playing: boolean;
  canPlay: boolean;
  time: number;
  span: number;
  source: AudioSource | null;
  rate: number;
  zoom: number;
  onToggle: () => void;
  onRate: (rate: number) => void;
  onZoom: (zoom: number) => void;
}) {
  return (
        <div className="transport">
          <button className="play" aria-label={playing ? "暂停" : "播放"} disabled={!canPlay} onClick={onToggle}>
            {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </button>
          <time className="clock">{clock(time)}</time>
          <span className="clock-total">/ {clock(span)}</span>
          <span className="source-name" title={source?.name}>
            {source ? source.name : "没有音频：导入音频后可回听并在波形上打轴"}
          </span>
          <label className="rate">
            <span className="sr-only">播放速度</span>
            <select name="rate" aria-label="播放速度" value={rate} onChange={(e) => onRate(Number(e.target.value))}>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
          </label>
          <div className="zoom" role="group" aria-label="波形缩放">
            <button aria-label="缩小波形" disabled={zoom === 0} onClick={() => onZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}>
              <ZoomOut size={15} aria-hidden="true" />
            </button>
            <span>{zoom ? `${zoom} px/秒` : "全览"}</span>
            <button aria-label="放大波形" disabled={zoom === ZOOMS.at(-1)} onClick={() => onZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}>
              <ZoomIn size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
  );
}

export function Caption({ cue, speakers, time }: { cue: Cue | undefined; speakers: Speaker[]; time: number }) {
  return (
        <div className="caption" aria-live="off">
          {(() => {
            const c = cue;
            if (!c) return <span className="caption-empty">回听时这里按逐词时间显示当前字幕</span>;
            const who = speakers.find((s) => s.id === c.speaker)?.name;
            return (
              <>
                {who ? <span className="caption-who" style={{ color: speakerColor(speakers, c.speaker) }}>{who}</span> : null}
                {c.words.length
                  ? c.words.map((w, i) => (
                      <span key={i} className={time >= w.s ? "spoken" : ""}>
                        {w.w}
                      </span>
                    ))
                  : c.text}
              </>
            );
          })()}
        </div>
  );
}
