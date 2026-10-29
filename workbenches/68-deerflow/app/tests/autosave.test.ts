// Autosave contract with the research model: valid copies become projects, unfinished
// copies stay drafts, a replayed mutation is idempotent and conflicts never overwrite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { researchValue, emptyResearch } from "../src/contracts/research.ts";
import { sampleResearch } from "../src/contracts/sample.ts";

function db() {
  const d = new DatabaseSync(":memory:");
  for (const f of ["0002_projects.sql", "0003_autosave.sql"]) d.exec(readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"));
  return d;
}
const request = (documentId: string, draftRevision: number, data: unknown, projectId: string | null = null, projectRevision: number | null = null, extra = {}) => ({
  documentId,
  mutationId: randomUUID(),
  draftRevision,
  projectId,
  projectRevision,
  snapshot: { title: "研究", data, extra },
});

test("a new research saves as a project; a replayed mutation returns the same receipt", async () => {
  const store = createAutosaveStore(db() as never, researchValue);
  const doc = randomUUID();
  const r = request(doc, 0, emptyResearch("问题"));
  const first = await store.commit(r);
  assert.equal(first.phase, "saved");
  const again = await store.commit(r);
  assert.deepEqual(again, first);
  await assert.rejects(store.commit({ ...r, snapshot: { ...r.snapshot, title: "改" } }), /不一致/);
});
test("an unfinished source URL is kept as a draft with the unapplied input, not misreported as saved", async () => {
  const store = createAutosaveStore(db() as never, researchValue);
  const doc = randomUUID();
  const saved = await store.commit(request(doc, 0, { ...sampleResearch, stage: "reviewing" }));
  const broken = structuredClone({ ...sampleResearch, stage: "reviewing" as const });
  broken.sources[0].url = "https://";
  const draft = await store.commit(request(doc, 1, broken, saved.project!.id, saved.project!.revision, { inputJson: "{ 未完成" }));
  assert.equal(draft.phase, "draft");
  assert.match(draft.message, /HTTP/);
  const kept = store.get(doc)!;
  assert.equal((kept.snapshot.data as typeof broken).sources[0].url, "https://");
  assert.equal(kept.snapshot.extra.inputJson, "{ 未完成");
});
test("a stale window gets a conflict and the newer project content is untouched", async () => {
  const database = db();
  const store = createAutosaveStore(database as never, researchValue);
  const a = randomUUID(),
    b = randomUUID();
  const saved = await store.commit(request(a, 0, { ...sampleResearch, stage: "reviewing" }));
  const pid = saved.project!.id;
  await store.commit(request(a, 1, { ...sampleResearch, stage: "reviewing", report: "窗口一 [1]" }, pid, 1));
  const stale = await store.commit(request(b, 0, { ...sampleResearch, stage: "reviewing", report: "窗口二 [1]" }, pid, 1));
  assert.equal(stale.phase, "conflict");
  const row = database.prepare("SELECT payload FROM projects WHERE id=?").get(pid)!;
  assert.equal(JSON.parse(String(row.payload)).report, "窗口一 [1]");
});
