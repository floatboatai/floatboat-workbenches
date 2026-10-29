// ABOUTME: 谱面上沿工具条：光标与回放、缩放、版式、移调、显示内容和导出。
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Eye, Minus, Pause, Play, Plus } from "lucide-react";
import { LAYOUTS, ZOOM_MAX, ZOOM_MIN, type Layout, type ViewSettings } from "../contracts/domain";
import type { PartInfo } from "../contracts/musicxml";
import { Menu } from "./Menu";

export type ExportKind = "pdf" | "png" | "svg" | "json" | "original" | "musicxml";

const clampZoom = (value: number) => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 20) / 20;
const transposeLabel = (value: number) => (value === 0 ? "原调" : `${value > 0 ? "+" : "−"}${Math.abs(value)} 半音`);

export function ScoreToolbar({
  view,
  parts,
  ready,
  playing,
  canPlay,
  exporting,
  mxl,
  onView,
  onStep,
  onMeasure,
  onPlay,
  onFit,
  onExport,
}: {
  view: ViewSettings;
  parts: PartInfo[];
  ready: boolean;
  playing: boolean;
  canPlay: boolean;
  exporting: string;
  mxl: boolean;
  onView: (patch: Partial<ViewSettings>) => void;
  onStep: (direction: 1 | -1) => void;
  onMeasure: (direction: 1 | -1) => void;
  onPlay: () => void;
  onFit: () => void;
  onExport: (kind: ExportKind) => void;
}) {
  const visible = parts.length - view.hiddenParts.length;
  return (
    <div className="score-toolbar" role="toolbar" aria-label="谱面工具">
      <div className="tool-group transport" aria-label="光标与回放">
        <button type="button" className="icon" aria-label="上一小节" title="上一小节（Shift+←）" disabled={!ready} onClick={() => onMeasure(-1)}>
          <ChevronsLeft aria-hidden="true" size={17} />
        </button>
        <button type="button" className="icon" aria-label="光标后退一个音" title="上一个音（←）" disabled={!ready} onClick={() => onStep(-1)}>
          <ChevronLeft aria-hidden="true" size={17} />
        </button>
        <button
          type="button"
          className={`play ${playing ? "on" : ""}`}
          aria-pressed={playing}
          disabled={!ready || !canPlay}
          title={canPlay ? "从光标处回放（空格）" : "浏览器不支持 Web Audio"}
          onClick={onPlay}
        >
          {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
          {playing ? "暂停" : "回放"}
        </button>
        <button type="button" className="icon" aria-label="光标前进一个音" title="下一个音（→）" disabled={!ready} onClick={() => onStep(1)}>
          <ChevronRight aria-hidden="true" size={17} />
        </button>
        <button type="button" className="icon" aria-label="下一小节" title="下一小节（Shift+→）" disabled={!ready} onClick={() => onMeasure(1)}>
          <ChevronsRight aria-hidden="true" size={17} />
        </button>
        <label className="tempo">
          <span>速度</span>
          <select name="tempo" value={view.tempo} onChange={(event) => onView({ tempo: Number(event.target.value) })}>
            {[50, 75, 100, 125, 150].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tool-group" aria-label="缩放">
        <button type="button" className="icon" aria-label="缩小" disabled={view.zoom <= ZOOM_MIN} onClick={() => onView({ zoom: clampZoom(view.zoom - 0.1) })}>
          <Minus aria-hidden="true" size={16} />
        </button>
        <button type="button" className="zoom-value" title="适合宽度" onClick={onFit}>
          {Math.round(view.zoom * 100)}%
        </button>
        <button type="button" className="icon" aria-label="放大" disabled={view.zoom >= ZOOM_MAX} onClick={() => onView({ zoom: clampZoom(view.zoom + 0.1) })}>
          <Plus aria-hidden="true" size={16} />
        </button>
      </div>
      <label className="tool-group layout-select">
        <span className="sr-only">版式</span>
        <select name="layout" aria-label="版式" value={view.layout} onChange={(event) => onView({ layout: event.target.value as Layout })}>
          {Object.entries(LAYOUTS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="tool-group" aria-label="移调">
        <button type="button" className="icon" aria-label="向下移调一个半音" disabled={view.transpose <= -12} onClick={() => onView({ transpose: view.transpose - 1 })}>
          <Minus aria-hidden="true" size={16} />
        </button>
        <span className="transpose-value" aria-live="polite">
          移调 {transposeLabel(view.transpose)}
        </span>
        <button type="button" className="icon" aria-label="向上移调一个半音" disabled={view.transpose >= 12} onClick={() => onView({ transpose: view.transpose + 1 })}>
          <Plus aria-hidden="true" size={16} />
        </button>
      </div>
      <Menu label={`声部 ${visible}/${parts.length}`} icon={<Eye aria-hidden="true" size={16} />} className="display-menu">
        {() => (
          <div className="display-panel">
            <fieldset>
              <legend>声部</legend>
              {parts.map((part) => {
                const shown = !view.hiddenParts.includes(part.id);
                return (
                  <label key={part.id} className="check">
                    <input
                      type="checkbox"
                      checked={shown}
                      disabled={shown && visible === 1}
                      onChange={() =>
                        onView({ hiddenParts: shown ? [...view.hiddenParts, part.id] : view.hiddenParts.filter((id) => id !== part.id) })
                      }
                    />
                    <span translate="no">{part.name}</span>
                    {part.staves > 1 ? <small>{part.staves} 行谱表</small> : null}
                  </label>
                );
              })}
              {parts.length > 1 ? (
                <div className="part-shortcuts">
                  <button type="button" onClick={() => onView({ hiddenParts: [] })}>
                    全部显示
                  </button>
                </div>
              ) : null}
            </fieldset>
            <fieldset>
              <legend>谱面内容</legend>
              <label>
                小节号
                <select name="measureNumbers" value={view.measureNumbers} onChange={(event) => onView({ measureNumbers: event.target.value as ViewSettings["measureNumbers"] })}>
                  <option value="system">每行开头</option>
                  <option value="every">每小节</option>
                  <option value="off">不显示</option>
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={view.credits} onChange={(event) => onView({ credits: event.target.checked })} />
                标题与作曲信息
              </label>
              <label className="check">
                <input type="checkbox" checked={view.partNames} onChange={(event) => onView({ partNames: event.target.checked })} />
                声部名称
              </label>
            </fieldset>
          </div>
        )}
      </Menu>
      <Menu label={exporting || "导出"} icon={<Download aria-hidden="true" size={16} />} className="export-menu" align="end" disabled={!!exporting}>
        {(close) => (
          <ul className="export-list">
            {(
              [
                ["pdf", "PDF 校样（含批注与清单）", !ready],
                ["png", "PNG 当前页（含批注）", !ready],
                ["svg", "SVG 全部页（含批注）", !ready],
                ["json", "批注 JSON", false],
                ["original", "原文件（逐字节）", false],
                ...(mxl ? ([["musicxml", "展开的 MusicXML", false]] as const) : []),
              ] as const
            ).map(([kind, label, disabled]) => (
              <li key={kind}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    close();
                    onExport(kind);
                  }}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Menu>
    </div>
  );
}
