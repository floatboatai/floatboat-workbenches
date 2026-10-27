import { validateDeck, type Deck } from "../contracts/domain";
import { loadPresentationEngine } from "./browser-engine";
export const colors = {
  ember: {
    background: "20242B",
    foreground: "F8F2E9",
    accent: "F2AA6B",
    muted: "C8C2B9",
  },
  ink: {
    background: "E9EEF2",
    foreground: "243A4C",
    accent: "3C7198",
    muted: "60768A",
  },
  paper: {
    background: "F7F1E6",
    foreground: "40362C",
    accent: "A26B48",
    muted: "8B7865",
  },
};
export async function buildPptx(data: Deck, title: string): Promise<Blob> {
  const deck = validateDeck(data);
  const PptxGenJS = await loadPresentationEngine();
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.title = title;
  presentation.author = "Floatboat Workbenches";
  presentation.subject = "演示编排室";
  presentation.company = "";
  presentation.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
  };
  const palette = colors[deck.theme];
  for (let index = 0; index < deck.slides.length; index++) {
    const item = deck.slides[index],
      slide = presentation.addSlide();
    slide.background = { color: palette.background };
    slide.addText(item.kicker || `SLIDE ${index + 1}`, {
      x: 0.72,
      y: 0.52,
      w: 11.7,
      h: 0.25,
      fontFace: "Microsoft YaHei",
      fontSize: 10,
      color: palette.accent,
      charSpacing: 2,
    });
    slide.addText(item.title, {
      x: 0.72,
      y: 1.12,
      w: 11.7,
      h: 1.1,
      fontFace: "Microsoft YaHei",
      lang: "zh-CN",
      fontSize: 32,
      bold: true,
      color: palette.foreground,
      breakLine: false,
      fit: "shrink",
      margin: 0,
    });
    slide.addShape(presentation.ShapeType.line, {
      x: 0.74,
      y: 2.43,
      w: 1.1,
      h: 0,
      line: { color: palette.accent, width: 2 },
    });
    slide.addText(
      item.body
        .split("\n")
        .filter((line) => line.trim())
        .join("\n"),
      {
        x: 0.8,
        y: 2.88,
        w: 11.5,
        h: 3.65,
        fontFace: "Microsoft YaHei",
        lang: "zh-CN",
        fontSize: 20,
        color: palette.muted,
        bullet: { indent: 16 },
        paraSpaceAfter: 14,
        breakLine: false,
        fit: "shrink",
        margin: 0,
      },
    );
    slide.addText(
      `${String(index + 1).padStart(2, "0")} / ${String(deck.slides.length).padStart(2, "0")}`,
      {
        x: 11.5,
        y: 7,
        w: 1.05,
        h: 0.18,
        fontSize: 9,
        color: palette.muted,
        align: "right",
      },
    );
    if (item.notes) slide.addNotes(item.notes);
  }
  const output = await presentation.write({
    outputType: "blob",
    compression: true,
  });
  if (!(output instanceof Blob)) throw new Error("未能生成有效的演示文稿。");
  return output;
}
