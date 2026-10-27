import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  emptyTranscript,
  exampleTranscript,
  exportSubtitles,
  importTranscript,
  validateTranscript,
  restoreTranscript,
  seconds,
  clock,
  splitCue,
} from "../src/contracts/transcript.ts";
import { jobInput, parseJob } from "../src/contracts/job.ts";
import { createAudioFiles, digest, detectMime } from "../src/server/files.ts";
import { configuredService, createJobs } from "../src/server/jobs.ts";
import { createStore, StoreError } from "../src/server/store.ts";
const id = "33333333-3333-4333-8333-333333333333";
function wav() {
  const b = Buffer.alloc(80);
  b.write("RIFF");
  b.writeUInt32LE(72, 4);
  b.write("WAVE", 8);
  return b;
}
const source = {
  id: digest(wav()),
  bytes: wav().length,
  name: "speech.wav",
  mime: "audio/wav",
};
async function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL)",
  );
  db.exec(
    await readFile(
      new URL("../migrations/0004_transcriptions.sql", import.meta.url),
      "utf8",
    ),
  );
  return db;
}

test("SRT roundtrip preserves Chinese, multiline cues and millisecond boundaries", () => {
  const text = exportSubtitles(exampleTranscript, "srt");
  const cues = importTranscript(text, "clip.srt");
  assert.equal(cues.length, 3);
  assert.equal(cues[1].start, "00:00:04.200");
  assert.equal(cues[1].text, exampleTranscript.cues[1].text);
});
test("VTT accepts cue IDs and settings while preserving time and text", () => {
  const cues = importTranscript(
    "WEBVTT\n\nintro\n00:00.000 --> 00:02.200 align:start\n你好\n第二行\n",
    "clip.vtt",
  );
  assert.equal(cues[0].end, "00:00:02.200");
  assert.equal(cues[0].text, "你好\n第二行");
  assert.ok(
    exportSubtitles({ ...emptyTranscript, cues }, "vtt").startsWith(
      "WEBVTT\n\n",
    ),
  );
});
test("upstream segments JSON is validated without invented timing", () => {
  const cues = importTranscript(
    JSON.stringify({
      segments: [{ start: 1.23, end: 4.56, text: "Actual result" }],
    }),
    "result.json",
  );
  assert.equal(cues[0].start, "00:00:01.230");
  assert.throws(() =>
    importTranscript(
      '{"segments":[{"start":4,"end":1,"text":"bad"}]}',
      "result.json",
    ),
  );
  assert.throws(() =>
    importTranscript('{"text":"No timestamps"}', "result.json"),
  );
});
test("incomplete timing is a recoverable draft but never a valid export", () => {
  const draft = {
    ...exampleTranscript,
    cues: [{ ...exampleTranscript.cues[0], start: "00:" }],
  };
  assert.equal(restoreTranscript(draft).cues[0].start, "00:");
  assert.throws(() => validateTranscript(draft));
  assert.throws(() => exportSubtitles(draft, "srt"));
  assert.throws(() =>
    restoreTranscript({ ...draft, cues: [{ ...draft.cues[0], text: 5 }] }),
  );
});
test("time parsing rejects reversed or unbounded timestamps and rounds correctly", () => {
  assert.equal(clock(59.9996), "00:01:00.000");
  assert.equal(seconds("01:02:03,456"), 3723.456);
  assert.throws(() => seconds("00:80:00.000"));
  assert.throws(() => seconds("08:00:00.000"));
  assert.throws(() =>
    validateTranscript({
      ...emptyTranscript,
      cues: [
        {
          id: "a",
          start: "00:00:02.000",
          end: "00:00:01.000",
          text: "x",
          reviewed: false,
        },
      ],
    }),
  );
});
test("splitting uses codepoints and creates a distinct unreviewed cue", () => {
  const cue = {
    id: "old",
    start: "00:00:00.000",
    end: "00:00:04.000",
    text: "你好😀世",
    reviewed: true,
  };
  const pair = splitCue(cue);
  assert.equal(pair[0].end, pair[1].start);
  assert.equal(pair[0].text + pair[1].text, cue.text);
  assert.notEqual(pair[0].id, pair[1].id);
  assert.equal(pair[0].reviewed, false);
});
test("audio chunks finish atomically and verify real bytes; tampering is rejected", async () => {
  const dir = await mkdtemp(join(tmpdir(), "whisper-files-"));
  try {
    const files = createAudioFiles(async (p) => join(dir, p));
    await files.chunk(source.id, 0, wav().toString("base64"));
    await files.finish(source);
    assert.deepEqual(await files.read(source.id), wav());
    await files.verify(source);
    assert.equal(detectMime(wav()), "audio/wav");
    await assert.rejects(files.chunk("../escape", 0, "AA=="));
    await files.chunk(source.id, 0, Buffer.alloc(80).toString("base64"));
    await assert.rejects(files.finish(source));
    assert.deepEqual(await files.read(source.id), wav());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("project revisions reject conflicts instead of overwriting another editor", async () => {
  const db = await database();
  try {
    const store = createStore(db, validateTranscript),
      p = store.create("Interview", exampleTranscript);
    store.update(p.id, "Edited", exampleTranscript, p.revision);
    assert.throws(
      () => store.update(p.id, "Lost", exampleTranscript, p.revision),
      (e: unknown) => e instanceof StoreError && e.status === 409,
    );
    assert.equal(store.get(p.id).title, "Edited");
  } finally {
    db.close();
  }
});
test("job records exist before external submit; duplicate request does not submit again", async () => {
  const db = await database();
  try {
    const p = createStore(db, validateTranscript).create("Audio", {
      ...emptyTranscript,
      source,
    });
    let calls = 0;
    const fake: typeof fetch = async () => {
      calls++;
      assert.ok(
        db.prepare("SELECT id FROM transcription_jobs WHERE id=?").get(id),
      );
      return Response.json({
        id,
        audioSha256: source.id,
        language: "en",
        status: "queued",
        model: "tiny.en",
        error: "",
      });
    };
    const jobs = createJobs(
      db,
      async () => wav(),
      fake,
      new URL("http://127.0.0.1:8768"),
    );
    const input = jobInput({ source, language: "en" });
    await jobs.create(id, p.id, input);
    await jobs.create(id, p.id, input);
    assert.equal(calls, 1);
    await assert.rejects(jobs.create(id, p.id, { ...input, language: "zh" }));
    assert.equal(jobs.get(id).status, "queued");
    assert.equal(parseJob(jobs.list()[0]).id, id);
  } finally {
    db.close();
  }
});
test("lost response is unknown and reconciles original job without duplicate submission", async () => {
  const db = await database();
  try {
    const p = createStore(db, validateTranscript).create("Audio", {
      ...emptyTranscript,
      source,
    });
    let writes = 0;
    const fake: typeof fetch = async (_url, options) => {
      if (options?.method === "PUT") {
        writes++;
        throw new Error("response lost");
      }
      return Response.json({
        id,
        audioSha256: source.id,
        language: "en",
        status: "completed",
        model: "tiny.en",
        segments: [{ start: 0, end: 1, text: "Hello" }],
      });
    };
    const jobs = createJobs(
      db,
      async () => wav(),
      fake,
      new URL("http://127.0.0.1:8768"),
    );
    assert.equal(
      (await jobs.create(id, p.id, { source, language: "en" })).status,
      "unknown",
    );
    assert.equal((await jobs.reconcile(id)).segments?.[0].text, "Hello");
    assert.equal(writes, 1);
  } finally {
    db.close();
  }
});
test("cancel and invalid upstream responses never produce completed fake results", async () => {
  const db = await database();
  try {
    const p = createStore(db, validateTranscript).create("Audio", {
      ...emptyTranscript,
      source,
    });
    let cancel = false;
    const fake: typeof fetch = async (url, options) => {
      if (String(url).endsWith("/cancel")) {
        cancel = true;
        return Response.json({
          id,
          audioSha256: source.id,
          language: "en",
          status: "cancelled",
          model: "tiny.en",
        });
      }
      if (options?.method === "PUT")
        return Response.json({
          id,
          audioSha256: source.id,
          language: "en",
          status: "queued",
        });
      return Response.json({
        id,
        audioSha256: source.id,
        language: "en",
        status: "completed",
        segments: [{ start: 0, end: -1, text: "invalid" }],
      });
    };
    const jobs = createJobs(
      db,
      async () => wav(),
      fake,
      new URL("http://127.0.0.1:8768"),
    );
    await jobs.create(id, p.id, { source, language: "en" });
    assert.equal((await jobs.reconcile(id)).status, "unknown");
    assert.equal((await jobs.cancel(id)).status, "cancelled");
    assert.ok(cancel);
    assert.equal(jobs.get(id).segments, null);
  } finally {
    db.close();
  }
});
test("service URL rejects embedded credentials, paths and other protocols", () => {
  assert.throws(() => configuredService("file:///etc/passwd"));
  assert.throws(() => configuredService("http://secret:password@example.test"));
  assert.throws(() => configuredService("http://example.test/path"));
  assert.equal(
    configuredService("http://127.0.0.1:8768").hostname,
    "127.0.0.1",
  );
});

test("concurrent duplicate job requests share one durable operation", async () => {
  const db = await database();
  try {
    const project = createStore(db, validateTranscript).create("Audio", {
      ...emptyTranscript,
      source,
    });
    let calls = 0;
    const fake: typeof fetch = async () => {
      calls++;
      return Response.json({
        id,
        audioSha256: source.id,
        language: "en",
        status: "queued",
        model: "tiny.en",
      });
    };
    const jobs = createJobs(
      db,
      async () => wav(),
      fake,
      new URL("http://127.0.0.1:8768"),
    );
    const [a, b] = await Promise.all([
      jobs.create(id, project.id, { source, language: "en" }),
      jobs.create(id, project.id, { source, language: "en" }),
    ]);
    assert.equal(a.id, b.id);
    assert.equal(calls, 1);
    assert.equal(jobs.list().length, 1);
  } finally {
    db.close();
  }
});
