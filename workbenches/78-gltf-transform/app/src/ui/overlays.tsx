import { memo, useMemo, useState } from "react";
import { Box, Pause, Play, X } from "lucide-react";
import type { AssetDocument } from "../contracts/asset";
import type { Inspection } from "../contracts/inspection";
import { formatBytes, PASS_BY_KIND, type PassKind } from "../contracts/pipeline";
import { PASS_ICONS } from "./Pipeline";

/** Spatial before/after: one chip per pipeline stage; the pressed chip is on the canvas. */
export function StageStrip(p: {
  document: AssetDocument;
  valid: number;
  viewIndex: number;
  edited: boolean;
  sourceBytes?: number;
  onPreview: (stage: number) => void;
}) {
  const d = p.document;
  const chips: { index: number; label: string; ok: boolean; bytes?: number; kind?: PassKind }[] = [
    { index: -2, label: "原件", ok: true, bytes: p.sourceBytes },
    ...(p.edited ? [{ index: 0, label: "修订", ok: p.valid > 0, bytes: d.stages[0]?.report.bytes }] : []),
    ...d.passes.map((s, i) => ({
      index: i + 1,
      label: PASS_BY_KIND[s.kind].label,
      ok: i + 1 < p.valid,
      bytes: d.stages[i + 1]?.report.bytes,
      kind: s.kind,
    })),
  ];
  return (
    <ol className="stage-strip" aria-label="流水线阶段">
      {chips.map((c, i) => {
        const Icon = c.kind ? PASS_ICONS[c.kind] : null;
        return (
          <li key={c.index}>
            {i ? (
              <span className="chev" aria-hidden="true">
                ›
              </span>
            ) : null}
            <button
              aria-pressed={p.viewIndex === c.index}
              disabled={!c.ok}
              title={c.bytes ? formatBytes(c.bytes) : "待更新"}
              onClick={() => p.onPreview(c.index)}
            >
              {Icon ? <Icon size={12} aria-hidden="true" /> : null}
              {c.label}
              {!c.ok ? <i aria-label="待更新" /> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Scene hierarchy of the original, filterable for large exports. */
export const NodePalette = memo(function NodePalette(p: {
  document: AssetDocument;
  source: Inspection | null;
  locked: boolean;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const d = p.document,
    [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase(),
      all = p.source?.nodes ?? [];
    return (q ? all.filter((n) => (n.name + " " + n.mesh).toLowerCase().includes(q)) : all).slice(0, 300);
  }, [p.source, query]);
  return (
    <fieldset className="node-palette" disabled={p.locked} aria-label="节点目录">
      <div className="palette-label">
        节点 <span>{p.source?.nodes.length ?? 0}</span>
        <button className="icon-button" aria-label="关闭节点目录" onClick={p.onClose}>
          <X size={14} />
        </button>
      </div>
      <input
        type="search"
        className="node-search"
        name="node-search"
        aria-label="筛选节点"
        placeholder="筛选节点…"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {rows.map((row) => (
        <button
          key={row.index}
          aria-pressed={d.selected === row.index}
          style={{ paddingLeft: 10 + Math.min(row.depth, 8) * 12 }}
          onClick={() => p.onSelect(row.index)}
        >
          <Box size={14} />
          <span>
            {(d.edits.nodes[row.index]?.name ?? row.name) || `节点 ${row.index + 1}`}
            {d.edits.nodes[row.index] ? <i className="change-dot" /> : null}
            <small>
              {row.mesh || "分组"}
              {row.animated ? " · 动画" : ""}
              {row.children ? ` · ${row.children} 子项` : ""}
            </small>
          </span>
        </button>
      ))}
      {(p.source?.nodes.length ?? 0) > rows.length && !query ? (
        <p className="quiet">仅显示前 300 个，输入名称筛选。</p>
      ) : null}
    </fieldset>
  );
});

/** Material swatches taken from the original's base colors. */
export function MaterialShelf(p: {
  document: AssetDocument;
  source: Inspection;
  locked: boolean;
  withInspector: boolean;
  notesMode: boolean;
  onSelect: (index: number, trigger: HTMLElement) => void;
}) {
  const d = p.document;
  return (
    <fieldset
      className={"material-shelf " + (p.withInspector ? "with-inspector" : "")}
      disabled={p.locked}
      aria-label="模型材质"
    >
      <div className="palette-label">
        材质 <span>{p.source.materials.length}</span>
      </div>
      <div className="material-strip">
        {p.source.materials.slice(0, 200).map((row) => (
          <button
            key={row.index}
            aria-pressed={d.selected === row.index && !p.notesMode}
            onClick={(e) => p.onSelect(row.index, e.currentTarget)}
          >
            <span className="swatch" style={{ background: row.color }} />
            <span>{(d.edits.materials[row.index]?.name ?? row.name) || `材质 ${row.index + 1}`}</span>
            {d.edits.materials[row.index] ? <i className="change-dot" /> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Transport for the previewed model's clips; playback never starts on restore. */
export function AnimationBar(p: {
  document: AssetDocument;
  view: Inspection;
  playing: boolean;
  liveTime: number;
  locked: boolean;
  withInspector: boolean;
  onClip: (clip: string) => void;
  onToggle: () => void;
  onSeek: (time: number) => void;
}) {
  const d = p.document,
    info = p.view.animations[Number(d.clip) || 0],
    duration = info?.duration || 1,
    time = p.playing ? p.liveTime % duration : Math.min(d.time, duration);
  return (
    <div className={"animation-controls " + (p.withInspector ? "with-inspector" : "")}>
      <select
        aria-label="检查动画"
        name="animation-clip"
        value={String(Number(d.clip) || 0)}
        onChange={(e) => p.onClip(e.target.value)}
        disabled={p.locked}
      >
        {p.view.animations.map((clip, i) => (
          <option key={i} value={i}>
            {clip.name}
          </option>
        ))}
      </select>
      <button
        className="icon-button"
        disabled={p.locked}
        aria-label={p.playing ? "暂停动画" : "播放动画"}
        onClick={p.onToggle}
      >
        {p.playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <input
        aria-label="动画位置"
        name="animation-time"
        type="range"
        min="0"
        max={duration}
        step="0.01"
        value={time}
        onChange={(e) => p.onSeek(Number(e.target.value))}
        disabled={p.locked}
      />
      <span className="clip-time">
        {time.toFixed(2)} / {(info?.duration ?? 0).toFixed(2)} s
      </span>
    </div>
  );
}
