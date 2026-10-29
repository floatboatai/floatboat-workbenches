// ABOUTME: Mermaid 源码工具与模型校验：外部资源、Markdown 导入、错误定位、文件名、模板。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowedReference,
  cleanedLineMap,
  extractMermaidBlocks,
  findExternalResources,
  frontmatterTitle,
  locateParseError,
  neutralizeExternal,
  safeFileName,
  sanitizeCssText,
} from "../src/contracts/mermaid-source.ts";
import { restoreDraftData, seed, validate } from "../src/contracts/model.ts";
import { templates } from "../src/contracts/templates.ts";

test("普通文字中的 image: / img: 不再被误判为外部图片", () => {
  for (const source of [
    "flowchart LR\n  A[Docker image: nginx] --> B[img: 缩略图]",
    "sequenceDiagram\n  A->>B: upload image: avatar.png",
    'flowchart LR\n  A["![logo](https://example.com/a.png)"]',
    "flowchart LR\n  A[调用 url(https://api.example.com)]",
  ]) {
    assert.deepEqual(findExternalResources(source), [], source);
    assert.equal(validate({ source }).source, source);
  }
});

test("真正加载外部资源的写法被拦截并给出行号", () => {
  const img =
    'flowchart LR\n  A --> B\n  C@{ img: "https://example.com/a.png", label: "x" }';
  assert.deepEqual(findExternalResources(img), [
    { line: 3, url: "https://example.com/a.png" },
  ]);
  assert.throws(() => validate({ source: img }), /第 3 行引用外部资源/);
  const css =
    "flowchart LR\n  A-->B\n  classDef bg fill:url(https://x.test/p.png)";
  assert.equal(findExternalResources(css)[0].line, 3);
  const directive =
    "%%{init: {'themeCSS': '@import url(//evil.test/a.css); .node rect{fill:red}'}}%%\nflowchart LR\n A-->B";
  assert.ok(findExternalResources(directive).length >= 1);
  const front =
    "---\nconfig:\n  themeCSS: \".x{background:url('http://a.test/b.png')}\"\n---\nflowchart LR\n A-->B";
  assert.equal(findExternalResources(front)[0].line, 3);
  // 内嵌 data: 图片与片段引用允许
  assert.deepEqual(
    findExternalResources(
      'flowchart LR\n  C@{ img: "data:image/png;base64,iVBOR", w: 40 }',
    ),
    [],
  );
  assert.deepEqual(
    findExternalResources("flowchart LR\n  classDef a fill:url(#grad)"),
    [],
  );
});

test("渲染前移除联网写法且保持行数", () => {
  const source = [
    "---",
    "config:",
    "  themeCSS: \".n{background:url('https://a.test/b.png')}\"",
    "---",
    "flowchart LR",
    '  logo@{ img: "https://example.com/logo.png", label: "Logo", w: 60 }',
    '  inline@{ img: "data:image/png;base64,AAA", label: "ok" }',
    "  classDef bg fill:url(http://x.test/p.png)",
    "  A[Docker image: nginx] --> logo",
  ].join("\n");
  const safe = neutralizeExternal(source);
  assert.equal(safe.split("\n").length, source.split("\n").length);
  assert.deepEqual(findExternalResources(safe), []);
  assert.match(safe, /logo@\{\s+label: "Logo", w: 60 \}/);
  assert.match(safe, /data:image\/png;base64,AAA/);
  assert.match(safe, /A\[Docker image: nginx\]/);
  const plain = "flowchart LR\n  A-->B";
  assert.equal(neutralizeExternal(plain), plain);
});

test("CSS 与引用净化", () => {
  assert.equal(
    sanitizeCssText(
      "@import url(https://a.test/x.css); .a{fill:url(#g);background:url('https://t.test/i.png')}",
    ),
    " .a{fill:url(#g);background:none}",
  );
  assert.equal(allowedReference("#arrowhead", "use"), true);
  assert.equal(allowedReference("data:image/png;base64,AAA", "image"), true);
  assert.equal(
    allowedReference("data:image/svg+xml;base64,AAA", "image"),
    false,
  );
  assert.equal(allowedReference("https://example.com/a.png", "image"), false);
  assert.equal(allowedReference("https://example.com", "a"), true);
  assert.equal(allowedReference("javascript:alert(1)", "a"), false);
});

test("模型：旧文件补默认外观，主题/风格校验，草稿可保存未完成内容", () => {
  assert.deepEqual(validate({ source: "flowchart LR\nA-->B" }), {
    source: "flowchart LR\nA-->B",
    theme: "neutral",
    look: "classic",
  });
  assert.deepEqual(validate(seed), seed);
  assert.equal(
    validate({ ...seed, theme: "dark", look: "handDrawn" }).look,
    "handDrawn",
  );
  assert.throws(() => validate({ ...seed, theme: "neon" }), /主题/);
  assert.throws(() => validate({ ...seed, look: "pixel" }), /风格/);
  assert.throws(() => validate({ ...seed, source: "x".repeat(100001) }));
  assert.equal(
    validate({ ...seed, source: "x".repeat(99000) }).source.length,
    99000,
  );
  assert.deepEqual(restoreDraftData({ source: "" }), {
    source: "",
    theme: "neutral",
    look: "classic",
  });
  assert.throws(() => restoreDraftData({ source: "a", theme: 3 }));
});

test("Markdown 中提取 mermaid 代码块及所在标题", () => {
  const md = [
    "# 系统设计",
    "说明文字",
    "## 登录时序",
    "```mermaid",
    "sequenceDiagram",
    "  A->>B: hi",
    "```",
    "```js",
    "const x = 1",
    "```",
    "## 数据模型",
    "~~~~ mermaid",
    "erDiagram",
    "  A ||--o{ B : has",
    "```",
    "~~~~",
    "::: mermaid",
    "pie",
    '  "a" : 1',
    ":::",
    "  ```mermaid",
    "  flowchart LR",
    "    X-->Y",
    "  ```",
  ].join("\r\n");
  const blocks = extractMermaidBlocks(md);
  assert.equal(blocks.length, 4);
  assert.deepEqual(blocks[0], {
    source: "sequenceDiagram\n  A->>B: hi",
    title: "登录时序",
    line: 4,
  });
  assert.equal(blocks[1].source, "erDiagram\n  A ||--o{ B : has\n```");
  assert.equal(blocks[1].title, "数据模型");
  assert.equal(blocks[2].source, 'pie\n  "a" : 1');
  assert.equal(blocks[3].source, "flowchart LR\n  X-->Y");
  assert.deepEqual(extractMermaidBlocks("# 无图\n```js\nx\n```"), []);
});

test("frontmatter 标题", () => {
  assert.equal(
    frontmatterTitle("---\ntitle: 发布流程\n---\nflowchart LR\nA-->B"),
    "发布流程",
  );
  assert.equal(
    frontmatterTitle(
      '---\ntitle: "带引号"\nconfig:\n  look: handDrawn\n---\npie',
    ),
    "带引号",
  );
  assert.equal(frontmatterTitle("flowchart LR\nA-->B"), "");
});

test("安全文件名", () => {
  assert.equal(safeFileName("发布流程", "png"), "发布流程.png");
  assert.equal(
    safeFileName('a/b\\c:d*e?"f"<g>|h', "svg"),
    "a b c d e f g h.svg",
  );
  assert.equal(safeFileName("  ..隐藏.  ", "mmd"), "隐藏.mmd");
  assert.equal(safeFileName("", "mmd"), "diagram.mmd");
  assert.equal(safeFileName("CON", "png"), "CON_.png");
  assert.equal(safeFileName("行\n换\t行", "mmd"), "行 换 行.mmd");
  assert.equal(Array.from(safeFileName("长".repeat(200), "png")).length, 84);
  assert.equal(safeFileName("../../etc/passwd", "mmd"), "etc passwd.mmd");
});

test("解析错误映射回原始行：frontmatter、指令、注释与空行", () => {
  const source = [
    "---", // 1
    "title: 例子", // 2
    "---", // 3
    "%%{init: {'theme':'dark'}}%%", // 4
    "flowchart LR", // 5
    "  %% 注释", // 6
    "", // 7
    "  %% 第二个注释", // 8
    "  A --> B", // 9
    "  B --> C[未闭合", // 10
  ].join("\n");
  const map = cleanedLineMap(source);
  // 清理后：第 1 行 = 空（指令行），第 2 行 = flowchart，第 3 行 = A --> B，第 4 行 = 未闭合
  assert.equal(map[map.length - 1], 10);
  const lineOfB = map.findIndex((line) => line === 10) + 1;
  const error = Object.assign(new Error("Parse error on line X"), {
    hash: {
      loc: {
        first_line: lineOfB,
        first_column: 4,
        last_line: lineOfB,
        last_column: 9,
      },
    },
  });
  assert.deepEqual(
    {
      line: locateParseError(error, source).line,
      column: locateParseError(error, source).column,
    },
    { line: 10, column: 5 },
  );
  // 无 hash 时从消息中读取行列（langium 解析器）
  const plain = new Error(
    "Parsing failed: Lexer error on line 2, column 3: unexpected character",
  );
  assert.deepEqual(locateParseError(plain, "pie\n  ? 1").line, 2);
  assert.equal(locateParseError(plain, "pie\n  ? 1").column, 3);
  // 未识别类型定位到首个有效行
  const unknown = new Error(
    "No diagram type detected matching given configuration for text: hello",
  );
  const located = locateParseError(unknown, "\n%% c\nhello world");
  assert.equal(located.line, 3);
  assert.match(located.message, /没有识别到图类型/);
  // Expecting 行作为简要消息
  const jison = Object.assign(
    new Error(
      "Parse error on line 2:\n...LR  A-->\n----------------^\nExpecting 'AMP', 'ALPHA', got 'EOF'",
    ),
    { hash: { line: 1 } },
  );
  const out = locateParseError(jison, "flowchart LR\n  A-->");
  assert.equal(out.line, 2);
  assert.match(out.message, /^Expecting/);
});

test("模板覆盖主要图类型且全部通过正式校验", () => {
  const kinds = new Set(
    templates.map((t) => t.source.trimStart().split(/\s/)[0]),
  );
  for (const kind of [
    "flowchart",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram-v2",
    "erDiagram",
    "gantt",
    "mindmap",
    "timeline",
    "pie",
    "quadrantChart",
    "journey",
    "gitGraph",
    "architecture-beta",
  ])
    assert.ok(kinds.has(kind), kind);
  assert.equal(new Set(templates.map((t) => t.id)).size, templates.length);
  for (const template of templates)
    assert.equal(validate({ source: template.source }).source, template.source);
});
