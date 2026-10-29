import { test } from "node:test";
import assert from "node:assert/strict";
import { audioParts, frameCount, frameSpans } from "../src/contracts/render-plan.ts";
import { sampleTimeline } from "../src/contracts/samples.ts";
import { servicePlan } from "../src/contracts/service-plan.ts";
import { readyMontage } from "../src/contracts/montage.ts";

test("frame plan covers each video clip with increasing source timestamps", () => {
  const t = sampleTimeline();
  assert.equal(frameCount(t), 726);
  const spans = frameSpans(t);
  assert.equal(spans.length, 3); // 图片不解码，文字不占帧
  const waves = spans.find((s) => s.clip.id === "s-waves")!;
  assert.equal(waves.first, 180);
  assert.equal(waves.last, 359);
  assert.equal(waves.timestamps[0], 0);
  assert.ok(waves.timestamps.every((v, i, a) => i === 0 || v > a[i - 1]));
  assert.ok(waves.timestamps.at(-1)! < 6);
  t.tracks.find((k) => k.id === "v-main")!.muted = true;
  assert.equal(frameSpans(t).length, 0);
});

test("audio mix includes music, ambience and footage sound with track volume and fades", () => {
  const t = sampleTimeline();
  const parts = audioParts(t);
  assert.deepEqual(parts.map((p) => p.clip.id).sort(), ["s-sea", "s-sunrise", "s-theme", "s-waves"]);
  const theme = parts.find((p) => p.clip.id === "s-theme")!;
  assert.deepEqual(theme.gains, [
    { time: 0, gain: 0 },
    { time: 1.5, gain: 0.56 },
    { time: 21.7, gain: 0.56 },
    { time: 24.2, gain: 0 },
  ]);
  t.tracks.find((k) => k.id === "a-music")!.muted = true;
  assert.equal(audioParts(t).some((p) => p.clip.id === "s-theme"), false);
});

test("OpenMontage service plan explains what it cannot take and accepts a plain MP4 cut", () => {
  const sample = servicePlan(sampleTimeline());
  assert.equal(sample.montage, null);
  assert.match(sample.reason, /夜色灯塔/);
  const t = sampleTimeline();
  t.clips = t.clips.filter((c) => c.id === "s-sunrise" || c.id === "s-waves");
  const plan = servicePlan(t);
  assert.ok(plan.montage);
  assert.deepEqual(plan.montage!.shots.map((s) => [s.start, s.end]), [["0", "7"], ["0", "6"]]);
  assert.deepEqual(plan.omitted, ["淡入淡出与交叉溶解（改为硬切）"]);
  readyMontage(plan.montage);
});
