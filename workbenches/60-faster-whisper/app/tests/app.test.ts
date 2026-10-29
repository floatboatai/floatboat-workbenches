import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  emptyTranscript,
  validateTranscript,
  restoreTranscript,
  transcriptDraft,
  seconds,
  clock,
  type Cue,
  type Transcript,
} from "../src/contracts/transcript.ts";
import { splitCue } from "../src/contracts/edit.ts";
import { exportSubtitles, importSubtitles } from "../src/contracts/subtitles.ts";
import { defaultOptions, wireOptions } from "../src/contracts/options.ts";
const importTranscript = (text: string, name: string) => importSubtitles(text, name).cues;
const cue = (c: Partial<Cue> & Pick<Cue, "id" | "start" | "end" | "text">): Cue => ({ reviewed: false, speaker: "", words: [], ...c });
const exampleTranscript: Transcript = {
  ...emptyTranscript,
  cues: [
    cue({ id: "example-1", start: "00:00:00.000", end: "00:00:04.200", text: "今天，我们聊聊如何为一段访谈制作清晰的字幕。", reviewed: true }),
    cue({ id: "example-2", start: "00:00:04.200", end: "00:00:09.600", text: "先听完整段录音，再检查专有名词、停顿与语气。" }),
    cue({ id: "example-3", start: "00:00:09.600", end: "00:00:14.500", text: "每一次修订都保留下来，\n交付时就能更从容。" }),
  ],
};
/** What the companion service echoes for a job submitted with default options. */
const echo = { options: wireOptions(defaultOptions) };
import { jobInput, parseJob } from "../src/contracts/job.ts";
import { createAudioFiles, digest, detectMime } from "../src/server/files.ts";
import { configuredService, createJobs } from "../src/server/jobs.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
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
  for (const file of ["0004_transcriptions.sql", "0005_job_info.sql"])
    db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
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
        cue({ id: "a", start: "00:00:02.000", end: "00:00:01.000", text: "x" }),
      ],
    }),
  );
});
test("splitting uses codepoints and creates a distinct unreviewed cue", () => {
  const old = cue({ id: "old", start: "00:00:00.000", end: "00:00:04.000", text: "你好😀世", reviewed: true });
  const pair = splitCue(old);
  assert.equal(pair[0].end, pair[1].start);
  assert.equal(pair[0].text + pair[1].text, old.text);
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
        ...echo,
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
        ...echo,
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
          ...echo,
          id,
          audioSha256: source.id,
          language: "en",
          status: "cancelled",
          model: "tiny.en",
        });
      }
      if (options?.method === "PUT")
        return Response.json({
          ...echo,
          id,
          audioSha256: source.id,
          language: "en",
          status: "queued",
        });
      return Response.json({
        ...echo,
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
        ...echo,
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

test("late poll cannot resurrect cancelled transcription and remote cleartext is rejected", async () => {
  assert.throws(() => configuredService("http://example.org"));
  const db = await database();
  try {
    const project = createStore(db, validateTranscript).create("Audio", {
      ...emptyTranscript,
      source,
    });
    let resolvePoll: ((response: Response) => void) | undefined;
    const reply = (status: string) =>
      Response.json({
        ...echo,
        id,
        audioSha256: source.id,
        language: "en",
        status,
        model: "tiny.en",
        segments:
          status === "completed"
            ? [{ start: 0, end: 1, text: "Late output" }]
            : undefined,
      });
    const jobs = createJobs(
      db,
      async () => wav(),
      async (url, options) => {
        if (options?.method === "PUT") return reply("queued");
        if (String(url).endsWith("/cancel")) return reply("cancelled");
        return new Promise<Response>((resolve) => {
          resolvePoll = resolve;
        });
      },
      new URL("http://127.0.0.1:8768"),
    );
    await jobs.create(id, project.id, { source, language: "en" });
    const pending = jobs.reconcile(id);
    assert.equal((await jobs.cancel(id)).status, "cancelled");
    resolvePoll!(reply("completed"));
    assert.equal((await pending).status, "cancelled");
    assert.equal(jobs.get(id).segments, null);
  } finally {
    db.close();
  }
});

test("oversized subtitle notes and incomplete long cues survive draft storage", async () => {
  const cues = Array.from({ length: 200 }, (_, i) =>
    cue({ id: "cue-" + i, start: "00:00:00.000", end: "00:00:01.000", text: "x".repeat(3600) }),
  );
  const initial = { ...emptyTranscript, cues };
  const baseBytes = Buffer.byteLength(JSON.stringify(initial));
  const base = validateTranscript({
    ...initial,
    notes: "x".repeat(Math.min(20000, 879000 - baseBytes)),
  });
  const edited = {
    ...base,
    cues: base.cues.map((c, i) =>
      i === 0 ? { ...c, text: "复".repeat(7000) } : c,
    ),
  };
  assert.throws(() => validateTranscript(edited));
  assert.equal(restoreTranscript(edited).cues[0].text.length, 7000);
  const db = await database();
  db.exec(
    await readFile(
      new URL("../migrations/0003_autosave.sql", import.meta.url),
      "utf8",
    ),
  );
  try {
    const store = createAutosaveStore(db, validateTranscript),
      documentId = crypto.randomUUID();
    const receipt = await store.commit({
      documentId,
      mutationId: crypto.randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: {
        title: "Subtitle draft",
        data: edited,
        extra: transcriptDraft({ importText: "00:00:" }),
      },
    });
    assert.equal(receipt.phase, "draft");
    assert.equal(
      restoreTranscript(store.get(documentId)!.snapshot.data).cues[0].text
        .length,
      7000,
    );
    const portable = JSON.parse(
      JSON.stringify({
        data: edited,
        draft: { importText: "字".repeat(100000) },
      }),
    );
    assert.equal(restoreTranscript(portable.data).cues[0].text.length, 7000);
    assert.equal(
      transcriptDraft(portable.draft).importText,
      portable.draft.importText,
    );
  } finally {
    db.close();
  }
});
