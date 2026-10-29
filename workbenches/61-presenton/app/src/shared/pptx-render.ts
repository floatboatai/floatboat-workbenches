// ABOUTME: 用 PptxGenJS 把文稿写成 PPTX：同一版式几何输出原生文本框、项目符号、形状、图片与原生图表（可在 PowerPoint 中改数据），并写入演讲备注。
import type PptxGenJS from "pptxgenjs";
import { validateDeck, type ArtId, type Chart, type Deck, type ImageRef } from "../contracts/model.ts";
import { SLIDE_H, SLIDE_W, bulletIndent, slidePrims, type ListPrim, type Prim, type TextPrim } from "./geometry.ts";
import { chartNumber } from "./marks.ts";
import { THEME_DEFS, mix, pptxFont, type Theme } from "./themes.ts";

export type MediaAsset = { mime: string; width: number; height: number; base64: string };
export type PptxAssets = {
  media: Map<string, MediaAsset>;
  /** PNG for an illustration rendered at the given box size: "image/png;base64,…". */
  art: (art: ArtId, w: number, h: number, theme: Theme) => string;
};
type Pptx = PptxGenJS;
type PptxConstructor = new () => Pptx;

export const artKey = (art: ArtId, w: number, h: number, theme: string) => `${art}:${theme}:${w.toFixed(2)}x${h.toFixed(2)}`;
export function artBoxes(deck: Deck): { art: ArtId; w: number; h: number }[] {
  const theme = THEME_DEFS[deck.theme];
  const out = new Map<string, { art: ArtId; w: number; h: number }>();
  deck.slides.forEach((s, index) => {
    for (const p of slidePrims(s, theme, { index, total: deck.slides.length, deckTitle: "" }))
      if (p.k === "image" && p.image.kind === "art") out.set(artKey(p.image.art, p.w, p.h, deck.theme), { art: p.image.art, w: p.w, h: p.h });
  });
  return [...out.values()];
}

export function chartData(chart: Chart) {
  const round = chart.type === "pie" || chart.type === "doughnut";
  return (round ? chart.series.slice(0, 1) : chart.series).map((s, i) => ({
    name: s.name || (chart.series.length > 1 ? `系列 ${i + 1}` : " "),
    labels: chart.categories.map((c) => c || " "),
    values: s.values.map(chartNumber),
  }));
}

export function renderPresentation(Pptx: PptxConstructor, input: Deck, title: string, assets: PptxAssets): Pptx {
  const deck = validateDeck(input);
  const theme = THEME_DEFS[deck.theme];
  const pres = new Pptx();
  pres.defineLayout({ name: "FLOATBOAT_16x9", width: SLIDE_W, height: SLIDE_H });
  pres.layout = "FLOATBOAT_16x9";
  pres.title = title;
  pres.subject = "Presenton 工作台";
  pres.author = "Floatboat Presenton 工作台";
  pres.company = "";
  pres.theme = { headFontFace: pptxFont(theme.serifHead), bodyFontFace: pptxFont(false) };
  deck.slides.forEach((s, index) => {
    const slide = pres.addSlide();
    slide.background = { color: theme.bg };
    for (const p of slidePrims(s, theme, { index, total: deck.slides.length, deckTitle: title })) draw(slide, p);
    if (s.notes.trim()) slide.addNotes(s.notes);
  });
  return pres;

  function draw(slide: PptxGenJS.Slide, p: Prim) {
    switch (p.k) {
      case "rect":
        if (p.x === 0 && p.y === 0 && p.w === SLIDE_W && p.h === SLIDE_H) {
          slide.background = { color: p.fill };
          return;
        }
        slide.addShape(p.radius ? pres.ShapeType.roundRect : pres.ShapeType.rect, {
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          fill: { color: p.fill },
          line: { color: p.fill, width: 0 },
          ...(p.radius ? { rectRadius: p.radius } : {}),
        });
        return;
      case "ellipse":
        slide.addShape(pres.ShapeType.ellipse, { x: p.x, y: p.y, w: p.w, h: p.h, fill: { color: p.fill }, line: { color: p.fill, width: 0 } });
        return;
      case "line":
        slide.addShape(pres.ShapeType.line, { x: p.x1, y: p.y1, w: Math.max(p.x2 - p.x1, 0.001), h: Math.max(p.y2 - p.y1, 0), line: { color: p.color, width: p.width } });
        return;
      case "text":
        return addText(slide, p);
      case "list":
        return addList(slide, p);
      case "image":
        return addImage(slide, p.image, p.x, p.y, p.w, p.h);
      case "chart":
        return addChart(slide, p.chart, p.x, p.y, p.w, p.h);
    }
  }
  function addText(slide: PptxGenJS.Slide, p: TextPrim) {
    if (!p.text.trim()) return;
    slide.addText(p.text, {
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      fontFace: pptxFont(p.head && theme.serifHead),
      fontSize: p.size,
      color: p.color,
      bold: p.bold,
      italic: p.italic,
      align: p.align,
      valign: p.valign,
      margin: 0,
      lineSpacingMultiple: p.lh,
      lang: "zh-CN",
      wrap: true,
    });
  }
  function addList(slide: PptxGenJS.Slide, p: ListPrim) {
    if (!p.items.length) return;
    const runs: PptxGenJS.TextProps[] = p.items.map((item, i) => ({
      text: item,
      options: {
        bullet:
          p.marker === "number"
            ? { type: "number", indent: bulletIndent(p.size) * 72 }
            : { characterCode: p.marker === "dash" ? "2013" : "25CF", indent: bulletIndent(p.size) * 72 },
        breakLine: i < p.items.length - 1,
        paraSpaceAfter: i < p.items.length - 1 ? p.gap * p.size : 0,
      },
    }));
    slide.addText(runs, {
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      fontFace: pptxFont(false),
      fontSize: p.size,
      color: p.color,
      valign: "top",
      margin: 0,
      lineSpacingMultiple: p.lh,
      lang: "zh-CN",
      wrap: true,
    });
  }
  function addImage(slide: PptxGenJS.Slide, image: ImageRef, x: number, y: number, w: number, h: number) {
    if (image.kind === "art") {
      slide.addImage({ data: assets.art(image.art, w, h, theme), x, y, w, h, altText: image.alt });
      return;
    }
    const asset = assets.media.get(image.id);
    if (!asset) throw new Error("文稿引用的图片尚未载入，请重新导出。");
    const ratio = asset.height / asset.width;
    slide.addImage({
      data: `${asset.mime};base64,${asset.base64}`,
      x,
      y,
      w,
      h: w * ratio,
      sizing: { type: "cover", w, h },
      altText: image.alt,
    });
  }
  function addChart(slide: PptxGenJS.Slide, chart: Chart, x: number, y: number, w: number, h: number) {
    const round = chart.type === "pie" || chart.type === "doughnut";
    const type = {
      bar: pres.ChartType.bar,
      line: pres.ChartType.line,
      pie: pres.ChartType.pie,
      doughnut: pres.ChartType.doughnut,
    }[chart.type] as unknown as PptxGenJS.CHART_NAME;
    const legend = round || chart.series.length > 1 || !!chart.series[0]?.name.trim();
    const font = pptxFont(false);
    slide.addChart(type, chartData(chart), {
      x,
      y,
      w,
      h,
      chartColors: theme.chart.slice(0, Math.max(chart.categories.length, chart.series.length)),
      showLegend: legend,
      legendPos: round ? "r" : "t",
      legendFontFace: font,
      legendFontSize: 12,
      legendColor: theme.ink,
      showValue: !round,
      showPercent: round,
      showLabel: false,
      dataLabelColor: round ? theme.onAccent : theme.ink,
      dataLabelFontFace: font,
      dataLabelFontSize: 11,
      ...(chart.unit && !round ? { dataLabelFormatCode: chart.unit === "%" ? '0"%"' : "#,##0.##" } : {}),
      ...(chart.type === "bar" ? { barDir: "col", barGapWidthPct: 50, dataLabelPosition: "outEnd" } : {}),
      ...(chart.type === "line" ? { lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7, dataLabelPosition: "t" } : {}),
      ...(chart.type === "doughnut" ? { holeSize: 58 } : {}),
      ...(round
        ? { dataBorder: { pt: 1, color: theme.bg } }
        : {
            catAxisLabelColor: theme.muted,
            catAxisLabelFontFace: font,
            catAxisLabelFontSize: 11,
            catAxisLineShow: true,
            catAxisLineColor: mix(theme.muted, theme.bg, 0.4),
            valAxisLabelColor: theme.muted,
            valAxisLabelFontFace: font,
            valAxisLabelFontSize: 10,
            valAxisLineShow: false,
            valGridLine: { color: mix(theme.line, theme.bg, 0.25), size: 0.75 },
          }),
    } as PptxGenJS.IChartOpts);
  }
}

export async function writePresentation(pres: Pptx): Promise<Uint8Array> {
  const output = await pres.write({ outputType: "uint8array", compression: true });
  if (!(output instanceof Uint8Array)) throw new Error("未能生成有效的演示文稿。");
  return output;
}
