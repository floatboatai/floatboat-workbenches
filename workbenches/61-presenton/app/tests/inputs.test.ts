import assert from "node:assert/strict";
import { test } from "node:test";
import { briefFromFile, csvToMarkdown, decodeText, htmlToMarkdown } from "../src/contracts/brief-import.ts";
import { outlineFromBrief } from "../src/contracts/generate.ts";
import { blank } from "../src/contracts/model.ts";
import { outlinePrompt, parseModelOutline } from "../src/contracts/model-outline.ts";
import { createModelChannel, type HostModel } from "../src/server/model.ts";
import { WorkbenchHostError } from "../sdk/host.mjs";
import { writeZip } from "../src/shared/zip.ts";
import { SAMPLE_BRIEF } from "../src/contracts/sample-brief.ts";

const enc = new TextEncoder();
const docxXml = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>
<w:p><w:pPr><w:pStyle w:val="1"/></w:pPr><w:r><w:t>门店复盘</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="2"/></w:pPr><w:r><w:t>销售</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">三季度销售额 </w:t></w:r><w:r><w:t>增长 12%。</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>新会员 3,200 人</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>月份</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>销售额（万元）</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>7 月</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>412</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>8 月</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>398</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
</w:body></w:document>`;
const stylesXml = `<w:styles xmlns:w="w"><w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="2"><w:name w:val="heading 2"/></w:style></w:styles>`;

test("读入 .docx：标题样式、跨 run 文字、列表与表格转为 Markdown，并能直接生成图表页", async () => {
  const bytes = await writeZip([
    { name: "[Content_Types].xml", data: enc.encode("<Types/>") },
    { name: "word/document.xml", data: enc.encode(docxXml) },
    { name: "word/styles.xml", data: enc.encode(stylesXml) },
    { name: "word/media/big.bin", data: new Uint8Array(200_000) },
  ]);
  const md = await briefFromFile("复盘.docx", bytes);
  assert.match(md, /^# 门店复盘/);
  assert.match(md, /## 销售/);
  assert.match(md, /三季度销售额 增长 12%。/);
  assert.match(md, /- 新会员 3,200 人/);
  assert.match(md, /\| 7 月 \| 412 \|/);
  const outline = outlineFromBrief({ ...blank.brief, source: md }).items;
  assert.ok(outline.some((o) => o.layout === "chart" && o.chart?.type === "line"));
});
test("读入 HTML / CSV / GB18030 文本；不能读取的格式给出可执行的提示", async () => {
  const md = htmlToMarkdown("<html><head><style>x{}</style></head><body><h1>报告</h1><script>alert(1)</script><p>正文 &amp; 说明</p><ul><li>一</li><li>二</li></ul><table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>");
  assert.match(md, /^# 报告/);
  assert.doesNotMatch(md, /alert|x\{\}/);
  assert.match(md, /正文 & 说明/);
  assert.match(md, /- 一\n- 二/);
  assert.match(md, /\| 1 \| 2 \|/);
  assert.match(csvToMarkdown('城市,人口\n"上海, 浦东",100\n杭州,80\n', "城市.csv"), /\| 上海, 浦东 \| 100 \|/);
  const gbk = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);
  assert.equal(decodeText(gbk), "中文");
  await assert.rejects(() => briefFromFile("a.pdf", new Uint8Array([1])), /另存为/);
  await assert.rejects(() => briefFromFile("a.txt", enc.encode("   ")), /没有可读/);
  assert.equal(await briefFromFile("a.md", enc.encode("﻿# 标题\n正文")), "# 标题\n正文");
});
test("模型大纲：提示包含资料与限制；输出容忍代码块，未知版式回退，坏图表丢弃", () => {
  const p = outlinePrompt({ ...blank.brief, source: SAMPLE_BRIEF, audience: "评审", length: 10 });
  assert.match(p.prompt, /正好 10 页/);
  assert.match(p.prompt, /桂园路/);
  assert.match(p.system, /不编造/);
  const items = parseModelOutline(
    '```json\n{"slides":[{"layout":"cover","title":"T","points":["a"]},{"layout":"weird","title":"","points":["b",3]},{"layout":"chart","title":"C","chart":{"type":"bar","categories":["x"],"series":[{"name":"s","values":[1,2]}]}}]}\n```',
  );
  assert.deepEqual(items.map((i) => i.layout), ["cover", "bullets", "bullets"]);
  assert.equal(items[1].title, "第 2 页");
  assert.deepEqual(items[1].points, ["b", "3"]);
  assert.throws(() => parseModelOutline("抱歉，我不能"), /本地生成/);
});
test("Host 通道（mock，未发起真实调用）：状态、起草、未连接与截断的可读错误", async () => {
  const calls: unknown[] = [];
  const ok: HostModel = {
    capabilities: { list: async () => ({ capabilities: [{ operation: "generateText", status: "available" }] }) },
    llm: {
      generateText: async (input) => {
        calls.push(input);
        return { text: '{"slides":[{"layout":"cover","title":"模型封面","points":["x"]}]}', model: "mock-model", finishReason: "stop" };
      },
    },
  };
  const ch = createModelChannel(ok);
  assert.equal((await ch.status()).available, true);
  const r = await ch.draft({ brief: { ...blank.brief, source: SAMPLE_BRIEF } });
  assert.equal(r.items[0].title, "模型封面");
  assert.equal(r.model, "mock-model");
  assert.equal(calls.length, 1);
  await assert.rejects(() => ch.draft({ brief: { ...blank.brief, source: "太短" } }), /资料太少/);
  const offline = createModelChannel({
    capabilities: { list: async () => Promise.reject(new WorkbenchHostError({ code: "HOST_NOT_CONNECTED", message: "offline" })) },
    llm: { generateText: async () => Promise.reject(new WorkbenchHostError({ code: "HOST_NOT_CONNECTED", message: "offline" })) },
  });
  const s = await offline.status();
  assert.equal(s.available, false);
  assert.match(s.message, /重新检查/);
  await assert.rejects(() => offline.draft({ brief: { ...blank.brief, source: SAMPLE_BRIEF } }), /未连接 Floatboat/);
  const cut = createModelChannel({ ...ok, llm: { generateText: async () => ({ text: "{", model: "m", finishReason: "length" }) } });
  await assert.rejects(() => cut.draft({ brief: { ...blank.brief, source: SAMPLE_BRIEF } }), /截断/);
});
