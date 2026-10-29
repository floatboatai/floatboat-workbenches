// ABOUTME: 暗室主题的画布颜色：节点、控件与按数据类型着色的插槽和连线。

import { LGraphCanvas, LiteGraph } from "@comfyorg/litegraph";

/** Link / slot colours by ComfyUI data type (original palette for this workbench). */
export const TYPE_COLORS: Record<string, string> = {
  MODEL: "#a99cf0",
  CLIP: "#f2cf5b",
  VAE: "#ef7b7b",
  LATENT: "#e28ad6",
  CONDITIONING: "#f0a14e",
  IMAGE: "#6fb4ee",
  MASK: "#7fcf8f",
  CONTROL_NET: "#42cfa0",
  CLIP_VISION: "#c9a0dc",
  CLIP_VISION_OUTPUT: "#a8ccd8",
  STYLE_MODEL: "#d4b483",
  UPSCALE_MODEL: "#8fd0d6",
  GLIGEN: "#e0a1a1",
  SAMPLER: "#d9894b",
  SIGMAS: "#9cc7a8",
  NOISE: "#b7b7b7",
  GUIDER: "#8fb5e8",
  INT: "#8fc3a6",
  FLOAT: "#b3c78a",
  STRING: "#d6b98f",
  BOOLEAN: "#d99191",
  COMBO: "#9aa7bd",
  "*": "#98a2b3",
};

export function typeColor(type: string): string {
  return TYPE_COLORS[String(type).split(",")[0].toUpperCase()] ?? "#98a2b3";
}

/** Configures the global litegraph theme. Safe to call repeatedly. */
export function applyTheme(): void {
  const L = LiteGraph;
  L.NODE_DEFAULT_COLOR = "#2b3140";
  L.NODE_DEFAULT_BGCOLOR = "#1f2430";
  L.NODE_DEFAULT_BOXCOLOR = "#7c879c";
  L.NODE_TITLE_COLOR = "#d6dbe6";
  L.NODE_SELECTED_TITLE_COLOR = "#ffffff";
  L.NODE_TEXT_COLOR = "#aab3c5";
  L.NODE_SUBTEXT_SIZE = 11;
  L.NODE_TEXT_SIZE = 13;
  L.NODE_TITLE_HEIGHT = 28;
  L.NODE_SLOT_HEIGHT = 22;
  L.NODE_WIDGET_HEIGHT = 24;
  L.NODE_WIDTH = 190;
  L.WIDGET_BGCOLOR = "#12151c";
  L.WIDGET_OUTLINE_COLOR = "#343b4c";
  L.WIDGET_TEXT_COLOR = "#dbe0ea";
  L.WIDGET_SECONDARY_TEXT_COLOR = "#8993a8";
  L.LINK_COLOR = "#8993a8";
  L.CONNECTING_LINK_COLOR = "#f0b24a";
  L.DEFAULT_SHADOW_COLOR = "rgba(0,0,0,0.45)";
  L.saveViewportWithGraph = true;
  L.alt_drag_do_clone_nodes = true;
  L.release_link_on_empty_shows_menu = false;
  const fonts = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Noto Sans CJK SC", sans-serif';
  L.DEFAULT_FONT = fonts;
  for (const [type, color] of Object.entries(TYPE_COLORS)) {
    LGraphCanvas.link_type_colors[type] = color;
  }
}
