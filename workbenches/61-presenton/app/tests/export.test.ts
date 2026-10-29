import assert from "node:assert/strict";
import { test } from "node:test";
import PptxGenJS from "pptxgenjs";
import { example } from "../src/contracts/deck.ts";
import { artBoxes, renderPresentation, writePresentation } from "../src/shared/pptx-render.ts";
import { buildPdf } from "../src/shared/pdf.ts";
import { normalizePptx, readZip } from "../src/shared/zip.ts";
import { SLIDE_W, fitSize, slidePrims } from "../src/shared/geometry.ts";
import { chartMarks } from "../src/shared/marks.ts";
import { THEME_DEFS } from "../src/shared/themes.ts";
import { LAYOUTS, THEMES } from "../src/contracts/model.ts";
import { switchLayout } from "../src/contracts/generate.ts";

// 1×1 PNG stands in for the browser-rasterised illustration.
const PNG = "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MEDIA = "b".repeat(64);

test("PPTX：示例 12 页写出原生文本、项目符号、图表、图片与演讲备注", async () => {
  const deck = structuredClone(example);
  deck.slides[8].image = { kind: "media", id: MEDIA, alt: "现场" };
  const arts: string[] = [];
  const pres = renderPresentation(PptxGenJS as unknown as new () => PptxGenJS, deck, "城市绿荫计划", {
    media: new Map([[MEDIA, { mime: "image/png", width: 1, height: 1, base64: PNG.split(",")[1] }]]),
    art: (a, w, h) => {
      arts.push(`${a}:${w.toFixed(1)}x${h.toFixed(1)}`);
      return PNG;
    },
  });
  const bytes = await normalizePptx(await writePresentation(pres));
  const files = new Map((await readZip(bytes)).map((e) => [e.name, new TextDecoder().decode(e.data)]));
  const slides = [...files.keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  assert.equal(slides.length, 12);
  const charts = [...files.keys()].filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  assert.equal(charts.length, 2);
  assert.ok([...charts].some((c) => files.get(c)!.includes("<c:barChart>")));
  assert.ok([...charts].some((c) => files.get(c)!.includes("<c:doughnutChart>")));
  const s1 = files.get("ppt/slides/slide1.xml")!;
  assert.match(s1, /城市绿荫计划：试点评估与第二期提案/);
  assert.match(files.get("ppt/slides/slide3.xml")!, /<a:buChar char="&#x25CF;"/);
  assert.match(files.get("ppt/slides/slide12.xml")!, /<a:buAutoNum/);
  assert.match(files.get("ppt/slides/slide6.xml")!, /81%/);
  const notes = [...files.entries()].filter(([n]) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
  assert.ok(notes.some(([, x]) => x.includes("以前接孩子")));
  assert.ok([...files.keys()].some((n) => n.startsWith("ppt/media/")));
  assert.deepEqual(arts, ["canopy:5.8x7.5"]);
  for (const [n, x] of files) if (/slides\/slide\d+\.xml$/.test(n)) assert.doesNotMatch(x, /<a:pPr[^>]*\/?>(?:(?!<\/a:p>).)*<a:pPr/s, n);
});
test("PPTX：缺少已引用的图片时报错而不是悄悄漏图；插画尺寸可预先枚举", () => {
  const deck = structuredClone(example);
  deck.slides[8].image = { kind: "media", id: MEDIA, alt: "" };
  assert.throws(() => renderPresentation(PptxGenJS as unknown as new () => PptxGenJS, deck, "x", { media: new Map(), art: () => PNG }), /图片/);
  assert.equal(artBoxes(example).length, 2);
});
test("PDF：每页一张 JPEG，交叉引用偏移准确，标题以 UTF-16 写入", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = buildPdf([{ jpeg, width: 1920, height: 1080 }, { jpeg, width: 1920, height: 1080 }], "城市");
  const text = new TextDecoder("latin1").decode(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 2/);
  assert.match(text, /\/Title <FEFF57CE5E02>/);
  const start = Number(text.match(/startxref\n(\d+)/)![1]);
  assert.equal(text.slice(start, start + 4), "xref");
  const offsets = [...text.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  offsets.forEach((o, i) => assert.equal(text.slice(o, o + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  assert.throws(() => buildPdf([{ jpeg: new Uint8Array([1, 2]), width: 1, height: 1 }], "x"), /JPEG/);
});
test("版式几何：所有版式 × 主题的图元都在画布内，字号随内容收缩", () => {
  for (const theme of THEMES)
    for (const layout of LAYOUTS) {
      const slide = switchLayout({ ...example.slides[2], layout: "bullets" }, layout);
      for (const p of slidePrims(slide, THEME_DEFS[theme], { index: 2, total: 12, deckTitle: "t" })) {
        if (p.k === "line") continue;
        assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= SLIDE_W + 0.01 && p.y + p.h <= 7.51, `${layout} ${p.k}`);
      }
    }
  assert.ok(fitSize(["短"], 5, 1, 32, 12) === 32);
  assert.ok(fitSize(["很长".repeat(200)], 5, 1, 32, 12) === 12);
  const marks = chartMarks(example.slides[4].chart!, 7.9, 3.75, THEME_DEFS.paper);
  assert.ok(marks.filter((m) => m.k === "rect").length >= 6);
});
