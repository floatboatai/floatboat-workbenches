// ABOUTME: 预览播放器：按时间线驱动每个片段的 <video>/<audio>/<img>，同步播放头、音量包络并把画面合成到监视器画布。
import { active, clipEnd, duration, envelope, type Clip, type Timeline } from "../../contracts/timeline";
import { composeFrame, sourceTime, type Frame } from "./compose";

export const mediaUrl = (id: string) => "/api/media/" + id;
type Listener = () => void;
type Element = HTMLVideoElement | HTMLAudioElement;

export class Player {
  private timeline: Timeline;
  private canvas: HTMLCanvasElement | null = null;
  private time = 0;
  private playing = false;
  private wall = 0;
  private origin = 0;
  private raf = 0;
  private dirty = true;
  private elements = new Map<string, { el: Element; asset: string }>();
  private images = new Map<string, HTMLImageElement>();
  private listeners = new Set<Listener>();
  private failures = new Set<string>();
  onEnded: (() => void) | null = null;
  onMediaError: ((names: string[]) => void) | null = null;

  constructor(timeline: Timeline) {
    this.timeline = timeline;
    this.loop = this.loop.bind(this);
  }
  attach(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.dirty = true;
    if (canvas && !this.raf) this.raf = requestAnimationFrame(this.loop);
  }
  setTimeline(t: Timeline) {
    this.timeline = t;
    const ids = new Set(t.clips.map((c) => c.id));
    for (const [id, entry] of this.elements) {
      const clip = t.clips.find((c) => c.id === id);
      if (!ids.has(id) || clip?.assetId !== entry.asset) this.drop(id);
    }
    this.dirty = true;
  }
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getTime = () => this.time;
  isPlaying = () => this.playing;
  private emit() {
    for (const l of this.listeners) l();
  }
  play() {
    const end = duration(this.timeline);
    if (end <= 0) return;
    if (this.time >= end - 0.02) this.time = 0;
    this.playing = true;
    this.origin = this.time;
    this.wall = performance.now();
    this.emit();
  }
  pause() {
    this.playing = false;
    for (const { el } of this.elements.values()) el.pause();
    this.dirty = true;
    this.emit();
  }
  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }
  seek(t: number) {
    this.time = Math.max(0, Math.min(t, Math.max(duration(this.timeline), 0)));
    if (this.playing) {
      this.origin = this.time;
      this.wall = performance.now();
    }
    this.dirty = true;
    this.emit();
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const id of [...this.elements.keys()]) this.drop(id);
    this.images.clear();
    this.listeners.clear();
  }
  private drop(id: string) {
    const entry = this.elements.get(id);
    if (!entry) return;
    entry.el.pause();
    entry.el.removeAttribute("src");
    entry.el.load();
    this.elements.delete(id);
  }
  private element(c: Clip): Element | null {
    const asset = this.timeline.assets.find((a) => a.id === c.assetId);
    if (!asset || asset.kind === "image") return null;
    const existing = this.elements.get(c.id);
    if (existing) return existing.el;
    const el = asset.kind === "audio" ? new Audio() : document.createElement("video");
    el.preload = "auto";
    if (el instanceof HTMLVideoElement) el.playsInline = true;
    el.addEventListener("seeked", this.refresh);
    el.addEventListener("loadeddata", this.refresh);
    el.addEventListener("loadedmetadata", this.refresh);
    el.addEventListener("error", () => {
      this.failures.add(asset.name);
      this.onMediaError?.([...this.failures]);
    });
    el.src = mediaUrl(asset.id);
    this.elements.set(c.id, { el, asset: asset.id });
    return el;
  }
  private image(id: string) {
    let img = this.images.get(id);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.onload = this.refresh;
      img.src = mediaUrl(id);
      this.images.set(id, img);
    }
    return img;
  }
  private trackOf(c: Clip) {
    return this.timeline.tracks.find((k) => k.id === c.trackId);
  }
  /** 让每个媒体元素跟随时间线：活动片段播放/定位，邻近片段预读，远处片段释放。 */
  private sync() {
    const t = this.time;
    for (const c of this.timeline.clips) {
      if (!c.assetId) continue;
      const near = t >= c.start - 1.5 && t < clipEnd(c) + 0.5;
      if (!near) {
        if (this.elements.has(c.id) && (t < c.start - 8 || t > clipEnd(c) + 8)) this.drop(c.id);
        else this.elements.get(c.id)?.el.pause();
        continue;
      }
      const el = this.element(c);
      if (!el) continue;
      const local = sourceTime(c, t);
      const track = this.trackOf(c);
      const on = active(c, t);
      const asset = this.timeline.assets.find((a) => a.id === c.assetId);
      const audible = asset?.kind === "audio" || asset?.hasAudio === true;
      el.volume = on && audible && !track?.muted ? Math.max(0, Math.min(1, c.volume * (track?.volume ?? 1) * envelope(c, t))) : 0;
      el.muted = el.volume === 0;
      if (!on) {
        if (!el.paused) el.pause();
        if (el.readyState >= 1 && Math.abs(el.currentTime - c.in) > 0.05) el.currentTime = c.in;
        continue;
      }
      if (this.playing) {
        if (el.paused) {
          if (el.readyState >= 1) el.currentTime = local;
          void el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - local) > 0.25) el.currentTime = local;
      } else {
        if (!el.paused) el.pause();
        if (el.readyState >= 1 && Math.abs(el.currentTime - local) > 1 / 60) el.currentTime = local;
      }
    }
  }
  private frame = (c: Clip): Frame | null => {
    const asset = this.timeline.assets.find((a) => a.id === c.assetId);
    if (!asset) return null;
    if (asset.kind === "image") {
      const img = this.image(asset.id);
      return img.complete && img.naturalWidth ? { image: img, width: img.naturalWidth, height: img.naturalHeight } : null;
    }
    const entry = this.elements.get(c.id);
    const el = entry?.el;
    if (!(el instanceof HTMLVideoElement) || el.readyState < 2 || !el.videoWidth) return null;
    return { image: el, width: el.videoWidth, height: el.videoHeight };
  };
  /** 媒体就绪事件到达时立即重画；页面在后台时 requestAnimationFrame 可能暂停。 */
  private refresh = () => {
    this.dirty = true;
    if (!this.playing) this.draw();
  };
  private draw() {
    this.dirty = false;
    this.sync();
    const canvas = this.canvas;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = this.timeline.settings;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    composeFrame(ctx, this.timeline, this.time, this.frame);
    // 视频帧在定位后异步到达；暂停时继续重画，直到帧就绪。
    if (!this.playing && this.timeline.clips.some((c) => c.assetId && active(c, this.time) && !this.frame(c))) this.dirty = true;
  }
  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    if (this.playing) {
      const end = duration(this.timeline);
      this.time = this.origin + (now - this.wall) / 1000;
      if (this.time >= end) {
        this.time = end;
        this.pause();
        this.onEnded?.();
      }
      this.emit();
      this.dirty = true;
    }
    if (!this.dirty && !this.playing) return;
    this.draw();
  }
}
