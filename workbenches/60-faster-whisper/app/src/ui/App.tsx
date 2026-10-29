// ABOUTME: 字幕校对台：文件条、波形监看与时间轴、字幕表（查找替换/筛选）、右侧本句·说话人·转写检查器。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Search, Plus } from "lucide-react";
import { useProjects, Notice } from "./workspace";
import {
  clock,
  emptyTranscript,
  restoreTranscript,
  transcriptDraft,
  trySeconds,
  validateTranscript,
  MAX_CUES,
  type Cue,
  type Transcript,
} from "../contracts/transcript";
import { mergeCues, nudge, retext, setEdge, splitCue, lowConfidence } from "../contracts/edit";
import { optionsValue, type TranscribeOptions } from "../contracts/options";
import { sampleTranscript, SAMPLE_TITLE } from "../contracts/sample";
import { usePlayer } from "./usePlayer";
import { Timeline, type Span } from "./Timeline";
import { CueRow, cueError, type Field } from "./CueRow";
import { CuePanel, SpeakersPanel, speakerColor } from "./Inspector";
import { TranscribePanel, activeStates } from "./TranscribePanel";
import { FileMenu, ExportMenu } from "./Menus";
import { FindBar } from "./FindBar";
import { useFind } from "./useFind";
import { Transport, Caption } from "./Monitor";
import { useTranscription } from "./useTranscription";
import { useFiles } from "./useFiles";
import type { ChangeData } from "./desk";

type Tab = "cue" | "speakers" | "transcribe";
const editable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function App() {
  const p = useProjects(emptyTranscript, validateTranscript, "未命名字幕稿", {
    storageKey: "faster-whisper-studio-v1",
    restoreDraftData: restoreTranscript,
  });
  const latest = useRef(p);
  latest.current = p;
  const d = transcriptDraft(p.draft);
  const data = p.data,
    source = data.source;
  const player = usePlayer(source);
  const audio = useRef<HTMLAudioElement>(null),
    audioInput = useRef<HTMLInputElement>(null),
    subtitleInput = useRef<HTMLInputElement>(null),
    findInput = useRef<HTMLInputElement>(null),
    inspector = useRef<HTMLElement>(null),
    epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [rate, setRate] = useState(1),
    [zoom, setZoom] = useState(0),
    [tab, setTab] = useState<Tab>("cue"),
    [findOpen, setFindOpen] = useState(false),
    [pasteOpen, setPasteOpen] = useState(false),
    [undo, setUndo] = useState<{ cue: Cue; index: number; key: string } | null>(null);
  const { health, checkService, jobs, queueError, jobBusy, start, jobAction, adopt } = useTranscription(p);
  const { uploading, importAudio, importFile, applyPaste, exportFile, exportProject } = useFiles(p, (c) => changeDataRef.current(c), epoch, {
    audio: () => setTab("transcribe"),
    paste: () => setPasteOpen(false),
  });

  const changeDataRef = useRef<ChangeData>(() => {});
  const changeData = useCallback((change: (value: Transcript) => Transcript) => {
    try {
      latest.current.setData((previous) => {
        const next = change(previous);
        restoreTranscript(next);
        return next;
      });
    } catch (error) {
      latest.current.report(error);
    }
  }, []);
  changeDataRef.current = changeData;
  const patchCue = useCallback(
    (id: string, change: (cue: Cue) => Cue) =>
      changeData((t) => ({ ...t, cues: t.cues.map((c) => (c.id === id ? change(c) : c)) })),
    [changeData],
  );
  const setDraft = useCallback((patch: Record<string, unknown>) => latest.current.setDraft((x) => ({ ...x, ...patch })), []);
  const select = useCallback((id: string) => setDraft({ selected: id }), [setDraft]);

  // First open with nothing saved: start on the bundled interview so proofreading works immediately.
  const firstRun = useRef(false);
  useEffect(() => {
    if (firstRun.current || p.loading) return;
    firstRun.current = true;
    if (!p.items.length && !p.current && !p.data.source && !p.data.cues.length && !Object.keys(p.draft).length)
      void p.replace(sampleTranscript, SAMPLE_TITLE, { selected: sampleTranscript.cues[4]?.id ?? "" });
  }, [p.loading]);
  useEffect(() => {
    document.title = `${p.title} · 字幕剪辑室`;
  }, [p.title]);
  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setUndo(null);
  }, [source?.id, p.documentKey]);
  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate, player.url]);


  const peaks = player.peaks;
  const lastEnd = useMemo(() => Math.max(0, ...data.cues.map((c) => trySeconds(c.end)).filter(Number.isFinite)), [data.cues]);
  const span = peaks?.duration || lastEnd || 10;
  const spans = useMemo<Span[]>(() => {
    const names = new Map(data.speakers.map((s) => [s.id, s.name]));
    return data.cues.flatMap((c, index) => {
      const s = trySeconds(c.start),
        e = trySeconds(c.end);
      return e > s
        ? [{ id: c.id, index, s, e, color: speakerColor(data.speakers, c.speaker), speaker: names.get(c.speaker) ?? "", text: c.text, words: c.words }]
        : [];
    });
  }, [data.cues, data.speakers]);
  const playingCue = useMemo(() => spans.find((s) => time >= s.s && time < s.e)?.id ?? "", [spans, time]);
  const selectedIndex = data.cues.findIndex((c) => c.id === d.selected);
  const selectedCue = selectedIndex >= 0 ? data.cues[selectedIndex] : null;
  const reviewed = data.cues.filter((c) => c.reviewed).length;
  const lowCount = useMemo(() => data.cues.reduce((n, c) => n + (c.reviewed ? 0 : c.words.filter((w) => lowConfidence(w)).length), 0), [data.cues]);
  const speakerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data.cues) m.set(c.speaker, (m.get(c.speaker) ?? 0) + 1);
    return m;
  }, [data.cues]);

  const { matches, findError, matchCounts, current, setMatchIndex, step, replaceOne, replaceAll } = useFind(p, findOpen, changeData, patchCue, select);

  // ---- playback ----
  const seekTo = useCallback((t: number, play = false) => {
    setTime(t);
    const el = audio.current;
    if (!el) return;
    el.currentTime = t;
    if (play) void el.play().catch(() => player.setError("无法播放此音频，请检查格式。"));
  }, []);
  const togglePlay = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => player.setError("此音频无法播放。"));
    else el.pause();
  }, []);
  const seekCue = useCallback(
    (cue: Cue) => {
      const t = trySeconds(cue.start);
      if (!Number.isFinite(t)) return;
      select(cue.id);
      seekTo(t, true);
    },
    [select, seekTo],
  );
  const timeRef = useRef(time);
  timeRef.current = time;

  // ---- cue edits ----
  const update = useCallback(
    (id: string, field: Field, value: string | boolean) =>
      patchCue(id, (c) =>
        field === "text"
          ? retext(c, String(value))
          : field === "reviewed"
            ? { ...c, reviewed: value === true }
            : field === "speaker"
              ? { ...c, speaker: String(value) }
              : { ...c, [field]: String(value) },
      ),
    [patchCue],
  );
  const split = useCallback(
    (id: string, at?: number) => {
      const q = latest.current;
      try {
        const cue = q.data.cues.find((c) => c.id === id);
        if (!cue) return;
        if (q.data.cues.length >= MAX_CUES) throw new Error("字幕已达到行数上限。");
        const now = timeRef.current,
          s = trySeconds(cue.start),
          e = trySeconds(cue.end);
        const point = at ?? (now > s + 0.02 && now < e - 0.02 ? now : undefined);
        const pair = splitCue(cue, point);
        changeData((t) => ({ ...t, cues: t.cues.flatMap((c) => (c.id === id ? pair : [c])) }));
        setDraft({ selected: pair[1].id });
      } catch (err) {
        q.report(err);
      }
    },
    [changeData, setDraft],
  );
  const merge = useCallback(
    (id: string) => {
      const q = latest.current;
      try {
        const index = q.data.cues.findIndex((c) => c.id === id),
          first = q.data.cues[index],
          next = q.data.cues[index + 1];
        if (!next) throw new Error("已经是最后一句。");
        if (cueError(first) || cueError(next)) throw new Error("请先修正时间格式。");
        const merged = mergeCues(first, next);
        changeData((t) => ({ ...t, cues: t.cues.flatMap((c, i) => (i === index ? [merged] : i === index + 1 ? [] : [c])) }));
      } catch (err) {
        q.report(err);
      }
    },
    [changeData],
  );
  const remove = useCallback(
    (id: string) => {
      const q = latest.current,
        index = q.data.cues.findIndex((c) => c.id === id);
      if (index < 0) return;
      setUndo({ cue: q.data.cues[index], index, key: q.documentKey });
      changeData((t) => ({ ...t, cues: t.cues.filter((c) => c.id !== id) }));
    },
    [changeData],
  );
  const onEdge = useCallback(
    (id: string, edge: "start" | "end", t: number) => {
      try {
        patchCue(id, (c) => setEdge(c, edge, t));
        select(id);
      } catch (err) {
        latest.current.report(err);
      }
    },
    [patchCue, select],
  );
  const onTimelineSelect = useCallback(
    (id: string, t: number) => {
      select(id);
      seekTo(t);
    },
    [select, seekTo],
  );
  function edgeAtPlayhead(edge: "start" | "end") {
    if (!selectedCue) return;
    try {
      const next = setEdge(selectedCue, edge, Math.round(time * 1000) / 1000);
      patchCue(selectedCue.id, () => next);
    } catch (err) {
      p.report(err);
    }
  }
  function moveSelection(delta: number, play = true) {
    const list = data.cues;
    if (!list.length) return;
    const next = list[Math.max(0, Math.min(list.length - 1, (selectedIndex < 0 ? -1 : selectedIndex) + delta))];
    select(next.id);
    const t = trySeconds(next.start);
    if (Number.isFinite(t)) seekTo(t, play);
    document.getElementById(`cue-${next.id}`)?.scrollIntoView({ block: "nearest" });
    return next;
  }
  function addCue() {
    if (data.cues.length >= MAX_CUES) return p.setError("字幕已达到行数上限。");
    const start = Math.round(Math.max(time, selectedCue ? trySeconds(selectedCue.end) || 0 : lastEnd) * 1000) / 1000;
    const cue: Cue = { id: crypto.randomUUID(), start: clock(start), end: clock(start + 2.5), text: "", reviewed: false, speaker: selectedCue?.speaker ?? "", words: [] };
    changeData((t) => {
      const at = t.cues.findIndex((c) => trySeconds(c.start) > start);
      const cues = [...t.cues];
      cues.splice(at < 0 ? cues.length : at, 0, cue);
      return { ...t, cues };
    });
    select(cue.id);
    requestAnimationFrame(() => (document.querySelector(`#cue-${cue.id} textarea`) as HTMLTextAreaElement | null)?.focus());
  }

  const openFind = () => {
    setFindOpen(true);
    requestAnimationFrame(() => findInput.current?.select());
  };

  // ---- keyboard ----
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "f") {
      e.preventDefault();
      openFind();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (mod && e.key === "Enter" && target?.closest(".cue")) {
      e.preventDefault();
      if (selectedCue) update(selectedCue.id, "reviewed", true);
      const next = moveSelection(1, true);
      if (next) requestAnimationFrame(() => (document.querySelector(`#cue-${next.id} textarea`) as HTMLTextAreaElement | null)?.focus());
      return;
    }
    if (editable(e.target) || mod || (e.target as HTMLElement | null)?.closest("[role=slider]")) return;
    const k = e.key;
    if (k === " ") {
      e.preventDefault();
      togglePlay();
    } else if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      seekTo(Math.max(0, Math.min(span, time + (k === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 5 : 1))));
    } else if (k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      moveSelection(k === "ArrowUp" ? -1 : 1);
    } else if (k === "[" || k === "]") edgeAtPlayhead(k === "[" ? "start" : "end");
    else if (k.toLowerCase() === "s" && selectedCue) split(selectedCue.id);
    else if (k.toLowerCase() === "m" && selectedCue) merge(selectedCue.id);
    else if (k.toLowerCase() === "r" && selectedCue) update(selectedCue.id, "reviewed", !selectedCue.reviewed);
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keys.current(e);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!playing || !playingCue || editable(document.activeElement)) return;
    document.getElementById(`cue-${playingCue}`)?.scrollIntoView({ block: "nearest" });
  }, [playingCue, playing]);

  // ---- transcription ----
  function setOptions(patch: Partial<TranscribeOptions>) {
    const clean: Partial<TranscribeOptions> = { ...patch };
    if (clean.beamSize !== undefined) clean.beamSize = Math.min(10, Math.max(1, clean.beamSize));
    if (clean.vadMinSilenceMs !== undefined) clean.vadMinSilenceMs = Math.min(5000, Math.max(100, clean.vadMinSilenceMs));
    changeData((t) => ({ ...t, options: optionsValue({ ...t.options, ...clean }) }));
  }
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在打开字幕剪辑室…
      </main>
    );
  const visibleCues = data.cues
    .map((cue, index) => ({ cue, index }))
    .filter(({ cue }) => (!d.onlyPending || !cue.reviewed) && (!d.onlyLow || (!cue.reviewed && cue.words.some((w) => lowConfidence(w)))));
  const sourcePending = jobs.some((j) => j.input.source.id === source?.id && activeStates.includes(j.status));
  return (
    <div className="studio">
      <a className="skip" href="#editor">
        跳到字幕表
      </a>
      <header className="filebar">
        <span className="brand" aria-hidden="true">
          <AudioLines size={20} />
        </span>
        <h1 className="sr-only">字幕剪辑室 · faster-whisper</h1>
        <FileMenu
          items={p.items}
          currentId={p.current?.id}
          busy={p.busy || !!uploading}
          onBlank={() => void p.fresh()}
          onSample={() => void p.replace(sampleTranscript, SAMPLE_TITLE, { selected: sampleTranscript.cues[4]?.id ?? "" })}
          onAudio={() => audioInput.current?.click()}
          onSubtitles={() => subtitleInput.current?.click()}
          onPaste={() => setPasteOpen(true)}
          onOpen={(id) => void p.open(id)}
          onDelete={() => {
            if (window.confirm(`删除字幕稿“${p.title}”？音频原件仍保留给其他字幕稿使用。`)) void p.remove();
          }}
        />
        <input className="doc-title" aria-label="字幕稿名称" name="project-title" maxLength={120} autoComplete="off" value={p.title} onChange={(e) => p.setTitle(e.target.value)} />
        <span className={`save-state ${p.autoState.phase}`} role="status">
          {uploading ? `音频上传 ${uploading}` : p.autoState.message}
        </span>
        <div className="filebar-actions">
          <button
            className={`service-chip ${health.connected ? "online" : health.reason === "checking" ? "checking" : ""}`}
            onClick={() => {
              setTab("transcribe");
              inspector.current?.scrollIntoView({ block: "start", behavior: "smooth" });
            }}
            aria-label={`转写：${health.connected ? "服务已连接" : "服务未连接"}`}
          >
            <span className="dot" aria-hidden="true" />
            转写{sourcePending ? " · 进行中" : ""}
          </button>
          <ExportMenu
            disabled={!data.cues.length}
            speakers={d.exportSpeakers}
            times={d.exportTimes}
            onSpeakers={(v) => setDraft({ exportSpeakers: v })}
            onTimes={(v) => setDraft({ exportTimes: v })}
            onExport={exportFile}
            onProject={() => void exportProject()}
            onDraft={p.exportDraft}
          />
        </div>
        <input ref={audioInput} hidden type="file" aria-label="导入音频或视频" accept="audio/*,video/*,.wav,.mp3,.m4a,.aac,.mp4,.mov,.ogg,.opus,.webm,.mkv,.flac,.aif,.aiff" onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importAudio(file);
        }} />
        <input ref={subtitleInput} hidden type="file" aria-label="导入字幕或项目" accept=".srt,.vtt,.json" onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }} />
      </header>
      <Notice error={p.error} notice={p.notice} />
      {undo && undo.key === p.documentKey ? (
        <div className="undo-bar" role="status">
          已删除第 {undo.index + 1} 句“{undo.cue.text.slice(0, 18) || "空白"}”。
          <button
            onClick={() => {
              const u = undo;
              setUndo(null);
              changeData((t) => {
                const cues = [...t.cues];
                const known = !u.cue.speaker || t.speakers.some((s) => s.id === u.cue.speaker);
                cues.splice(Math.min(u.index, cues.length), 0, known ? u.cue : { ...u.cue, speaker: "" });
                return { ...t, cues };
              });
            }}
          >
            撤销删除
          </button>
        </div>
      ) : null}
      {["offline", "conflict", "draft"].includes(p.autoState.phase) ? (
        <div className="recovery">
          <button onClick={() => void p.save()}>重试保存</button>
          <button onClick={p.exportDraft}>导出恢复草稿</button>
          {p.current ? <button onClick={() => void p.open(p.current!.id)}>重新打开服务端版本</button> : null}
        </div>
      ) : null}
      <section className="monitor" aria-label="音频监看">
        <Transport playing={playing} canPlay={!!player.url} time={time} span={span} source={source} rate={rate} zoom={zoom} onToggle={togglePlay} onRate={setRate} onZoom={setZoom} />
        {player.loading && !peaks ? <p className="wave-note">正在解码波形…</p> : null}
        {!source ? <p className="wave-note">支持 WAV、MP3、AAC、M4A/MP4/MOV、OGG/Opus、WebM/MKV、FLAC，最大 200 MB。</p> : null}
        <Timeline peaks={peaks} span={span} time={time} playing={playing} spans={spans} selected={d.selected} zoom={zoom} onSeek={seekTo} onSelect={onTimelineSelect} onEdge={onEdge} />
        <Caption cue={data.cues.find((x) => x.id === playingCue)} speakers={data.speakers} time={time} />
        {player.error ? (
          <p className="field-error" role="status">
            {player.error}
          </p>
        ) : null}
        {player.url ? (
          <audio
            ref={audio}
            src={player.url}
            preload="auto"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => player.setError("浏览器无法播放这种音频编码；原件已保存，仍可提交转写。")}
          />
        ) : null}
      </section>
      <div className="workspace">
        <main id="editor" className="editor">
          <div className="editor-heading">
            <h2>
              字幕表 <span>{data.cues.length} 句 · 已复核 {reviewed}</span>
            </h2>
            <div className="editor-tools">
              <label className="check">
                <input type="checkbox" checked={d.onlyPending} onChange={(e) => setDraft({ onlyPending: e.target.checked })} />
                待复核
              </label>
              <label className="check">
                <input type="checkbox" checked={d.onlyLow} onChange={(e) => setDraft({ onlyLow: e.target.checked })} />
                低置信词{lowCount ? ` (${lowCount})` : ""}
              </label>
              <button onClick={openFind} aria-label="查找替换" title="查找替换（Ctrl/⌘ F）">
                <Search size={15} aria-hidden="true" />
                查找替换
              </button>
              <button onClick={addCue}>
                <Plus size={15} aria-hidden="true" />
                在播放头加一句
              </button>
            </div>
          </div>
          <div className="progress-line" aria-hidden="true">
            <span style={{ width: `${data.cues.length ? (reviewed / data.cues.length) * 100 : 0}%` }} />
          </div>
          {data.origin ? <p className="origin">{data.origin}</p> : null}
          {findOpen ? (
            <FindBar
              inputRef={findInput}
              find={d.find}
              replace={d.replace}
              matchCase={d.matchCase}
              regex={d.regex}
              count={matches.length}
              current={current}
              error={findError}
              onChange={(patch) => {
                setDraft(patch);
                setMatchIndex(0);
              }}
              onStep={(delta) => step(delta, false)}
              onReplaceOne={replaceOne}
              onReplaceAll={replaceAll}
              onClose={() => setFindOpen(false)}
            />
          ) : null}
          {pasteOpen ? (
            <section className="paste-panel" aria-label="粘贴字幕">
              <label className="stack">
                粘贴 SRT、VTT 或分段 JSON
                <textarea name="import-text" rows={6} spellCheck={false} maxLength={100000} autoComplete="off" value={d.importText} onChange={(e) => setDraft({ importText: e.target.value })} />
              </label>
              <div className="row">
                <button className="primary" disabled={!d.importText.trim()} onClick={() => void applyPaste()}>
                  导入为新字幕稿
                </button>
                <button onClick={() => setPasteOpen(false)}>收起</button>
              </div>
            </section>
          ) : null}
          <div className="cue-list">
            {visibleCues.map(({ cue, index }) => (
              <CueRow
                key={cue.id}
                cue={cue}
                index={index}
                selected={d.selected === cue.id}
                playing={playingCue === cue.id}
                speakers={data.speakers}
                color={speakerColor(data.speakers, cue.speaker)}
                matches={matchCounts.get(cue.id) ?? 0}
                onChange={update}
                onSelect={select}
                onSeek={seekCue}
                onSplit={split}
                onMerge={merge}
                onRemove={remove}
              />
            ))}
            {!data.cues.length ? (
              <div className="empty">
                <h3>{source ? "这段音频还没有字幕" : "从音频或字幕开始"}</h3>
                <p>{source ? "在“转写”页开始 faster-whisper 转写；也可以边听边用“在播放头加一句”手动打轴。" : "从“字幕稿”菜单导入音频、SRT/VTT/JSON，或打开示例访谈先熟悉校对流程。"}</p>
                <div className="row">
                  {!source ? <button onClick={() => audioInput.current?.click()}>导入音频</button> : null}
                  <button onClick={() => void p.replace(sampleTranscript, SAMPLE_TITLE)}>打开示例访谈</button>
                </div>
              </div>
            ) : !visibleCues.length ? (
              <p className="empty">筛选条件下没有字幕。</p>
            ) : null}
          </div>
          <details className="shortcuts">
            <summary>快捷键</summary>
            <p>
              空格 播放/暂停 · ←/→ 跳 1 秒（Shift 5 秒）· ↑/↓ 上一句/下一句 · [ / ] 把入点/出点设为播放头 · S 拆分 · M 合并 · R 复核 · 在对白框里 Ctrl/⌘ Enter 复核并进入下一句 · Ctrl/⌘ F 查找替换 · 波形上的入出点可拖动（Alt 关闭吸附），聚焦后用 ←/→ 微调 50 毫秒（Shift 10 毫秒）
            </p>
          </details>
        </main>
        <aside ref={inspector} className="inspector" aria-label="检查器">
          <div
            className="tabs"
            role="tablist"
            aria-label="检查器"
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              const order: Tab[] = ["cue", "speakers", "transcribe"];
              const next = order[(order.indexOf(tab) + (e.key === "ArrowRight" ? 1 : 2)) % 3];
              setTab(next);
              requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
            }}
          >
            {(
              [
                ["cue", "本句"],
                ["speakers", `说话人 ${data.speakers.length}`],
                ["transcribe", "转写"],
              ] as const
            ).map(([id, name]) => (
              <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} aria-controls={`panel-${id}`} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                {id === "transcribe" ? <span className={`dot ${health.connected ? "online" : ""}`} aria-hidden="true" /> : null}
                {name}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
            {tab === "cue" ? (
              <CuePanel
                cue={selectedCue}
                index={selectedIndex}
                speakers={data.speakers}
                time={time}
                onSpeaker={(v) => selectedCue && update(selectedCue.id, "speaker", v)}
                onNudge={(edge, delta) => selectedCue && patchCue(selectedCue.id, (c) => nudge(c, edge, delta))}
                onEdgeAtPlayhead={edgeAtPlayhead}
                onSeek={(t) => seekTo(t, true)}
                onSplit={(at) => selectedCue && split(selectedCue.id, at)}
                onMerge={() => selectedCue && merge(selectedCue.id)}
                onRemove={() => selectedCue && remove(selectedCue.id)}
                onReview={(v) => selectedCue && update(selectedCue.id, "reviewed", v)}
              />
            ) : tab === "speakers" ? (
              <SpeakersPanel
                speakers={data.speakers}
                counts={speakerCounts}
                onRename={(id, name) => changeData((t) => ({ ...t, speakers: t.speakers.map((s) => (s.id === id ? { ...s, name } : s)) }))}
                onAdd={() =>
                  changeData((t) => ({ ...t, speakers: [...t.speakers, { id: `spk-${crypto.randomUUID().slice(0, 8)}`, name: `说话人 ${t.speakers.length + 1}` }] }))
                }
                onRemove={(id) =>
                  changeData((t) => ({ ...t, speakers: t.speakers.filter((s) => s.id !== id), cues: t.cues.map((c) => (c.speaker === id ? { ...c, speaker: "" } : c)) }))
                }
                onAssignPending={(id) => changeData((t) => ({ ...t, cues: t.cues.map((c) => (c.speaker ? c : { ...c, speaker: id })) }))}
              />
            ) : (
              <>
                {queueError ? <p className="field-error" role="alert">{queueError}</p> : null}
                <TranscribePanel
                  health={health}
                  language={data.language}
                  options={data.options}
                  hasSource={!!source}
                  busy={jobBusy}
                  jobs={jobs}
                  sourceId={source?.id ?? ""}
                  onLanguage={(language) =>
                    changeData((t) => ({ ...t, language, options: language === "en" && t.options.task === "translate" ? { ...t.options, task: "transcribe" } : t.options }))
                  }
                  onOptions={setOptions}
                  onStart={() => void start()}
                  onRecheck={() => void checkService()}
                  onAdopt={(job) => void adopt(job)}
                  onJob={(job, action) => void jobAction(job, action)}
                />
              </>
            )}
          </div>
          <label className="stack notes">
            术语与校对备注
            <textarea name="notes" rows={4} maxLength={20000} autoComplete="off" value={data.notes} placeholder="人名、术语、体例…" onChange={(e) => changeData((t) => ({ ...t, notes: e.target.value }))} />
          </label>
        </aside>
      </div>
    </div>
  );
}
