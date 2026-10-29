import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sniff, resolveMime, assetValue, guessMime, MAX_ASSET_BYTES, CHUNK_BYTES } from "../src/contracts/media.ts";
import { createMediaFiles, digest } from "../src/server/files.ts";
import { SAMPLES } from "../src/contracts/samples.ts";

const bytes = (s: string, pad = 16) => { const b = Buffer.alloc(Math.max(pad, s.length)); b.write(s, "latin1"); return new Uint8Array(b); };

test("container families are recognised from file headers, not names", () => {
  const mp4 = bytes("\0\0\0\x18ftypisom");
  assert.equal(sniff(mp4), "mp4");
  assert.equal(sniff(bytes("\x1a\x45\xdf\xa3")), "matroska");
  assert.equal(sniff(bytes("RIFF\0\0\0\0WAVEfmt ")), "wav");
  assert.equal(sniff(bytes("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  assert.equal(sniff(bytes("ID3\x04")), "mp3");
  assert.equal(sniff(bytes("\xff\xfb\x90\x64")), "mp3");
  assert.equal(sniff(bytes("\xff\xf1\x50\x80")), "adts");
  assert.equal(sniff(bytes("OggS")), "ogg");
  assert.equal(sniff(bytes("fLaC")), "flac");
  assert.equal(sniff(bytes("\x89PNG\r\n\x1a\n")), "png");
  assert.equal(sniff(bytes("\xff\xd8\xff\xe0")), "jpeg");
  assert.equal(sniff(bytes("GIF89a")), "gif");
  assert.equal(sniff(bytes("not media at all")), null);
  assert.equal(resolveMime("mp4", "video/quicktime"), "video/quicktime");
  assert.equal(resolveMime("mp4", "image/png"), "video/mp4");
  assert.equal(guessMime("clip.MKV", ""), "video/x-matroska");
  assert.equal(guessMime("voice.m4a", ""), "audio/mp4");
});

test("asset records accept large real files and reject bad identifiers", () => {
  const ok = assetValue({ id: "c".repeat(64), name: "4K 素材.mov", kind: "video", mime: "video/quicktime", bytes: 1.8 * 1024 ** 3, duration: 1800, width: 3840, height: 2160, hasAudio: true });
  assert.equal(ok.sample, false);
  assert.throws(() => assetValue({ ...ok, bytes: MAX_ASSET_BYTES + 1 }));
  assert.throws(() => assetValue({ ...ok, id: "../x" }));
  assert.throws(() => assetValue({ ...ok, mime: "application/pdf" }));
  assert.throws(() => assetValue({ ...ok, duration: null }));
  assert.equal(assetValue({ ...ok, kind: "image", mime: "image/png", duration: null }).duration, null);
});

async function store() {
  const dir = await mkdtemp(join(tmpdir(), "montage-media-"));
  const samples = join(dir, "samples");
  await mkdir(samples);
  const files = createMediaFiles(async (p) => join(dir, p), async (p) => join(samples, p));
  return { dir, samples, files };
}
const chunks = async (files: ReturnType<typeof createMediaFiles>, id: string, data: Buffer) => {
  for (let i = 0; i * CHUNK_BYTES < data.length; i++) await files.chunk(id, i, data.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES).toString("base64"));
};

test("chunked upload is hashed while merging, deduplicated and served with byte ranges", async () => {
  const { dir, files } = await store();
  try {
    const data = Buffer.alloc(CHUNK_BYTES * 2 + 77, 7);
    data.write("ftypisom", 4, "latin1");
    const up = "1".repeat(32);
    await chunks(files, up, data);
    const r = await files.finish(up, { bytes: data.length, mime: "video/mp4" });
    assert.equal(r.id, digest(data));
    assert.equal(r.mime, "video/mp4");
    await chunks(files, "2".repeat(32), data);
    assert.equal((await files.finish("2".repeat(32), { bytes: data.length, mime: "" })).id, r.id);
    await files.verify({ id: r.id, bytes: data.length });
    const part = await files.response(r.id, "bytes=10-19");
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), `bytes 10-19/${data.length}`);
    assert.deepEqual(new Uint8Array(await part.arrayBuffer()), new Uint8Array(data.subarray(10, 20)));
    const tail = await files.response(r.id, "bytes=-5");
    assert.equal((await tail.arrayBuffer()).byteLength, 5);
    assert.equal((await files.response(r.id, "bytes=999999999-")).status, 416);
    const whole = await files.response(r.id, undefined, "成片.mp4");
    assert.equal(whole.headers.get("content-length"), String(data.length));
    assert.match(whole.headers.get("content-disposition")!, /UTF-8''%E6%88%90/);
    await whole.arrayBuffer();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("incomplete, unknown-format and bad-identifier uploads never publish a file", async () => {
  const { dir, files } = await store();
  try {
    const data = Buffer.from("plain text that is long enough to pass the size floor");
    await files.chunk("3".repeat(32), 0, data.toString("base64"));
    await assert.rejects(() => files.finish("3".repeat(32), { bytes: data.length, mime: "video/mp4" }), /无法识别/);
    await assert.rejects(() => files.finish("4".repeat(32), { bytes: 5000, mime: "video/mp4" }), /尚未完整/);
    await assert.rejects(() => files.chunk("../escape", 0, "AA=="), /上传标识/);
    await assert.rejects(() => files.chunk("5".repeat(32), 0, "not base64!"), /编码/);
    await assert.rejects(() => files.verify({ id: "d".repeat(64), bytes: 10 }), (e: Error) => /缺失/.test(e.message) && !("status" in e));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bundled samples and 0.5 originals resolve without re-upload", async () => {
  const { dir, samples, files } = await store();
  try {
    const sunrise = SAMPLES[0];
    const real = await readFile(new URL("../samples/" + sunrise.file, import.meta.url));
    assert.equal(digest(real), sunrise.asset.id);
    assert.equal(real.length, sunrise.asset.bytes);
    await writeFile(join(samples, sunrise.file), real);
    await files.verify(sunrise.asset);
    const legacy = Buffer.alloc(40);
    legacy.write("ftypmp42", 4, "latin1");
    await writeFile(join(dir, digest(legacy) + ".mp4"), legacy);
    await files.verify({ id: digest(legacy), bytes: 40 });
    assert.equal((await files.response(digest(legacy), undefined)).headers.get("content-type"), "video/mp4");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("every bundled sample file matches its recorded hash and size", async () => {
  for (const s of SAMPLES) {
    const b = await readFile(new URL("../samples/" + s.file, import.meta.url));
    assert.equal(b.length, s.asset.bytes, s.file);
    assert.equal(digest(b), s.asset.id, s.file);
    assert.ok(sniff(new Uint8Array(b.subarray(0, 16))), s.file);
  }
});
