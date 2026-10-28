import { boundedText, isRecord } from "./project.ts";
export type Scene = {
  id: string;
  kind: "title" | "feature" | "closing";
  eyebrow: string;
  title: string;
  body: string;
  duration: string;
};
export type Movie = { brand: string; accent: string; scenes: Scene[] };
export function movieValue(raw: unknown, working = false): Movie {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.scenes) ||
    raw.scenes.length < 1 ||
    raw.scenes.length > (working ? 50 : 12)
  )
    throw new Error("请保留1–12个镜头。");
  const scenes = raw.scenes.map((v): Scene => {
    if (
      !isRecord(v) ||
      !["title", "feature", "closing"].includes(String(v.kind))
    )
      throw new Error("镜头类型无效。");
    const id = boundedText(v.id, 80);
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("镜头编号无效。");
    const s = {
      id,
      kind: v.kind as Scene["kind"],
      eyebrow: boundedText(v.eyebrow, 80),
      title: boundedText(v.title, 200),
      body: boundedText(v.body, 600),
      duration: boundedText(v.duration, 30),
    };
    if (
      !working &&
      (!s.title.trim() ||
        !/^\d+(?:\.\d{1,2})?$/.test(s.duration) ||
        +s.duration < 1 ||
        +s.duration > 15)
    )
      throw new Error("每个镜头需要标题和1–15秒时长。");
    return s;
  });
  if (new Set(scenes.map((s) => s.id)).size !== scenes.length)
    throw new Error("镜头编号重复。");
  const accent = boundedText(raw.accent, 30),
    brand = boundedText(raw.brand, 80);
  if (
    !working &&
    (brand.length > 40 ||
      scenes.some(
        (s) =>
          s.eyebrow.length > 50 ||
          wrapped(s.title, 16).length > 3 ||
          wrapped(s.body, 40).length > 3,
      ))
  )
    throw new Error(
      "品牌最多40字符，眉题最多50字符；标题与说明请各控制在3行内。",
    );
  if (
    !working &&
    (!/^#[0-9a-f]{6}$/i.test(accent) ||
      scenes.reduce((n, s) => n + Number(s.duration), 0) > 60)
  )
    throw new Error("请输入六位颜色，视频总时长不能超过60秒。");
  return { brand, accent, scenes };
}
export const restoreMovie = (raw: unknown) => movieValue(raw, true);
export const seed: Movie = {
  brand: "FIELD NOTES",
  accent: "#e9f17a",
  scenes: [
    {
      id: "scene-intro",
      kind: "title",
      eyebrow: "A QUIETER WAY TO WORK",
      title: "把好想法，\n留在眼前。",
      body: "一处收集灵感，一次整理思路。",
      duration: "4",
    },
    {
      id: "scene-detail",
      kind: "feature",
      eyebrow: "01 / CAPTURE",
      title: "随时记录，\n逐步成形。",
      body: "卡片、资料与连接，组成你的思考地图。",
      duration: "4",
    },
    {
      id: "scene-end",
      kind: "closing",
      eyebrow: "MAKE ROOM FOR IDEAS",
      title: "开始你的\n下一页。",
      body: "FIELD NOTES · Autumn release",
      duration: "3",
    },
  ],
};
export function spans(movie: Movie) {
  let t = 0;
  return movie.scenes.map((scene) => {
    const duration = Number.isFinite(+scene.duration)
      ? Math.max(1, Math.min(15, +scene.duration))
      : 4;
    const span = { scene, start: t, duration };
    t += duration;
    return span;
  });
}
export function total(movie: Movie) {
  return spans(movie).reduce((n, s) => n + s.duration, 0);
}
export function xml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
function wrapped(s: string, n: number) {
  return s.split("\n").flatMap((line) => {
    const a = Array.from(line);
    const result: string[] = [];
    while (a.length) result.push(a.splice(0, n).join(""));
    return result.length ? result : [""];
  });
}
export function sceneSvg(movie: Movie, scene: Scene, progress = 1) {
  const accent = /^#[0-9a-f]{6}$/i.test(movie.accent)
      ? movie.accent
      : "#e9f17a",
    p = Math.min(1, Math.max(0, progress)),
    dark = scene.kind === "feature",
    bg = dark ? "#e9e7df" : "#202623",
    fg = dark ? "#202623" : "#f4f1e9";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720"><rect width="1280" height="720" fill="${bg}"/><circle cx="1130" cy="390" r="210" fill="${accent}" opacity="${dark ? ".9" : ".13"}"/><path d="M952 165v390M870 360h328" stroke="${dark ? "#202623" : accent}" opacity=".45" stroke-width="2"/><text x="72" y="64" font-family="Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="4" fill="${fg}">${xml(movie.brand)}</text><text x="72" y="172" font-family="Arial,sans-serif" font-size="18" letter-spacing="3" fill="${dark ? "#526653" : accent}">${xml(scene.eyebrow)}</text><g class="motion" opacity="${p}" transform="translate(0 ${Math.round((1 - p) * 28)})">${wrapped(
    scene.title,
    16,
  )
    .slice(0, 3)
    .map(
      (s, i) =>
        `<text x="66" y="${285 + i * 86}" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="${fg}">${xml(s)}</text>`,
    )
    .join("")}${wrapped(scene.body, 40)
    .slice(0, 3)
    .map(
      (s, i) =>
        `<text x="72" y="${593 + i * 31}" font-family="Arial,sans-serif" font-size="23" fill="${fg}" opacity=".7">${xml(s)}</text>`,
    )
    .join(
      "",
    )}</g><line x1="72" x2="1208" y1="672" y2="672" stroke="${fg}" opacity=".25"/><text x="1208" y="64" text-anchor="end" font-family="monospace" font-size="17" fill="${fg}">${String(movie.scenes.indexOf(scene) + 1).padStart(2, "0")} / ${String(movie.scenes.length).padStart(2, "0")}</text></svg>`;
}
export function composition(movie: Movie) {
  movie = movieValue(movie);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${xml(movie.brand)}</title><style>html,body{margin:0;background:#202623;width:1280px;height:720px;overflow:hidden}#root,.clip{position:absolute;inset:0;width:1280px;height:720px}svg{display:block}</style></head><body><div id="root" data-composition-id="root" data-start="0" data-duration="${total(movie)}" data-width="1280" data-height="720" data-fps="24">${spans(
    movie,
  )
    .map(
      ({ scene, start, duration }) =>
        `<div class="clip" data-start="${start}" data-duration="${duration}" data-track-index="0">${sceneSvg(movie, scene)}</div>`,
    )
    .join(
      "",
    )}</div><script>document.querySelectorAll('.clip').forEach(el=>{const start=Number(el.dataset.start)*1000;const a=el.querySelector('.motion').animate([{opacity:0,transform:'translateY(28px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,delay:start,fill:'both',easing:'ease-out'});a.pause();a.currentTime=0;});</script></body></html>`;
}
export type RenderJob = {
  id: string;
  state: string;
  createdAt: string;
  error: string;
  projectId: string;
};
export function jobValue(v: unknown): RenderJob {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.state !== "string")
    throw new Error("渲染任务响应无效。");
  return {
    id: v.id,
    state: v.state,
    createdAt: boundedText(v.createdAt, 80),
    error: typeof v.error === "string" ? v.error : "",
    projectId: typeof v.projectId === "string" ? v.projectId : "",
  };
}
