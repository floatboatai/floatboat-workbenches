// ABOUTME: 合成一帧画面：按图层顺序绘制视频/图片/文字、适配、画面运动与淡入淡出。预览与导出共用。
import {
  active,
  clipEnd,
  envelope,
  visualOrder,
  type Clip,
  type TextStyle,
  type Timeline,
} from "../../contracts/timeline";

export type Frame = { image: CanvasImageSource; width: number; height: number };
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** 返回某片段在时间点的可绘制画面；未就绪时返回 null（跳过该层）。 */
export type FrameSource = (clip: Clip, time: number) => Frame | null;

export const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei","Source Han Sans SC",system-ui,sans-serif';

export function visibleClips(t: Timeline, time: number): Clip[] {
  const out: Clip[] = [];
  for (const track of visualOrder(t)) {
    if (track.muted && track.kind === "text") continue;
    const clips = t.clips.filter((c) => c.trackId === track.id && active(c, time)).sort((a, b) => a.start - b.start);
    out.push(...clips);
  }
  return out;
}

function drawMedia(ctx: Ctx, c: Clip, f: Frame, W: number, H: number, time: number) {
  const p = Math.min(1, Math.max(0, (time - c.start) / Math.max(0.001, c.duration)));
  const scale0 = c.fit === "cover" ? Math.max(W / f.width, H / f.height) : Math.min(W / f.width, H / f.height);
  let zoom = 1, dx = 0;
  if (c.motion === "zoom-in") zoom = 1 + 0.12 * p;
  else if (c.motion === "zoom-out") zoom = 1.12 - 0.12 * p;
  else if (c.motion === "pan-left" || c.motion === "pan-right") {
    zoom = 1.12;
    const travel = (f.width * scale0 * zoom - W) / 2;
    dx = (c.motion === "pan-left" ? 1 - 2 * p : 2 * p - 1) * travel;
  }
  const w = f.width * scale0 * zoom, h = f.height * scale0 * zoom;
  ctx.drawImage(f.image, (W - w) / 2 + dx, (H - h) / 2, w, h);
}

function wrap(ctx: Ctx, text: string, max: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of [...para]) {
      if (line && ctx.measureText(line + ch).width > max) {
        // 英文在空格处折行，中文逐字折行。
        const space = line.lastIndexOf(" ");
        if (/[A-Za-z0-9]$/.test(line) && /[A-Za-z0-9]/.test(ch) && space > 0) {
          lines.push(line.slice(0, space));
          line = line.slice(space + 1) + ch;
        } else {
          lines.push(line);
          line = ch.trim() ? ch : "";
        }
      } else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

export function drawText(ctx: Ctx, text: string, s: TextStyle, W: number, H: number) {
  if (!text.trim()) return;
  const size = Math.max(6, (s.size * H) / 720);
  ctx.font = `${s.bold ? 700 : 400} ${size}px ${FONT}`;
  ctx.textBaseline = "middle";
  const margin = W * 0.06, max = W - margin * 2;
  const lines = wrap(ctx, text, max), lineH = size * 1.32;
  const blockH = lines.length * lineH;
  const top = Math.min(H - blockH - size * 0.3, Math.max(size * 0.3, s.y * H - blockH / 2));
  ctx.textAlign = s.align;
  const x = s.align === "left" ? margin : s.align === "right" ? W - margin : W / 2;
  if (s.box) {
    const pad = size * 0.4;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      const w = ctx.measureText(lines[i]).width;
      const left = s.align === "left" ? x : s.align === "right" ? x - w : x - w / 2;
      ctx.fillStyle = "rgba(0,0,0,0.58)";
      ctx.fillRect(left - pad, top + i * lineH, w + pad * 2, lineH);
    }
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = size * 0.35;
    ctx.shadowOffsetY = size * 0.05;
  }
  ctx.fillStyle = s.color;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, top + i * lineH + lineH / 2);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

export function composeFrame(ctx: Ctx, t: Timeline, time: number, source: FrameSource, W = t.settings.width, H = t.settings.height) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = t.settings.background;
  ctx.fillRect(0, 0, W, H);
  const hidden = new Set(t.tracks.filter((k) => k.kind === "video" && k.muted).map((k) => k.id));
  for (const c of visibleClips(t, time)) {
    if (hidden.has(c.trackId)) continue;
    const alpha = envelope(c, time);
    if (alpha <= 0.001) continue;
    ctx.globalAlpha = alpha;
    if (c.assetId === null) {
      if (c.style) drawText(ctx, c.text, c.style, W, H);
    } else {
      const f = source(c, time);
      if (f && f.width > 0 && f.height > 0) drawMedia(ctx, c, f, W, H, time);
    }
  }
  ctx.restore();
}

/** 片段在时间点对应的素材时间（秒）。 */
export const sourceTime = (c: Clip, time: number) => c.in + Math.min(c.duration, Math.max(0, time - c.start));
export { clipEnd };
