// ABOUTME: 浏览器内导出成片：Mediabunny 解码素材、逐帧合成到画布、WebCodecs 编码并封装 MP4/WebM，声音用离线音频上下文混音。
import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  UrlSource,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type AudioCodec,
  type VideoCodec,
  type WrappedCanvas,
} from "mediabunny";
import { audioParts, frameCount, frameSpans } from "../../contracts/render-plan";
import { duration, type Clip, type Timeline } from "../../contracts/timeline";
import { composeFrame, type Frame } from "./compose";
import { mediaUrl } from "./player";

export type ExportOptions = { width: number; height: number; fps: number; quality: "high" | "medium" | "low" };
export type ExportResult = { blob: Blob; mime: string; extension: "mp4" | "webm"; video: VideoCodec; audio: AudioCodec | null; seconds: number };
export type Progress = { phase: "prepare" | "audio" | "video" | "finalize"; ratio: number; message: string };

const SAMPLE_RATE = 48000;
export class ExportCancelled extends Error {
  constructor() {
    super("已取消导出。");
  }
}

export function webCodecsAvailable() {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined" && typeof OfflineAudioContext !== "undefined";
}

/** 依次尝试 MP4(H.264+AAC)、WebM(VP9/VP8+Opus)、MP4(H.264+Opus)，取第一个本机能编码的组合。 */
export async function chooseFormat(width: number, height: number, withAudio: boolean) {
  const size = { width, height };
  const combos: { container: "mp4" | "webm"; video: VideoCodec; audio: AudioCodec }[] = [
    { container: "mp4", video: "avc", audio: "aac" },
    { container: "webm", video: "vp9", audio: "opus" },
    { container: "webm", video: "vp8", audio: "opus" },
    { container: "mp4", video: "avc", audio: "opus" },
  ];
  for (const c of combos) {
    if (!(await canEncodeVideo(c.video, size))) continue;
    if (withAudio && !(await canEncodeAudio(c.audio, { numberOfChannels: 2, sampleRate: SAMPLE_RATE }))) continue;
    return c;
  }
  return null;
}

async function mixAudio(t: Timeline, inputs: (id: string) => Input, signal: AbortSignal, progress: (r: number) => void) {
  const parts = audioParts(t);
  const total = duration(t);
  if (!parts.length || total <= 0) return null;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * SAMPLE_RATE), SAMPLE_RATE);
  let done = 0;
  for (const part of parts) {
    if (signal.aborted) throw new ExportCancelled();
    const track = await inputs(part.assetId).getPrimaryAudioTrack();
    if (!track) continue;
    if (!(await track.canDecode())) throw new Error("本机无法解码素材的声音，可在素材属性中检查格式。");
    const sink = new AudioBufferSink(track);
    const chunks: AudioBuffer[] = [];
    let first: number | null = null;
    for await (const w of sink.buffers(part.from, part.from + part.length)) {
      if (signal.aborted) throw new ExportCancelled();
      if (first === null) first = w.timestamp;
      chunks.push(w.buffer);
    }
    if (!chunks.length || first === null) continue;
    const rate = chunks[0].sampleRate, channels = Math.min(2, Math.max(...chunks.map((b) => b.numberOfChannels)));
    const length = chunks.reduce((n, b) => n + b.length, 0);
    const buffer = new AudioBuffer({ length, numberOfChannels: channels, sampleRate: rate });
    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      let offset = 0;
      for (const b of chunks) {
        data.set(b.getChannelData(Math.min(ch, b.numberOfChannels - 1)), offset);
        offset += b.length;
      }
    }
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    const gain = ctx.createGain();
    const [head, ...rest] = part.gains;
    gain.gain.setValueAtTime(head.gain, head.time);
    for (const p of rest) gain.gain.linearRampToValueAtTime(p.gain, p.time);
    node.connect(gain).connect(ctx.destination);
    const lead = part.from - first; // 解码块可能早于入点开始。
    node.start(part.at, Math.max(0, lead), part.length);
    done++;
    progress(done / parts.length);
  }
  return ctx.startRendering();
}

export async function exportTimeline(t: Timeline, options: ExportOptions, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<ExportResult> {
  if (!webCodecsAvailable()) throw new Error("当前浏览器不支持 WebCodecs，无法在本机导出；可使用 Chrome / Edge 116+，或改用 OpenMontage 服务渲染。");
  const total = duration(t);
  if (total <= 0) throw new Error("时间线还是空的，先把素材放上时间线。");
  const W = options.width, H = options.height, fps = options.fps;
  const hasAudio = audioParts(t).length > 0;
  const format = await chooseFormat(W, H, hasAudio);
  if (!format) throw new Error(`本机编码器不支持 ${W}×${H}，请降低导出分辨率。`);
  onProgress({ phase: "prepare", ratio: 0, message: "正在读取素材…" });

  const inputs = new Map<string, Input>();
  const input = (id: string) => {
    let i = inputs.get(id);
    if (!i) {
      i = new Input({ source: new UrlSource(new URL(mediaUrl(id), location.href)), formats: ALL_FORMATS });
      inputs.set(id, i);
    }
    return i;
  };
  const iterators = new Map<string, AsyncGenerator<WrappedCanvas | null, void, unknown>>();
  const last = new Map<string, Frame>();
  try {
    const images = new Map<string, ImageBitmap>();
    for (const a of t.assets) {
      if (a.kind !== "image" || !t.clips.some((c) => c.assetId === a.id)) continue;
      const r = await fetch(mediaUrl(a.id));
      if (!r.ok) throw new Error(`素材「${a.name}」无法读取。`);
      images.set(a.id, await createImageBitmap(await r.blob()));
    }
    const spans = frameSpans(t, fps);
    for (const s of spans) {
      const track = await input(s.clip.assetId!).getPrimaryVideoTrack();
      if (!track) throw new Error("素材里没有可用的画面轨。");
      if (!(await track.canDecode())) throw new Error("本机无法解码这个视频的编码格式，请转成 H.264/VP9 后再导入。");
    }

    const mixed = await mixAudio(t, input, signal, (r) => onProgress({ phase: "audio", ratio: r * 0.1, message: "正在混合声音…" }));
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("无法创建导出画布。");
    const quality = options.quality === "high" ? QUALITY_HIGH : options.quality === "low" ? QUALITY_LOW : QUALITY_MEDIUM;
    const output = new Output({
      format: format.container === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    const video = new CanvasSource(canvas, { codec: format.video, quality, keyFrameInterval: 2 });
    output.addVideoTrack(video, { frameRate: fps });
    const audio = mixed ? new AudioBufferSource({ codec: format.audio, quality }) : null;
    if (audio) output.addAudioTrack(audio);
    await output.start();
    signal.addEventListener("abort", () => void output.cancel().catch(() => {}), { once: true });
    if (audio && mixed) await audio.add(mixed);

    const frames = frameCount(t, fps);
    const byClip = new Map(spans.map((s) => [s.clip.id, s]));
    const source = (c: Clip): Frame | null => {
      const asset = t.assets.find((a) => a.id === c.assetId);
      if (asset?.kind === "image") {
        const b = images.get(asset.id);
        return b ? { image: b, width: b.width, height: b.height } : null;
      }
      return last.get(c.id) ?? null;
    };
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new ExportCancelled();
      const time = i / fps;
      for (const s of byClip.values()) {
        if (i < s.first || i > s.last) continue;
        let it = iterators.get(s.clip.id);
        if (!it) {
          const track = await input(s.clip.assetId!).getPrimaryVideoTrack();
          it = new CanvasSink(track!, { poolSize: 2 }).canvasesAtTimestamps(s.timestamps);
          iterators.set(s.clip.id, it);
        }
        const next = await it.next();
        if (!next.done && next.value) last.set(s.clip.id, { image: next.value.canvas, width: next.value.canvas.width, height: next.value.canvas.height });
        if (i === s.last) {
          await it.return(undefined);
          iterators.delete(s.clip.id);
        }
      }
      composeFrame(ctx, t, time, source, W, H);
      await video.add(time, 1 / fps);
      for (const s of byClip.values()) if (i === s.last) last.delete(s.clip.id);
      if (i % 5 === 0) onProgress({ phase: "video", ratio: 0.1 + 0.88 * (i / frames), message: `正在编码第 ${i + 1} / ${frames} 帧…` });
    }
    onProgress({ phase: "finalize", ratio: 0.99, message: "正在封装文件…" });
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("导出文件为空。");
    const mime = format.container === "mp4" ? "video/mp4" : "video/webm";
    for (const b of images.values()) b.close();
    return { blob: new Blob([buffer], { type: mime }), mime, extension: format.container, video: format.video, audio: audio ? format.audio : null, seconds: total };
  } catch (e) {
    if (signal.aborted) throw new ExportCancelled();
    throw e;
  } finally {
    for (const it of iterators.values()) await it.return(undefined).catch(() => {});
    for (const i of inputs.values()) i.dispose();
  }
}
