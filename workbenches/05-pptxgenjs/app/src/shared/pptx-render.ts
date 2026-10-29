// ABOUTME: 把演示文稿模型写成 PptxGenJS 对象：每个版式定义为幻灯片母版，元素按舞台同一几何输出为原生文本/图片/表格/图表/形状。
import type PptxGenJS from "pptxgenjs";
import {
  SLIDE_SIZES,
  validateDeck,
  type ChartElement,
  type Deck,
  type ImageElement,
  type ShapeElement,
  type TableElement,
  type TextElement,
  type Theme,
} from "../contracts/domain.ts";
import { LAYOUTS, NUMBER_BOX, chartPalette, mix, onPlaceholder, resolveColor } from "../contracts/layouts.ts";

export interface MediaAsset {
  mime: string;
  width: number;
  height: number;
  base64: string;
}
/** Text inset in points on every side; the stage uses the same value. */
export const TEXT_MARGIN_PT = 5;
/** Bullet hanging indent in points. */
export const BULLET_INDENT_PT = 18;
/** Table cell padding in inches. */
export const TABLE_MARGIN_IN = 0.06;
/** Rounded rectangle corner radius in inches. */
export const ROUND_RADIUS_IN = 0.16;
/** PowerPoint single line spacing relative to the font size, used by the stage. */
export const LINE_HEIGHT = 1.2;

type Pptx = PptxGenJS;
type PptxConstructor = new () => Pptx;

export function chartData(el: ChartElement) {
  const series = el.chart === "pie" || el.chart === "doughnut" ? el.series.slice(0, 1) : el.series;
  return series.map((s) => ({
    name: s.name || " ",
    labels: el.categories.map((c) => c || " "),
    values: s.values.map((v) => {
      const n = Number(v.trim());
      return v.trim() === "" || !Number.isFinite(n) ? 0 : n;
    }),
  }));
}
export function tableStyle(el: TableElement, theme: Theme) {
  const c = theme.colors;
  return {
    border: mix(c.muted, c.background, 0.55),
    header: { fill: c.accent, color: c.background },
    band: mix(c.surface, c.background, 0.15),
    body: c.background,
    text: c.text,
    rowFill: (row: number) => (el.header && row === 0 ? c.accent : el.banded && (el.header ? row % 2 === 0 : row % 2 === 1) ? mix(c.surface, c.background, 0.15) : c.background),
  };
}
export function containBox(el: ImageElement, asset: { width: number; height: number }, slideW: number, slideH: number) {
  const bw = (el.w / 100) * slideW,
    bh = (el.h / 100) * slideH;
  const ratio = asset.height / asset.width;
  let w = bw,
    h = bw * ratio;
  if (h > bh) {
    h = bh;
    w = bh / ratio;
  }
  return { x: (el.x / 100) * slideW + (bw - w) / 2, y: (el.y / 100) * slideH + (bh - h) / 2, w, h };
}

export function renderPresentation(Pptx: PptxConstructor, input: Deck, title: string, media: Map<string, MediaAsset>): Pptx {
  const deck = validateDeck(input);
  const { theme } = deck;
  const size = SLIDE_SIZES[theme.aspect];
  const X = (pct: number) => (pct / 100) * size.w;
  const Y = (pct: number) => (pct / 100) * size.h;
  const font = (role: "head" | "body") => (role === "head" ? theme.headFont : theme.bodyFont);
  const color = (ref: string) => resolveColor(ref, theme);
  const pres = new Pptx();
  const layoutName = `FLOATBOAT_${theme.aspect.replace(":", "x")}`;
  pres.defineLayout({ name: layoutName, width: size.w, height: size.h });
  pres.layout = layoutName;
  pres.title = title;
  pres.subject = "演示编排室";
  pres.author = "Floatboat 演示编排室";
  pres.company = "";
  pres.theme = { headFontFace: theme.headFont, bodyFontFace: theme.bodyFont };

  for (const def of Object.values(LAYOUTS)) {
    const objects: NonNullable<Parameters<Pptx["defineSlideMaster"]>[0]["objects"]> = [];
    for (const d of def.decor) {
      if (d.kind === "rect")
        objects.push({ rect: { x: X(d.x), y: Y(d.y), w: X(d.w), h: Y(d.h), fill: { color: color(d.fill ?? "accent") } } });
      else
        objects.push({
          text: {
            text: d.text ?? "",
            options: {
              x: X(d.x),
              y: Y(d.y),
              w: X(d.w),
              h: Y(d.h),
              fontFace: font(d.font ?? "body"),
              fontSize: d.size ?? 18,
              color: color(d.color ?? "text"),
              margin: 0,
              valign: "top",
            },
          },
        });
    }
    for (const slot of def.slots) {
      if (!slot.placeholder) continue;
      const box = slot.make();
      objects.push({
        placeholder: {
          options: {
            name: slot.name,
            type: slot.placeholder,
            x: X(box.x),
            y: Y(box.y),
            w: X(box.w),
            h: Y(box.h),
            margin: TEXT_MARGIN_PT,
          } as PptxGenJS.PlaceholderProps,
          text: slot.prompt,
        },
      });
    }
    pres.defineSlideMaster({
      title: def.label,
      background: { color: color(def.background) },
      objects,
      ...(def.numberColor
        ? {
            slideNumber: {
              x: X(NUMBER_BOX.x),
              y: Y(NUMBER_BOX.y),
              w: X(NUMBER_BOX.w),
              h: Y(NUMBER_BOX.h),
              fontFace: theme.bodyFont,
              fontSize: NUMBER_BOX.size,
              color: color(def.numberColor),
              align: "right",
              margin: 0,
            } as PptxGenJS.SlideNumberProps,
          }
        : {}),
    });
  }

  for (const item of deck.slides) {
    const slide = pres.addSlide({ masterName: LAYOUTS[item.layout].label });
    if (item.hidden) slide.hidden = true;
    for (const el of item.elements) {
      if (el.type === "text") addText(slide, el, onPlaceholder(item.layout, el) ? el.slot : undefined);
      else if (el.type === "image") addImage(slide, el);
      else if (el.type === "table") addTable(slide, el);
      else if (el.type === "chart") addChart(slide, el);
      else addShape(slide, el);
    }
    if (item.notes.trim()) slide.addNotes(item.notes);
  }
  return pres;

  function addText(slide: PptxGenJS.Slide, el: TextElement, placeholder?: string) {
    const isEmpty = el.paragraphs.every((p) => p.runs.every((r) => !r.text));
    if (isEmpty) return;
    const runs: PptxGenJS.TextProps[] = [];
    el.paragraphs.forEach((paragraph, pi) => {
      const last = pi === el.paragraphs.length - 1;
      const paraOptions = {
        align: el.align,
        bullet: paragraph.bullet ? { indent: BULLET_INDENT_PT } : false,
        ...(paragraph.level ? { indentLevel: paragraph.level } : {}),
      } as const;
      const parts = paragraph.runs.filter((r) => r.text);
      if (!parts.length) {
        runs.push({ text: "", options: { ...paraOptions, color: color(el.color), breakLine: !last } });
        return;
      }
      parts.forEach((run, ri) => {
        runs.push({
          text: run.text,
          options: {
            ...paraOptions,
            color: color(run.color ?? el.color),
            ...(run.bold || el.bold ? { bold: true } : {}),
            ...(run.italic || el.italic ? { italic: true } : {}),
            ...(run.underline ? { underline: { style: "sng" } } : {}),
            ...(run.link ? { hyperlink: { url: run.link } } : {}),
            breakLine: ri === parts.length - 1 && !last,
          },
        });
      });
    });
    slide.addText(runs, {
      x: X(el.x),
      y: Y(el.y),
      w: X(el.w),
      h: Y(el.h),
      fontFace: font(el.font),
      fontSize: el.size,
      color: color(el.color),
      align: el.align,
      valign: el.valign,
      margin: TEXT_MARGIN_PT,
      lang: "zh-CN",
      wrap: true,
      ...(el.fill ? { fill: { color: color(el.fill) } } : {}),
      ...(el.lineSpacing !== 1 ? { lineSpacingMultiple: el.lineSpacing } : {}),
      ...(el.spaceAfter ? { paraSpaceAfter: el.spaceAfter } : {}),
      ...(placeholder ? { placeholder } : {}),
    });
  }

  function addImage(slide: PptxGenJS.Slide, el: ImageElement) {
    const asset = el.mediaId ? media.get(el.mediaId) : undefined;
    if (!asset) return;
    const data = `${asset.mime};base64,${asset.base64}`;
    if (el.fit === "contain") {
      slide.addImage({ data, ...containBox(el, asset, size.w, size.h), altText: el.alt });
      return;
    }
    const w = X(el.w),
      h = Y(el.h);
    slide.addImage({
      data,
      x: X(el.x),
      y: Y(el.y),
      w,
      h: (w * asset.height) / asset.width,
      sizing: { type: "cover", w, h },
      altText: el.alt,
    });
  }

  function addTable(slide: PptxGenJS.Slide, el: TableElement) {
    const style = tableStyle(el, theme);
    const cols = el.rows[0].length;
    const rows: PptxGenJS.TableRow[] = el.rows.map((row, ri) =>
      row.map((cell) => ({
        text: cell,
        options: {
          fill: { color: style.rowFill(ri) },
          color: el.header && ri === 0 ? style.header.color : style.text,
          bold: el.header && ri === 0,
        },
      })),
    );
    slide.addTable(rows, {
      x: X(el.x),
      y: Y(el.y),
      w: X(el.w),
      colW: Array.from({ length: cols }, () => X(el.w) / cols),
      rowH: Array.from({ length: el.rows.length }, () => Y(el.h) / el.rows.length),
      fontFace: theme.bodyFont,
      fontSize: el.size,
      valign: "middle",
      margin: TABLE_MARGIN_IN,
      border: { type: "solid", pt: 0.75, color: style.border },
      autoPage: false,
    });
  }

  function addChart(slide: PptxGenJS.Slide, el: ChartElement) {
    const c = theme.colors;
    const round = el.chart === "pie" || el.chart === "doughnut";
    const palette = chartPalette(theme);
    const type = {
      bar: pres.ChartType.bar,
      line: pres.ChartType.line,
      area: pres.ChartType.area,
      pie: pres.ChartType.pie,
      doughnut: pres.ChartType.doughnut,
    }[el.chart] as unknown as PptxGenJS.CHART_NAME;
    slide.addChart(type, chartData(el), {
      x: X(el.x),
      y: Y(el.y),
      w: X(el.w),
      h: Y(el.h),
      chartColors: palette,
      showLegend: el.legend,
      legendPos: round ? "r" : "b",
      legendFontFace: theme.bodyFont,
      legendFontSize: 12,
      legendColor: c.muted,
      showTitle: Boolean(el.title.trim()),
      ...(el.title.trim() ? { title: el.title, titleColor: c.text, titleFontFace: theme.headFont, titleFontSize: 16 } : {}),
      showValue: el.labels && !round,
      showPercent: el.labels && round,
      showLabel: false,
      dataLabelColor: round ? c.background : c.text,
      dataLabelFontFace: theme.bodyFont,
      dataLabelFontSize: 11,
      ...(el.chart === "bar" ? { barDir: "col", barGapWidthPct: 60, dataLabelPosition: "outEnd" } : {}),
      ...(el.chart === "line" ? { lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7, dataLabelPosition: "t" } : {}),
      ...(el.chart === "area" ? { chartColorsOpacity: 70 } : {}),
      ...(el.chart === "doughnut" ? { holeSize: 58 } : {}),
      ...(round
        ? { dataBorder: { pt: 1, color: c.background } }
        : {
            catAxisLabelColor: c.muted,
            catAxisLabelFontFace: theme.bodyFont,
            catAxisLabelFontSize: 12,
            catAxisLineShow: true,
            catAxisLineColor: mix(c.muted, c.background, 0.4),
            valAxisLabelColor: c.muted,
            valAxisLabelFontFace: theme.bodyFont,
            valAxisLabelFontSize: 11,
            valAxisLineShow: false,
            valGridLine: { color: mix(c.muted, c.background, 0.7), size: 0.75 },
          }),
    } as PptxGenJS.IChartOpts);
  }

  function addShape(slide: PptxGenJS.Slide, el: ShapeElement) {
    const box = { x: X(el.x), y: Y(el.y), w: X(el.w), h: Y(el.h) };
    if (el.shape === "line") {
      slide.addShape(pres.ShapeType.line, { ...box, line: { color: color(el.line ?? "text"), width: Math.max(el.lineWidth, 0.5) } });
      return;
    }
    const type = {
      rect: pres.ShapeType.rect,
      roundRect: pres.ShapeType.roundRect,
      ellipse: pres.ShapeType.ellipse,
      triangle: pres.ShapeType.triangle,
      rightArrow: pres.ShapeType.rightArrow,
    }[el.shape];
    const style = {
      ...box,
      ...(el.fill ? { fill: { color: color(el.fill) } } : {}),
      ...(el.line && el.lineWidth > 0 ? { line: { color: color(el.line), width: el.lineWidth } } : {}),
      ...(el.shape === "roundRect" ? { rectRadius: Math.min(ROUND_RADIUS_IN, box.w / 2, box.h / 2) } : {}),
    };
    if (el.text.trim())
      slide.addText(el.text, {
        ...style,
        shape: type,
        fontFace: theme.bodyFont,
        fontSize: el.size,
        color: color(el.textColor),
        align: "center",
        valign: "middle",
        margin: TEXT_MARGIN_PT,
        lang: "zh-CN",
      });
    else slide.addShape(type, style);
  }
}

export async function writePresentation(pres: Pptx): Promise<Uint8Array> {
  const output = await pres.write({ outputType: "uint8array", compression: true });
  if (!(output instanceof Uint8Array)) throw new Error("未能生成有效的演示文稿。");
  return output;
}
