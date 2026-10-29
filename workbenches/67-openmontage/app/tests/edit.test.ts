import { test } from "node:test";
import assert from "node:assert/strict";
import { timelineValue, clipEnd, emptyTimeline } from "../src/contracts/timeline.ts";
import { sampleTimeline, SAMPLES } from "../src/contracts/samples.ts";
import { addMediaClip, addTextClip, addTrack, crossfade, moveClip, removeClip, removeTrack, snap, snapPoints, splitClip, trimClip, overlapWithPrevious } from "../src/contracts/edit.ts";

const get = (t: ReturnType<typeof sampleTimeline>, id: string) => t.clips.find((c) => c.id === id)!;

test("moving keeps the clip on a compatible track only", () => {
  const t = sampleTimeline();
  const a = moveClip(t, "s-waves", 8, "v-over");
  assert.equal(get(a, "s-waves").trackId, "v-over");
  assert.equal(get(a, "s-waves").start, 8);
  const b = moveClip(t, "s-waves", 8, "a-music");
  assert.equal(get(b, "s-waves").trackId, "v-main");
  timelineValue(a);
});

test("trimming the head moves the source in-point and is bounded by the footage", () => {
  const t = sampleTimeline();
  const a = trimClip(t, "s-waves", "start", 7);
  assert.deepEqual([get(a, "s-waves").start, get(a, "s-waves").in, get(a, "s-waves").duration], [7, 1, 5]);
  const b = trimClip(t, "s-waves", "start", 2); // cannot reveal footage before 0
  assert.equal(get(b, "s-waves").start, 6);
  const c = trimClip(t, "s-waves", "end", 40); // 6 s of footage
  assert.equal(clipEnd(get(c, "s-waves")), 12);
  const d = trimClip(t, "x-title", "end", 40); // text has no source limit
  assert.equal(clipEnd(get(d, "x-title")), 40);
  timelineValue(a);
  timelineValue(c);
});

test("splitting keeps continuous source time and moves fades to the outer halves", () => {
  const t = sampleTimeline();
  const { timeline, right } = splitClip(t, "s-light", 20);
  const left = get(timeline, "s-light");
  assert.ok(right);
  assert.equal(left.duration, 1.8);
  assert.equal(left.fadeOut, 0);
  assert.equal(right!.start, 20);
  assert.equal(right!.fadeIn, 0);
  assert.equal(right!.fadeOut, 1.5);
  const video = splitClip(t, "s-sunrise", 3).right!;
  assert.equal(video.in, 3);
  assert.equal(splitClip(t, "s-sunrise", 0.05).right, null);
  timelineValue(timeline);
});

test("cross dissolve overlaps with the previous clip, fades in and ripples later clips", () => {
  const t = sampleTimeline();
  const harbor = get(t, "s-harbor"), light = get(t, "s-light");
  const out = crossfade(t, "s-harbor", 1.5);
  assert.equal(get(out, "s-harbor").start, clipEnd(get(t, "s-waves")) - 1.5);
  assert.equal(get(out, "s-harbor").fadeIn, 1.5);
  assert.equal(overlapWithPrevious(out, get(out, "s-harbor")), 1.5);
  assert.equal(get(out, "s-light").start, light.start - (harbor.start - get(out, "s-harbor").start));
  assert.throws(() => crossfade(t, "s-sunrise", 1), /前一段/);
});

test("snapping prefers the nearest edge within tolerance", () => {
  const t = sampleTimeline();
  const points = snapPoints(t, "s-waves", 9.5);
  assert.equal(snap(6.97, points, 0.1), 7);
  assert.equal(snap(9.45, points, 0.1), 9.5);
  assert.equal(snap(9.2, points, 0.1), 9.2);
});

test("adding media appends to the matching track; text, tracks and ripple delete", () => {
  let t = emptyTimeline();
  const [video, , , image, music] = SAMPLES.map((s) => s.asset);
  t = addMediaClip(t, video, undefined).timeline;
  t = addMediaClip(t, image, undefined).timeline;
  t = addMediaClip(t, music, 0).timeline;
  const main = t.clips.filter((c) => c.trackId === "v-main");
  assert.deepEqual(main.map((c) => c.start), [0, 7]);
  assert.equal(t.clips.find((c) => c.assetId === music.id)!.trackId, "a-music");
  t = addTextClip(t, "subtitle", 1, "你好").timeline;
  assert.equal(t.clips.at(-1)!.trackId, "t-sub");
  t = addTrack(t, "video");
  assert.equal(t.tracks.findIndex((k) => k.kind === "video"), t.tracks.findIndex((k) => k.name === "画面 3"));
  t = addTrack(t, "audio");
  assert.equal(t.tracks.at(-1)!.kind, "audio");
  timelineValue(t);
  const rippled = removeClip(t, main[0].id, true);
  assert.equal(rippled.clips.find((c) => c.id === main[1].id)!.start, 0);
  assert.throws(() => removeTrack(removeTrack(emptyTimeline(), "t-title"), "t-sub"), /至少保留/);
});
