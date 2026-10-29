// ABOUTME: 从内置渲染的 DOM 量取实际布局，生成独立 SVG（矩形/路径/文字），并可栅格化为 PNG。
import { childrenOf, type FigDocument, type FigNode } from "../contracts/figdoc";
import {
  cornerRadii,
  ellipsePath,
  gradientOf,
  networkPath,
  rgba,
  shadows,
  strokeLook,
  textLook,
  visiblePaints,
} from "../contracts/paint";
import type { Overrides } from "./ProofCanvas";

const r3 = (v: number) => String(Math.round(v * 100) / 100);
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
/** rgba() → SVG 1.1 兼容的颜色与透明度。 */
function svgColor(css: string): { color: string; opacity: number } {
  const m = /rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)/.exec(css.replace(/\s/g, ""));
  if (!m) return { color: css, opacity: 1 };
  const hex = (v: string) => Math.round(Number(v)).toString(16).padStart(2, "0");
  return { color: `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`, opacity: m[4] === undefined ? 1 : Number(m[4]) };
}
const paintAttr = (attr: "fill" | "stroke" | "stop", css: string) => {
  const c = svgColor(css);
  const name = attr === "stop" ? "stop-color" : attr;
  return `${name}="${c.color}"${c.opacity < 1 ? ` ${attr === "stop" ? "stop" : attr}-opacity="${r3(c.opacity)}"` : ""}`;
};
function roundedRect(x: number, y: number, w: number, h: number, r: [number, number, number, number]): string {
  const lim = Math.min(w, h) / 2;
  const [a, b, c, d] = r.map((v) => Math.min(v, lim));
  return `M${r3(x + a)} ${r3(y)}H${r3(x + w - b)}${b ? `A${r3(b)} ${r3(b)} 0 0 1 ${r3(x + w)} ${r3(y + b)}` : ""}V${r3(y + h - c)}${c ? `A${r3(c)} ${r3(c)} 0 0 1 ${r3(x + w - c)} ${r3(y + h)}` : ""}H${r3(x + d)}${d ? `A${r3(d)} ${r3(d)} 0 0 1 ${r3(x)} ${r3(y + h - d)}` : ""}V${r3(y + a)}${a ? `A${r3(a)} ${r3(a)} 0 0 1 ${r3(x + a)} ${r3(y)}` : ""}Z`;
}
function solidFills(hex: string) {
  return [{ type: "solid", visible: true, opacity: 1, color: { r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255, a: 1 } }];
}

export function frameToSvg(root: HTMLElement, doc: FigDocument, frame: FigNode, overrides: Overrides): string {
  const scale = Number(root.dataset.scale) || 1;
  const origin = root.getBoundingClientRect();
  const elements = new Map<number, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-node]").forEach((el) => elements.set(Number(el.dataset.node), el));
  const defs: string[] = [];
  let uid = 0;
  const box = (el: HTMLElement) => {
    const b = el.getBoundingClientRect();
    return { x: (b.left - origin.left) / scale, y: (b.top - origin.top) / scale, w: b.width / scale, h: b.height / scale };
  };
  const paintRef = (paint: Record<string, unknown> & { type: string }): string | null => {
    if (paint.type === "solid") return paintAttr("fill", rgba(paint.color, typeof paint.opacity === "number" ? paint.opacity : 1));
    const g = gradientOf(paint);
    if (!g) return null;
    const id = `g${++uid}`;
    const stops = g.stops.map((s) => `<stop offset="${r3(s.offset)}" ${paintAttr("stop", s.color)}/>`).join("");
    defs.push(
      g.kind === "linear"
        ? `<linearGradient id="${id}" x1="${r3(g.from[0])}" y1="${r3(g.from[1])}" x2="${r3(g.to[0])}" y2="${r3(g.to[1])}">${stops}</linearGradient>`
        : `<radialGradient id="${id}" cx="${r3(g.from[0])}" cy="${r3(g.from[1])}" r="0.5">${stops}</radialGradient>`,
    );
    return `fill="url(#${id})"`;
  };
  const shadowFilter = (node: FigNode): string => {
    const list = shadows(node).filter((s) => !s.inset);
    if (!list.length) return "";
    const id = `f${++uid}`;
    defs.push(
      `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${list
        .map((s) => {
          const c = svgColor(s.color);
          return `<feDropShadow dx="${r3(s.x)}" dy="${r3(s.y)}" stdDeviation="${r3(s.blur / 2)}" flood-color="${c.color}" flood-opacity="${r3(c.opacity)}"/>`;
        })
        .join("")}</filter>`,
    );
    return ` filter="url(#${id})"`;
  };
  const textOut = (node: FigNode, el: HTMLElement, fills: FigNode["fills"]): string => {
    const span = el.querySelector<HTMLElement>(".pn-text");
    const textNode = span?.firstChild;
    if (!span || !textNode || textNode.nodeType !== Node.TEXT_NODE) return "";
    const raw = textNode.textContent ?? "";
    const look = textLook({ ...node, fills: fills as FigNode["fills"] });
    const lines: { top: number; height: number; x: number; text: string }[] = [];
    const range = document.createRange();
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "\n" || ch === "​") continue;
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect) continue;
      const top = (rect.top - origin.top) / scale,
        x = (rect.left - origin.left) / scale;
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.top - top) < look.fontSize * 0.4) {
        last.text += ch;
        last.x = Math.min(last.x, x);
      } else lines.push({ top, height: rect.height / scale, x, text: ch });
    }
    const cased = (s: string) =>
      look.textTransform === "uppercase" ? s.toUpperCase() : look.textTransform === "lowercase" ? s.toLowerCase() : look.textTransform === "capitalize" ? s.replace(/\b\p{L}/gu, (m) => m.toUpperCase()) : s;
    const weight = look.fontWeight,
      family = look.fontFamily.replace(/"/g, "'");
    return lines
      .filter((l) => l.text.trim())
      .map(
        (l) =>
          `<text x="${r3(l.x)}" y="${r3(l.top + l.height * 0.8)}" font-family="${esc(family)}" font-size="${r3(look.fontSize)}" font-weight="${weight}"${look.fontStyle === "italic" ? ' font-style="italic"' : ""}${look.letterSpacing !== "0em" && look.letterSpacing !== "0px" ? ` letter-spacing="${esc(look.letterSpacing)}"` : ""}${look.textDecoration ? ` text-decoration="${look.textDecoration}"` : ""} ${paintAttr("fill", look.color)} xml:space="preserve">${esc(cased(l.text.replace(/\s+$/, "")))}</text>`,
      )
      .join("");
  };
  const emit = (node: FigNode, isRoot: boolean): string => {
    const el = elements.get(node.id);
    if (!el || node.visible === false) return "";
    const b = isRoot ? { x: 0, y: 0, w: node.width, h: node.height } : box(el);
    const fills: FigNode["fills"] = overrides.fills[node.id] ? solidFills(overrides.fills[node.id]) : node.fills;
    const out: string[] = [];
    if (node.type === "text") return wrap(node, textOut(node, el, fills));
    if (["vector", "ellipse", "polygon", "star", "line", "arrow"].includes(node.type)) {
      const sx = node.width ? b.w / node.width : 1,
        sy = node.height ? b.h / node.height : 1;
      let fillD = "",
        strokeD = "",
        rule = "nonzero";
      if (node.type === "vector") {
        const p = networkPath(node);
        fillD = p.fill || p.stroke;
        strokeD = p.stroke;
        rule = p.rule;
      } else if (node.type === "ellipse") {
        const rx = node.width / 2,
          ry = node.height / 2;
        fillD = strokeD =
          ellipsePath(node) ?? `M0 ${r3(ry)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(node.width)} ${r3(ry)}A${r3(rx)} ${r3(ry)} 0 1 0 0 ${r3(ry)}Z`;
      } else if (node.type === "line" || node.type === "arrow") strokeD = `M0 0L${r3(node.width)} 0`;
      else {
        const shape = el.querySelector("svg path");
        fillD = strokeD = shape?.getAttribute("d") ?? "";
      }
      const tf = `transform="translate(${r3(b.x)} ${r3(b.y)})${sx !== 1 || sy !== 1 ? ` scale(${r3(sx)} ${r3(sy)})` : ""}"`;
      const filter = shadowFilter(node);
      for (const paint of visiblePaints(fills)) {
        const ref = paintRef(paint);
        if (ref && fillD) out.push(`<path ${tf} d="${fillD}" ${ref} fill-rule="${rule}"${filter}/>`);
      }
      const stroke = strokeLook(node);
      if (stroke && strokeD)
        out.push(
          `<path ${tf} d="${strokeD}" fill="none" ${paintAttr("stroke", stroke.color)} stroke-width="${r3(stroke.weight)}" stroke-linecap="${stroke.cap}" stroke-linejoin="${stroke.join}"${stroke.dashed ? ' stroke-dasharray="4 3"' : ""}/>`,
        );
      return wrap(node, out.join(""));
    }
    const radii = cornerRadii(node);
    const shape = roundedRect(b.x, b.y, b.w, b.h, radii);
    const filter = shadowFilter(node);
    const fillParts = visiblePaints(fills)
      .map((paint) => {
        const ref = paint.type === "image" ? `fill="#8a90a6" fill-opacity="0.35"` : paintRef(paint);
        return ref ? `<path d="${shape}" ${ref}/>` : "";
      })
      .join("");
    if (fillParts) out.push(filter ? `<g${filter}>${fillParts}</g>` : fillParts);
    const kids = childrenOf(doc, node)
      .map((child) => emit(child, false))
      .join("");
    if (kids) {
      if (node.clip === true) {
        const id = `c${++uid}`;
        defs.push(`<clipPath id="${id}"><path d="${shape}"/></clipPath>`);
        out.push(`<g clip-path="url(#${id})">${kids}</g>`);
      } else out.push(kids);
    }
    const stroke = strokeLook(node);
    if (stroke?.sides) {
      const [t, r, bt, l] = stroke.sides;
      const k = stroke.align === "outside" ? -0.5 : stroke.align === "center" ? 0 : 0.5;
      const lines = [
        t ? `M${r3(b.x)} ${r3(b.y + t * k)}H${r3(b.x + b.w)}` : "",
        r ? `M${r3(b.x + b.w - r * k)} ${r3(b.y)}V${r3(b.y + b.h)}` : "",
        bt ? `M${r3(b.x)} ${r3(b.y + b.h - bt * k)}H${r3(b.x + b.w)}` : "",
        l ? `M${r3(b.x + l * k)} ${r3(b.y)}V${r3(b.y + b.h)}` : "",
      ];
      [t, r, bt, l].forEach((w, i) => {
        if (lines[i]) out.push(`<path d="${lines[i]}" fill="none" ${paintAttr("stroke", stroke.color)} stroke-width="${r3(w)}"/>`);
      });
    } else if (stroke) {
      const off = stroke.align === "inside" ? stroke.weight / 2 : stroke.align === "outside" ? -stroke.weight / 2 : 0;
      const sr = radii.map((v) => Math.max(0, v - off)) as [number, number, number, number];
      out.push(
        `<path d="${roundedRect(b.x + off, b.y + off, b.w - off * 2, b.h - off * 2, sr)}" fill="none" ${paintAttr("stroke", stroke.color)} stroke-width="${r3(stroke.weight)}"${stroke.dashed ? ' stroke-dasharray="4 3"' : ""}/>`,
      );
    }
    return wrap(node, out.join(""));
  };
  const wrap = (node: FigNode, body: string) => {
    if (!body) return "";
    const opacity = typeof node.opacity === "number" && node.opacity < 1 ? ` opacity="${r3(Math.max(0, node.opacity))}"` : "";
    return `<g data-name="${esc(node.name)}"${opacity}>${body}</g>`;
  };
  const body = emit(frame, true);
  const pad = strokeLook(frame)?.align === "outside" ? strokeLook(frame)!.weight : 0;
  const w = frame.width + pad * 2,
    h = frame.height + pad * 2;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${r3(w)}" height="${r3(h)}" viewBox="${r3(-pad)} ${r3(-pad)} ${r3(w)} ${r3(h)}"><title>${esc(frame.name)}</title><desc>FigCraft 原型校样 · 内置近似渲染（非原生引擎）</desc>${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${body}</svg>\n`;
}

export async function svgToPng(svg: string, factor = 2): Promise<Blob> {
  // 页面 CSP 的 img-src 只允许 data:，不能用 blob: URL。
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG 栅格化失败。"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * factor));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * factor));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持画布导出。");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 生成失败。"))), "image/png"),
    );
  }
}
