import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  seed,
  validateMap,
  restoreMap,
  parseMapImport,
  flatBranches,
} from "../src/contracts/mindmap.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
function database() {
  const db = new DatabaseSync(":memory:");
  for (const name of ["0001_initial", "0002_projects", "0003_autosave"])
    db.exec(
      readFileSync(
        new URL("../migrations/" + name + ".sql", import.meta.url),
        "utf8",
      ),
    );
  return db;
}
function req(data: unknown = seed) {
  return {
    documentId: randomUUID(),
    mutationId: randomUUID(),
    draftRevision: 0,
    projectId: null,
    projectRevision: null,
    snapshot: { title: "花园", data, extra: {} },
  };
}
test("native tree structure, order and version marker round trip", () => {
  const native = { ...structuredClone(seed.tree), smmVersion: "0.14.0-fix.3" };
  const imported = parseMapImport(native);
  assert.deepEqual(imported.data.tree, native);
  assert.equal(flatBranches(imported.data.tree).length, 16);
  assert.equal(validateMap(imported.data).tree.smmVersion, "0.14.0-fix.3");
});
test("native plain-text flags and expand/collapse survive serialization", () => {
  const m = structuredClone(seed);
  m.tree.children[0].data = {
    ...m.tree.children[0].data,
    expand: false,
    richText: false,
    isActive: false,
    resetRichText: false,
  };
  assert.deepEqual(validateMap(m), m);
});
test("unsupported rich text, remote images, links and styles fail without cleaning raw input", () => {
  for (const field of [
    { richText: true },
    { image: "https://example.com/x.png" },
    { hyperlink: "javascript:alert(1)" },
    { fontSize: "large" },
  ]) {
    const raw = {
      ...seed,
      tree: { ...seed.tree, data: { ...seed.tree.data, ...field } },
    };
    assert.equal(restoreMap(raw), raw);
    assert.throws(() => validateMap(raw));
  }
});
test("HTML-like plain text stays literal while enum spoofing and duplicated ids fail", () => {
  const text = "<img src=x onerror=alert(1)>";
  const raw = {
    ...structuredClone(seed),
    tree: { data: { text, uid: "root" }, children: [] },
  };
  assert.equal(validateMap(raw).tree.data.text, text);
  assert.throws(() => validateMap({ ...seed, layout: ["mindMap"] }));
  const dupe = structuredClone(seed);
  dupe.tree.children[0].data.uid = dupe.tree.data.uid;
  assert.throws(() => validateMap(dupe));
  for (const uid of ["__proto__", "constructor", "prototype"])
    assert.throws(() =>
      validateMap({
        ...seed,
        tree: { data: { text: "reserved", uid }, children: [] },
      }),
    );
});
test("working decoder preserves oversized unfinished text and larger capacity separately", () => {
  const m = structuredClone(seed);
  m.tree.data.text = "待".repeat(5000);
  assert.equal(restoreMap(m), m);
  assert.throws(() => validateMap(m), /4000/);
  const big = { ...seed, scratch: "x".repeat(900000) };
  assert.equal(restoreMap(big), big);
  assert.throws(() => validateMap(big), /容量/);
});
test("recovery imports actual cacheValue snapshot as new copy without old document identity", () => {
  const raw = {
    documentId: randomUUID(),
    revision: 3,
    snapshot: {
      title: "草稿",
      data: seed,
      extra: {
        json: "{ incomplete",
        nativeEditing: { uid: "plants", text: "尚未结束" },
        nodeTexts: { day: "尚未应用" },
      },
    },
  };
  const out = parseMapImport(raw);
  assert.deepEqual(out.extra, raw.snapshot.extra);
  assert.equal("documentId" in out, false);
  assert.equal(out.title, "草稿");
});
test("lost-receipt retry and optimistic conflict preserve both window values", async () => {
  const db = database(),
    s = createAutosaveStore(db, validateMap),
    first = req();
  const a = await s.commit(first);
  assert.deepEqual(await s.commit(first), a);
  assert.equal(db.prepare("select count(*) n from projects").get()?.n, 1);
  await s.commit({
    ...first,
    mutationId: randomUUID(),
    draftRevision: a.draftRevision,
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: { ...first.snapshot, title: "窗口A" },
  });
  const other = {
    ...req(),
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: { ...first.snapshot, title: "窗口B" },
  };
  assert.equal((await s.commit(other)).phase, "conflict");
  assert.equal(db.prepare("select title from projects").get()?.title, "窗口A");
  assert.equal(s.get(other.documentId)?.snapshot.title, "窗口B");
  db.close();
});
test("unapplied native editor and JSON drafts persist alongside last valid model", async () => {
  const db = database(),
    s = createAutosaveStore(db, validateMap),
    r = req();
  r.snapshot.extra = { nativeEditing: { uid: "plants", text: "" }, json: "{" };
  const a = await s.commit(r);
  assert.equal(a.phase, "saved");
  assert.deepEqual(s.get(r.documentId)?.snapshot.extra, r.snapshot.extra);
  const b = await s.commit({
    ...r,
    mutationId: randomUUID(),
    draftRevision: a.draftRevision,
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: { ...r.snapshot, data: { ...seed, theme: "unfinished" } },
  });
  assert.equal(b.phase, "draft");
  assert.equal(
    JSON.parse(
      String(db.prepare("select payload from projects").get()?.payload),
    ).theme,
    "garden",
  );
  db.close();
});
test("branch navigation preserves hierarchy and native import rejects malformed children", () => {
  const flat = flatBranches(seed.tree);
  assert.deepEqual(
    flat.find((n) => n.uid === "herbs"),
    { uid: "herbs", text: "香草角 · 薄荷与迷迭香", depth: 2, parent: "plants" },
  );
  assert.throws(() => parseMapImport({ data: { text: "x" }, children: {} }));
  assert.throws(() =>
    restoreMap({ ...seed, tree: { data: { text: 1 }, children: [] } }),
  );
});

test("full upstream configuration is not silently dropped on import", () => {
  const raw = {
    root: seed.tree,
    layout: "fishbone",
    theme: {
      template: "custom",
      config: { backgroundImage: "https://example.com/image.png" },
    },
  };
  assert.throws(() => parseMapImport(raw), /主题/);
});
