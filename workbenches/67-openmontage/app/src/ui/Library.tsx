// ABOUTME: 素材库：导入视频/图片/音频/字幕，拖到时间线或一键放到播放头；文字模板（标题、字条、字幕、角标）。
import { memo, useRef } from "react";
import { Captions, Film, Image as ImageIcon, Music, Plus, Trash2, Type, Upload } from "lucide-react";
import { formatBytes, type Asset } from "../contracts/media";
import type { TextPreset, Timeline } from "../contracts/timeline";
import { mediaUrl } from "./engine/player";
import { ASSET_DRAG } from "./Timeline";

const TEXTS: { preset: TextPreset; label: string; sample: string }[] = [
  { preset: "title", label: "大标题", sample: "片名" },
  { preset: "lower", label: "下方字条", sample: "地点 · 时间" },
  { preset: "subtitle", label: "字幕", sample: "在这里输入台词或旁白" },
  { preset: "caption", label: "角标", sample: "2026 · 样片" },
];
const icon = (a: Asset) => (a.kind === "image" ? ImageIcon : a.kind === "audio" ? Music : Film);
const length = (a: Asset) => (a.duration === null ? "静帧" : a.duration >= 60 ? `${Math.floor(a.duration / 60)}分${Math.round(a.duration % 60)}秒` : a.duration.toFixed(1) + " 秒");

export const Library = memo(function Library({
  timeline,
  mutable,
  progress,
  onImport,
  onSubtitles,
  onAdd,
  onRemove,
  onText,
}: {
  timeline: Timeline;
  mutable: boolean;
  progress: string;
  onImport: (files: File[]) => void;
  onSubtitles: (file: File) => void;
  onAdd: (asset: Asset) => void;
  onRemove: (asset: Asset) => void;
  onText: (preset: TextPreset, sample: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const subs = useRef<HTMLInputElement>(null);
  const used = new Set(timeline.clips.map((c) => c.assetId));
  return (
    <section className="library" aria-label="素材库">
      <div className="panel-head">
        <h2>素材库</h2>
        <button className="ghost" disabled={!mutable} onClick={() => input.current?.click()}>
          <Upload aria-hidden="true" size={14} />
          导入素材
        </button>
        <input
          ref={input}
          hidden
          type="file"
          multiple
          aria-label="导入视频、图片或音频"
          accept="video/*,audio/*,image/*,.mkv,.mov,.m4a,.flac,.srt,.vtt"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            const subtitle = files.filter((f) => /\.(srt|vtt)$/i.test(f.name));
            subtitle.forEach(onSubtitles);
            const media = files.filter((f) => !subtitle.includes(f));
            if (media.length) onImport(media);
          }}
        />
      </div>
      {progress ? (
        <p className="progress-line" role="status">
          {progress}
        </p>
      ) : null}
      <p className="hint">拖到下方轨道，或点“＋”放到播放头。支持 MP4、MOV、WebM、MKV、常见图片与音频，单个最大 2 GB。</p>
      <ul className="assets">
        {timeline.assets.map((a) => {
          const Icon = icon(a);
          return (
            <li
              key={a.id}
              draggable={mutable}
              onDragStart={(e) => {
                e.dataTransfer.setData(ASSET_DRAG, a.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className={"asset kind-" + a.kind}
            >
              <span className="thumb" aria-hidden="true">
                {a.kind === "image" ? <img src={mediaUrl(a.id)} alt="" loading="lazy" width={64} height={36} /> : a.kind === "video" ? <video src={mediaUrl(a.id) + "#t=1"} preload="metadata" muted width={64} height={36} /> : <Music size={18} />}
              </span>
              <span className="asset-text">
                <strong title={a.name}>{a.name}</strong>
                <small>
                  <Icon aria-hidden="true" size={11} />
                  {length(a)} · {a.width ? `${a.width}×${a.height} · ` : ""}
                  {formatBytes(a.bytes)}
                  {a.sample ? " · 示例" : ""}
                  {used.has(a.id) ? " · 已使用" : ""}
                </small>
              </span>
              <button className="icon" aria-label={"放到播放头：" + a.name} disabled={!mutable} onClick={() => onAdd(a)}>
                <Plus aria-hidden="true" size={15} />
              </button>
              <button className="icon quiet" aria-label={"从素材库移除：" + a.name} disabled={!mutable} onClick={() => onRemove(a)}>
                <Trash2 aria-hidden="true" size={13} />
              </button>
            </li>
          );
        })}
      </ul>
      {timeline.assets.length === 0 ? <p className="empty">素材库是空的。导入一段视频、图片或音乐开始剪辑。</p> : null}
      <div className="panel-head small">
        <h3>文字</h3>
        <button className="ghost" disabled={!mutable} onClick={() => subs.current?.click()}>
          <Captions aria-hidden="true" size={14} />
          导入字幕
        </button>
        <input
          ref={subs}
          hidden
          type="file"
          aria-label="导入 SRT 或 VTT 字幕"
          accept=".srt,.vtt,text/vtt,application/x-subrip"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onSubtitles(f);
          }}
        />
      </div>
      <div className="text-presets">
        {TEXTS.map((t) => (
          <button key={t.preset} className={"preset preset-" + t.preset} disabled={!mutable} onClick={() => onText(t.preset, t.sample)}>
            <Type aria-hidden="true" size={13} />
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
});
