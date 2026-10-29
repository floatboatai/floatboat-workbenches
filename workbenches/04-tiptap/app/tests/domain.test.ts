import assert from "node:assert/strict";
import { test } from "node:test";
import { validateWriting, plainText } from "../src/contracts/domain.ts";
import { seed } from "../src/contracts/sample.ts";
test("示例文稿通过校验，表格按制表符输出可读文本", () => {
  const parsed = validateWriting(seed);
  assert.deepEqual(parsed, seed);
  assert.match(plainText(parsed.content), /自助借还设备\t1 台\t9,800/);
});
test("拒绝危险链接和不符合编辑器语法的结构", () => {
  for (const content of [
    { type: "doc", content: [{ type: "text", text: "非法根文字" }] },
    {
      type: "doc",
      content: [{ type: "bulletList", content: [{ type: "paragraph" }] }],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "链接",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    },
    { type: "doc", content: [{ type: "heading", attrs: { level: 6 } }] },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "image", attrs: { src: "x" } }],
        },
      ],
    },
  ])
    assert.throws(() => validateWriting({ content }));
});
test("安全链接统一隔离新窗口", () => {
  const value = validateWriting({
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "官网",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    },
  });
  assert.equal(
    value.content.content?.[0].content?.[0].marks?.[0].attrs?.rel,
    "noopener noreferrer",
  );
});
