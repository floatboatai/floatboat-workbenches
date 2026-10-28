import { isRecord, boundedText } from "./project.ts";
export const CHUNK_BYTES = 384 * 1024,
  MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export type VideoSource = {
  id: string;
  name: string;
  bytes: number;
  mime: "video/mp4";
};
export type Shot = {
  id: string;
  title: string;
  script: string;
  source: VideoSource | null;
  start: string;
  end: string;
  approved: boolean;
};
export type Montage = { brief: string; shots: Shot[] };
export function videoSource(v: unknown): VideoSource {
  if (
    !isRecord(v) ||
    typeof v.id !== "string" ||
    !/^\w{64}$/.test(v.id) ||
    !/^[a-f0-9]+$/.test(v.id) ||
    typeof v.bytes !== "number" ||
    !Number.isInteger(v.bytes) ||
    v.bytes < 12 ||
    v.bytes > MAX_VIDEO_BYTES ||
    v.mime !== "video/mp4"
  )
    throw new Error("视频资源无效，仅支持20MB以内MP4。");
  return {
    id: v.id,
    name: boundedText(v.name, 180),
    bytes: v.bytes,
    mime: "video/mp4",
  };
}
export function montageValue(raw: unknown, working = false): Montage {
  if (!isRecord(raw) || !Array.isArray(raw.shots) || raw.shots.length > 30)
    throw new Error("分镜格式无效。");
  const shots = raw.shots.map((v): Shot => {
    if (!isRecord(v) || typeof v.approved !== "boolean")
      throw new Error("镜头格式无效。");
    const id = boundedText(v.id, 80);
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("镜头编号无效。");
    const shot = {
      id,
      title: boundedText(v.title, 150),
      script: boundedText(v.script, 4000),
      source: v.source === null ? null : videoSource(v.source),
      start: boundedText(v.start, 40),
      end: boundedText(v.end, 40),
      approved: v.approved,
    };
    if (
      !working &&
      (!/^\d+(?:\.\d{1,3})?$/.test(shot.start) ||
        !/^\d+(?:\.\d{1,3})?$/.test(shot.end) ||
        +shot.end <= +shot.start ||
        +shot.start < 0 ||
        +shot.end > 120)
    )
      throw new Error("入点和出点需为有效秒数，出点须晚于入点且不超过120秒。");
    return shot;
  });
  if (new Set(shots.map((x) => x.id)).size !== shots.length)
    throw new Error("镜头编号重复。");
  const sources = new Map(
    shots.filter((s) => s.source).map((s) => [s.source!.id, s.source!]),
  );
  if ([...sources.values()].reduce((n, s) => n + s.bytes, 0) > 60 * 1024 * 1024)
    throw new Error("工程素材总量不能超过60MB。");
  return { brief: boundedText(raw.brief, 10000), shots };
}
export const restoreMontage = (v: unknown) => montageValue(v, true);
export function readyMontage(v: unknown) {
  const m = montageValue(v);
  if (
    m.shots.length < 2 ||
    m.shots.length > 12 ||
    m.shots.some((s) => !s.source || !s.approved)
  )
    throw new Error("需要2–12个已上传素材并通过审阅的镜头。");
  if (m.shots.reduce((n, s) => n + (+s.end - +s.start), 0) > 120)
    throw new Error("成片不能超过120秒。");
  return m;
}
export const seed: Montage = {
  brief:
    "为一段城市漫游短片整理镜头。先检查每个素材的画面与入出点，再确认组接顺序。",
  shots: [
    {
      id: "opening",
      title: "开场 · 抵达",
      script: "留出片头的呼吸感，明确场景与时间。",
      source: null,
      start: "0",
      end: "2",
      approved: false,
    },
    {
      id: "detail",
      title: "细节 · 经过",
      script: "切到更近的视角，保持视觉节奏。",
      source: null,
      start: "0",
      end: "2",
      approved: false,
    },
  ],
};
export function shotEdit(
  s: Shot,
  patch: Partial<Omit<Shot, "id" | "approved">>,
): Shot {
  return { ...s, ...patch, approved: false };
}
export function report(m: Montage) {
  return (
    "# 分镜制作单\n\n" +
    m.brief +
    "\n\n" +
    m.shots
      .map(
        (s, i) =>
          `## ${i + 1}. ${s.title}\n\n${s.script}\n\n素材：${s.source?.name ?? "未上传"}\n\n入点：${s.start}s / 出点：${s.end}s / ${s.approved ? "已审阅" : "待审阅"}\n`,
      )
      .join("\n")
  );
}
