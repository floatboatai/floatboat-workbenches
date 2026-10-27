import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  FilePlus2,
  Upload,
  Download,
  Play,
  Pause,
  Scissors,
  Merge,
  Trash2,
  Check,
  Headphones,
  RotateCcw,
} from "lucide-react";
import {
  useProjects,
  ProjectPicker,
  Notice,
  download,
  request,
} from "./workspace";
import {
  audioSource,
  clock,
  emptyTranscript,
  exampleTranscript,
  exportSubtitles,
  importTranscript,
  languages,
  restoreTranscript,
  transcriptDraft,
  seconds,
  segmentCues,
  splitCue,
  validateTranscript,
  MAX_CUES,
  type Cue,
  type Transcript,
} from "../contracts/transcript";
import { parseJob, type Job } from "../contracts/job";
import { isRecord } from "../contracts/project";
import { audioBytes, base64, sourceFor, unbase64, upload } from "./media";

type Field = "start" | "end" | "text" | "reviewed";
const labels: Record<Job["status"], string> = {
  submitting: "正在提交",
  queued: "排队中",
  running: "正在转写",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  unknown: "状态待确认",
  interrupted: "服务中断",
};
const activeStates = ["submitting", "queued", "running", "unknown"];
function cueError(cue: Cue) {
  try {
    if (seconds(cue.end) <= seconds(cue.start)) return "出点必须晚于入点";
    return "";
  } catch {
    return "时间格式为 00:00:00.000";
  }
}
const CueRow = memo(function CueRow({
  cue,
  index,
  selected,
  onChange,
  onSeek,
  onSplit,
  onMerge,
  onRemove,
}: {
  cue: Cue;
  index: number;
  selected: boolean;
  onChange: (id: string, field: Field, value: string | boolean) => void;
  onSeek: (cue: Cue) => void;
  onSplit: (id: string) => void;
  onMerge: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const error = cueError(cue);
  return (
    <article
      className={`cue ${selected ? "selected" : ""} ${cue.reviewed ? "reviewed" : ""}`}
      aria-label={`字幕 ${index + 1}`}
    >
      <button
        className="cue-number"
        title="跳转回听"
        aria-label={`回听第 ${index + 1} 句`}
        disabled={!!error}
        onClick={() => onSeek(cue)}
      >
        {String(index + 1).padStart(2, "0")}
        <Play size={11} aria-hidden="true" />
      </button>
      <div className="cue-times">
        <label>
          <span>入点</span>
          <input
            aria-label={`第 ${index + 1} 句入点`}
            name={`start-${cue.id}`}
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            value={cue.start}
            aria-invalid={!!error}
            onChange={(e) => onChange(cue.id, "start", e.target.value)}
          />
        </label>
        <label>
          <span>出点</span>
          <input
            aria-label={`第 ${index + 1} 句出点`}
            name={`end-${cue.id}`}
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            value={cue.end}
            aria-invalid={!!error}
            onChange={(e) => onChange(cue.id, "end", e.target.value)}
          />
        </label>
        {error ? <small className="field-error">{error}</small> : null}
      </div>
      <div className="cue-copy">
        <textarea
          aria-label={`第 ${index + 1} 句字幕`}
          name={`text-${cue.id}`}
          autoComplete="off"
          rows={2}
          maxLength={8000}
          value={cue.text}
          onChange={(e) => onChange(cue.id, "text", e.target.value)}
        />
        <span>{cue.text.length} 字</span>
      </div>
      <div className="cue-actions">
        <label className="review-check">
          <input
            type="checkbox"
            aria-label={`第 ${index + 1} 句已复核`}
            checked={cue.reviewed}
            onChange={(e) => onChange(cue.id, "reviewed", e.target.checked)}
          />
          <span>{cue.reviewed ? "已复核" : "待复核"}</span>
        </label>
        <div>
          <button
            title="从中点拆分"
            aria-label={`拆分第 ${index + 1} 句`}
            disabled={!!error}
            onClick={() => onSplit(cue.id)}
          >
            <Scissors size={15} />
          </button>
          <button
            title="与下一句合并"
            aria-label={`合并第 ${index + 1} 句与下一句`}
            disabled={!!error}
            onClick={() => onMerge(cue.id)}
          >
            <Merge size={15} />
          </button>
          <button
            title="删除字幕"
            aria-label={`删除第 ${index + 1} 句`}
            onClick={() => onRemove(cue.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
});

export function App() {
  const p = useProjects(emptyTranscript, validateTranscript, "未命名字幕", {
    storageKey: "faster-whisper-studio-v1",
    restoreDraftData: restoreTranscript,
  });
  const [uploading, setUploading] = useState(false),
    [progress, setProgress] = useState(0),
    [jobBusy, setJobBusy] = useState(false);
  const [service, setService] = useState({
      connected: false,
      model: "",
      message: "正在检查转写服务…",
    }),
    [jobs, setJobs] = useState<Job[]>([]),
    [queueError, setQueueError] = useState("");
  const [audioUrl, setAudioUrl] = useState(""),
    [peaks, setPeaks] = useState<number[]>([]),
    [duration, setDuration] = useState(0),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [mediaError, setMediaError] = useState("");
  const audio = useRef<HTMLAudioElement>(null),
    epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const latest = useRef(p);
  latest.current = p;
  const changeData = useCallback(
    (change: (value: Transcript) => Transcript) => {
      try {
        latest.current.setData((previous) => {
          const next = change(previous);
          restoreTranscript(next);
          return next;
        });
      } catch (error) {
        latest.current.report(error);
      }
    },
    [],
  );
  const source = p.data.source,
    selected = typeof p.draft.selected === "string" ? p.draft.selected : "",
    importText =
      typeof p.draft.importText === "string" ? p.draft.importText : "";
  const onlyPending = p.draft.onlyPending === true;
  const lastEnd = Math.max(
    0,
    ...p.data.cues.map((c) => {
      try {
        return seconds(c.end);
      } catch {
        return 0;
      }
    }),
  );
  const span = duration || lastEnd || 1;
  const currentCue = p.data.cues.find((c) => {
    try {
      return time >= seconds(c.start) && time < seconds(c.end);
    } catch {
      return false;
    }
  });
  const reviewed = p.data.cues.filter((c) => c.reviewed).length;
  const jobForSource = jobs.some(
    (j) => j.input.source.id === source?.id && activeStates.includes(j.status),
  );
  const update = useCallback(
    (id: string, field: Field, value: string | boolean) =>
      changeData((d) => ({
        ...d,
        cues: d.cues.map((c) =>
          c.id === id
            ? {
                ...c,
                [field]: value,
                ...(field === "text" ? { reviewed: false } : {}),
              }
            : c,
        ),
      })),
    [],
  );
  useEffect(() => {
    document.title = "字幕剪辑室";
  }, []);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const list = await request("/api/jobs");
        if (!Array.isArray(list)) throw new Error("任务列表无效。");
        const next = list.map(parseJob);
        const active = next.filter((j) => activeStates.includes(j.status));
        const refreshed = await Promise.all(
          active.map((j) =>
            request("/api/jobs/" + j.id)
              .then(parseJob)
              .catch(() => j),
          ),
        );
        if (!disposed) {
          setJobs(next.map((j) => refreshed.find((r) => r.id === j.id) ?? j));
          setQueueError("");
        }
      } catch (e) {
        if (!disposed)
          setQueueError(e instanceof Error ? e.message : "任务队列暂不可用。");
      } finally {
        if (!disposed) timer = setTimeout(poll, 3500);
      }
    };
    void poll();
    void checkService();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    let disposed = false,
      url = "";
    setAudioUrl("");
    setPeaks([]);
    setDuration(0);
    setTime(0);
    setPlaying(false);
    setMediaError("");
    if (source) {
      void (async () => {
        const bytes = await audioBytes(source.id);
        url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: source.mime }),
        );
        if (disposed) {
          URL.revokeObjectURL(url);
          return;
        }
        setAudioUrl(url);
        const context = new AudioContext();
        try {
          const decoded = await context.decodeAudioData(
            new Uint8Array(bytes).buffer,
          );
          const channel = decoded.getChannelData(0),
            values: number[] = [];
          for (let i = 0; i < 240; i++) {
            let max = 0;
            const a = Math.floor((i * channel.length) / 240),
              b = Math.floor(((i + 1) * channel.length) / 240);
            for (let n = a; n < b; n += Math.max(1, Math.floor((b - a) / 500)))
              max = Math.max(max, Math.abs(channel[n]));
            values.push(max);
          }
          if (!disposed) {
            setPeaks(values);
            setDuration(decoded.duration);
          }
        } catch {
          if (!disposed)
            setMediaError("此音频暂无法绘制波形，仍可尝试播放或提交转写。");
        } finally {
          await context.close();
        }
      })().catch(() => {
        if (!disposed) setMediaError("音频原件无法读取，请重新导入。");
      });
    }
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source?.id]);
  async function checkService() {
    try {
      const raw = await request("/api/service");
      if (
        !isRecord(raw) ||
        typeof raw.connected !== "boolean" ||
        typeof raw.model !== "string" ||
        typeof raw.message !== "string"
      )
        throw new Error("服务状态无效。");
      setService({
        connected: raw.connected,
        model: raw.model,
        message: raw.message,
      });
    } catch {
      setService({
        connected: false,
        model: "",
        message: "转写服务未连接；仍可审校与导出字幕。",
      });
    }
  }
  const seek = useCallback((cue: Cue) => {
    const p = latest.current;
    try {
      const value = seconds(cue.start);
      setTime(value);
      p.setDraft((d) => ({ ...d, selected: cue.id }));
      if (audio.current) {
        audio.current.currentTime = value;
        void audio.current
          .play()
          .catch(() => setMediaError("无法播放此音频，请检查格式。"));
      }
    } catch (e) {
      p.report(e);
    }
  }, []);
  const split = useCallback((id: string) => {
    const p = latest.current;
    try {
      const cue = p.data.cues.find((c) => c.id === id);
      if (!cue) return;
      if (p.data.cues.length >= MAX_CUES)
        throw new Error("字幕已达到行数上限。");
      const pair = splitCue(cue);
      changeData((d) => ({
        ...d,
        cues: d.cues.flatMap((c) => (c.id === id ? pair : [c])),
      }));
    } catch (e) {
      p.report(e);
    }
  }, []);
  const merge = useCallback((id: string) => {
    const p = latest.current;
    try {
      const index = p.data.cues.findIndex((c) => c.id === id),
        first = p.data.cues[index],
        next = p.data.cues[index + 1];
      if (!next) throw new Error("已经是最后一句。");
      if (cueError(first) || cueError(next))
        throw new Error("请先修正时间格式。");
      changeData((d) => ({
        ...d,
        cues: d.cues.flatMap((c, i) =>
          i === index
            ? [
                {
                  ...c,
                  end: clock(Math.max(seconds(first.end), seconds(next.end))),
                  text: first.text + " " + next.text,
                  reviewed: false,
                },
              ]
            : i === index + 1
              ? []
              : [c],
        ),
      }));
    } catch (e) {
      p.report(e);
    }
  }, []);
  const remove = useCallback((id: string) => {
    if (confirm("删除这行字幕？"))
      changeData((d) => ({
        ...d,
        cues: d.cues.filter((c) => c.id !== id),
      }));
  }, []);
  function add() {
    if (p.data.cues.length >= MAX_CUES) {
      p.setError("字幕已达到行数上限。");
      return;
    }
    const start = Math.max(lastEnd, time);
    changeData((d) => ({
      ...d,
      cues: [
        ...d.cues,
        {
          id: crypto.randomUUID(),
          start: clock(start),
          end: clock(start + 3),
          text: "",
          reviewed: false,
        },
      ],
    }));
  }
  async function importAudio(file: File) {
    const key = p.documentKey;
    setUploading(true);
    setProgress(0);
    p.setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()),
        source = await sourceFor(file, bytes);
      await upload(bytes, source, setProgress);
      if (epoch.current === key) {
        changeData((d) => ({ ...d, source }));
        p.setNotice("音频已保存，可以回听或开始转写。");
      }
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      setUploading(false);
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 58 * 1024 * 1024) throw new Error("项目文件过大。");
      const text = await file.text();
      if (file.name.endsWith(".subtitle.json")) {
        const raw: unknown = JSON.parse(text);
        if (
          !isRecord(raw) ||
          raw.format !== "floatboat-subtitles" ||
          raw.version !== 1
        )
          throw new Error("不是字幕剪辑室项目。");
        const data = restoreTranscript(raw.data);
        if (data.source) {
          if (typeof raw.audioBase64 !== "string")
            throw new Error("项目缺少音频原件。");
          setUploading(true);
          await upload(unbase64(raw.audioBase64), data.source, setProgress);
        }
        const extra = transcriptDraft(raw.draft);
        await p.replace(
          data,
          typeof raw.title === "string"
            ? raw.title.slice(0, 120)
            : "导入的字幕",
          extra,
        );
      } else {
        const cues = importTranscript(text, file.name);
        await p.replace(
          {
            ...emptyTranscript,
            source: p.data.source,
            cues,
            language: p.data.language,
            origin: `导入 · ${file.name}`.slice(0,240),
          },
          file.name.replace(/\.[^.]+$/, "").slice(0,120),
        );
      }
      p.setNotice("已导入为新项目。");
    } catch (e) {
      p.report(e);
    } finally {
      setUploading(false);
    }
  }
  async function applyText() {
    try {
      const cues = importTranscript(importText, "subtitles.srt");
      await p.replace(
        {
          ...emptyTranscript,
          source: p.data.source,
          cues,
          language: p.data.language,
          origin: "粘贴字幕",
        },
        "导入的字幕",
      );
    } catch (e) {
      p.report(e);
    }
  }
  async function exportProject() {
    try {
      const data = restoreTranscript(p.data),
        bytes = data.source ? await audioBytes(data.source.id) : null;
      download(
        new Blob(
          [
            JSON.stringify({
              format: "floatboat-subtitles",
              version: 1,
              title: p.title,
              data,
              draft: transcriptDraft(p.draft),
              ...(bytes ? { audioBase64: base64(bytes) } : {}),
            }),
          ],
          { type: "application/json" },
        ),
        `${p.title}.subtitle.json`,
      );
      p.setNotice("项目已导出，包含原音频和编辑草稿。");
    } catch (e) {
      p.report(e);
    }
  }
  function exportFile(format: "srt" | "vtt" | "txt") {
    try {
      download(
        new Blob([exportSubtitles(p.data, format)], {
          type:
            format === "vtt"
              ? "text/vtt;charset=utf-8"
              : "text/plain;charset=utf-8",
        }),
        `${p.title}.${format}`,
      );
    } catch (e) {
      p.report(e);
    }
  }
  async function start() {
    setJobBusy(true);
    p.setError("");
    try {
      const saved = await p.save();
      if (!saved?.data.source) throw new Error("请先上传音频并保存项目。");
      const input = {
        source: saved.data.source,
        language: saved.data.language,
      };
      const job = parseJob(
        await request("/api/jobs", {
          method: "POST",
          body: JSON.stringify({
            id: crypto.randomUUID(),
            projectId: saved.id,
            input,
          }),
        }),
      );
      setJobs((list) => [job, ...list.filter((j) => j.id !== job.id)]);
      p.setNotice("转写已提交。完成后可采用为新项目。");
    } catch (e) {
      p.report(e);
    } finally {
      setJobBusy(false);
    }
  }
  async function jobAction(job: Job, action: "cancel" | "retry") {
    setJobBusy(true);
    try {
      const result = parseJob(
        await request(`/api/jobs/${job.id}/${action}`, { method: "POST" }),
      );
      setJobs((list) => list.map((j) => (j.id === result.id ? result : j)));
    } catch (e) {
      p.report(e);
    } finally {
      setJobBusy(false);
    }
  }
  async function adopt(job: Job) {
    setJobBusy(true);
    try {
      const result = parseJob(await request("/api/jobs/" + job.id));
      if (result.status !== "completed" || result.segments === null)
        throw new Error("转写结果尚未就绪。");
      await p.replace(
        {
          ...emptyTranscript,
          source: result.input.source,
          language: result.input.language,
          cues: segmentCues(result.segments),
          origin: `faster-whisper · ${result.model} · ${result.id}`,
        },
        (result.input.source.name.replace(/\.[^.]+$/, "") + " · 转写稿").slice(0,120),
      );
      p.setNotice("已采用为新项目，原项目的人工修订保持不变。");
    } catch (e) {
      p.report(e);
    } finally {
      setJobBusy(false);
    }
  }
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在打开字幕剪辑室…
      </main>
    );
  return (
    <div className="studio">
      <a className="skip" href="#editor">
        跳到字幕编辑
      </a>
      <header className="topbar">
        <div className="identity">
          <AudioLines size={26} aria-hidden="true" />
          <div>
            <h1>字幕剪辑室</h1>
            <span>faster-whisper</span>
          </div>
        </div>
        <input
          className="project-title"
          aria-label="项目名称"
          name="project-title"
          maxLength={120}
          autoComplete="off"
          value={p.title}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <span className={`save-state ${p.autoState.phase}`} role="status">
          {p.autoState.message}
        </span>
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={p.busy}
          onOpen={(id) => void p.open(id)}
        />
        <button
          title="新建项目"
          aria-label="新建项目"
          onClick={() => void p.fresh()}
          disabled={p.busy}
        >
          <FilePlus2 size={19} />
        </button>
      </header>
      <Notice error={p.error} notice={p.notice} />
      {["offline", "conflict", "draft"].includes(p.autoState.phase) ? (
        <div className="recovery">
          <button onClick={() => void p.save()}>重试保存</button>
          <button onClick={p.exportDraft}>导出恢复草稿</button>
          {p.current ? (
            <button onClick={() => void p.open(p.current!.id)}>
              重新打开服务端版本
            </button>
          ) : null}
        </div>
      ) : null}
      <section className="monitor" aria-label="音频监看">
        <div className="monitor-top">
          <div>
            <span className="eyebrow">AUDIO / 音频轨</span>
            <h2>{source?.name ?? "导入音频，开始逐句审校"}</h2>
          </div>
          <div className="transport">
            <button
              className="play"
              aria-label={playing ? "暂停音频" : "播放音频"}
              disabled={!audioUrl}
              onClick={() => {
                if (audio.current) {
                  if (playing) audio.current.pause();
                  else
                    void audio.current
                      .play()
                      .catch(() => setMediaError("此音频无法播放。"));
                }
              }}
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <time>{clock(time)}</time>
            <span>/ {clock(span)}</span>
          </div>
        </div>
        <div className="waveform">
          <svg
            viewBox="0 0 1200 110"
            preserveAspectRatio="none"
            role="img"
            aria-label={peaks.length ? "音频波形" : "尚未加载音频波形"}
          >
            <line x1="0" y1="55" x2="1200" y2="55" className="wave-mid" />
            {peaks.map((v, i) => (
              <line
                key={i}
                x1={i * 5 + 2}
                y1={55 - v * 49}
                x2={i * 5 + 2}
                y2={55 + v * 49}
                className="wave-bar"
              />
            ))}
            <line
              x1={Math.min(1200, (time / span) * 1200)}
              y1="0"
              x2={Math.min(1200, (time / span) * 1200)}
              y2="110"
              className="playhead"
            />
          </svg>
          {!source ? (
            <span className="wave-empty">
              WAV · MP3 · M4A · OGG · WebM · FLAC
            </span>
          ) : null}
          <input
            aria-label="音频播放位置"
            type="range"
            min="0"
            max={span}
            step="0.01"
            value={Math.min(time, span)}
            disabled={!audioUrl}
            onChange={(e) => {
              const value = Number(e.target.value);
              setTime(value);
              if (audio.current) audio.current.currentTime = value;
            }}
          />
        </div>
        <div className="ruler">
          <span>00:00</span>
          <span>{clock(span / 4).slice(3, 8)}</span>
          <span>{clock(span / 2).slice(3, 8)}</span>
          <span>{clock((span * 3) / 4).slice(3, 8)}</span>
          <span>{clock(span).slice(3, 8)}</span>
        </div>
        <div className="subtitle-preview">
          {currentCue?.text || "回听时，这里显示当前字幕"}
        </div>
        {mediaError ? (
          <p className="field-error" role="status">
            {mediaError}
          </p>
        ) : null}
        {audioUrl ? (
          <audio
            ref={audio}
            src={audioUrl}
            preload="metadata"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() =>
              setMediaError("音频无法播放，请检查浏览器支持的格式。")
            }
          />
        ) : null}
      </section>
      <div className="workspace">
        <main id="editor" className="editor">
          <div className="editor-heading">
            <div>
              <span className="eyebrow">TRANSCRIPT / 字幕轨</span>
              <h2>
                逐句审校 <span>{p.data.cues.length} 句</span>
              </h2>
            </div>
            <div className="editor-tools">
              <label>
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(e) =>
                    p.setDraft((d) => ({ ...d, onlyPending: e.target.checked }))
                  }
                />
                只看待复核
              </label>
              <button onClick={add}>＋ 添加一句</button>
            </div>
          </div>
          <div className="progress-line">
            <span
              style={{
                width: `${p.data.cues.length ? (reviewed / p.data.cues.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="review-summary">
            <Check size={14} aria-hidden="true" />
            {reviewed} / {p.data.cues.length} 句已复核
            <span>{p.data.origin}</span>
          </p>
          <div className="cue-list">
            {p.data.cues.map((cue, index) =>
              onlyPending && cue.reviewed ? null : (
                <CueRow
                  key={cue.id}
                  cue={cue}
                  index={index}
                  selected={selected === cue.id}
                  onChange={update}
                  onSeek={seek}
                  onSplit={split}
                  onMerge={merge}
                  onRemove={remove}
                />
              ),
            )}
            {!p.data.cues.length ? (
              <div className="empty">
                <Headphones size={32} aria-hidden="true" />
                <h3>让字幕跟上声音</h3>
                <p>
                  上传音频并转写，或导入已有字幕。
                  <br />
                  也可以先打开示例，熟悉审校流程。
                </p>
                <button
                  onClick={() =>
                    void p.replace(exampleTranscript, "访谈字幕 · 示例")
                  }
                >
                  打开示例字幕
                </button>
              </div>
            ) : onlyPending && reviewed === p.data.cues.length ? (
              <p className="empty">所有字幕已复核。</p>
            ) : null}
          </div>
          <details className="import-panel">
            <summary>粘贴 SRT / VTT 字幕</summary>
            <label>
              字幕内容
              <textarea
                aria-label="待导入字幕"
                name="import-text"
                autoComplete="off"
                rows={5}
                spellCheck={false}
                maxLength={100000}
                value={importText}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, importText: e.target.value }))
                }
              />
            </label>
            <button
              onClick={() => void applyText()}
              disabled={!importText.trim()}
            >
              导入为新项目
            </button>
          </details>
        </main>
        <aside className="tools" aria-label="素材与交付">
          <section>
            <span className="eyebrow">01 / 素材</span>
            <label className="file-button">
              <Upload size={17} aria-hidden="true" />
              {uploading ? `音频上传 ${progress}%` : "导入音频"}
              <input
                type="file"
                aria-label="导入音频"
                accept=".wav,.mp3,.m4a,.mp4,.ogg,.webm,.flac"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void importAudio(file);
                }}
              />
            </label>
            <label className="file-button secondary">
              导入字幕 / 项目
              <input
                type="file"
                aria-label="导入字幕或项目"
                accept=".srt,.vtt,.json"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void importFile(file);
                }}
              />
            </label>
            <p className="hint">音频最大 40 MB。原文件会随项目保留。</p>
          </section>
          <section>
            <span className="eyebrow">02 / 转写</span>
            <label className="stack">
              识别语言
              <select
                name="language"
                aria-label="识别语言"
                value={p.data.language}
                onChange={(e) =>
                  changeData((d) => ({ ...d, language: e.target.value }))
                }
              >
                {languages.map(([id, name]) => (
                  <option
                    key={id}
                    value={id}
                    disabled={
                      service.model.endsWith(".en") &&
                      id !== "en" &&
                      id !== "auto"
                    }
                  >
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className={`service ${service.connected ? "online" : ""}`}>
              <span />
              {service.connected ? service.model : "服务未连接"}
              <button
                aria-label="重新检查转写服务"
                onClick={() => void checkService()}
              >
                <RotateCcw size={13} />
              </button>
            </div>
            <button
              className="primary"
              disabled={
                !source || !service.connected || jobBusy || jobForSource
              }
              onClick={() => void start()}
            >
              {jobBusy
                ? "正在处理…"
                : jobForSource
                  ? "已有任务待处理"
                  : "开始转写"}
            </button>
            <p className="hint">
              {service.connected
                ? "结果保留为独立初稿，审阅后采用。"
                : service.message}
            </p>
          </section>
          <section>
            <span className="eyebrow">03 / 交付</span>
            <div className="export-buttons">
              <button
                onClick={() => exportFile("srt")}
                disabled={!p.data.cues.length}
              >
                <Download size={15} />
                SRT
              </button>
              <button
                onClick={() => exportFile("vtt")}
                disabled={!p.data.cues.length}
              >
                VTT
              </button>
              <button
                onClick={() => exportFile("txt")}
                disabled={!p.data.cues.length}
              >
                TXT
              </button>
            </div>
            <button className="full" onClick={() => void exportProject()}>
              导出完整项目
            </button>
            <label className="stack notes">
              术语与校对备注
              <textarea
                aria-label="校对备注"
                name="notes"
                autoComplete="off"
                rows={4}
                maxLength={20000}
                value={p.data.notes}
                onChange={(e) =>
                  changeData((d) => ({ ...d, notes: e.target.value }))
                }
                placeholder="记录人名、术语或发音…"
              />
            </label>
          </section>
          <button
            className="delete-project"
            disabled={!p.current}
            onClick={() => void p.remove()}
          >
            <Trash2 size={14} />
            删除当前项目
          </button>
        </aside>
      </div>
      <section className="queue" aria-label="转写任务">
        <div className="queue-title">
          <h2>转写队列</h2>
          <span>完成的结果可采用为新项目</span>
        </div>
        {queueError ? <p role="alert">{queueError}</p> : null}
        {jobs.length ? (
          jobs.map((job) => (
            <article className="job" key={job.id}>
              <span className={`job-dot ${job.status}`} />
              <div className="job-name">
                <strong>{job.input.source.name}</strong>
                <small>
                  {job.model || "faster-whisper"} ·{" "}
                  {new Date(job.createdAt).toLocaleString()}
                </small>
                {job.error ? <p>{job.error}</p> : null}
              </div>
              <span className="job-status">{labels[job.status]}</span>
              {job.status === "completed" ? (
                <button disabled={jobBusy} onClick={() => void adopt(job)}>
                  采用为新项目
                </button>
              ) : activeStates.includes(job.status) ? (
                <div className="job-buttons">
                  {job.status === "unknown" ? (
                    <button
                      disabled={jobBusy}
                      onClick={() => void jobAction(job, "retry")}
                    >
                      用原任务重试
                    </button>
                  ) : null}
                  <button
                    disabled={jobBusy}
                    onClick={() => void jobAction(job, "cancel")}
                  >
                    取消
                  </button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="queue-empty">暂无转写任务。导入音频后即可开始。</p>
        )}
      </section>
    </div>
  );
}
