import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace";
import { isRecord } from "../contracts/project";
import {
  seed,
  movieValue,
  restoreMovie,
  spans,
  total,
  sceneSvg,
  composition,
  jobValue,
  type Scene,
  type RenderJob,
} from "../contracts/movie";
export function useMovieDesk() {
  const p = useProjects(seed, movieValue, "Field Notes · 秋季发布", {
    storageKey: "hyperframes-movie-v1",
    restoreDraftData: restoreMovie,
  });
  const [selected, setSelected] = useState(seed.scenes[0].id),
    [time, setTime] = useState(0.7),
    [playing, setPlaying] = useState(false),
    [jobs, setJobs] = useState<RenderJob[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState({
      available: false,
      message: "正在检查渲染服务…",
    }),
    [jsonOpen, setJsonOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const timeline = spans(p.data),
    duration = total(p.data),
    scene = p.data.scenes.find((x) => x.id === selected) ?? p.data.scenes[0],
    active =
      timeline.find((x) => time >= x.start && time < x.start + x.duration) ??
      timeline.at(-1)!;
  const mutable = !p.loading && !p.busy;
  const raw =
    typeof p.draft.json === "string"
      ? p.draft.json
      : JSON.stringify(p.data, null, 2);
  useEffect(() => {
    setSelected(p.data.scenes[0]?.id ?? "");
    setTime(0.7);
    setPlaying(false);
    setJobs([]);
  }, [p.documentKey]);
  async function check() {
    try {
      const v = await request("/api/renderer");
      if (isRecord(v))
        setStatus({
          available: v.available === true,
          message: String(v.message),
        });
    } catch (e) {
      p.report(e);
    }
  }
  async function loadJobs() {
    const key = epoch.current,
      id = p.current?.id;
    if (!id) return;
    try {
      const v = await request("/api/projects/" + id + "/renders");
      if (!Array.isArray(v)) throw new Error("渲染列表无效");
      const list = await Promise.all(
        v.map(async (row) => {
          const j = jobValue(row);
          return ["queued", "running", "submitting", "unknown"].includes(
            j.state,
          )
            ? jobValue(await request("/api/renders/" + j.id))
            : j;
        }),
      );
      if (key === epoch.current) setJobs(list);
    } catch (e) {
      if (key === epoch.current) p.report(e);
    }
  }
  useEffect(() => {
    void check();
  }, []);
  useEffect(() => {
    void loadJobs();
    const id = setInterval(() => void loadJobs(), 2500);
    return () => clearInterval(id);
  }, [p.current?.id, p.documentKey]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(),
      id = 0;
    function tick(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        if (t + dt >= duration) {
          setPlaying(false);
          return duration - 0.01;
        }
        return t + dt;
      });
      id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, duration]);
  function edit(next: Partial<Scene>) {
    p.setData((d) => ({
      ...d,
      scenes: d.scenes.map((s) => (s.id === scene.id ? { ...s, ...next } : s)),
    }));
  }
  function focus(id: string) {
    setSelected(id);
    setPlaying(false);
    setTime((timeline.find((x) => x.scene.id === id)?.start ?? 0) + 0.7);
  }
  function move(delta: number) {
    const i = p.data.scenes.findIndex((s) => s.id === scene.id),
      j = i + delta;
    if (j < 0 || j >= p.data.scenes.length) return;
    p.setData((d) => {
      const scenes = [...d.scenes];
      [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
      return { ...d, scenes };
    });
  }
  function add(copy = false) {
    if (p.data.scenes.length >= 12) {
      p.setError("最多12个镜头。");
      return;
    }
    const next: Scene = copy
      ? { ...scene, id: crypto.randomUUID() }
      : {
          id: crypto.randomUUID(),
          kind: "feature",
          eyebrow: "NEXT CHAPTER",
          title: "新的想法",
          body: "在这里写下这一镜头要表达的内容。",
          duration: "4",
        };
    p.setData((d) => ({ ...d, scenes: [...d.scenes, next] }));
    setSelected(next.id);
    setTime(duration + 0.7);
  }
  async function render() {
    const key = epoch.current;
    setBusy(true);
    p.setError("");
    try {
      movieValue(p.data);
      if (
        jobs.some((j) =>
          ["queued", "running", "submitting", "unknown"].includes(j.state),
        )
      )
        throw new Error("已有未完成或待核对任务，请先刷新任务或取消。");
      const snapshot = structuredClone(p.data),
        saved = await p.save();
      if (!saved) return;
      const j = jobValue(
        await request("/api/renders", {
          method: "POST",
          body: JSON.stringify({
            id: crypto.randomUUID(),
            projectId: saved.id,
            movie: snapshot,
          }),
        }),
      );
      if (key === epoch.current) setJobs((old) => [j, ...old]);
    } catch (e) {
      if (key === epoch.current) p.report(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportVideo(id: string) {
    try {
      const { getPageConnection } = await import("./connection");
      const page = await getPageConnection();
      const r = await page.fetch("/api/renders/" + id + "/video");
      if (!r.ok) throw new Error("视频下载失败，请核对渲染服务。");
      download(await r.blob(), p.title + ".mp4");
    } catch (e) {
      p.report(e);
    }
  }
  async function importFile(f?: File) {
    if (!f) return;
    try {
      if (f.size > 900000) throw new Error("工程不能超过900 KB");
      const v: unknown = JSON.parse(await f.text());
      if (
        !isRecord(v) ||
        v.format !== "floatboat-hyperframes-v1" ||
        typeof v.title !== "string"
      )
        throw new Error("不是有效的HyperFrames工作台工程。");
      await p.replace(
        restoreMovie(v.data),
        v.title,
        isRecord(v.draft) ? v.draft : {},
      );
    } catch (e) {
      p.report(e);
    }
  }
  const labels: Record<string, string> = {
    queued: "排队中",
    running: "正在渲染",
    submitting: "正在提交",
    unknown: "等待核对",
    completed: "渲染完成",
    failed: "渲染失败",
    interrupted: "渲染中断",
    cancelled: "已取消",
  };
  return {
    p,
    scene,
    timeline,
    duration,
    active,
    mutable,
    raw,
    time,
    setTime,
    playing,
    setPlaying,
    jobs,
    busy,
    status,
    jsonOpen,
    setJsonOpen,
    file,
    check,
    loadJobs,
    edit,
    focus,
    move,
    add,
    render,
    exportVideo,
    importFile,
    labels,
  };
}
