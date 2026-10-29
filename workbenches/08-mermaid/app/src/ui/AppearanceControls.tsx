// ABOUTME: 预览工具条中的图类型、主题、风格与缩放控件；主题和风格按文件保存。
import type { RefObject } from "react";
import {
  LOOKS,
  LOOK_LABELS,
  THEMES,
  THEME_LABELS,
  type Look,
  type Theme,
} from "../contracts/model";
import type { PreviewHandle } from "./Preview";

export function AppearanceControls({
  type,
  theme,
  look,
  directiveTheme,
  zoom,
  onTheme,
  onLook,
  preview,
}: {
  type: string;
  theme: Theme;
  look: Look;
  directiveTheme: boolean;
  zoom: number;
  onTheme: (value: Theme) => void;
  onLook: (value: Look) => void;
  preview: RefObject<PreviewHandle | null>;
}) {
  return (
    <>
      <span className="type-badge">{type}</span>
      <label className="select">
        <span>主题</span>
        <select
          name="theme"
          value={theme}
          title={directiveTheme ? "源码中的主题设置优先于此处" : undefined}
          onChange={(event) => onTheme(event.target.value as Theme)}
        >
          {THEMES.map((value) => (
            <option key={value} value={value}>
              {THEME_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="select">
        <span>风格</span>
        <select
          name="look"
          value={look}
          onChange={(event) => onLook(event.target.value as Look)}
        >
          {LOOKS.map((value) => (
            <option key={value} value={value}>
              {LOOK_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <div className="zoom" role="group" aria-label="缩放">
        <button
          type="button"
          aria-label="缩小"
          onClick={() => preview.current?.zoomOut()}
        >
          −
        </button>
        <button
          type="button"
          className="zoom-value"
          aria-label="按 100% 显示"
          title="按 100% 显示"
          onClick={() => preview.current?.actual()}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="放大"
          onClick={() => preview.current?.zoomIn()}
        >
          +
        </button>
        <button type="button" onClick={() => preview.current?.fit()}>
          适应
        </button>
      </div>
    </>
  );
}
