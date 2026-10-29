// ABOUTME: 时间线工具条：分割、删除、吸附、缩放与添加轨道。
import { Magnet, Minus, Plus, Scissors, Trash2, ZoomIn } from "lucide-react";
import type { TrackKind } from "../contracts/timeline";

export function TimelineToolbar({ mutable, canDelete, snapping, onSplit, onDelete, onSnap, onZoom, onFit, onAddTrack }: { mutable: boolean; canDelete: boolean; snapping: boolean; onSplit: () => void; onDelete: () => void; onSnap: () => void; onZoom: (factor: number) => void; onFit: () => void; onAddTrack: (k: TrackKind) => void }) {
  return (
    <div className="tl-toolbar" role="toolbar" aria-label="时间线工具">
      <button disabled={!mutable} onClick={onSplit}>
        <Scissors aria-hidden="true" size={14} />
        分割<kbd>S</kbd>
      </button>
      <button disabled={!mutable || !canDelete} onClick={onDelete}>
        <Trash2 aria-hidden="true" size={14} />
        删除
      </button>
      <button aria-pressed={snapping} onClick={onSnap}>
        <Magnet aria-hidden="true" size={14} />
        吸附
      </button>
      <span className="zoom" role="group" aria-label="缩放">
        <button className="icon" aria-label="缩小时间线" onClick={() => onZoom(1 / 1.4)}>
          <Minus aria-hidden="true" size={14} />
        </button>
        <button className="icon" aria-label="放大时间线" onClick={() => onZoom(1.4)}>
          <Plus aria-hidden="true" size={14} />
        </button>
        <button onClick={onFit}>
          <ZoomIn aria-hidden="true" size={14} />
          适合
        </button>
      </span>
      <span className="add-track" role="group" aria-label="添加轨道">
        <span>加轨</span>
        {(
          [
            ["video", "画面"],
            ["audio", "音频"],
            ["text", "文字"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} disabled={!mutable} onClick={() => onAddTrack(k)}>
            {label}
          </button>
        ))}
      </span>
    </div>
  );
}
