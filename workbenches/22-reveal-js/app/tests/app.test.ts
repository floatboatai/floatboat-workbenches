import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  seed,
  validateDeck,
  restoreDeck,
  renderMarkdown,
  parseSource,
  portableSource,
  exportProject,
  importProject,
  moveSlide,
  LIMITS,
} from "../src/contracts/deck.ts";
import { standaloneHtml } from "../src/server/export.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { createStore } from "../src/server/store.ts";

function database() {
  const db = new DatabaseSync(":memory:");
  for (const file of [
    "0001_initial.sql",
    "0002_projects.sql",
    "0003_autosave.sql",
  ])
    db.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  return db;
}
function command(data: unknown = seed, title = "测试演示") {
  return {
    documentId: randomUUID(),
    mutationId: randomUUID(),
    draftRevision: 0,
    projectId: null as string | null,
    projectRevision: null as number | null,
    snapshot: { title, data, extra: {} as Record<string, unknown> },
  };
}

test("Markdown renders only a bounded, inert subset including unfinished fences", () => {
  const html = renderMarkdown(
    "# 标题\n- **重点**\n> 引言\n<script>alert(1)</script>\n![bad](https://remote/a)\n`<img src=x>`\n```html\n<a onmouseover=x>",
  );
  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /<li><strong>重点<\/strong><\/li>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|<img|<a /);
  assert.match(html, /<pre><code>&lt;a onmouseover=x&gt;<\/code><\/pre>/);
  assert.match(renderMarkdown("- step", true), /class="fragment"/);
});
test("Deck schema rejects executable options, duplicate IDs, oversized input, and unknown format", () => {
  assert.throws(() => validateDeck({ ...seed, theme: "<script>" }));
  assert.throws(() => validateDeck({ ...seed, theme: ["forest"] }));
  assert.throws(() =>
    validateDeck({ ...seed, slides: [seed.slides[0], seed.slides[0]] }),
  );
  assert.throws(() => validateDeck({ ...seed, slides: [] }));
  assert.throws(() =>
    validateDeck({
      ...seed,
      slides: [
        { id: "a", markdown: "a".repeat(LIMITS.markdown + 1), notes: "" },
      ],
    }),
  );
  assert.throws(() => importProject({ data: seed }));
  const withUnknown = validateDeck({ ...seed, script: "evil()" });
  assert.equal("script" in withUnknown, false);
});
test("Source boundaries respect fenced code and notes; ordinary export imports correctly", () => {
  const parsed = parseSource(
    "# A\n```\n---\nNotes:\n```\n\nNotes:\n说话\n\n---\n\n## B",
  );
  assert.equal(parsed.slides.length, 2);
  assert.match(parsed.slides[0].markdown, /---\nNotes:/);
  assert.equal(parsed.slides[0].notes, "说话");
  const restored = parseSource(portableSource(seed));
  assert.deepEqual(
    restored.slides.map((s) => [s.markdown, s.notes]),
    seed.slides.map((s) => [s.markdown, s.notes]),
  );
  assert.throws(() =>
    portableSource({
      ...seed,
      slides: [{ id: "a", markdown: "```\nunfinished", notes: "notes" }],
    }),
  );
});
test("Project backup round trips all controls and maximum practical payload within import limits", () => {
  const large = {
    ...seed,
    slides: Array.from({ length: 50 }, (_, i) => ({
      id: "s" + i,
      markdown: "a".repeat(4000),
      notes: "b".repeat(2000),
    })),
  };
  const output = exportProject(large, "large");
  assert.ok(Buffer.byteLength(output) < LIMITS.file);
  assert.deepEqual(importProject(JSON.parse(output)).data, large);
  const recovery = importProject({
    snapshot: {
      title: "",
      data: seed,
      extra: {
        source: "---\n".repeat(51),
        sourceOpen: true,
        selected: "opening",
        untrusted: { script: "x" },
      },
    },
  });
  assert.equal(recovery.title, "");
  assert.equal(recovery.extra.sourceOpen, true);
  assert.equal("untrusted" in recovery.extra, false);
});
test("Invalid aggregate draft remains restorable but cannot be applied or exported", () => {
  const over = {
    ...seed,
    slides: Array.from({ length: 50 }, (_, i) => ({
      id: "s" + i,
      markdown: "文".repeat(4000),
      notes: "注".repeat(2000),
    })),
  };
  assert.throws(() => validateDeck(over), /350 KB/);
  assert.equal(restoreDeck(over).slides.length, 50);
  assert.throws(() => exportProject(over, "large"));
});
test("Move preserves exact content and identity, and keeps boundaries unchanged", () => {
  const moved = moveSlide(seed, 1, -1);
  assert.equal(moved.slides[0], seed.slides[1]);
  assert.equal(moved.slides[1], seed.slides[0]);
  assert.equal(moveSlide(seed, 0, -1), seed);
  assert.equal(moveSlide(seed, 4, 1), seed);
});
test("Standalone HTML carries real engine, system-font styling, license and safe title/notes", () => {
  const script = readFileSync(
      new URL("../assets/reveal/runtime/reveal.js", import.meta.url),
      "utf8",
    ),
    css = readFileSync(
      new URL("../assets/reveal/runtime/reveal.css", import.meta.url),
      "utf8",
    ),
    license = readFileSync(
      new URL("../assets/reveal/LICENSE", import.meta.url),
      "utf8",
    );
  const html = standaloneHtml(
    {
      ...seed,
      slides: [
        {
          id: "x",
          markdown: "<script>bad()</script>",
          notes: "</aside><script>bad()</script>",
        },
      ],
    },
    "</title><script>evil()</script>",
    script,
    css,
    license,
  );
  assert.ok(html.length > 100000);
  assert.match(html, /Reveal\.initialize/);
  assert.ok(html.includes("Permission is hereby granted"));
  assert.doesNotMatch(
    html,
    /<script>bad|<script>evil|<script src=|<link[^>]*href=/,
  );
  assert.match(html, /&lt;\/aside&gt;/);
});
test("Autosave creates stable document identity and lost-response retry is idempotent", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateDeck),
      c = command();
    const first = await store.commit(c),
      replay = await store.commit(c);
    assert.equal(first.project?.id, c.documentId);
    assert.deepEqual(first, replay);
    assert.equal(db.prepare("SELECT count(*) AS n FROM projects").get()?.n, 1);
    assert.equal(first.project?.revision, 1);
  } finally {
    db.close();
  }
});
test("Unfinished title and source are durable drafts; valid follow-up applies model", async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateDeck),
      c = command(seed, "");
    c.snapshot.extra = { source: "---\n".repeat(51), sourceOpen: true };
    const receipt = await store.commit(c);
    assert.equal(receipt.phase, "draft");
    assert.equal(receipt.project, null);
    assert.deepEqual(store.get(c.documentId)?.snapshot.extra, c.snapshot.extra);
    const saved = await store.commit({
      ...c,
      mutationId: randomUUID(),
      draftRevision: 1,
      snapshot: { ...c.snapshot, title: "恢复" },
    });
    assert.equal(saved.phase, "saved");
  } finally {
    db.close();
  }
});
test("Older project revisions produce conflict without overwriting server content", async () => {
  const db = database();
  try {
    const drafts = createAutosaveStore(db, validateDeck),
      store = createStore(db, validateDeck),
      c = command();
    const saved = await drafts.commit(c);
    const project = saved.project!;
    store.update(project.id, "另一窗口", seed, project.revision);
    const receipt = await drafts.commit({
      ...c,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: project.id,
      projectRevision: project.revision,
      snapshot: { ...c.snapshot, title: "本窗口" },
    });
    assert.equal(receipt.phase, "conflict");
    assert.equal(store.get(project.id).title, "另一窗口");
    assert.equal(drafts.get(c.documentId)?.snapshot.title, "本窗口");
  } finally {
    db.close();
  }
});
test("New import document creates a second row and preserves original project", async () => {
  const db = database();
  try {
    const drafts = createAutosaveStore(db, validateDeck),
      original = command();
    await drafts.commit(original);
    const imported = command(
      importProject(JSON.parse(exportProject(seed, "导入"))).data,
      "导入",
    );
    await drafts.commit(imported);
    assert.equal(db.prepare("SELECT count(*) AS n FROM projects").get()?.n, 2);
    assert.equal(
      createStore(db, validateDeck).get(original.documentId).title,
      "测试演示",
    );
  } finally {
    db.close();
  }
});
