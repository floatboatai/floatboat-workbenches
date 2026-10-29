// ABOUTME: 用真实 PptxGenJS 生成示例文稿，再打开 ZIP 校验页数、母版、图表、媒体、超链接、备注与段落属性。
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import PptxGenJS from "pptxgenjs";
import { seed, SEED_MEDIA_ID } from "../src/contracts/seed.ts";
import { DEMO_MEDIA } from "../src/server/demo-media.ts";
import { renderPresentation, writePresentation, type MediaAsset } from "../src/shared/pptx-render.ts";
import { fixParagraphProperties, normalizePptx, readZip, writeZip } from "../src/shared/zip.ts";
import { LAYOUTS } from "../src/contracts/layouts.ts";
import type { Deck } from "../src/contracts/domain.ts";

const media = new Map<string, MediaAsset>([[SEED_MEDIA_ID, { ...DEMO_MEDIA }]]);
async function build(deck: Deck) {
  const bytes = await normalizePptx(await writePresentation(renderPresentation(PptxGenJS, deck, "测试文稿", media)));
  const entries = await readZip(bytes);
  const text = new Map(entries.map((e) => [e.name, e.data]));
  const xml = (name: string) => {
    const data = text.get(name);
    assert.ok(data, `missing ${name}`);
    return new TextDecoder().decode(data);
  };
  return { bytes, names: entries.map((e) => e.name), xml };
}

test("示例插画的哈希与示例文稿引用一致", () => {
  const hash = createHash("sha256").update(Buffer.from(DEMO_MEDIA.base64, "base64")).digest("hex");
  assert.equal(hash, SEED_MEDIA_ID);
});

test("示例文稿导出为可打开的 PPTX：10 页、10 个版式母版、2 个原生图表、1 张图片", async () => {
  const { bytes, names, xml } = await build(seed);
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), "PK");
  const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  assert.equal(slides.length, 10);
  const layouts = names.filter((n) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n));
  assert.ok(layouts.length >= Object.keys(LAYOUTS).length);
  const layoutNames = layouts.map((n) => /<p:cSld name="([^"]+)"/.exec(xml(n))?.[1]);
  for (const def of Object.values(LAYOUTS)) assert.ok(layoutNames.includes(def.label), `layout ${def.label}`);
  const charts = names.filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  assert.equal(charts.length, 2);
  const chartXml = charts.map(xml).join("");
  assert.match(chartXml, /<c:barChart>/);
  assert.match(chartXml, /<c:doughnutChart>/);
  assert.match(chartXml, /2026 年/);
  assert.ok(names.some((n) => /^ppt\/embeddings\/.+\.xlsx$/.test(n)), "chart data workbook embedded");
  const images = names.filter((n) => /^ppt\/media\/.+\.(jpeg|jpg)$/.test(n));
  assert.equal(images.length, 1);
  const types = xml("[Content_Types].xml");
  assert.match(types, /drawingml\.chart\+xml/);

  const presentation = xml("ppt/presentation.xml");
  assert.match(presentation, /<p:sldSz cx="12192000" cy="6858000"/);

  const cover = xml("ppt/slides/slide1.xml");
  assert.match(cover, /门店运营复盘与第四季度计划/);
  assert.match(cover, /<p:ph[^>]*type="title"/, "title is bound to the master placeholder");
  const bullets = xml("ppt/slides/slide4.xml");
  assert.match(bullets, /<a:hlinkClick r:id="rId\d+"/);
  assert.match(xml("ppt/slides/_rels/slide4.xml.rels"), /https:\/\/www\.example\.com\/reports\/membership-2026q3/);
  assert.match(bullets, /b="1"/);
  for (const name of slides) {
    for (const paragraph of xml(name).match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []) {
      const count = paragraph.match(/<a:pPr\b/g)?.length ?? 0;
      assert.ok(count <= 1, `${name} paragraph has ${count} pPr`);
      if (count) assert.ok(paragraph.startsWith("<a:p><a:pPr"), `${name} pPr must be first`);
    }
  }
  const table = xml("ppt/slides/slide5.xml");
  assert.match(table, /<a:tbl>/);
  assert.equal(table.match(/<a:tr /g)?.length, 6);
  const notes = names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map(xml).join("");
  assert.match(notes, /强调 9 月开学季的拉动/);
  const roadmap = xml("ppt/slides/slide10.xml");
  assert.match(roadmap, /prst="roundRect"/);
  assert.match(roadmap, /prst="rightArrow"/);
});

test("主题比例、隐藏页与品牌颜色写入 PPTX", async () => {
  const deck = structuredClone(seed);
  deck.theme.aspect = "4:3";
  deck.theme.colors.accent = "C2185B";
  deck.slides[1].hidden = true;
  deck.slides[2].elements = deck.slides[2].elements.map((el) => (el.type === "chart" ? { ...el, chart: "line" } : el));
  const { xml, names } = await build(deck);
  assert.match(xml("ppt/presentation.xml"), /<p:sldSz cx="9144000" cy="6858000"/);
  assert.match(xml("ppt/slides/slide2.xml"), /<p:sld[^>]*show="0"/);
  assert.match(xml("ppt/slides/slide2.xml"), /C2185B|<p:bg>|/);
  const layoutXml = names.filter((n) => /slideLayouts\/slideLayout\d+\.xml$/.test(n)).map(xml).join("");
  assert.match(layoutXml, /C2185B/);
  assert.match(names.filter((n) => /charts\/chart\d+\.xml$/.test(n)).map(xml).join(""), /<c:lineChart>/);
});

test("段落属性修正只保留首个 pPr，并保持在段首", () => {
  const input = '<a:p><a:pPr marL="1"/><a:r><a:t>A</a:t></a:r><a:pPr indent="0" marL="0"><a:buNone/></a:pPr><a:r><a:t>B</a:t></a:r></a:p><a:p><a:r><a:t>C</a:t></a:r></a:p>';
  assert.equal(
    fixParagraphProperties(input),
    '<a:p><a:pPr marL="1"/><a:r><a:t>A</a:t></a:r><a:r><a:t>B</a:t></a:r></a:p><a:p><a:r><a:t>C</a:t></a:r></a:p>',
  );
});

test("ZIP 写入后可无损读回", async () => {
  const data = new TextEncoder().encode("你好".repeat(500));
  const bytes = await writeZip([
    { name: "a.txt", data },
    { name: "dir/b.bin", data: new Uint8Array([1, 2, 3]) },
  ]);
  const entries = await readZip(bytes);
  assert.deepEqual(
    entries.map((e) => e.name),
    ["a.txt", "dir/b.bin"],
  );
  assert.deepEqual(entries[0].data, data);
  assert.deepEqual([...entries[1].data], [1, 2, 3]);
});
