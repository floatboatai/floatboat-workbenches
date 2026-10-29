import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHUNK, digest } from "../src/server/blobs.ts";
import { blobStore, database, realDocling } from "./helpers.ts";
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
test("chunked upload resumes, acknowledges a retried chunk once and verifies SHA-256", async () => {
  const db = database();
  const { blobs, close } = await blobStore(db);
  try {
    const bytes = new Uint8Array(CHUNK * 2 + 1234).map((_, i) => (i * 31) % 251);
    const id = digest(bytes);
    const begun = await blobs.begin({ id, kind: "source", name: "scan.pdf", bytes: bytes.length });
    assert.equal(begun.received, 0);
    await blobs.chunk(id, 0, { data: b64(bytes.subarray(0, CHUNK)) });
    // Lost response: the client resends chunk 0; it must not be appended twice.
    await blobs.chunk(id, 0, { data: b64(bytes.subarray(0, CHUNK)) });
    const again = await blobs.begin({ id, kind: "source", name: "scan.pdf", bytes: bytes.length });
    assert.equal(again.received, CHUNK);
    await assert.rejects(() => blobs.chunk(id, 2, { data: b64(bytes.subarray(2 * CHUNK)) }), /第 2 块/);
    await blobs.chunk(id, 1, { data: b64(bytes.subarray(CHUNK, 2 * CHUNK)) });
    await blobs.chunk(id, 2, { data: b64(bytes.subarray(2 * CHUNK)) });
    assert.equal((await blobs.complete(id)).stored, true);
    assert.deepEqual(new Uint8Array(await blobs.read(id, "source")), bytes);
    assert.equal((await blobs.begin({ id, kind: "source", name: "x", bytes: bytes.length })).stored, true);
  } finally {
    db.close();
    await close();
  }
});
test("wrong hashes, oversize files and invalid documents are rejected", async () => {
  const db = database();
  const { blobs, close } = await blobStore(db);
  try {
    const bytes = new TextEncoder().encode("hello");
    const wrong = "0".repeat(64);
    await blobs.begin({ id: wrong, kind: "source", name: "a.txt", bytes: 5 });
    await blobs.chunk(wrong, 0, { data: b64(bytes) });
    await assert.rejects(() => blobs.complete(wrong), /校验失败/);
    await assert.rejects(() => blobs.begin({ id: "1".repeat(64), kind: "source", name: "big", bytes: 65 * 1024 * 1024 }), /64 MB/);
    const bad = new TextEncoder().encode(JSON.stringify({ schema_name: "DoclingDocument", version: "1.10.0" }));
    const id = digest(bad);
    await blobs.begin({ id, kind: "docling", name: "bad.json", bytes: bad.length });
    await blobs.chunk(id, 0, { data: b64(bad) });
    await assert.rejects(() => blobs.complete(id));
    const good = new TextEncoder().encode(JSON.stringify(realDocling));
    const gid = digest(good);
    await blobs.begin({ id: gid, kind: "docling", name: "ok.json", bytes: good.length });
    await blobs.chunk(gid, 0, { data: b64(good) });
    await blobs.complete(gid);
    assert.equal((await blobs.document(gid)).tables.length, 1);
    await assert.rejects(() => blobs.read(gid, "source"), /原文件不在/);
  } finally {
    db.close();
    await close();
  }
});
test("bundled examples are served read-only by content hash", async () => {
  const db = database();
  const store = await blobStore(db);
  try {
    const file = join(store.dir, "example.pdf");
    writeFileSync(file, "%PDF example");
    const id = digest(readFileSync(file));
    const { blobs } = await blobStore(db, new Map([[id, file]]));
    assert.equal(blobs.stored(id), true);
    assert.equal((await blobs.read(id, "source")).toString(), "%PDF example");
    assert.equal((await blobs.begin({ id, kind: "source", name: "x", bytes: 12 })).stored, true);
  } finally {
    db.close();
    await store.close();
  }
});
