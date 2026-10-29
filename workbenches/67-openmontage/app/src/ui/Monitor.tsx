// ABOUTME: 节目监视器：时间线合成画面与走带控制（播放、逐帧、跳到首尾、时间码）。
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import { duration, timecode, type Timeline } from "../contracts/timeline";
import type { Player } from "./engine/player";

export function Timecode({ player, fps }: { player: Player; fps: number }) {
  const t = useSyncExternalStore(player.subscribe, player.getTime);
  return <span className="tc">{timecode(t, fps)}</span>;
}

export function Monitor({ player, timeline, mediaError }: { player: Player; timeline: Timeline; mediaError: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const playing = useSyncExternalStore(player.subscribe, player.isPlaying);
  useEffect(() => {
    player.attach(canvas.current);
    return () => player.attach(null);
  }, [player]);
  const { width, height, fps } = timeline.settings;
  const total = duration(timeline);
  const frame = 1 / fps;
  return (
    <section className="monitor" aria-label="节目监视器">
      <div className="screen" style={{ aspectRatio: `${width} / ${height}` }}>
        <canvas ref={canvas} width={width} height={height} aria-label="合成预览画面" />
        {total === 0 ? <p className="screen-empty">从素材库把片段拖到下方时间线，或点素材上的“＋”。</p> : null}
        {mediaError ? (
          <p className="screen-error" role="alert">
            {mediaError}
          </p>
        ) : null}
      </div>
      <div className="transport">
        <div className="transport-buttons">
          <button className="icon" aria-label="跳到开头" onClick={() => player.seek(0)}>
            <SkipBack aria-hidden="true" size={16} />
          </button>
          <button className="icon" aria-label="后退一帧" onClick={() => player.seek(player.getTime() - frame)}>
            <StepBack aria-hidden="true" size={16} />
          </button>
          <button className="icon play" aria-label={playing ? "暂停" : "播放"} disabled={total === 0} onClick={() => player.toggle()}>
            {playing ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
          </button>
          <button className="icon" aria-label="前进一帧" onClick={() => player.seek(player.getTime() + frame)}>
            <StepForward aria-hidden="true" size={16} />
          </button>
          <button className="icon" aria-label="跳到结尾" onClick={() => player.seek(total)}>
            <SkipForward aria-hidden="true" size={16} />
          </button>
        </div>
        <span className="transport-time" aria-live="off">
          <Timecode player={player} fps={fps} />
          <span className="tc-total">/ {timecode(total, fps)}</span>
        </span>
        <span className="transport-format">
          {width}×{height} · {fps} fps
        </span>
      </div>
    </section>
  );
}
