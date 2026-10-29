// ABOUTME: 含内嵌图片的文稿（超过旧的 900 KB 新建上限）能经自动保存适配器创建并更新；超过 1.6 MB 时保留为草稿而不覆盖正式内容。
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { validateWriting } from "../src/contracts/domain.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createStore } from "../src/server/store.ts";

const image = (size: number) => ({ type: "image", attrs: { src: "data:image/webp;base64," + "Q".repeat(size), alt: "配图" } });
const docWith = (...sizes: number[]) => ({
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "带图的方案" }] }, ...sizes.map(image)] },
});

test("1.2 MB 的带图文稿通过写作台适配器保存；超限版本只存为草稿", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const migration of ["0002_projects.sql", "0003_autosave.sql"])
      db.exec(readFileSync(new URL("../migrations/" + migration, import.meta.url), "utf8"));
    const store = createStore(db, validateWriting);
    const drafts = createAutosaveStore(db, validateWriting, {
      get: store.get,
      create: (title, data, id) => store.create(title, data, id),
      update: store.update,
    });
    const documentId = crypto.randomUUID();
    const first = await drafts.commit({
      documentId,
      mutationId: crypto.randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "带图方案", data: docWith(400_000, 400_000, 400_000), extra: {} },
    });
    assert.equal(first.phase, "saved", first.message);
    assert.equal(first.project?.id, documentId, "新建项目沿用工作副本 id");
    const tooLarge = await drafts.commit({
      documentId,
      mutationId: crypto.randomUUID(),
      draftRevision: 1,
      projectId: first.project!.id,
      projectRevision: first.project!.revision,
      snapshot: { title: "带图方案", data: docWith(600_000, 600_000, 600_000), extra: {} },
    });
    assert.equal(tooLarge.phase, "draft");
    assert.match(tooLarge.message, /1\.6 MB/);
    assert.equal(store.get(documentId).revision, 1);
    assert.equal(JSON.stringify(store.get(documentId).data).length < 1_300_000, true);
  } finally {
    db.close();
  }
});
