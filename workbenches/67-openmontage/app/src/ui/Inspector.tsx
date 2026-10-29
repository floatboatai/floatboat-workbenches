// ABOUTME: 检查器：选中片段的时间、画面、声音、转场与文字样式；选中轨道的设置；未选中时为影片设置。
import { memo, useState } from "react";
import { Blend, Copy, Scissors, Trash2 } from "lucide-react";
import { clipEnd, FPS_CHOICES, MAX_TIMELINE, MIN_CLIP, PRESETS, type Clip, type Motion, type TextPreset, type Timeline, type Track } from "../contracts/timeline";
import { overlapWithPrevious, previousOnTrack } from "../contracts/edit";
import { NumberField, Slider } from "./fields";

export const FRAMES = [
  { label: "16:9 · 1280×720", width: 1280, height: 720 },
  { label: "16:9 · 1920×1080", width: 1920, height: 1080 },
  { label: "9:16 竖屏 · 720×1280", width: 720, height: 1280 },
  { label: "1:1 方形 · 1080×1080", width: 1080, height: 1080 },
  { label: "4:3 · 960×720", width: 960, height: 720 },
];
const MOTIONS: { value: Motion; label: string }[] = [
  { value: "none", label: "静止" },
  { value: "zoom-in", label: "缓慢推近" },
  { value: "zoom-out", label: "缓慢拉远" },
  { value: "pan-left", label: "向左平移" },
  { value: "pan-right", label: "向右平移" },
];
const PRESET_LABEL: Record<TextPreset, string> = { title: "大标题", lower: "下方字条", subtitle: "字幕", caption: "角标" };

type Actions = {
  patchClip: (id: string, patch: Partial<Clip>, key?: string) => void;
  patchTrack: (id: string, patch: Partial<Track>, key?: string) => void;
  patchTimeline: (patch: Partial<Timeline>, key?: string) => void;
  crossfade: (id: string, seconds: number) => void;
  split: () => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  removeTrack: (id: string) => void;
};

function ClipInspector({ t, c, a, mutable }: { t: Timeline; c: Clip; a: Actions; mutable: boolean }) {
  const asset = c.assetId ? t.assets.find((x) => x.id === c.assetId) ?? null : null;
  const track = t.tracks.find((k) => k.id === c.trackId);
  const [cross, setCross] = useState(1);
  const prev = previousOnTrack(t, c);
  const overlap = overlapWithPrevious(t, c);
  const max = asset?.duration ?? MAX_TIMELINE;
  const p = (patch: Partial<Clip>, key?: string) => a.patchClip(c.id, patch, key);
  return (
    <fieldset className="inspector-body" disabled={!mutable}>
      <legend className="sr-only">片段属性</legend>
      <p className="inspector-kind">
        {asset ? { video: "视频片段", image: "图片片段", audio: "音频片段" }[asset.kind] : "文字片段"} · {track?.name}
      </p>
      {asset ? <h3 title={asset.name}>{asset.name}</h3> : null}
      {c.style ? (
        <section className="group">
          <label className="field">
            文字内容
            <textarea name="clip-text" rows={3} value={c.text} onChange={(e) => p({ text: e.target.value }, "text:" + c.id)} />
          </label>
          <div className="field-row">
            <label className="field">
              样式
              <select
                value={c.style.preset}
                onChange={(e) => {
                  const preset = e.target.value as TextPreset;
                  p({ style: { ...PRESETS[preset] } });
                }}
              >
                {(Object.keys(PRESETS) as TextPreset[]).map((k) => (
                  <option key={k} value={k}>
                    {PRESET_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field color">
              颜色
              <input type="color" value={c.style.color} onChange={(e) => p({ style: { ...c.style!, color: e.target.value } }, "color:" + c.id)} />
            </label>
          </div>
          <Slider label="字号" value={c.style.size} min={12} max={160} step={1} format={(v) => v + " px"} onChange={(v) => p({ style: { ...c.style!, size: v } }, "size:" + c.id)} />
          <Slider label="垂直位置" value={c.style.y} min={0} max={1} step={0.01} format={(v) => Math.round(v * 100) + "%"} onChange={(v) => p({ style: { ...c.style!, y: v } }, "y:" + c.id)} />
          <div className="segmented" role="group" aria-label="对齐">
            {(["left", "center", "right"] as const).map((al) => (
              <button key={al} aria-pressed={c.style!.align === al} onClick={() => p({ style: { ...c.style!, align: al } })}>
                {{ left: "左", center: "中", right: "右" }[al]}
              </button>
            ))}
            <button aria-pressed={c.style.bold} onClick={() => p({ style: { ...c.style!, bold: !c.style!.bold } })}>
              粗体
            </button>
            <button aria-pressed={c.style.box} onClick={() => p({ style: { ...c.style!, box: !c.style!.box } })}>
              底衬
            </button>
          </div>
        </section>
      ) : null}
      <section className="group">
        <h4>时间</h4>
        <div className="field-row">
          <NumberField label="起点" value={c.start} min={0} max={MAX_TIMELINE} onCommit={(v) => p({ start: v })} />
          <NumberField label="时长" value={c.duration} min={MIN_CLIP} max={Math.max(MIN_CLIP, max - c.in)} onCommit={(v) => p({ duration: v })} />
        </div>
        {asset?.duration != null ? (
          <div className="field-row">
            <NumberField label="素材入点" value={c.in} min={0} max={Math.max(0, asset.duration - c.duration)} onCommit={(v) => p({ in: v })} />
            <p className="readout">
              出点 {(c.in + c.duration).toFixed(2)} 秒<small>素材共 {asset.duration.toFixed(2)} 秒</small>
            </p>
          </div>
        ) : null}
        <p className="readout">结束于 {clipEnd(c).toFixed(2)} 秒</p>
      </section>
      {asset && asset.kind !== "audio" ? (
        <section className="group">
          <h4>画面</h4>
          <div className="field-row">
            <label className="field">
              适配
              <select value={c.fit} onChange={(e) => p({ fit: e.target.value as Clip["fit"] })}>
                <option value="cover">填满画面</option>
                <option value="contain">完整显示</option>
              </select>
            </label>
            <label className="field">
              运动
              <select value={c.motion} onChange={(e) => p({ motion: e.target.value as Motion })}>
                {MOTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}
      {asset && (asset.kind === "audio" || asset.hasAudio) ? (
        <section className="group">
          <h4>声音</h4>
          <Slider label="片段音量" value={c.volume} onChange={(v) => p({ volume: v }, "volume:" + c.id)} />
        </section>
      ) : asset?.kind === "video" ? (
        <p className="readout">这个视频没有声音轨。</p>
      ) : null}
      <section className="group">
        <h4>转场</h4>
        <div className="field-row">
          <NumberField label="淡入" value={c.fadeIn} min={0} max={c.duration} onCommit={(v) => p({ fadeIn: v })} />
          <NumberField label="淡出" value={c.fadeOut} min={0} max={c.duration} onCommit={(v) => p({ fadeOut: v })} />
        </div>
        {overlap > 0 ? <p className="readout">与上一段交叉溶解 {overlap.toFixed(2)} 秒</p> : null}
        <div className="crossfade">
          <label className="sr-only" htmlFor="cross-len">
            交叉溶解秒数
          </label>
          <select id="cross-len" value={cross} onChange={(e) => setCross(Number(e.target.value))}>
            {[0.5, 1, 1.5, 2].map((s) => (
              <option key={s} value={s}>
                {s} 秒
              </option>
            ))}
          </select>
          <button onClick={() => a.crossfade(c.id, cross)} aria-describedby={prev ? undefined : "cross-hint"}>
            <Blend aria-hidden="true" size={14} />与上一段交叉溶解
          </button>
        </div>
        {prev ? null : (
          <small className="hint" id="cross-hint">
            同轨前面没有片段时，用“淡入”从黑场进入。
          </small>
        )}
      </section>
      <label className="field">
        剪辑备注
        <textarea name="clip-note" rows={2} value={c.note} onChange={(e) => p({ note: e.target.value }, "note:" + c.id)} />
      </label>
      <div className="inspector-actions">
        <button onClick={a.split}>
          <Scissors aria-hidden="true" size={14} />
          在播放头分割
        </button>
        <button onClick={() => a.duplicate(c.id)}>
          <Copy aria-hidden="true" size={14} />
          复制到轨尾
        </button>
        <button className="danger" onClick={() => a.remove(c.id)}>
          <Trash2 aria-hidden="true" size={14} />
          删除
        </button>
      </div>
    </fieldset>
  );
}

function TrackInspector({ t, k, a, mutable }: { t: Timeline; k: Track; a: Actions; mutable: boolean }) {
  const count = t.clips.filter((c) => c.trackId === k.id).length;
  return (
    <fieldset className="inspector-body" disabled={!mutable}>
      <legend className="sr-only">轨道设置</legend>
      <p className="inspector-kind">{{ video: "画面轨", audio: "音频轨", text: "文字轨" }[k.kind]} · {count} 个片段</p>
      <label className="field">
        轨道名称
        <input name="track-name" autoComplete="off" value={k.name} maxLength={40} onChange={(e) => a.patchTrack(k.id, { name: e.target.value }, "track:" + k.id)} />
      </label>
      {k.kind !== "text" ? <Slider label="轨道音量" value={k.volume} onChange={(v) => a.patchTrack(k.id, { volume: v }, "tv:" + k.id)} /> : null}
      <label className="check">
        <input type="checkbox" checked={k.muted} onChange={(e) => a.patchTrack(k.id, { muted: e.target.checked })} />
        {k.kind === "audio" ? "静音" : k.kind === "video" ? "关闭此轨（画面与声音）" : "隐藏此轨"}
      </label>
      <p className="hint">{k.kind === "video" ? "列表中靠上的画面轨叠在上层。" : k.kind === "text" ? "文字轨总在画面之上。" : "音频轨与视频自带声音一起混音。"}</p>
      <div className="inspector-actions">
        <button className="danger" onClick={() => a.removeTrack(k.id)}>
          <Trash2 aria-hidden="true" size={14} />
          删除轨道及其片段
        </button>
      </div>
    </fieldset>
  );
}

function FilmInspector({ t, a, mutable }: { t: Timeline; a: Actions; mutable: boolean }) {
  const frame = FRAMES.findIndex((f) => f.width === t.settings.width && f.height === t.settings.height);
  return (
    <fieldset className="inspector-body" disabled={!mutable}>
      <legend className="sr-only">影片设置</legend>
      <p className="inspector-kind">影片设置</p>
      <label className="field">
        画幅
        <select
          value={frame < 0 ? "custom" : String(frame)}
          onChange={(e) => {
            const f = FRAMES[Number(e.target.value)];
            if (f) a.patchTimeline({ settings: { ...t.settings, width: f.width, height: f.height } });
          }}
        >
          {frame < 0 ? <option value="custom">{t.settings.width}×{t.settings.height}</option> : null}
          {FRAMES.map((f, i) => (
            <option key={f.label} value={i}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          帧率
          <select value={t.settings.fps} onChange={(e) => a.patchTimeline({ settings: { ...t.settings, fps: Number(e.target.value) } })}>
            {FPS_CHOICES.map((f) => (
              <option key={f} value={f}>
                {f} fps
              </option>
            ))}
          </select>
        </label>
        <label className="field color">
          底色
          <input type="color" value={t.settings.background} onChange={(e) => a.patchTimeline({ settings: { ...t.settings, background: e.target.value } }, "bg")} />
        </label>
      </div>
      <label className="field">
        影片说明
        <textarea name="brief" rows={5} value={t.brief} placeholder="写下这条片子的用途、节奏和交片要求。" onChange={(e) => a.patchTimeline({ brief: e.target.value }, "brief")} />
      </label>
      <p className="hint">选中时间线上的片段或轨道名称，可在这里调整它。快捷键：空格播放，S 分割，Delete 删除，←/→ 逐帧，⌘/Ctrl+Z 撤销。</p>
    </fieldset>
  );
}

export const Inspector = memo(function Inspector({ timeline, clipId, trackId, actions, mutable }: { timeline: Timeline; clipId: string | null; trackId: string | null; actions: Actions; mutable: boolean }) {
  const clip = clipId ? timeline.clips.find((c) => c.id === clipId) : undefined;
  const track = !clip && trackId ? timeline.tracks.find((k) => k.id === trackId) : undefined;
  return (
    <aside className="inspector" aria-label="检查器">
      <div className="panel-head">
        <h2>{clip ? "片段" : track ? "轨道" : "影片"}</h2>
      </div>
      {clip ? <ClipInspector key={clip.id} t={timeline} c={clip} a={actions} mutable={mutable} /> : track ? <TrackInspector t={timeline} k={track} a={actions} mutable={mutable} /> : <FilmInspector t={timeline} a={actions} mutable={mutable} />}
    </aside>
  );
});
export type InspectorActions = Actions;
