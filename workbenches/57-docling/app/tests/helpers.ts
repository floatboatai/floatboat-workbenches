// Shared fixtures: a real Docling 2.140 output, fresh databases with all migrations, and a blob store on disk.
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createBlobs, digest } from "../src/server/blobs.ts";
import { parseDocument, type Document } from "../src/contracts/docling.ts";
import { empty, summary, type Review } from "../src/contracts/review.ts";
export const fixtureUrl = (name: string) => new URL("../fixtures/" + name, import.meta.url);
/** Real `docling-slim[format-html]==2.140.0` conversion of fixtures/sample.html. */
export const realDocling = JSON.parse(readFileSync(fixtureUrl("docling-document.json"), "utf8"));
export function database(file = ":memory:", migrate = true) {
  const db = new DatabaseSync(file);
  if (migrate)
  for (const m of ["0002_projects.sql", "0003_autosave.sql", "0004_docling_operations.sql", "0005_sources.sql"])
    db.exec(readFileSync(new URL("../migrations/" + m, import.meta.url), "utf8"));
  return db;
}
export async function blobStore(db: DatabaseSync, examples = new Map<string, string>()) {
  const dir = await mkdtemp(join(tmpdir(), "docling-blobs-"));
  const blobs = createBlobs(db, async (name) => join(dir, name), examples);
  return { blobs, dir, close: () => rm(dir, { recursive: true, force: true }) };
}
export function reviewOf(doc: Document = parseDocument(realDocling)): { review: Review; doc: Document } {
  const json = JSON.stringify(doc);
  return { review: { ...empty, document: summary(doc, digest(json), json.length, "test", null), source: "test" }, doc };
}
