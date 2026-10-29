// ABOUTME: 舞台/缩略图 HTML 渲染器的排版样式。幻灯片可能被放进按钮等会改变继承样式的容器（缩略图就在 <button> 里，默认居中、不换行），
// 因此画布根节点与每个文字图元都显式声明对齐、换行、字重与字距，与 PPTX/PDF 渲染器的左对齐逐行排版一致。
import type { CSSProperties } from "react";
import type { ListPrim, TextPrim } from "../shared/geometry.ts";

export const PPI = 96;
export const px = (inch: number) => inch * PPI;
export const ptPx = (pt: number) => (pt * PPI) / 72;

/** Resets every inherited text property that could leak in from the host element. */
export const CANVAS_RESET: CSSProperties = {
  textAlign: "left",
  whiteSpace: "normal",
  fontWeight: 400,
  fontStyle: "normal",
  letterSpacing: "normal",
  wordSpacing: "normal",
  textTransform: "none",
  textIndent: 0,
  direction: "ltr",
};

export function textStyle(p: TextPrim, family: string): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: p.valign === "top" ? "flex-start" : p.valign === "middle" ? "center" : "flex-end",
    textAlign: p.align,
    whiteSpace: "normal",
    color: `#${p.color}`,
    fontFamily: family,
    fontSize: ptPx(p.size),
    fontWeight: p.bold ? 700 : 400,
    fontStyle: p.italic ? "italic" : "normal",
    lineHeight: p.lh,
  };
}

/** Bulleted lists are left-aligned with a hanging indent in all renderers (PPTX marL/indent, canvas x + indent). */
export function listStyle(p: ListPrim, family: string): CSSProperties {
  return {
    color: `#${p.color}`,
    fontFamily: family,
    fontSize: ptPx(p.size),
    fontWeight: 400,
    fontStyle: "normal",
    lineHeight: p.lh,
    textAlign: "left",
    whiteSpace: "normal",
    listStyle: "none",
    margin: 0,
    padding: 0,
  };
}
