import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { validatePage, exportHtml, renderCss } from "../src/contracts/page.ts";
import { seed, blocks } from "../src/contracts/templates.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";

test("模板和所有原生区块可安全往返，完整网页包含内容与响应样式", () => {
  const data = validatePage(structuredClone(seed));
  for (const block of blocks)
    validatePage({ ...data, components: [block.content] });
  assert.deepEqual(validatePage(JSON.parse(JSON.stringify(data))), data);
  const html = exportHtml(data, "页面 <标题>");
  assert.match(html, /<!doctype html>/);
  assert.match(html, /&lt;标题&gt;/);
  assert.match(html, /把日常/);
  assert.match(html, /@media \(max-width: 480px\)/);
  assert.doesNotMatch(html, /<script|<iframe|https?:\/\//);
  assert.match(renderCss(data), /\.hero-title\{/);
});
test("导入拒绝脚本、网络资源、事件、可执行内容和 CSS 请求", () => {
  const attempts = [
    { tagName: "script", content: "alert(1)" },
    { tagName: "iframe", attributes: { src: "https://evil.test" } },
    { tagName: "div", attributes: { onclick: "alert(1)" } },
    { tagName: "a", attributes: { href: "javascript:alert(1)" } },
    { tagName: "p", content: '<img src="https://evil.test">' },
    { tagName: "p", script: "alert(1)" },
    { tagName: "p", type: ["text"] },
    { tagName: "p", style: { "background-image": "url(https://evil.test)" } },
    {
      tagName: "p",
      style: { "background-image": 'image-set("https://evil.test" 1x)' },
    },
  ];
  for (const component of attempts)
    assert.throws(() =>
      validatePage({ version: 1, components: [component], rules: [] }),
    );
});
test("导入拒绝超量元素、过深结构和未知样式", () => {
  assert.throws(() =>
    validatePage({
      version: 1,
      components: Array.from({ length: 1001 }, () => ({ tagName: "p" })),
      rules: [],
    }),
  );
  let child: unknown = { tagName: "p" };
  for (let n = 0; n < 26; n++) child = { tagName: "div", components: [child] };
  assert.throws(() =>
    validatePage({ version: 1, components: [child], rules: [] }),
  );
  assert.throws(() =>
    validatePage({
      ...seed,
      rules: [{ selector: ".x", style: { behavior: "test" } }],
    }),
  );
  assert.throws(() =>
    validatePage({ ...seed, rules: [{ selector: "<style>", style: {} }] }),
  );
});
test("已转义文字与锚点导出保持安全", () => {
  const data = validatePage({
    version: 1,
    components: [
      { tagName: "p", type: "text", content: "&lt;script&gt;安全 &amp; 完整" },
      {
        tagName: "a",
        attributes: { href: "#about", title: '"<点击>' },
        content: "继续",
      },
    ],
    rules: [],
  });
  const html = exportHtml(data, "测试");
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /title="&quot;&lt;点击&gt;"/);
  assert.doesNotMatch(html, /<script>/);
});
function database() {
  const db = new DatabaseSync(":memory:");
  for (const name of [
    "0001_initial.sql",
    "0002_projects.sql",
    "0003_autosave.sql",
  ])
    db.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  return db;
}
function request() {
  return {
    documentId: randomUUID(),
    mutationId: randomUUID(),
    draftRevision: 0,
    projectId: null,
    projectRevision: null,
    snapshot: {
      title: "页面",
      data: structuredClone(seed),
      extra: {
        source: '{"unfinished":',
        nativeInput: { id: "title", index: 0, value: "12r" },
      },
    },
  };
}
test("自动保存保存模型与未完成源码、重放丢失响应不会生成重复页面", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validatePage);
    const first = request();
    const receipt = await store.commit(first);
    assert.equal(receipt.phase, "saved");
    assert.deepEqual(await store.commit(first), receipt);
    assert.equal(db.prepare("SELECT count(*) n FROM projects").get()?.n, 1);
    assert.deepEqual(
      store.get(first.documentId)?.snapshot.extra,
      first.snapshot.extra,
    );
  } finally {
    db.close();
  }
});
test("无效模型只保留草稿，冲突无法覆盖另一版本", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validatePage);
    const first = request();
    const receipt = await store.commit(first);
    const project = receipt.project!;
    const invalid = {
      ...request(),
      snapshot: {
        ...first.snapshot,
        data: { version: 1, components: [{ tagName: "script" }], rules: [] },
      },
    };
    assert.equal((await store.commit(invalid)).phase, "draft");
    db.prepare(
      "UPDATE projects SET revision=revision+1,title=? WHERE id=?",
    ).run("其他窗口", project.id);
    const conflict = {
      ...request(),
      projectId: project.id,
      projectRevision: project.revision,
    };
    assert.equal((await store.commit(conflict)).phase, "conflict");
    assert.equal(
      db.prepare("SELECT title FROM projects WHERE id=?").get(project.id)
        ?.title,
      "其他窗口",
    );
  } finally {
    db.close();
  }
});
