// ABOUTME: 把带批注层的谱页栅格化为 PNG，或连同批注清单页写成 PDF。全部在浏览器内完成。
import { buildPdf, type PdfPage } from "../contracts/pdf";
import type { ReviewReport } from "../contracts/report";
import type { PageSnapshot } from "./engine";

const MAX_SIDE = 12000;
const MAX_AREA = 60_000_000;

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("谱页无法栅格化。"));
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

export async function rasterize(page: PageSnapshot, scale: number): Promise<HTMLCanvasElement> {
  let factor = Math.min(scale, MAX_SIDE / page.width, MAX_SIDE / page.height);
  if (page.width * page.height * factor * factor > MAX_AREA) factor = Math.sqrt(MAX_AREA / (page.width * page.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(page.width * factor));
  canvas.height = Math.max(1, Math.round(page.height * factor));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法创建画布。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(await loadSvg(page.svg), 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("图像编码失败。"))), type, quality));

export async function pagePng(page: PageSnapshot, scale = 2): Promise<Blob> {
  return toBlob(await rasterize(page, scale), "image/png");
}

const A4 = { w: 595.28, h: 841.89 };
const FONT = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif';

function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    let line = "";
    for (const char of paragraph) {
      if (context.measureText(line + char).width > width && line) {
        lines.push(line);
        line = char;
      } else line += char;
    }
    lines.push(line);
  }
  return lines;
}

/** 批注清单页：按编号列出位置、类别、状态与正文；多页自动续排。 */
function appendixPages(report: ReviewReport): HTMLCanvasElement[] {
  const W = 1654,
    H = 2339,
    margin = 120;
  const pages: HTMLCanvasElement[] = [];
  let context!: CanvasRenderingContext2D;
  let y = 0;
  const page = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    context = canvas.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, W, H);
    context.fillStyle = "#1f2933";
    context.font = `600 40px ${FONT}`;
    context.fillText(pages.length ? "审校批注（续）" : "审校批注", margin, margin + 30);
    context.font = `26px ${FONT}`;
    context.fillStyle = "#52606d";
    context.fillText(
      `${report.score.title} · 共 ${report.summary.total} 条，待核对 ${report.summary.open} 条 · 原件 SHA-256 ${report.source.sha256.slice(0, 16)}…`,
      margin,
      margin + 80,
    );
    pages.push(canvas);
    y = margin + 140;
  };
  page();
  if (!report.annotations.length) {
    context.font = `30px ${FONT}`;
    context.fillText("没有批注。", margin, y + 40);
  }
  for (const note of report.annotations) {
    context.font = `28px ${FONT}`;
    const body = wrap(context, note.text || "（空白）", W - margin * 2 - 80);
    const need = 60 + body.length * 40 + 30;
    if (y + need > H - margin) page();
    context.fillStyle = note.resolved ? "#5b6b7d" : "#c2410c";
    context.beginPath();
    context.arc(margin + 24, y + 22, 24, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = `700 24px Helvetica, Arial, sans-serif`;
    context.textAlign = "center";
    context.fillText(String(note.number), margin + 24, y + 31);
    context.textAlign = "left";
    context.fillStyle = "#1f2933";
    context.font = `600 28px ${FONT}`;
    const where = `${note.partName} · 第 ${note.measureNumber} 小节${note.beat ? ` 第 ${note.beat} 拍` : ""} · ${note.kindLabel} · ${note.resolved ? "已核对" : "待核对"}`;
    context.fillText(where, margin + 80, y + 32);
    context.font = `28px ${FONT}`;
    context.fillStyle = "#323f4b";
    body.forEach((line, i) => context.fillText(line, margin + 80, y + 82 + i * 40));
    y += need;
  }
  return pages;
}

export async function scorePdf(pages: PageSnapshot[], report: ReviewReport, onProgress: (message: string) => void): Promise<Blob> {
  const out: PdfPage[] = [];
  for (const [i, page] of pages.entries()) {
    onProgress(`正在生成 PDF 第 ${i + 1}/${pages.length} 页…`);
    const scale = Math.min(2, 2480 / page.width);
    const canvas = await rasterize(page, scale);
    const portrait = page.height >= page.width;
    const pageWidth = portrait ? A4.w : A4.h;
    const pageHeight = Math.min(14000, (pageWidth * canvas.height) / canvas.width);
    out.push({ jpeg: new Uint8Array(await (await toBlob(canvas, "image/jpeg", 0.9)).arrayBuffer()), width: canvas.width, height: canvas.height, pageWidth, pageHeight });
  }
  for (const canvas of appendixPages(report))
    out.push({ jpeg: new Uint8Array(await (await toBlob(canvas, "image/jpeg", 0.92)).arrayBuffer()), width: canvas.width, height: canvas.height, pageWidth: A4.w, pageHeight: A4.h });
  const bytes = buildPdf(out, { title: report.score.title, subject: `${report.summary.total} 条审校批注` });
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
