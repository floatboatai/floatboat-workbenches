// ABOUTME: 把时间线主画面轨转换为 OpenMontage 服务能执行的裁切+硬切拼接计划，并说明哪些内容不在服务范围内。
import { readyMontage, MAX_VIDEO_BYTES, type Montage } from "./montage.ts";
import type { Timeline } from "./timeline.ts";

export type ServicePlan = { montage: Montage | null; reason: string; omitted: string[] };
export function servicePlan(t: Timeline): ServicePlan {
  const main = [...t.tracks].reverse().find((k) => k.kind === "video");
  const clips = t.clips.filter((c) => c.trackId === main?.id).sort((a, b) => a.start - b.start);
  const omitted: string[] = [];
  if (t.clips.some((c) => c.assetId === null)) omitted.push("标题与字幕");
  if (t.clips.some((c) => c.trackId !== main?.id && c.assetId !== null)) omitted.push("其他画面与音频轨");
  if (clips.some((c) => c.fadeIn > 0 || c.fadeOut > 0)) omitted.push("淡入淡出与交叉溶解（改为硬切）");
  const shots = [];
  for (const c of clips) {
    const asset = t.assets.find((a) => a.id === c.assetId);
    if (!asset || asset.kind !== "video" || asset.mime !== "video/mp4" || asset.bytes > MAX_VIDEO_BYTES)
      return { montage: null, reason: `「${asset?.name ?? "片段"}」不是20MB以内的MP4视频，OpenMontage服务暂不接收。`, omitted };
    shots.push({ id: c.id, title: asset.name, script: c.note, source: { id: asset.id, name: asset.name.slice(0, 180), bytes: asset.bytes, mime: "video/mp4" as const }, start: String(c.in), end: String(Math.round((c.in + c.duration) * 1000) / 1000), approved: true });
  }
  try {
    return { montage: readyMontage({ brief: t.brief.slice(0, 10000), shots }), reason: "", omitted };
  } catch (e) {
    return { montage: null, reason: "主画面轨" + (e instanceof Error ? e.message.replace("需要", "需") : "不满足服务条件"), omitted };
  }
}
