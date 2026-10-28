import { useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import {
  seed,
  validateReview,
  restoreReview,
  importReview,
  clipsCSV,
  validRange,
  MAX_AUDIO_BYTES,
  type Clip,
} from "../contracts/review";
import { useProjects, ProjectPicker, Notice, download } from "./workspace";
import {
  decodeAudio,
  audioBytes,
  sourceFor,
  upload,
  base64,
  unbase64,
} from "./media";
import { Waveform } from "./Waveform";
const clock = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
export function App() {
  const p = useProjects(seed, validateReview, "未命名录音", {
      storageKey: "wavesurfer-js-v1",
      restoreDraftData: restoreReview,
    }),
    [selected, setSelected] = useState(""),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [loop, setLoop] = useState(false),
    [speed, setSpeed] = useState(1),
    [zoom, setZoom] = useState(0),
    [fileBusy, setFileBusy] = useState(false),
    [transitioning, setTransitioning] = useState(false),
    [progress, setProgress] = useState(0),
    [audioLoad, setAudioLoad] = useState(0);
  const api = useRef<WaveSurfer | null>(null),
    transitionRef = useRef(false),
    keyRef = useRef(p.documentKey);
  keyRef.current = p.documentKey;
  const clip = p.data.clips.find((c) => c.id === selected) ?? p.data.clips[0],
    blocked = transitioning || fileBusy || p.loading;
  const raw = typeof p.draft.json === "string" ? p.draft.json : "";
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current || fileBusy) return;
    transitionRef.current = true;
    setTransitioning(true);
    try {
      if (await action()) {
        setSelected("");
        setTime(0);
        setPlaying(false);
        setLoop(false);
        setSpeed(1);
        setZoom(0);
      }
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  function edit(c: Partial<Clip>) {
    if (!clip || blocked) return;
    p.setData((d) => ({
      ...d,
      clips: d.clips.map((x) => (x.id === clip.id ? { ...x, ...c } : x)),
    }));
  }
  async function attach(file: File) {
    if (blocked) return;
    const key = p.documentKey;
    setFileBusy(true);
    p.setError("");
    try {
      if (file.size > MAX_AUDIO_BYTES) throw Error("单个音频原件最大 32 MB。");
      const bytes = new Uint8Array(await file.arrayBuffer()),
        source = await sourceFor(file, bytes);
      if (p.data.source && source.id !== p.data.source.id)
        throw Error("文件指纹与当前录音不匹配。要审阅其他录音，请新建录音。");
      const duration = await decodeAudio(bytes);
      await upload(bytes, source, setProgress);
      if (keyRef.current !== key) return;
      p.setData((d) => ({ ...d, source, duration }));
      if (!p.data.source)
        p.setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 120));
      setAudioLoad((v) => v + 1);
      p.setNotice("原件已附回。");
    } catch (e) {
      if (keyRef.current === key) p.report(e);
    } finally {
      setFileBusy(false);
    }
  }
  async function importFile(file: File) {
    await transition(async () => {
      if (file.size > 48 * 1024 * 1024) throw Error("工程文件超过 48 MB。");
      const value = importReview(JSON.parse(await file.text()));
      if (value.audioBase64 && value.data.source) {
        const b = unbase64(value.audioBase64);
        const duration = await decodeAudio(b);
        if (Math.abs(duration - value.data.duration) > 0.05)
          throw Error("工程时长与原件实际解码时长不一致，请检查原件与工程。");
        await upload(b, value.data.source, setProgress);
      }
      return p.replace(value.data, value.title, value.extra);
    });
  }
  async function exported(kind: string) {
    const key = p.documentKey,
      data = p.data,
      title = p.title,
      extra = p.draft;
    p.setError("");
    try {
      if (kind === "original") {
        if (!data.source) throw Error("请先上传音频。");
        const b = await audioBytes(data.source.id);
        if (keyRef.current === key)
          download(
            new Blob([new Uint8Array(b)], { type: data.source.mime }),
            data.source.name,
          );
        return;
      }
      if (kind === "project") {
        const b = data.source ? await audioBytes(data.source.id) : null;
        if (keyRef.current !== key) return;
        download(
          new Blob(
            [
              JSON.stringify(
                {
                  format: "wavesurfer-review/v1",
                  title,
                  data,
                  extra,
                  ...(b ? { audioBase64: base64(b) } : {}),
                },
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
          title + ".review.json",
        );
        return;
      }
      validateReview(data);
      download(
        new Blob(
          [
            kind === "csv"
              ? clipsCSV(data)
              : JSON.stringify(
                  {
                    source: data.source,
                    duration: data.duration,
                    clips: data.clips,
                    notes: data.notes,
                  },
                  null,
                  2,
                ),
          ],
          { type: kind === "csv" ? "text/csv" : "application/json" },
        ),
        title + (kind === "csv" ? ".regions.csv" : ".regions.json"),
      );
    } catch (e) {
      if (keyRef.current === key) p.report(e);
    }
  }
  function add() {
    if (p.data.clips.length >= 500) {
      p.setError("最多支持 500 个选段。");
      return;
    }
    const start = Math.min(time, Math.max(0, p.data.duration - 0.1)),
      c: Clip = {
        id: crypto.randomUUID(),
        start: start.toFixed(3),
        end: Math.min(p.data.duration, start + 5).toFixed(3),
        label: `选段 ${p.data.clips.length + 1}`,
        text: "",
        reviewed: false,
      };
    p.setData((d) => ({ ...d, clips: [...d.clips, c] }));
    setSelected(c.id);
  }
  return (
    <>
      <a className="skip" href="#main">
        跳到听审区
      </a>
      <header>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ▥
          </span>
          <div>
            <h1>
              声段 <small>wavesurfer.js</small>
            </h1>
            <p>录音听审与素材选段</p>
          </div>
        </div>
        <div className="filebar">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={blocked}
            onOpen={(id) => void transition(() => p.open(id))}
          />
          <button
            disabled={blocked}
            onClick={() => void transition(() => p.fresh())}
          >
            新建录音
          </button>
          <label className="file-button">
            导入工程
            <input
              aria-label="导入工程"
              type="file"
              accept=".json"
              disabled={blocked}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importFile(f);
              }}
            />
          </label>
        </div>
      </header>
      <main id="main">
        <div className="titleline">
          <input
            className="title"
            aria-label="录音名称"
            maxLength={120}
            value={p.title}
            disabled={blocked}
            onChange={(e) => p.setTitle(e.target.value)}
          />
          <span className={"save " + p.autoState.phase} role="status">
            {p.autoState.message}
          </span>
          <button onClick={() => void p.save()} disabled={blocked}>
            立即保存
          </button>
        </div>
        <Notice error={p.error} notice={p.notice} />
        {p.autoState.phase === "conflict" && (
          <button
            disabled={blocked}
            onClick={() =>
              p.current && void transition(() => p.open(p.current!.id))
            }
          >
            打开服务端版本
          </button>
        )}
        <fieldset disabled={blocked}>
          <div className="source-row">
            <span>
              <b>{p.data.source?.name ?? "尚未附加原音频"}</b>
              <small>
                {p.data.source
                  ? `${(p.data.source.bytes / 1024 / 1024).toFixed(2)} MB · ${clock(p.data.duration)} · 原件保留`
                  : "WAV / MP3 / M4A / OGG / WebM / FLAC · 单个最大 32 MB / 10 分钟"}
              </small>
            </span>
            <label className="file-button accent">
              {p.data.source ? "重附匹配原件" : "上传录音"}
              <input
                aria-label="上传录音"
                type="file"
                accept="audio/*,.flac"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void attach(f);
                }}
              />
            </label>
          </div>
          <Waveform
            key={
              p.documentKey + ":" + audioLoad + ":" + (p.data.source?.id ?? "")
            }
            disabled={blocked}
            api={api}
            data={p.data}
            selected={clip?.id ?? ""}
            onRange={(id, start, end) => {
              if (transitionRef.current || fileBusy) return;
              p.setData((d) => ({
                ...d,
                clips: d.clips.map((c) =>
                  c.id === id ? { ...c, start, end } : c,
                ),
              }));
            }}
            onSelect={setSelected}
            onDuration={(duration) => {
              if (transitionRef.current) return;
              p.setData((d) =>
                d.source?.id === p.data.source?.id &&
                Math.abs(d.duration - duration) > 0.05
                  ? { ...d, duration }
                  : d,
              );
            }}
            onTime={(n) => {
              setTime(n);
              setPlaying(api.current?.isPlaying() ?? false);
            }}
            loop={loop}
          />
          <div className="transport">
            <button
              className="play"
              disabled={!p.data.source}
              onClick={() => {
                void api.current
                  ?.playPause()
                  .then(() => setPlaying(api.current?.isPlaying() ?? false))
                  .catch(p.report);
              }}
            >
              {playing ? "暂停" : "播放"}
            </button>
            <output className="time">
              {clock(time)} <span>/ {clock(p.data.duration)}</span>
            </output>
            <label>
              速度
              <select
                aria-label="播放速度"
                value={speed}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSpeed(n);
                  api.current?.setPlaybackRate(n, true);
                }}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
                  <option key={n} value={n}>
                    {n}×
                  </option>
                ))}
              </select>
            </label>
            <label>
              缩放
              <input
                aria-label="波形缩放"
                type="range"
                min="0"
                max="160"
                value={zoom}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setZoom(n);
                  api.current?.zoom(n);
                }}
              />
            </label>
            <button
              className="accent"
              disabled={!p.data.source || p.data.duration <= 0}
              onClick={add}
            >
              ＋ 标记选段
            </button>
          </div>
          <div className="desk">
            <section className="clip-list">
              <div className="section-head">
                <h2>素材选段</h2>
                <span>
                  {p.data.clips.filter((c) => c.reviewed).length} /{" "}
                  {p.data.clips.length} 已审阅
                </span>
              </div>
              {p.data.clips.length === 0 ? (
                <p className="muted empty-list">
                  在播放头位置标记第一个选段。可以拖动波形边界，也可以输入精确秒数。
                </p>
              ) : (
                p.data.clips.map((c, i) => (
                  <button
                    key={c.id}
                    className={
                      "clip-row " + (clip?.id === c.id ? "selected" : "")
                    }
                    onClick={() => {
                      setSelected(c.id);
                      if (validRange(c, p.data.duration))
                        api.current?.setTime(Number(c.start));
                    }}
                  >
                    <span className="ordinal">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <b>{c.label || "未命名选段"}</b>
                      <small>
                        {c.start} — {c.end} 秒
                      </small>
                    </span>
                    <span aria-label={c.reviewed ? "已审阅" : "待审阅"}>
                      {c.reviewed ? "✓" : "○"}
                    </span>
                  </button>
                ))
              )}
            </section>
            <section className="excerpt">
              <div className="section-head">
                <h2>选段摘录</h2>
                <span>人工记录</span>
              </div>
              {clip ? (
                <>
                  <label>
                    选段名称
                    <input
                      aria-label="选段名称"
                      maxLength={200}
                      value={clip.label}
                      onChange={(e) => edit({ label: e.target.value })}
                    />
                  </label>
                  <div className="range">
                    <label>
                      起点 / 秒
                      <input
                        aria-label="起点秒数"
                        maxLength={100}
                        inputMode="decimal"
                        value={clip.start}
                        onChange={(e) => edit({ start: e.target.value })}
                      />
                    </label>
                    <label>
                      终点 / 秒
                      <input
                        aria-label="终点秒数"
                        maxLength={100}
                        inputMode="decimal"
                        value={clip.end}
                        onChange={(e) => edit({ end: e.target.value })}
                      />
                    </label>
                    <button
                      disabled={!validRange(clip, p.data.duration)}
                      onClick={() => {
                        void api.current
                          ?.play(Number(clip.start), Number(clip.end))
                          .catch(p.report);
                      }}
                    >
                      回听选段
                    </button>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={loop}
                        onChange={(e) => setLoop(e.target.checked)}
                      />
                      循环
                    </label>
                  </div>
                  {!validRange(clip, p.data.duration) && (
                    <p className="error">
                      起止时间尚未完成，当前输入将作为草稿保留。
                    </p>
                  )}
                  <label>
                    摘录与用途
                    <textarea
                      aria-label="摘录与用途"
                      maxLength={20000}
                      rows={5}
                      placeholder="记下原话、观点或使用位置…"
                      value={clip.text}
                      onChange={(e) => edit({ text: e.target.value })}
                    />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={clip.reviewed}
                      onChange={(e) => edit({ reviewed: e.target.checked })}
                    />
                    已审阅此选段
                  </label>
                  <button
                    className="danger"
                    onClick={() => {
                      if (confirm("删除这个选段及摘录？")) {
                        p.setData((d) => ({
                          ...d,
                          clips: d.clips.filter((c) => c.id !== clip.id),
                        }));
                        setSelected("");
                      }
                    }}
                  >
                    删除选段
                  </button>
                </>
              ) : (
                <p className="muted">选中一段音频，把听到的内容留在这里。</p>
              )}
            </section>
          </div>
          <label className="notes">
            录音备忘
            <textarea
              aria-label="录音备忘"
              maxLength={50000}
              rows={2}
              value={p.data.notes}
              onChange={(e) =>
                p.setData((d) => ({ ...d, notes: e.target.value }))
              }
              placeholder="采访背景、素材来源或待确认问题…"
            />
          </label>
          <details>
            <summary>工程与导出</summary>
            <div className="exports">
              <button onClick={() => void exported("original")}>
                下载原音频
              </button>
              <button onClick={() => void exported("json")}>区间 JSON</button>
              <button onClick={() => void exported("csv")}>区间 CSV</button>
              <button onClick={() => void exported("project")}>
                完整工程（含原件）
              </button>
              <button onClick={p.exportDraft}>导出恢复稿</button>
            </div>
            <p className="muted">
              恢复稿保存区间、笔记和未应用编辑，不含原音频；重新导入后可重附匹配原件。每个原件最大
              32
              MB，波形解码受浏览器可用内存与音频格式支持限制。这里的导出不会剪切或处理音频。
            </p>
            <label>
              工程 JSON 工作稿
              <textarea
                aria-label="工程 JSON 工作稿"
                maxLength={500000}
                rows={5}
                spellCheck={false}
                value={raw}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, json: e.target.value }))
                }
              />
            </label>
            <button
              onClick={() =>
                p.setDraft((d) => ({
                  ...d,
                  json: JSON.stringify(
                    { title: p.title, data: p.data, extra: {} },
                    null,
                    2,
                  ),
                }))
              }
            >
              载入当前工程到编辑器
            </button>
            <button
              onClick={() =>
                void transition(async () => {
                  const v = importReview(JSON.parse(raw));
                  return p.replace(v.data, v.title, v.extra);
                })
              }
            >
              作为新副本应用
            </button>
          </details>
        </fieldset>
        {fileBusy && <p role="status">正在解码或保存原件… {progress}%</p>}
        <footer>
          声段 / LISTEN · MARK · REVIEW <span>原件与工作稿分别保留</span>
        </footer>
      </main>
    </>
  );
}
