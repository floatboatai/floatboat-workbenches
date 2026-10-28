import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import Regions from "wavesurfer.js/dist/plugins/regions.esm.js";
import Timeline from "wavesurfer.js/dist/plugins/timeline.esm.js";
import type { Review } from "../contracts/review";
import { validRange } from "../contracts/review";
import { audioBytes } from "./media";
export function Waveform({
  data,
  selected,
  onRange,
  onSelect,
  onTime,
  loop,
  api,
  disabled,
}: {
  data: Review;
  selected: string;
  onRange: (id: string, start: string, end: string) => void;
  onSelect: (id: string) => void;
  onTime: (n: number) => void;
  loop: boolean;
  disabled: boolean;
  api: React.RefObject<WaveSurfer | null>;
}) {
  const el = useRef<HTMLDivElement>(null),
    plugin = useRef<Regions | null>(null),
    sync = useRef(false),
    latest = useRef({ onRange, onSelect, onTime, loop, selected, disabled }),
    [state, setState] = useState("等待音频"),
    [ready, setReady] = useState(0);
  latest.current = { onRange, onSelect, onTime, loop, selected, disabled };
  useEffect(() => {
    if (!el.current || !data.source) return;
    let alive = true;
    const regions = Regions.create();
    plugin.current = regions;
    const ws = WaveSurfer.create({
      container: el.current,
      height: 174,
      waveColor: "#7c9b89",
      progressColor: "#235447",
      cursorColor: "#d2583b",
      barWidth: 2,
      barGap: 2,
      normalize: true,
      plugins: [
        regions,
        Timeline.create({
          height: 24,
          timeInterval: 1,
          primaryLabelInterval: 5,
          style: { fontSize: "11px", color: "#557064" },
        }),
      ],
    });
    api.current = ws;
    setState("正在读取与解码…");
    ws.on("ready", () => {
      if (alive) {
        setState("波形已就绪");
        setReady((v) => v + 1);
      }
    });
    ws.on("timeupdate", (n) => latest.current.onTime(n));
    ws.on("error", (e) => {
      if (alive) setState(e.message);
    });
    regions.on("region-updated", (r) => {
      if (!sync.current && !latest.current.disabled)
        latest.current.onRange(r.id, r.start.toFixed(3), r.end.toFixed(3));
    });
    regions.on("region-clicked", (r, e) => {
      e.stopPropagation();
      if (!latest.current.disabled) latest.current.onSelect(r.id);
    });
    regions.on("region-out", (r) => {
      if (
        latest.current.loop &&
        !latest.current.disabled &&
        r.id === latest.current.selected &&
        ws.isPlaying()
      )
        r.play();
    });
    audioBytes(data.source.id)
      .then((b) => {
        if (alive)
          return ws.loadBlob(
            new Blob([new Uint8Array(b)], { type: data.source?.mime }),
          );
      })
      .catch(() => {
        if (alive) setState("原件缺失 · 请重附匹配音频，笔记仍保留");
      });
    return () => {
      alive = false;
      api.current = null;
      plugin.current = null;
      ws.destroy();
    };
  }, [data.source?.id]);
  useEffect(() => {
    if (!plugin.current || !api.current?.getDuration()) return;
    sync.current = true;
    plugin.current.clearRegions();
    for (const c of data.clips) {
      if (validRange(c, data.duration))
        plugin.current.addRegion({
          id: c.id,
          start: Number(c.start),
          end: Number(c.end),
          content: c.label || "未命名选段",
          color: c.id === selected ? "#df8b5540" : "#4b80692a",
          drag: true,
          resize: true,
        });
    }
    sync.current = false;
  }, [data.clips, data.duration, selected, ready]);
  return (
    <div className="wavebox" inert={disabled}>
      <div className="wave-status" role="status">
        {state}
      </div>
      <div ref={el} data-testid="waveform" />
      {!data.source && (
        <div className="empty-wave">
          <strong>把值得留下的声音，标记下来。</strong>
          <p>上传录音后，播放、选择时间区间并写下摘录。</p>
        </div>
      )}
    </div>
  );
}
