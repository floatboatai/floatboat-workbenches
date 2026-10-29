import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  audioSource,
  emptyTranscript,
  restoreTranscript,
  seconds,
  sniffAudio,
  validateTranscript,
  type Cue,
  type Word,
} from "../src/contracts/transcript.ts";
import {
  carrySpeakers,
  findMatches,
  mergeCues,
  nudge,
  realign,
  replaceInCue,
  retext,
  segmentCues,
  setEdge,
  splitCue,
  wordsAligned,
} from "../src/contracts/edit.ts";
import { exportSubtitles, importSubtitles } from "../src/contracts/subtitles.ts";
import { defaultOptions, optionsValue, wireOptions } from "../src/contracts/options.ts";
import { jobInput } from "../src/contracts/job.ts";
import { sampleTranscript } from "../src/contracts/sample.ts";
import { SAMPLE_AUDIO_BASE64 } from "../src/server/sample-audio.ts";
import { createAudioFiles, digest } from "../src/server/files.ts";
import { canonical, createJobs } from "../src/server/jobs.ts";
import { createStore } from "../src/server/store.ts";

const w = (s: number, e: number, text: string, p = 0.9): Word => ({ s, e, w: text, p });
const cue = (c: Partial<Cue> & Pick<Cue, "id" | "start" | "end" | "text">): Cue => ({ reviewed: false, speaker: "", words: [], ...c });

test("0.4 projects without speakers, words or options still open and validate", () => {
  const legacy = {
    source: null,
    language: "en",
    notes: "",
    origin: "",
    cues: [{ id: "a", start: "00:00:00.000", end: "00:00:01.000", text: "Hi", reviewed: false }],
  };
  const data = validateTranscript(legacy);
  assert.deepEqual(data.speakers, []);
  assert.deepEqual(data.cues[0].words, []);
  assert.equal(data.cues[0].speaker, "");
  assert.deepEqual(data.options, defaultOptions);
  assert.throws(() => validateTranscript({ ...legacy, cues: [{ ...legacy.cues[0], speaker: "ghost" }] }), /说话人/);
});

test("bundled sample audio matches the bundled transcript and passes strict validation", () => {
  const bytes = Buffer.from(SAMPLE_AUDIO_BASE64, "base64");
  assert.equal(digest(bytes), sampleTranscript.source?.id);
  assert.equal(bytes.length, sampleTranscript.source?.bytes);
  assert.equal(sniffAudio(bytes), "audio/ogg");
  const data = validateTranscript(sampleTranscript);
  assert.equal(data.cues.length, 12);
  assert.equal(data.speakers.length, 2);
  assert.ok(data.cues.every((c) => c.speaker && c.words.length && wordsAligned(c)));
  assert.ok(data.cues.slice(0, 4).every((c) => c.reviewed));
  assert.ok(data.cues.some((c) => c.words.some((x) => x.p >= 0 && x.p < 0.5)), "sample shows low-confidence words");
  assert.match(data.cues[4].text + data.cues[5].text, /执办/, "unreviewed cues keep the real model errors to proofread");
});

test("sample original is written once by content and survives repeated starts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "whisper-sample-"));
  try {
    const files = createAudioFiles(async (p) => join(dir, p));
    const bytes = Buffer.from(SAMPLE_AUDIO_BASE64, "base64");
    const id = await files.ensure(bytes);
    assert.equal(await files.ensure(bytes), id);
    await files.verify(sampleTranscript.source);
    assert.deepEqual(await files.read(id), bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("realign keeps recognised times for surviving characters and marks inserted ones as edited", () => {
  const words = [w(1, 1.2, "吴"), w(1.2, 1.4, "同"), w(1.4, 1.6, "路"), w(1.6, 2, "社区")];
  const next = realign("梧桐路社区", words, 1, 2);
  assert.equal(next.map((x) => x.w).join(""), "梧桐路社区");
  assert.equal(next.find((x) => x.w === "路")!.s, 1.4);
  assert.equal(next.find((x) => x.w === "社区")!.e, 2);
  assert.ok(next.filter((x) => x.w === "梧" || x.w === "桐").every((x) => x.p === -1 && x.s >= 1 && x.e <= 1.4));
  const latin = realign("Hello brave world", [w(0, 0.5, " Hello", 0.95), w(0.5, 1, " world", 0.4)], 0, 1);
  assert.deepEqual(latin.map((x) => x.w), ["Hello", " brave", " world"]);
  assert.equal(latin[2].p, 0.4);
  const edited = retext(cue({ id: "c", start: "00:00:01.000", end: "00:00:02.000", text: "吴同路社区", words, reviewed: true }), "梧桐路社区。");
  assert.ok(wordsAligned(edited));
  assert.equal(edited.reviewed, false);
  assert.equal(edited.words.at(-1)!.w, "社区。");
});

test("split lands on the word nearest the playhead and partitions words; merge joins CJK without spaces", () => {
  const c = cue({
    id: "a",
    start: "00:00:10.000",
    end: "00:00:14.000",
    text: "我们和附近两所大学合作，招募了志愿者。",
    words: [w(10, 10.4, "我们"), w(10.4, 10.6, "和"), w(10.6, 11, "附近"), w(11, 11.3, "两所"), w(11.3, 11.9, "大学"), w(11.9, 12.4, "合作，"), w(12.6, 13, "招募"), w(13, 13.2, "了"), w(13.2, 14, "志愿者。")],
  });
  const [a, b] = splitCue(c, 12.55, "b");
  assert.equal(a.text, "我们和附近两所大学合作，");
  assert.equal(b.text, "招募了志愿者。");
  assert.equal(a.end, b.start);
  assert.ok(seconds(a.end) >= 12.4 && seconds(a.end) <= 12.6);
  assert.equal(a.words.length + b.words.length, c.words.length);
  assert.ok(wordsAligned(a) && wordsAligned(b));
  const merged = mergeCues(a, b);
  assert.equal(merged.text, c.text);
  assert.equal(merged.end, "00:00:14.000");
  assert.equal(merged.words.length, c.words.length);
  const en = mergeCues(cue({ id: "x", start: "00:00:00.000", end: "00:00:01.000", text: "Hello", words: [w(0, 1, " Hello")] }), cue({ id: "y", start: "00:00:01.000", end: "00:00:02.000", text: "world", words: [w(1, 2, "world")] }));
  assert.equal(en.text, "Hello world");
  assert.equal(en.words[1].w, " world");
});

test("in/out nudges and playhead edges never cross the opposite point", () => {
  const c = cue({ id: "a", start: "00:00:01.000", end: "00:00:02.000", text: "x" });
  assert.equal(nudge(c, "start", -0.5).start, "00:00:00.500");
  assert.equal(nudge(c, "start", 5).start, "00:00:01.990");
  assert.equal(nudge(c, "end", -5).end, "00:00:01.010");
  assert.equal(setEdge(c, "end", 3.25).end, "00:00:03.250");
  assert.throws(() => setEdge(c, "start", 2.5), /入点/);
});

test("find and replace: plain, case-insensitive, regex groups, and invalid regex", () => {
  const cues = [
    cue({ id: "a", start: "00:00:00.000", end: "00:00:01.000", text: "管长说，管长好", words: [w(0, 0.5, "管长"), w(0.5, 0.6, "说，"), w(0.6, 0.8, "管长"), w(0.8, 1, "好")] }),
    cue({ id: "b", start: "00:00:01.000", end: "00:00:02.000", text: "Call 10 PM, call again" }),
  ];
  assert.equal(findMatches(cues, "管长", { matchCase: false, regex: false }).length, 2);
  assert.equal(findMatches(cues, "call", { matchCase: false, regex: false }).length, 2);
  assert.equal(findMatches(cues, "call", { matchCase: true, regex: false }).length, 1);
  const [first] = findMatches(cues, "管长", { matchCase: false, regex: false });
  const one = replaceInCue(cues[0], "管长", "馆长", { matchCase: false, regex: false }, first);
  assert.equal(one.text, "馆长说，管长好");
  const all = replaceInCue(cues[0], "管长", "馆长", { matchCase: false, regex: false });
  assert.equal(all.text, "馆长说，馆长好");
  assert.ok(wordsAligned(all));
  assert.equal(all.words.find((x) => x.w === "好")!.s, 0.8);
  assert.equal(replaceInCue(cues[1], "(\\d+) PM", "$1 点", { matchCase: true, regex: true }).text, "Call 10 点, call again");
  assert.equal(replaceInCue(cues[1], "$1", "x", { matchCase: true, regex: false }).text, cues[1].text);
  assert.throws(() => findMatches(cues, "(", { matchCase: false, regex: true }), /正则/);
});

test("VTT voice tags become speakers and exports write them back per format", () => {
  const imported = importSubtitles("WEBVTT\n\n1\n00:00.000 --> 00:01.500\n<v 林夏>欢迎收听\n\n2\n00:01.500 --> 00:03.000\n<v.loud 周明远>大家好</v>\n\n3\n00:03.000 --> 00:04.000\n<v 林夏>谢谢\n", "a.vtt");
  assert.deepEqual(imported.speakers.map((s) => s.name), ["林夏", "周明远"]);
  assert.equal(imported.cues[1].text, "大家好");
  assert.equal(imported.cues[2].speaker, imported.cues[0].speaker);
  const data = validateTranscript({ ...emptyTranscript, ...imported });
  const vtt = exportSubtitles(data, "vtt");
  assert.match(vtt, /<v 周明远>大家好/);
  assert.deepEqual(importSubtitles(vtt, "b.vtt").cues.map((c) => c.text), ["欢迎收听", "大家好", "谢谢"]);
  assert.match(exportSubtitles(data, "srt"), /00:00:01,500 --> 00:00:03,000\n周明远：大家好/);
  assert.doesNotMatch(exportSubtitles(data, "srt", { speakers: false, times: false }), /林夏/);
  assert.equal(exportSubtitles(data, "txt", { speakers: true, times: true }), "[00:00:00] 林夏：欢迎收听\n\n[00:00:01] 周明远：大家好\n\n[00:00:03] 林夏：谢谢\n");
});

test("JSON export round-trips words, probabilities and speakers through the segment importer", () => {
  const data = validateTranscript(sampleTranscript);
  const json = exportSubtitles(data, "json");
  const parsed = JSON.parse(json);
  assert.equal(parsed.segments[0].speaker, "林夏");
  assert.equal(typeof parsed.segments[4].words[0].probability, "number");
  const back = importSubtitles(json, "sample.json");
  assert.equal(back.cues.length, data.cues.length);
  assert.deepEqual(back.cues[6].words, data.cues[6].words);
  assert.deepEqual(back.cues.map((c) => back.speakers.find((s) => s.id === c.speaker)?.name), data.cues.map((c) => data.speakers.find((s) => s.id === c.speaker)?.name));
  // Hand-edited words export probability null and come back as edited (-1), not as low confidence.
  const edited = data.cues[0].words.find((x) => x.p < 0)!;
  assert.ok(edited);
  assert.ok(back.cues[0].words.some((x) => x.w === edited.w && x.p === -1));
});

test("faster-whisper word output becomes cue words; re-transcription keeps speakers by overlap", () => {
  const cues = segmentCues([{ start: 0, end: 2, text: " Hello world", words: [{ start: 0, end: 0.8, word: " Hello", probability: 0.98 }, { start: 0.9, end: 2, word: " world", probability: 0.31 }] }]);
  assert.equal(cues[0].text, "Hello world");
  assert.equal(cues[0].words[1].p, 0.31);
  assert.ok(wordsAligned(cues[0]));
  const old = [cue({ id: "o1", start: "00:00:00.000", end: "00:00:01.500", text: "a", speaker: "host" }), cue({ id: "o2", start: "00:00:01.500", end: "00:00:05.000", text: "b", speaker: "guest" })];
  const fresh = segmentCues([{ start: 0.1, end: 1.4, text: "x" }, { start: 1.6, end: 4, text: "y" }, { start: 9, end: 10, text: "z" }]);
  assert.deepEqual(carrySpeakers(fresh, old).map((c) => c.speaker), ["host", "guest", ""]);
});

test("transcribe options validate, default for legacy jobs and map to WhisperModel keyword arguments", () => {
  assert.deepEqual(optionsValue(undefined), defaultOptions);
  assert.throws(() => optionsValue({ beamSize: 0 }));
  assert.throws(() => optionsValue({ task: "summarize" }));
  assert.throws(() => optionsValue({ initialPrompt: "x".repeat(801) }));
  assert.deepEqual(wireOptions({ ...defaultOptions, task: "translate", initialPrompt: "  梧桐路 ", hotwords: " " }), {
    task: "translate",
    word_timestamps: true,
    vad_filter: true,
    min_silence_duration_ms: 500,
    beam_size: 5,
    initial_prompt: "梧桐路",
    hotwords: null,
    condition_on_previous_text: true,
  });
  const source = sampleTranscript.source!;
  assert.deepEqual(jobInput({ source, language: "zh" }).options, defaultOptions);
  assert.throws(() => jobInput({ source, language: "en", options: { ...defaultOptions, task: "translate" } }), /英语/);
  assert.equal(canonical({ b: 1, a: [true, null] }), canonical({ a: [true, null], b: 1 }));
});

test("audio sniffing accepts real containers and large files, and separates ADTS AAC from MP3", () => {
  assert.equal(sniffAudio(Uint8Array.from([0xff, 0xf1, 0x50, 0x80])), "audio/aac");
  assert.equal(sniffAudio(Uint8Array.from([0xff, 0xfb, 0x90, 0x64])), "audio/mpeg");
  assert.equal(sniffAudio(new TextEncoder().encode("FORM\0\0\0\0AIFF")), "audio/aiff");
  assert.equal(sniffAudio(new TextEncoder().encode("\0\0\0 ftypqt  ")), "audio/mp4");
  assert.throws(() => sniffAudio(new TextEncoder().encode("%PDF-1.7 hello")));
  assert.equal(audioSource({ id: "a".repeat(64), name: "1h.mp3", bytes: 150 * 1024 * 1024, mime: "audio/mpeg" }).bytes, 150 * 1024 * 1024);
  assert.throws(() => audioSource({ id: "a".repeat(64), name: "x", bytes: 201 * 1024 * 1024, mime: "audio/mpeg" }));
});

async function jobsDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL)");
  for (const f of ["0004_transcriptions.sql", "0005_job_info.sql"]) db.exec(await readFile(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
  return db;
}
const id = "44444444-4444-4444-8444-444444444444";

test("connector sends the captured options, rejects a service that ran different ones, and keeps run info", async () => {
  const db = await jobsDb();
  try {
    const source = sampleTranscript.source!;
    const project = createStore(db, validateTranscript).create("Interview", { ...emptyTranscript, source });
    const options = { ...defaultOptions, task: "translate" as const, beamSize: 2, initialPrompt: "梧桐路" };
    let sent: URL | null = null;
    let echoOptions: unknown = wireOptions(options);
    const reply = (status: string) =>
      Response.json({
        id,
        audioSha256: source.id,
        language: "zh",
        options: echoOptions,
        status,
        model: "small / faster-whisper 1.2.1",
        segments: status === "completed" ? [{ start: 0, end: 1.2, text: " Welcome", words: [{ start: 0, end: 1.2, word: " Welcome", probability: 0.9 }] }] : undefined,
        info: status === "completed" ? { language: "zh", language_probability: 0.97, duration: 82.2, duration_after_vad: 72.7 } : undefined,
      });
    const jobs = createJobs(
      db,
      async () => Buffer.from(SAMPLE_AUDIO_BASE64, "base64"),
      async (url, init) => {
        if (init?.method === "PUT") {
          sent = new URL(String(url));
          return reply("queued");
        }
        return reply("completed");
      },
      new URL("http://127.0.0.1:8768"),
    );
    await jobs.create(id, project.id, { source, language: "zh", options });
    assert.deepEqual(JSON.parse(sent!.searchParams.get("options")!), wireOptions(options));
    assert.equal(sent!.searchParams.get("language"), "zh");
    echoOptions = { ...wireOptions(options), beam_size: 5 };
    assert.equal((await jobs.reconcile(id)).status, "unknown", "mismatched option echo is never accepted");
    echoOptions = wireOptions(options);
    const done = await jobs.reconcile(id);
    assert.equal(done.status, "completed");
    assert.equal(done.info?.durationAfterVad, 72.7);
    assert.equal(done.segments?.[0].words?.[0].probability, 0.9);
    assert.equal(jobs.get(id).info?.languageProbability, 0.97);
  } finally {
    db.close();
  }
});

test("service health distinguishes not running, wrong token, outdated protocol and ready", async () => {
  const db = await jobsDb();
  try {
    const make = (fetcher: typeof fetch) => createJobs(db, async () => new Uint8Array(), fetcher, new URL("http://127.0.0.1:8768"));
    const down = await make(async () => {
      throw new TypeError("fetch failed");
    }).health();
    assert.equal(down.reason, "unreachable");
    assert.doesNotMatch(down.message, /fetch failed/);
    assert.equal(down.url, "http://127.0.0.1:8768");
    assert.equal((await make(async () => Response.json({ error: "Authentication required" }, { status: 401 })).health()).reason, "auth");
    assert.equal((await make(async () => Response.json({ engine: "faster-whisper", model: "tiny" })).health()).reason, "outdated");
    const ready = await make(async () => Response.json({ engine: "faster-whisper", model: "tiny.en", protocol: 2, multilingual: false })).health();
    assert.equal(ready.connected, true);
    assert.equal(ready.multilingual, false);
  } finally {
    db.close();
  }
});

test("working copies with unfinished speaker names and times restore, but never export", () => {
  const draft = {
    ...sampleTranscript,
    speakers: [{ id: "host", name: "" }, sampleTranscript.speakers[1]],
    cues: sampleTranscript.cues.map((c, i) => (i === 0 ? { ...c, end: "00:00:0" } : c)),
  };
  assert.equal(restoreTranscript(draft).speakers[0].name, "");
  assert.throws(() => validateTranscript(draft));
  assert.throws(() => exportSubtitles(draft, "json"));
});
