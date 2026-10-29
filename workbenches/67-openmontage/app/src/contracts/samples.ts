// ABOUTME: 随工作台附带的原创示例素材（由 samples-src/generate.mjs 程序生成）与示例粗剪工程。
import type { Asset } from "./media.ts";
import { defaultTracks, DEFAULT_SETTINGS, PRESETS, type Clip, type Timeline } from "./timeline.ts";

const sample = (id: string, file: string, name: string, kind: Asset["kind"], mime: string, bytes: number, duration: number | null, hasAudio: boolean) => ({
  file,
  asset: { id, name, kind, mime, bytes, duration, width: kind === "audio" ? null : 1280, height: kind === "audio" ? null : 720, hasAudio, sample: true } satisfies Asset,
});
export const SAMPLES = [
  sample("358805bc802700af5d9fb486bf9787982569218ff6a6e507101a8e10e3fc29e4", "sunrise.mp4", "海上日出.mp4", "video", "video/mp4", 639105, 7, true),
  sample("b8be05213d92239bf0c6d91ed3e82f0ca4de82853f3eb6322fb69119557b6f5c", "waves.mp4", "浪花近景.mp4", "video", "video/mp4", 569234, 6, true),
  sample("676e4da38bdc575f50940b0dfd6aea215b5097c8f291f8adbdda51276f952ed8", "harbor-dusk.mp4", "黄昏港城.mp4", "video", "video/mp4", 767490, 7, false),
  sample("c56b46544114a936f309f5316f77f04c144c9408ac89786e9ba29f7091aeb17e", "lighthouse.jpg", "夜色灯塔.jpg", "image", "image/jpeg", 77016, null, false),
  sample("a46a0e85c3a27405e487c5ccf6b71d6d1d0a424dee92f6f5d7c60e4e49606a82", "theme.m4a", "配乐 · 海风.m4a", "audio", "audio/mp4", 433994, 30, true),
  sample("afcd007374a313e010f7ef2b5da6ded1bc4d0c9f0b156f14ef2e07976824134a", "sea-ambience.m4a", "海浪环境声.m4a", "audio", "audio/mp4", 171172, 12, true),
] as const;
export const sampleFile = (id: string) => SAMPLES.find((s) => s.asset.id === id)?.file;
const [sunrise, waves, harbor, lighthouse, theme, sea] = SAMPLES.map((s) => s.asset);

const media = (id: string, trackId: string, asset: Asset, start: number, duration: number, extra: Partial<Clip> = {}): Clip => ({
  id, trackId, assetId: asset.id, text: "", style: null, start, in: 0, duration, volume: 1, fadeIn: 0, fadeOut: 0, fit: "cover", motion: "none", note: "", ...extra,
});
const text = (id: string, trackId: string, preset: keyof typeof PRESETS, start: number, duration: number, body: string, extra: Partial<Clip> = {}): Clip => ({
  id, trackId, assetId: null, text: body, style: { ...PRESETS[preset] }, start, in: 0, duration, volume: 1, fadeIn: 0, fadeOut: 0, fit: "cover", motion: "none", note: "", ...extra,
});

export const SAMPLE_TITLE = "海边的一天 · 粗剪";
/** 四个镜头从清晨到夜里：淡入开场、两处交叉溶解、经黑场转入静帧，配乐与环境声分轨。 */
export function sampleTimeline(): Timeline {
  return {
    version: 2,
    brief: "一分钟以内的城市海边短片。从日出到夜里四个镜头，配乐贯穿，环境声只在后半段补足。字幕为旁白稿，交片前再核对一次措辞。",
    settings: { ...DEFAULT_SETTINGS },
    assets: [sunrise, waves, harbor, lighthouse, theme, sea],
    tracks: defaultTracks(),
    clips: [
      media("s-sunrise", "v-main", sunrise, 0, 7, { fadeIn: 1, volume: 0.45, note: "开场从黑场淡入，海浪声压低给配乐让位。" }),
      media("s-waves", "v-main", waves, 6, 6, { fadeIn: 1, volume: 0.6, note: "与日出交叉溶解 1 秒。" }),
      media("s-harbor", "v-main", harbor, 11.2, 7, { fadeIn: 0.8, fadeOut: 0.6, note: "交叉溶解进入黄昏，出场经黑场。" }),
      media("s-light", "v-main", lighthouse, 18.2, 6, { fadeIn: 0.6, fadeOut: 1.5, motion: "zoom-in", note: "静帧缓慢推近，结尾淡出。" }),
      text("x-title", "t-title", "title", 0.8, 4.4, "海边的一天\nA Day by the Sea", { fadeIn: 0.6, fadeOut: 0.6 }),
      text("x-lower", "t-title", "lower", 12.4, 3.8, "港口 · 傍晚六点", { fadeIn: 0.3, fadeOut: 0.3 }),
      text("x-end", "t-title", "title", 21.4, 2.8, "完", { fadeIn: 0.5, fadeOut: 1.2, style: { ...PRESETS.title, size: 48 } }),
      text("x-s1", "t-sub", "subtitle", 1.2, 3.8, "清晨五点四十分，太阳从海平线上升起。"),
      text("x-s2", "t-sub", "subtitle", 6.6, 4.2, "潮水一遍遍推上岸，又退回去。"),
      text("x-s3", "t-sub", "subtitle", 12.0, 4.6, "傍晚，港口的灯一盏接一盏亮起来。"),
      text("x-s4", "t-sub", "subtitle", 18.8, 2.4, "夜里，灯塔替所有人看着海。"),
      media("s-theme", "a-music", theme, 0, 24.2, { volume: 0.7, fadeIn: 1.5, fadeOut: 2.5 }),
      media("s-sea", "a-amb", sea, 12, 12, { volume: 0.5, fadeIn: 1, fadeOut: 2 }),
    ],
    outputs: [],
  };
}
