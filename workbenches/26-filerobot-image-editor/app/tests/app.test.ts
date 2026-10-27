import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  seed,
  validateProject,
  restoreProject,
  serializeDesign,
  portableValue,
} from "../src/contracts/editor.ts";
import { inspectImage, imageBytes } from "../src/server/images.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
const photo = readFileSync(
  new URL("../src/ui/assets/still-life.jpg", import.meta.url),
);
function database() {
  const db = new DatabaseSync(":memory:");
  for (const n of ["0001_initial", "0002_projects", "0003_autosave"])
    db.exec(
      readFileSync(
        new URL("../migrations/" + n + ".sql", import.meta.url),
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
    snapshot: { title: "照片", data, extra: {} },
  };
}
test("JPEG byte signature and dimensions are independently inspected", () => {
  const info = inspectImage(photo);
  assert.equal(info.mime, "image/jpeg");
  assert.equal(info.width, 1200);
  assert.ok(info.height > 0);
  assert.deepEqual(imageBytes(photo.toString("base64")), photo);
  assert.throws(() => inspectImage(Buffer.from("<svg>remote image</svg>")));
  assert.throws(() => imageBytes("!!!!"));
});
test("oversized pixel allocation is rejected before editing", () => {
  const png = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12);
  png.writeUInt32BE(8000, 16);
  png.writeUInt32BE(8000, 20);
  assert.throws(() => inspectImage(png), /1600/);
});
test("autosave serializes native filter functions without exporting pixels or runtime objects", () => {
  const filter = Object.assign(() => {}, { filterName: "Clarendon" }),
    fine = Object.assign(() => {}, { finetuneName: "Brighten" });
  const out = serializeDesign({
    filter,
    finetunes: [fine],
    finetunesProps: { brightness: 0.2 },
    resize: { width: 600, height: 400 },
    originalSource: { src: "blob:test" },
    pastDesignStates: [{}],
    imgSrc: "blob:test",
  });
  assert.equal(out.filter, "Clarendon");
  assert.deepEqual(out.finetunes, ["Brighten"]);
  assert.equal(out.imgSrc, undefined);
  assert.deepEqual(validateProject({ ...seed, design: out }).design, out);
});
test("unfinished dimensions recover as draft but cannot replace the valid model", () => {
  const input = { ...seed, design: { resize: { width: "", height: 400 } } };
  assert.equal(
    (restoreProject(input).design.resize as Record<string, unknown>).width,
    "",
  );
  assert.throws(() => validateProject(input));
});
test("portable projects reject executable and remote image state", () => {
  assert.throws(() =>
    validateProject({
      ...seed,
      design: { imgSrc: "https://evil.test/img.png" },
    }),
  );
  assert.throws(() =>
    validateProject({
      ...seed,
      design: {
        annotations: {
          a: { id: "a", name: "Image", x: 0, y: 0, image: "https://evil.test" },
        },
      },
    }),
  );
  assert.throws(() =>
    validateProject({
      ...seed,
      design: JSON.parse('{"annotations":{"__proto__":{}}}'),
    }),
  );
  assert.throws(() =>
    portableValue({ version: 1, format: "wrong", original: "" }),
  );
});
test("text/shape annotations and order remain editable", () => {
  const design = {
    annotations: {
      a: {
        id: "a",
        name: "Text",
        x: 20,
        y: 30,
        text: "咖啡时光",
        fill: "#fff",
        fontSize: 32,
      },
    },
    annotationIds: ["a"],
  };
  assert.deepEqual(validateProject({ ...seed, design }).design, design);
  assert.throws(() =>
    validateProject({
      ...seed,
      design: { ...design, annotationIds: ["missing"] },
    }),
  );
});
test("autosave lost response retry is idempotent and conflicting revisions preserve both copies", async () => {
  const db = database(),
    store = createAutosaveStore(db, validateProject),
    first = req();
  const a = await store.commit(first),
    b = await store.commit(first);
  assert.equal(a.project?.id, b.project?.id);
  assert.equal(db.prepare("select count(*) as n from projects").get()?.n, 1);
  const next = {
    ...first,
    mutationId: randomUUID(),
    draftRevision: a.draftRevision,
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: { ...first.snapshot, title: "窗口 A" },
  };
  const saved = await store.commit(next);
  const other = {
    ...req(),
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: { ...first.snapshot, title: "窗口 B" },
  };
  const conflict = await store.commit(other);
  assert.equal(conflict.phase, "conflict");
  assert.equal(saved.project?.title, "窗口 A");
  assert.equal(store.get(other.documentId)?.snapshot.title, "窗口 B");
  db.close();
});
test("invalid model saves working copy and keeps last valid image edit", async () => {
  const db = database(),
    store = createAutosaveStore(db, validateProject),
    first = req({ ...seed, design: { resize: { width: 640, height: 480 } } });
  const a = await store.commit(first);
  const b = await store.commit({
    ...first,
    mutationId: randomUUID(),
    draftRevision: a.draftRevision,
    projectId: a.project!.id,
    projectRevision: a.project!.revision,
    snapshot: {
      ...first.snapshot,
      data: { ...seed, design: { resize: { width: "", height: 480 } } },
      extra: { rawWidth: "" },
    },
  });
  assert.equal(b.phase, "draft");
  assert.equal(
    JSON.parse(
      String(db.prepare("select payload from projects").get()?.payload),
    ).design.resize.width,
    640,
  );
  assert.equal(store.get(first.documentId)?.snapshot.extra.rawWidth, "");
  db.close();
});
test("missing durable original cannot be acknowledged as a saved model", async () => {
  const db = database(),
    store = createAutosaveStore(db, validateProject, undefined, {
      verify: async () => {
        throw new Error("原图丢失");
      },
    });
  assert.equal((await store.commit(req())).phase, "draft");
  assert.equal(db.prepare("select count(*) as n from projects").get()?.n, 0);
  db.close();
});
test("import metadata does not coerce arrays into strings", () => {
  const source = {
    id: "a".repeat(64),
    name: "a.png",
    mime: ["image/png"],
    bytes: 40,
    width: 1,
    height: 1,
  };
  assert.throws(() => validateProject({ ...seed, source }));
  assert.throws(() =>
    validateProject({
      ...seed,
      design: { annotations: { a: { id: "a", name: ["Text"], x: 0, y: 0 } } },
    }),
  );
  assert.throws(() =>
    validateProject({ ...seed, design: { adjustments: { crop: null } } }),
  );
  assert.throws(() =>
    validateProject({ ...seed, design: { filter: "constructor" } }),
  );
});

test("malformed rich-text and numeric annotations cannot reach the editor", () => {
  assert.throws(() =>
    validateProject({
      ...seed,
      design: {
        annotations: {
          x: { id: "x", name: "Text", x: 0, y: 0, text: { html: "<script>" } },
        },
      },
    }),
  );
  assert.throws(() =>
    validateProject({
      ...seed,
      design: {
        annotations: {
          x: { id: "x", name: "Rect", x: 0, y: 0, width: "large" },
        },
      },
    }),
  );
  assert.throws(() =>
    portableValue({
      format: "filerobot-workbench",
      version: 1,
      title: "bad draft",
      project: seed,
      original: "",
      draft: {
        nativeAnnotation: {
          id: "x",
          name: "Image",
          x: 0,
          y: 0,
          image: "https://invalid.test",
        },
      },
    }),
  );
});
