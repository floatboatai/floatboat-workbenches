// ABOUTME: 文件进出：Markdown 往返与导入清理、JSON 备份/旧格式/恢复草稿识别、HTML 外壳标题与安全、文件名清理。
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateWriting } from "../src/contracts/domain.ts";
import { seed, seedTitle } from "../src/contracts/sample.ts";
import { fromMarkdown, markdownForPrompt, toMarkdown } from "../src/contracts/markdown.ts";
import {
  BACKUP_FORMAT,
  backupJson,
  escapeHtml,
  htmlDocument,
  importKind,
  parseJsonImport,
  safeFileName,
  titleFromFileName,
} from "../src/contracts/files.ts";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("示例文稿 Markdown 往返后结构与内容不变（表格、任务、高亮、链接、引用）", () => {
  const markdown = toMarkdown(seedTitle, seed.content);
  assert.ok(markdown.startsWith(`# ${seedTitle}\n\n`));
  assert.match(markdown, /\| 书架与阅读桌椅 \| 1 套\s+\| 18,000 \|/);
  assert.match(markdown, /- \[x\] 完成居民问卷与需求汇总/);
  assert.match(markdown, /==11 月居民议事会==/);
  const back = fromMarkdown(markdown, { extractTitle: true });
  assert.equal(back.title, seedTitle);
  assert.deepEqual(back.notes, []);
  assert.deepEqual(back.data, validateWriting(seed));
});

test("以中文标点结尾的加粗导出后仍能读回为加粗", () => {
  const content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "志愿者不足：", marks: [{ type: "bold" }] },
          { type: "text", text: "与中学合作，" },
          { type: "text", text: "“重点”", marks: [{ type: "italic" }] },
          { type: "text", text: "说明" },
        ],
      },
    ],
  };
  const markdown = toMarkdown("t", content);
  const back = fromMarkdown(markdown, { extractTitle: true }).data.content.content![0].content!;
  assert.deepEqual(back.find((node) => node.text === "志愿者不足")?.marks, [{ type: "bold" }]);
  assert.deepEqual(back.find((node) => node.text?.includes("重点"))?.marks, [{ type: "italic" }]);
  assert.ok(!markdown.includes("**志愿者不足：**"));
});

test("下划线与删除线、行内代码在 Markdown 中往返", () => {
  const content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "春晖", marks: [{ type: "bold" }, { type: "underline" }] },
          { type: "text", text: " 旧址 ", marks: [{ type: "strike" }] },
          { type: "text", text: "npm run build", marks: [{ type: "code" }] },
        ],
      },
    ],
  };
  const markdown = toMarkdown("t", content);
  assert.match(markdown, /\+\+春晖\+\+|\*\*\+\+春晖\+\+\*\*/);
  const back = fromMarkdown(markdown, { extractTitle: true }).data.content.content![0].content!;
  const marks = (text: string) => back.find((node) => node.text?.includes(text))?.marks?.map((mark) => mark.type).sort();
  assert.deepEqual(marks("春晖"), ["bold", "underline"]);
  assert.deepEqual(marks("旧址"), ["strike"]);
  assert.deepEqual(marks("npm"), ["code"]);
});

test("导入 Markdown：frontmatter 标题、CRLF/BOM、外部图片改链接、危险链接去除、四级标题并入三级", () => {
  const source =
    "﻿---\r\ntitle: \"周会纪要\"\r\n---\r\n\r\n## 议题\r\n\r\n![现场](https://example.com/a.jpg)\r\n\r\n#### 细节\r\n\r\n[点我](javascript:alert(1)) <img src=x onerror=alert(1)>\r\n\r\n```ts title=x\r\nconst a = 1;\r\n```\r\n\r\n![内嵌](" +
    PNG +
    ")\r\n";
  const result = fromMarkdown(source, { extractTitle: true });
  assert.equal(result.title, "周会纪要");
  const json = JSON.stringify(result.data);
  assert.ok(json.includes('"href":"https://example.com/a.jpg"'));
  assert.ok(!json.includes("javascript:"));
  assert.ok(json.includes("<img src=x onerror=alert(1)>"), "原始 HTML 只作为文字保留");
  assert.ok(json.includes('"language":"ts"'));
  assert.ok(json.includes(`"src":"${PNG}"`));
  const levels = result.data.content.content!.filter((node) => node.type === "heading").map((node) => node.attrs!.level);
  assert.deepEqual(levels, [2, 3]);
  assert.equal(result.notes.length, 3);
});

test("首个一级标题成为文稿标题；空 Markdown 得到一个空段落", () => {
  const titled = fromMarkdown("# 年度报告\n\n正文", { extractTitle: true });
  assert.equal(titled.title, "年度报告");
  assert.equal(titled.data.content.content![0].type, "paragraph");
  const kept = fromMarkdown("# 年度报告\n\n正文");
  assert.equal(kept.title, null);
  assert.equal(kept.data.content.content![0].type, "heading");
  assert.deepEqual(fromMarkdown("").data.content, { type: "doc", content: [{ type: "paragraph" }] });
});

test("写作助手的参考正文不包含图片数据并有长度上限", () => {
  const value = validateWriting({
    content: {
      type: "doc",
      content: [
        { type: "image", attrs: { src: PNG, alt: "平面图" } },
        { type: "paragraph", content: [{ type: "text", text: "长".repeat(50) }] },
      ],
    },
  });
  const prompt = markdownForPrompt(value.content, 30);
  assert.ok(!prompt.includes("data:image"));
  assert.ok(prompt.includes("［图片：平面图］"));
  assert.ok(prompt.endsWith("（正文较长，后文已省略）"));
});

test("JSON：完整备份、0.3.0 导出、裸 doc 与恢复草稿都能导入，未知版本被拒绝", () => {
  const backup = JSON.parse(backupJson("方案 A", seed, new Date("2026-10-29T00:00:00Z")));
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.exportedAt, "2026-10-29T00:00:00.000Z");
  assert.deepEqual(parseJsonImport(backup), { title: "方案 A", data: validateWriting(seed) });
  assert.deepEqual(parseJsonImport({ content: seed.content }).title, null);
  assert.deepEqual(parseJsonImport(seed.content).data, validateWriting(seed));
  assert.equal(parseJsonImport({ documentId: "x", snapshot: { title: "草稿", data: seed, extra: {} } }).title, "草稿");
  assert.throws(() => parseJsonImport({ ...backup, version: 9 }), /更新的写作台版本/);
  assert.throws(() => parseJsonImport([]), /不是文稿/);
  assert.throws(() => parseJsonImport({ hello: 1 }), /没有可识别/);
  assert.throws(() => parseJsonImport({ ...backup, content: { type: "doc", content: [{ type: "image", attrs: { src: "https://x/y.png" } }] } }));
});

test("HTML 外壳：标题转义、无脚本和外部资源", () => {
  const html = htmlDocument('<script>alert("x")</script> & 方案', "<p>正文</p>", new Date("2026-10-29T08:00:00Z"));
  assert.match(html, /<title>&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; 方案<\/title>/);
  assert.ok(html.includes("<h1>&lt;script&gt;"));
  assert.ok(!/<script/i.test(html));
  assert.ok(!/(src|href)="https?:/i.test(html));
  assert.ok(!/@import|url\(/i.test(html));
  assert.equal(escapeHtml(`'"<>&`), "&#39;&quot;&lt;&gt;&amp;");
});

test("文件名与导入类型", () => {
  assert.equal(safeFileName('Q3/发布:计划*"终版"', "md"), "Q3 发布 计划 终版.md");
  assert.equal(safeFileName("con", "html"), "con-文稿.html");
  assert.equal(safeFileName("   ", "json"), "文稿.json");
  assert.equal(safeFileName("a".repeat(200), "md").length, 83);
  assert.equal(importKind("纪要.MD"), "markdown");
  assert.equal(importKind("notes.txt"), "markdown");
  assert.equal(importKind("备份.json"), "json");
  assert.equal(importKind("photo.png", "image/png"), null);
  assert.equal(titleFromFileName("会议_纪要.markdown"), "会议 纪要");
});
