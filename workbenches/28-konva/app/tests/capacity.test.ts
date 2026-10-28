import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  appendItem,
  assertItemCapacity,
  assertProjectBytes,
  MAX_PROJECT_BYTES,
  restoreBoard,
  validateBoard,
  parseImport,
  parseProjectText,
  serializeProject,
} from "../src/contracts/board.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { boardWithCount, imageProject } from "./capacity-fixtures.ts";
test("object addition reads the latest working board and stops exactly at 200", () => {
  let latest = boardWithCount(199);
  const next = { ...latest.items[0], id: "last" };
  latest = appendItem(latest, next);
  assert.equal(latest.items.length, 200);
  assert.throws(() => appendItem(latest, { ...next, id: "overflow" }), /200/);
  assert.throws(() => assertItemCapacity(latest), /200/);
  assert.equal(latest.items.length, 200);
});
test("image completion cannot append after another action fills the final slot", async () => {
  let latest = boardWithCount(199);
  assertItemCapacity(latest);
  const pending = Promise.resolve({
    ...latest.items[0],
    id: "uploaded-image",
    kind: "image" as const,
  });
  latest = appendItem(latest, { ...latest.items[0], id: "last-shape" });
  const image = await pending;
  assert.throws(() => appendItem(latest, image), /200/);
  assert.equal(latest.items.length, 200);
  assert.equal(
    latest.items.some((i) => i.id === image.id),
    false,
  );
});
test("existing over-limit drafts retain all objects through SQLite and recovery", async () => {
  const data = { ...boardWithCount(201), custom: "wire field retained" };
  const wire = JSON.stringify(data);
  assert.equal(restoreBoard(data), data);
  assert.equal(JSON.stringify(restoreBoard(data)), wire);
  assert.throws(() => validateBoard(data), /200/);
  assert.equal(
    parseImport({ snapshot: { title: "超限旧稿", data, extra: { json: "{" } } })
      .data.items.length,
    201,
  );
  const db = new DatabaseSync(":memory:");
  for (const file of ["0001_initial", "0002_projects", "0003_autosave"])
    db.exec(
      readFileSync(
        new URL("../migrations/" + file + ".sql", import.meta.url),
        "utf8",
      ),
    );
  const store = createAutosaveStore(db, validateBoard);
  const id = randomUUID();
  const receipt = await store.commit({
    documentId: id,
    mutationId: randomUUID(),
    draftRevision: 0,
    projectId: null,
    projectRevision: null,
    snapshot: { title: "超限旧稿", data, extra: { json: "{" } },
  });
  assert.equal(receipt.phase, "draft");
  assert.equal(restoreBoard(store.get(id)!.snapshot.data).items.length, 201);
  db.close();
});
test("13 valid originals above the old 12MB threshold roundtrip within 16MiB", () => {
  const project = imageProject(13);
  validateBoard(project.data);
  assert.ok(project.originals.every((i) => i.bytes < 750000));
  const text = serializeProject(project),
    size = Buffer.byteLength(text);
  assert.ok(size > 12000000);
  assert.ok(size < MAX_PROJECT_BYTES);
  const restored = parseProjectText(text);
  assert.equal(restored.data.items.length, 13);
  assert.deepEqual(restored.originals, project.originals);
  for (const original of project.originals)
    assert.equal(
      createHash("sha256")
        .update(Buffer.from(original.base64, "base64"))
        .digest("hex"),
      original.id,
    );
});
test("18 valid originals exceeding 16MiB reject complete export without omitting bytes", () => {
  const project = imageProject(18);
  validateBoard(project.data);
  const originalWire = JSON.stringify(project);
  assert.ok(Buffer.byteLength(originalWire) > MAX_PROJECT_BYTES);
  assert.throws(() => serializeProject(project), /16 MiB/);
  assert.equal(JSON.stringify(project), originalWire);
  assert.throws(() => parseProjectText(originalWire), /16 MiB/);
});
test("project budget measures UTF8 bytes and includes import whitespace", () => {
  assertProjectBytes(MAX_PROJECT_BYTES);
  assert.throws(() => assertProjectBytes(MAX_PROJECT_BYTES + 1), /16 MiB/);
  const wide = { note: "汉".repeat(6_000_000) };
  assert.ok(JSON.stringify(wide).length < MAX_PROJECT_BYTES);
  assert.throws(() => serializeProject(wide), /16 MiB/);
  assert.throws(
    () => parseProjectText(" ".repeat(MAX_PROJECT_BYTES) + "{}"),
    /16 MiB/,
  );
});
