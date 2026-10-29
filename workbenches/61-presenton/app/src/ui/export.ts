// ABOUTME: 浏览器端导出与导入：PPTX（PptxGenJS 浏览器包，插画先栅格化为 PNG）、PDF（逐页 Canvas → JPEG → PDF）、含图片的便携项目，以及项目导入时的图片回存。
import { mediaIds, validateDeck, type ArtId, type Deck } from "../contracts/model";
import { importDeck, portable, type Imported, type PortableMedia } from "../contracts/deck";
import { buildPdf } from "../shared/pdf";
import { renderPresentation, writePresentation, type MediaAsset } from "../shared/pptx-render";
import { normalizePptx } from "../shared/zip";
import { artMarks } from "../shared/marks";
import { fontStack, type Theme } from "../shared/themes";
import { loadPresentationEngine } from "./browser-engine";
import { fromBase64, loadMedia, uploadBytes } from "./media-client";
import { drawMarks, drawSlide, slideHeightPx, type CanvasImages } from "./render-canvas";

export function safeFileName(title: string, extension: string) {
  const base =
    title
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "演示文稿";
  return `${base}.${extension}`;
}
async function collectMedia(deck: Deck): Promise<Map<string, MediaAsset & { name: string }>> {
  const records = await Promise.all(mediaIds(deck).map((id) => loadMedia(id)));
  return new Map(records.map((r) => [r.id, { mime: r.mime, width: r.width, height: r.height, base64: r.base64, name: r.name }]));
}
function canvas(w: number, h: number) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("浏览器无法创建画布，不能导出。");
  return { el, ctx };
}
function artPng(art: ArtId, w: number, h: number, theme: Theme): string {
  const ppi = 160;
  const { el, ctx } = canvas(Math.round(w * ppi), Math.round(h * ppi));
  drawMarks(ctx, artMarks(art, w, h, theme), ppi, fontStack(false));
  return el.toDataURL("image/png").replace(/^data:/, "");
}

export async function buildPptx(data: Deck, title: string): Promise<Blob> {
  const deck = validateDeck(data);
  if (!deck.slides.length) throw new Error("还没有幻灯片，请先生成。");
  const [PptxGenJS, media] = await Promise.all([loadPresentationEngine(), collectMedia(deck)]);
  const cache = new Map<string, string>();
  const art = (a: ArtId, w: number, h: number, theme: Theme) => {
    const key = `${a}:${theme.id}:${w}x${h}`;
    if (!cache.has(key)) cache.set(key, artPng(a, w, h, theme));
    return cache.get(key)!;
  };
  const bytes = await normalizePptx(await writePresentation(renderPresentation(PptxGenJS, deck, title, { media, art })));
  return new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("文稿中的图片无法解码。"));
    img.src = src;
  });
}
/** One JPEG page per slide at 1920 px; text is part of the image (see ACCEPTANCE limits). */
export async function buildPdfFile(data: Deck, title: string, progress?: (done: number, total: number) => void): Promise<Blob> {
  const deck = validateDeck(data);
  if (!deck.slides.length) throw new Error("还没有幻灯片，请先生成。");
  if (document.fonts?.ready) await document.fonts.ready;
  const media = await collectMedia(deck);
  const images: CanvasImages = new Map();
  for (const [id, m] of media) images.set(id, await decodeImage(`data:${m.mime};base64,${m.base64}`));
  const width = 1920,
    height = slideHeightPx(width);
  const pages = [];
  for (const [index, slide] of deck.slides.entries()) {
    const { el, ctx } = canvas(width, height);
    drawSlide(ctx, slide, deck.theme, { index, total: deck.slides.length, deckTitle: title }, width, images);
    const blob = await new Promise<Blob | null>((resolve) => el.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("页面位图生成失败。");
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width, height });
    progress?.(index + 1, deck.slides.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return new Blob([buildPdf(pages, title) as BlobPart], { type: "application/pdf" });
}

export async function buildProjectJson(data: Deck, title: string, extra: Record<string, unknown>): Promise<Blob> {
  const media = await collectMedia(data);
  const out: PortableMedia = {};
  for (const [id, m] of media) out[id] = { mime: m.mime, base64: m.base64, name: m.name };
  return new Blob([portable(title, data, extra, out)], { type: "application/json" });
}

/** Parses a project/recovery/Presenton JSON and re-stores bundled images so the new document only references stored media. */
export async function importProjectText(text: string): Promise<Imported> {
  const parsed = importDeck(text);
  const remap = new Map<string, string>();
  for (const [id, m] of Object.entries(parsed.media)) {
    const stored = await uploadBytes(fromBase64(m.base64), m.name);
    remap.set(id, stored.id);
  }
  if (remap.size)
    parsed.deck.slides = parsed.deck.slides.map((s) => (s.image?.kind === "media" && remap.has(s.image.id) ? { ...s, image: { ...s.image, id: remap.get(s.image.id)! } } : s));
  return parsed;
}
