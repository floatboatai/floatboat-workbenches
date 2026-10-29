// ABOUTME: 浏览器导出：PPTX（官方 PptxGenJS 浏览器包 + 段落修正）与带图片数据的项目 JSON；以及项目 JSON 的导入解析。
import { mediaIds, restoreDeckDraft, validateDeck, type Deck } from "../contracts/domain";
import { MEDIA_ID } from "../contracts/domain";
import { isRecord } from "../contracts/project";
import { loadPresentationEngine } from "./browser-engine";
import { fromBase64, loadMedia, uploadBytes } from "./media-client";
import { renderPresentation, writePresentation, type MediaAsset } from "../shared/pptx-render";
import { normalizePptx } from "../shared/zip";

export const PROJECT_FORMAT = "floatboat-pptx-deck";
export const IMPORT_MAX_BYTES = 60 * 1024 * 1024;

async function collectMedia(deck: Deck): Promise<Map<string, MediaAsset & { name: string }>> {
  const records = await Promise.all(mediaIds(deck).map((id) => loadMedia(id)));
  return new Map(records.map((r) => [r.id, { mime: r.mime, width: r.width, height: r.height, base64: r.base64, name: r.name }]));
}

export async function buildPptx(data: Deck, title: string): Promise<Blob> {
  const deck = validateDeck(data);
  const [PptxGenJS, media] = await Promise.all([loadPresentationEngine(), collectMedia(deck)]);
  const bytes = await normalizePptx(await writePresentation(renderPresentation(PptxGenJS, deck, title, media)));
  return new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

export async function buildProjectJson(data: Deck, title: string): Promise<Blob> {
  const media = await collectMedia(data);
  const payload = { format: PROJECT_FORMAT, version: 2, title, deck: data, media: Object.fromEntries(media) };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

export function safeFileName(title: string, extension: string) {
  const base =
    title
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "演示文稿";
  return `${base}.${extension}`;
}

/**
 * Accepts this app's project package (with media), a bare deck (0.9 or the 0.3.0 title/kicker/body format),
 * or a recovery working copy. Media is uploaded first so the new deck only references stored images.
 */
export async function readProjectFile(file: File): Promise<{ deck: Deck; title: string; note: string }> {
  if (file.size > IMPORT_MAX_BYTES) throw new Error(`文件超过 ${IMPORT_MAX_BYTES / 1024 / 1024} MB。`);
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("文件不是有效的 JSON。");
  }
  const fallbackTitle = file.name.replace(/\.json$/i, "").slice(0, 120) || "导入的演示文稿";
  if (isRecord(value) && value.format === PROJECT_FORMAT) {
    const remap = new Map<string, string>();
    const media = isRecord(value.media) ? value.media : {};
    for (const [id, entry] of Object.entries(media)) {
      if (!MEDIA_ID.test(id) || !isRecord(entry) || typeof entry.base64 !== "string") throw new Error("项目中的图片数据无效。");
      const stored = await uploadBytes(fromBase64(entry.base64), typeof entry.name === "string" ? entry.name : "");
      remap.set(id, stored.id);
    }
    const deck = validateDeck(value.deck);
    const remapped: Deck = {
      ...deck,
      slides: deck.slides.map((s) => ({
        ...s,
        elements: s.elements.map((el) => (el.type === "image" && el.mediaId ? { ...el, mediaId: remap.get(el.mediaId) ?? el.mediaId } : el)),
      })),
    };
    const missing = mediaIds(remapped).filter((id) => ![...remap.values()].includes(id));
    if (missing.length) await Promise.all(missing.map((id) => loadMedia(id))).catch(() => {
      throw new Error(`项目引用了 ${missing.length} 张不在文件中的图片。`);
    });
    const title = typeof value.title === "string" && value.title.trim() ? value.title.trim().slice(0, 120) : fallbackTitle;
    return { deck: remapped, title, note: remap.size ? `含 ${remap.size} 张图片` : "" };
  }
  if (isRecord(value) && isRecord(value.snapshot) && "data" in value.snapshot) {
    const deck = restoreDeckDraft(value.snapshot.data);
    for (const id of mediaIds(deck)) await loadMedia(id).catch(() => undefined);
    const title = typeof value.snapshot.title === "string" && value.snapshot.title.trim() ? value.snapshot.title.trim().slice(0, 120) : fallbackTitle;
    return { deck, title, note: "恢复草稿" };
  }
  const deck = validateDeck(value);
  return { deck, title: fallbackTitle, note: isRecord(value) && value.version === undefined ? "已从 0.3.0 格式转换" : "" };
}
