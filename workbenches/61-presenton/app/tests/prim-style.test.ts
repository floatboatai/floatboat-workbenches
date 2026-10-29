import assert from "node:assert/strict";
import { test } from "node:test";
import PptxGenJS from "pptxgenjs";
import { example } from "../src/contracts/deck.ts";
import { slidePrims } from "../src/shared/geometry.ts";
import { THEME_DEFS } from "../src/shared/themes.ts";
import { renderPresentation, writePresentation } from "../src/shared/pptx-render.ts";
import { readZip } from "../src/shared/zip.ts";
import { CANVAS_RESET, listStyle, textStyle } from "../src/ui/prim-style.ts";

// Regression: thumbnails render inside <button>, whose UA style centres text and our button CSS sets nowrap.
// The HTML renderer must not inherit those, so lists stay left-aligned with a hanging indent like PPTX/PDF.
test("HTML 渲染器不继承容器的居中/不换行：画布根与每个列表、文字图元显式声明排版", () => {
  assert.equal(CANVAS_RESET.textAlign, "left");
  assert.equal(CANVAS_RESET.whiteSpace, "normal");
  assert.equal(CANVAS_RESET.fontWeight, 400);
  for (const [index, slide] of example.slides.entries())
    for (const p of slidePrims(slide, THEME_DEFS.paper, { index, total: example.slides.length, deckTitle: "t" })) {
      if (p.k === "list") {
        const s = listStyle(p, "sans");
        assert.equal(s.textAlign, "left", `slide ${index + 1}`);
        assert.equal(s.whiteSpace, "normal");
      }
      if (p.k === "text") {
        const s = textStyle(p, "sans");
        assert.equal(s.textAlign, p.align);
        assert.equal(s.whiteSpace, "normal");
        assert.ok(s.fontWeight === 400 || s.fontWeight === 700);
      }
    }
});
test("同一要点页在 PPTX 中同样左对齐、悬挂缩进（无居中段落）", async () => {
  const pres = renderPresentation(PptxGenJS as unknown as new () => PptxGenJS, example, "t", { media: new Map(), art: () => "image/png;base64,iVBORw0KGgo=" });
  const files = await readZip(await writePresentation(pres));
  const xml = new TextDecoder().decode(files.find((f) => f.name === "ppt/slides/slide3.xml")!.data);
  const bullets = [...xml.matchAll(/<a:pPr([^>]*)>(?:(?!<\/a:pPr>).)*<a:buChar/gs)].map((m) => m[1]);
  assert.ok(bullets.length >= 5);
  for (const attrs of bullets) {
    assert.doesNotMatch(attrs, /algn="ctr"/);
    assert.match(attrs, /marL="(\d+)" indent="-\1"/);
  }
});
