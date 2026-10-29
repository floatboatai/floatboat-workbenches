// ABOUTME: 剪辑单 Markdown：按轨道列出片段的时间、素材入出点、转场、音量、文字与备注，交接或审片用。
import { clipEnd, timecode, type Timeline } from "../contracts/timeline";
import { formatBytes } from "../contracts/media";

export function report(title: string, t: Timeline) {
  const fps = t.settings.fps;
  const tc = (s: number) => timecode(s, fps);
  const lines = [`# ${title || "影片"} · 剪辑单`, "", `${t.settings.width}×${t.settings.height} · ${fps} fps · 总长 ${tc(t.clips.reduce((n, c) => Math.max(n, clipEnd(c)), 0))}`, ""];
  if (t.brief.trim()) lines.push(t.brief.trim(), "");
  for (const track of t.tracks) {
    const clips = t.clips.filter((c) => c.trackId === track.id).sort((a, b) => a.start - b.start);
    if (!clips.length) continue;
    lines.push(`## ${track.name}${track.muted ? "（已关闭）" : ""}`, "", "| # | 时间线 | 内容 | 素材入出点 | 转场 | 音量 | 备注 |", "| --- | --- | --- | --- | --- | --- | --- |");
    clips.forEach((c, i) => {
      const asset = t.assets.find((a) => a.id === c.assetId);
      const what = asset ? asset.name : "文字：" + c.text.replace(/\n/g, " / ");
      const src = asset && asset.duration !== null ? `${c.in.toFixed(2)}–${(c.in + c.duration).toFixed(2)} 秒` : "—";
      const fx = [c.fadeIn ? `入 ${c.fadeIn}s` : "", c.fadeOut ? `出 ${c.fadeOut}s` : ""].filter(Boolean).join(" / ") || "硬切";
      const vol = asset && (asset.kind === "audio" || asset.hasAudio) ? Math.round(c.volume * track.volume * 100) + "%" : "—";
      const cell = (s: string) => s.replace(/\|/g, "\\|");
      lines.push(`| ${i + 1} | ${tc(c.start)} → ${tc(clipEnd(c))} | ${cell(what)} | ${src} | ${fx} | ${vol} | ${cell(c.note)} |`);
    });
    lines.push("");
  }
  lines.push("## 素材", "");
  for (const a of t.assets) lines.push(`- ${a.name}（${a.kind === "image" ? "图片" : a.kind === "audio" ? "音频" : "视频"}，${formatBytes(a.bytes)}${a.sample ? "，示例素材" : ""}）`);
  return lines.join("\n") + "\n";
}
