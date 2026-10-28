import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  seed,
  validateEmail,
  restoreEmail,
  importEmail,
  variablesValue,
  substitute,
} from "../src/contracts/email.ts";
import { renderEmail } from "../src/server/render-email.ts";
import { createStore } from "../src/server/store.ts";
test("官方组件和官方renderer输出可用HTML及纯文本", async () => {
  const v = await renderEmail(seed);
  assert.match(v.html, /<!DOCTYPE html/);
  assert.match(v.html, /role="presentation"/);
  assert.match(v.html, /<!--[\s\S]*?mso/);
  assert.match(v.html, /<h1/);
  assert.match(v.html, /<hr/);
  assert.match(v.html, /https:\/\/example.com\/letters\/october/);
  assert.match(v.subject, /林然/);
  assert.match(v.text, /你好，林然/);
  assert.doesNotMatch(v.text, /<table/);
  assert.equal(v.missing.length, 0);
});
test("示例收件人覆盖默认值且不执行模板表达式", async () => {
  const v = await renderEmail({ ...seed, selectedRecipient: "xu" });
  assert.match(v.html, /许诺/);
  const missing = new Set<string>();
  assert.equal(
    substitute(
      "{{name}} {{globalThis.x()}} {{unset}}",
      { name: "林然" },
      missing,
    ),
    "林然 {{globalThis.x()}} {{unset}}",
  );
  assert.deepEqual([...missing], ["unset"]);
});
test("文字和变量中的HTML按React文字转义", async () => {
  const v = await renderEmail({
    ...seed,
    variables: { name: "<script>alert(1)</script>" },
    selectedRecipient: "",
  });
  assert.match(v.html, /&lt;script&gt;/);
  assert.doesNotMatch(v.html, /<script>/);
});
test("脚本和未完成按钮链接只保留工作稿，不允许导出", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "http:",
    "",
  ]) {
    const d = {
      ...seed,
      blocks: seed.blocks.map((b) =>
        b.kind === "button" ? { ...b, href } : b,
      ),
    };
    assert.equal(restoreEmail(d).blocks[3].href, href);
    assert.throws(() => validateEmail(d));
  }
});
test("宽度颜色空主题草稿完整恢复", () => {
  const d = { ...seed, subject: "", accent: "#a", width: "6e-" };
  assert.deepEqual(restoreEmail(d), d);
  assert.throws(() => validateEmail(d));
});
test("snapshot恢复保留未应用变量JSON与组件文本", () => {
  const v = {
    title: "",
    data: { ...seed, subject: "" },
    extra: { variables: '{"name":', json: "{unfinished" },
  };
  assert.deepEqual(importEmail({ snapshot: v }), v);
  assert.throws(() =>
    importEmail({ title: "a".repeat(121), data: seed, extra: {} }),
  );
});
test("结构校验拒绝重复组件与过量变量", () => {
  assert.throws(() =>
    restoreEmail({ ...seed, blocks: [seed.blocks[0], seed.blocks[0]] }),
  );
  assert.throws(() => variablesValue({ __proto__: {}, name: 1 }));
  assert.throws(() => variablesValue({ "bad-key": "x" }));
});
test("官方源码固定commit和每文件hash保持一致", async () => {
  const provenance = JSON.parse(
    await readFile(
      new URL("../third-party/react-email-provenance.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(provenance.commit, "2e3c28c89a4ee18bd302325f51d5cf4f93c7ea06");
  assert.deepEqual(provenance.externalImports, ["react"]);
  assert.equal(Object.keys(provenance.files).length, 19);
  for (const [name, hash] of Object.entries(provenance.files)) {
    const bytes = await readFile(
      new URL("../third-party/react-email-source/" + name, import.meta.url),
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
  }
});
test("版本冲突不能覆盖服务端邮件", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      await readFile(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const store = createStore(db, validateEmail),
      a = store.create("邮件", seed);
    store.update(a.id, "新版", { ...seed, subject: "新版主题" }, a.revision);
    assert.throws(
      () => store.update(a.id, "旧版", seed, a.revision),
      /另一窗口/,
    );
    assert.equal(store.get(a.id).data.subject, "新版主题");
  } finally {
    db.close();
  }
});
test("超过正式容量的草稿经SQLite确认后仍完整恢复", async () => {
  const { createAutosaveStore } = await import("../src/server/autosave.ts");
  const { randomUUID } = await import("node:crypto");
  const large = {
    ...seed,
    blocks: Array.from({ length: 80 }, (_, i) => ({
      id: String(i),
      kind: "text" as const,
      text: "x".repeat(19000),
      secondary: "s".repeat(4500),
      href: "",
    })),
  };
  const bytes = Buffer.byteLength(JSON.stringify(large));
  assert.ok(bytes > 1850000 && bytes < 1940000);
  assert.throws(() => validateEmail(large), /850KB/);
  assert.deepEqual(restoreEmail(large), large);
  const db = new DatabaseSync(":memory:");
  try {
    for (const m of ["0002_projects.sql", "0003_autosave.sql"])
      db.exec(
        await readFile(new URL("../migrations/" + m, import.meta.url), "utf8"),
      );
    const autosave = createAutosaveStore(db, validateEmail),
      documentId = randomUUID();
    const receipt = await autosave.commit({
      documentId,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "大工作稿",
        data: large,
        extra: { json: "{unfinished" },
      },
    });
    assert.equal(receipt.phase, "draft");
    const stored = autosave.get(documentId);
    assert.deepEqual(importEmail({ snapshot: stored!.snapshot }).data, large);
  } finally {
    db.close();
  }
});
