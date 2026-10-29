import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSubtitles, toSrt, timelineSrt, srtTime } from "../src/contracts/subtitles.ts";
import { sampleTimeline } from "../src/contracts/samples.ts";

test("SRT and WebVTT parse with tags stripped and multi-line text kept", () => {
  const srt = parseSubtitles("﻿1\r\n00:00:01,000 --> 00:00:03,500\r\n第一条<i>字幕</i>\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,200\r\n第二条\r\n两行\r\n");
  assert.deepEqual(srt, [
    { start: 1, end: 3.5, text: "第一条字幕" },
    { start: 4, end: 6.2, text: "第二条\n两行" },
  ]);
  const vtt = parseSubtitles("WEBVTT\n\nNOTE 说明\n\ncue-1\n00:01.250 --> 00:02.000 align:start\nVTT 短时间戳\n\n01:00:00.000 --> 01:00:01.500\n一小时\n");
  assert.deepEqual(vtt.map((c) => [c.start, c.end]), [[1.25, 2], [3600, 3601.5]]);
  assert.throws(() => parseSubtitles("纯文本"), /没有读到/);
});

test("subtitle track exports as numbered SRT in time order", () => {
  const out = timelineSrt(sampleTimeline());
  assert.match(out, /^1\n00:00:01,200 --> 00:00:05,000\n清晨五点四十分/);
  assert.equal(out.match(/-->/g)!.length, 4);
  assert.equal(srtTime(3661.005), "01:01:01,005");
  assert.deepEqual(parseSubtitles(out).length, 4);
  assert.equal(toSrt([]), "");
});
