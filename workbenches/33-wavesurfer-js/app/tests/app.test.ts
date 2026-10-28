import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  seed,
  restoreReview,
  validateReview,
  importReview,
  clipsCSV,
  MAX_AUDIO_BYTES,
} from "../src/contracts/review.ts";
import { createAudioFiles, digest } from "../src/server/files.ts";
import { createStore } from "../src/server/store.ts";
const clip = {
  id: "one",
  start: "1.2",
  end: "3.5",
  label: "采访摘录",
  text: "“原话”,\n第二行",
  reviewed: false,
};
const data = { ...seed, duration: 10, clips: [clip] };
test("区间、摘录、审阅与原始精度保留", () => {
  assert.deepEqual(validateReview(data), data);
  assert.throws(() =>
    validateReview({ ...data, clips: [{ ...clip, end: "11" }] }),
  );
  assert.throws(() =>
    validateReview({ ...data, clips: [{ ...clip, start: "4" }] }),
  );
});
test("无效时间作为工作稿恢复，不能标记为有效工程", () => {
  const v = { ...data, clips: [{ ...clip, start: "1e-", end: "" }] };
  assert.deepEqual(restoreReview(v), v);
  assert.throws(() => validateReview(v));
  assert.throws(() => restoreReview({ ...v, clips: [clip, clip] }));
});
test("恢复文件 snapshot 带未应用 JSON 创建副本", () => {
  const raw = {
    snapshot: {
      title: "",
      data: { ...data, clips: [{ ...clip, end: "" }] },
      extra: { json: '{"unfinished":', note: "keep" },
    },
  };
  assert.deepEqual(importReview(raw), raw.snapshot);
  assert.throws(() =>
    importReview({ snapshot: { title: "x", data: {}, extra: {} } }),
  );
});
test("CSV 保留逗号、双引号和换行", () => {
  const csv = clipsCSV(data);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"“原话”,\n第二行"'));
  assert.ok(csv.includes('"1.2","3.5"'));
});
test("音频内容寻址完整上传、校验和原件字节不变", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wave-"));
  try {
    const files = createAudioFiles(async (n) => join(dir, n));
    const bytes = Buffer.alloc(48);
    bytes.write("RIFF");
    bytes.writeUInt32LE(40, 4);
    bytes.write("WAVE", 8);
    const source = {
      id: digest(bytes),
      bytes: bytes.length,
      name: "sample.wav",
      mime: "audio/wav",
    };
    await files.chunk(source.id, 0, bytes.toString("base64"));
    assert.deepEqual(await files.finish(source), source);
    assert.deepEqual(await files.read(source.id), bytes);
    await files.verify(source);
    await assert.rejects(files.chunk("../escape", 0, "abcd"));
    await assert.rejects(files.chunk(source.id, 0, "!invalid"));
    await assert.rejects(
      files.finish({ ...source, bytes: MAX_AUDIO_BYTES + 1 }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("不同音频无法伪装匹配原件", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wave-"));
  try {
    const files = createAudioFiles(async (n) => join(dir, n));
    const b = Buffer.from("RIFFxxxxWAVEhello");
    const id = "a".repeat(64);
    await files.chunk(id, 0, b.toString("base64"));
    await assert.rejects(
      files.finish({ id, bytes: b.length, name: "bad.wav", mime: "audio/wav" }),
      /校验/,
    );
    await assert.rejects(
      files.verify({
        id,
        bytes: b.length,
        name: "missing.wav",
        mime: "audio/wav",
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("工程持久化和版本冲突保护", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      await readFile(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    const store = createStore(db, validateReview);
    const first = store.create("录音", data);
    const second = store.update(first.id, "新名称", data, first.revision);
    assert.equal(second.revision, 2);
    assert.throws(
      () => store.update(first.id, "旧窗口", data, first.revision),
      /另一窗口/,
    );
    assert.equal(store.get(first.id).title, "新名称");
  } finally {
    db.close();
  }
});
test("标题边界不产生不可恢复工作稿，CSV公式作文字导出", () => {
  assert.throws(() =>
    importReview({ title: "a".repeat(121), data, extra: {} }),
  );
  assert.equal(importReview({ title: "", data, extra: {} }).title, "");
  assert.ok(
    clipsCSV({ ...data, clips: [{ ...clip, text: "=1+1" }] }).includes(
      '"\'=1+1"',
    ),
  );
});
