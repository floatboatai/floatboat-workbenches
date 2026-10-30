import { test } from "node:test";
import assert from "node:assert/strict";
import { timelineValue, emptyTimeline, envelope, duration, visualOrder, timecode } from "../src/contracts/timeline.ts";
import { sampleTimeline, SAMPLES } from "../src/contracts/samples.ts";

test("bundled sample film validates and spans four shots with music and ambience", () => {
  const t = timelineValue(sampleTimeline());
  assert.equal(t.assets.length, 6);
  assert.equal(t.clips.filter((c) => c.trackId === "v-main").length, 4);
  assert.equal(duration(t), 24.2);
  assert.ok(t.assets.every((a) => a.sample));
  assert.equal(new Set(SAMPLES.map((s) => s.asset.id)).size, SAMPLES.length);
});

test("0.5 shot sheets convert to a main-track sequence; shots without footage become caption cards", () => {
  const id = "a".repeat(64);
  const t = timelineValue({
    brief: "旧简报",
    shots: [
      { id: "opening", title: "开场", script: "呼吸感", source: { id, name: "a.mp4", bytes: 3000, mime: "video/mp4" }, start: "1", end: "3.5", approved: true },
      { id: "detail", title: "细节", script: "", source: null, start: "0", end: "2", approved: false },
      { id: "close", title: "收尾", script: "", source: { id, name: "a.mp4", bytes: 3000, mime: "video/mp4" }, start: "4", end: "6", approved: false },
    ],
  });
  assert.equal(t.version, 2);
  assert.equal(t.brief, "旧简报");
  const main = t.clips.filter((c) => c.trackId === "v-main");
  assert.deepEqual(main.map((c) => [c.start, c.in, c.duration]), [[0, 1, 2.5], [4.5, 4, 2]]);
  assert.equal(t.assets[0].duration, 6);
  const card = t.clips.find((c) => c.id === "detail")!;
  assert.equal(card.assetId, null);
  assert.equal(card.text, "细节");
  assert.match(main[0].note, /开场 · 呼吸感/);
});

test("validation rejects clips past the source, on the wrong track kind, or pointing at unknown media", () => {
  const base = sampleTimeline();
  const over = structuredClone(base);
  over.clips[0].duration = 9;
  assert.throws(() => timelineValue(over), /超出素材/);
  const wrong = structuredClone(base);
  wrong.clips.find((c) => c.id === "s-theme")!.trackId = "v-main";
  assert.throws(() => timelineValue(wrong), /不能放/);
  const missing = structuredClone(base);
  missing.clips[0].assetId = "b".repeat(64);
  assert.throws(() => timelineValue(missing), /不在素材库/);
  const odd = structuredClone(base);
  odd.settings.width = 1281;
  assert.throws(() => timelineValue(odd), /偶数/);
  assert.throws(() => timelineValue({ ...emptyTimeline(), tracks: [] }));
});

test("fade envelope ramps in and out and is full in between", () => {
  const c = sampleTimeline().clips.find((x) => x.id === "s-light")!; // 18.2–24.2, in 0.6, out 1.5
  assert.equal(envelope(c, 18.2), 0);
  assert.equal(Math.round(envelope(c, 18.5) * 100), 50);
  assert.equal(envelope(c, 20), 1);
  assert.equal(Math.round(envelope(c, 23.45) * 100), 50);
});

test("video layers draw lower tracks first and text above all pictures", () => {
  const order = visualOrder(sampleTimeline()).map((k) => k.id);
  assert.deepEqual(order, ["v-main", "v-over", "t-sub", "t-title"]);
  assert.equal(timecode(61.5, 30), "00:01:01:15");
  assert.equal(timecode(24.2, 30), "00:00:24:06");
  assert.equal(timecode(3725, 25), "01:02:05:00");
});
