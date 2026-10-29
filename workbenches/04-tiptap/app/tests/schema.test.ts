// ABOUTME: 0.9.0 新节点与标记的校验边界：表格、任务清单、内嵌图片、高亮、对齐、链接协议与容量上限。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_DOCUMENT_BYTES,
  normalizeLinkInput,
  outline,
  safeHref,
  textStats,
  validateWriting,
} from "../src/contracts/domain.ts";
import { seed } from "../src/contracts/sample.ts";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const doc = (...content: unknown[]) => ({ content: { type: "doc", content } });
const para = (text: string, attrs?: Record<string, unknown>) => ({
  type: "paragraph",
  ...(attrs ? { attrs } : {}),
  content: [{ type: "text", text }],
});
const cell = (type = "tableCell", attrs: Record<string, unknown> = {}) => ({ type, attrs, content: [para("值")] });

test("接受表格、任务清单、内嵌图片、高亮和对齐，并去掉编辑器的默认空属性", () => {
  const value = validateWriting(
    doc(
      para("居中", { textAlign: "center" }),
      para("默认左对齐", { textAlign: "left" }),
      { type: "heading", attrs: { level: 2, textAlign: null }, content: [{ type: "text", text: "标题" }] },
      {
        type: "table",
        content: [
          { type: "tableRow", content: [cell("tableHeader", { colspan: 1, rowspan: 1, colwidth: [120] }), cell()] },
          { type: "tableRow", content: [cell(), cell()] },
        ],
      },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [para("完成")] }] },
      { type: "image", attrs: { src: PNG, alt: "示意图", title: null, width: "320", height: null } },
      {
        type: "paragraph",
        content: [{ type: "text", text: "重点", marks: [{ type: "highlight" }, { type: "underline" }] }],
      },
      { type: "codeBlock", attrs: { language: "typescript" }, content: [{ type: "text", text: "let a = 1;" }] },
    ),
  );
  const [center, left, heading, table, tasks, image] = value.content.content!;
  assert.deepEqual(center.attrs, { textAlign: "center" });
  assert.equal(left.attrs, undefined);
  assert.deepEqual(heading.attrs, { level: 2 });
  assert.deepEqual(table.content![0].content![0].attrs, { colspan: 1, rowspan: 1, colwidth: [120] });
  assert.deepEqual(table.content![1].content![0].attrs, { colspan: 1, rowspan: 1, colwidth: null });
  assert.equal(tasks.content![0].attrs!.checked, true);
  assert.deepEqual(image.attrs, { src: PNG, alt: "示意图", width: 320 });
  assert.deepEqual(validateWriting(seed), seed);
});

test("图片只能是文稿内嵌的位图数据，外部地址与 SVG 都被拒绝", () => {
  for (const src of [
    "https://example.com/a.png",
    "//example.com/a.png",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:image/png;base64,<script>",
    "javascript:alert(1)",
  ])
    assert.throws(() => validateWriting(doc({ type: "image", attrs: { src } })), /图片/);
  assert.throws(() => validateWriting(doc({ type: "image", attrs: { src: PNG, width: -3 } })), /尺寸/);
  assert.throws(() => validateWriting(doc({ type: "image", attrs: { src: PNG }, content: [para("x")] })));
});

test("结构规则覆盖新节点：表格/行/单元格、任务项、对齐与代码语言", () => {
  const bad = [
    doc({ type: "table", content: [para("不是行")] }),
    doc({ type: "table", content: [{ type: "tableRow", content: [para("不是单元格")] }] }),
    doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [] }] }] }),
    doc({ type: "table", content: [{ type: "tableRow", content: [cell("tableCell", { colspan: 2, colwidth: [100] })] }] }),
    doc({ type: "taskList", content: [{ type: "listItem", content: [para("x")] }] }),
    doc({ type: "taskList", content: [{ type: "taskItem", attrs: { checked: "yes" }, content: [para("x")] }] }),
    doc({ type: "taskList", content: [{ type: "taskItem", content: [{ type: "image", attrs: { src: PNG } }] }] }),
    doc(para("x", { textAlign: "middle" })),
    doc({ type: "codeBlock", attrs: { language: "js onload=x" }, content: [{ type: "text", text: "1" }] }),
    doc({ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "textStyle" }] }] }),
    doc({ type: "tableRow", content: [cell()] }),
  ];
  for (const value of bad) assert.throws(() => validateWriting(value));
});

test("链接协议：仅 http/https/mailto/#，并能补全用户输入", () => {
  assert.equal(safeHref("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(safeHref("mailto:team@example.com"), "mailto:team@example.com");
  assert.equal(safeHref("#预算"), "#预算");
  for (const href of ["javascript:alert(1)", "data:text/html,1", "ftp://x", "https://", "http://a b", "vbscript:x", "file:///etc/passwd"])
    assert.equal(safeHref(href), null, href);
  assert.equal(normalizeLinkInput("chunhui.example.org/feedback"), "https://chunhui.example.org/feedback");
  assert.equal(normalizeLinkInput("王老师@example.com".replace("王老师", "wang")), "mailto:wang@example.com");
  assert.equal(normalizeLinkInput("  https://example.com  "), "https://example.com");
  assert.equal(normalizeLinkInput("随便写写"), null);
  assert.equal(normalizeLinkInput("javascript:alert(1)"), null);
});

test("容量：超过 1.6 MB 的文稿被拒绝，并提示删除图片", () => {
  const big = "data:image/png;base64," + "A".repeat(900_000);
  assert.throws(
    () => validateWriting(doc({ type: "image", attrs: { src: big } }, { type: "image", attrs: { src: big } })),
    new RegExp(`${(MAX_DOCUMENT_BYTES / 1_000_000).toFixed(1)} MB`),
  );
  assert.ok(validateWriting(doc({ type: "image", attrs: { src: big } })));
});

test("字数统计按中文字与英文词计，目录按标题顺序编号", () => {
  const value = doc(
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "总览" }] },
    para("我们用 Floatboat 写 3 份 SOP。"),
    { type: "blockquote", content: [{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "引用里的标题" }] }] },
  );
  const stats = textStats(value.content as never);
  assert.equal(stats.words, 2 + 5 + 6 + 3);
  assert.deepEqual(outline(value.content as never).map((item) => [item.index, item.level, item.text]), [
    [0, 1, "总览"],
    [1, 3, "引用里的标题"],
  ]);
});
