// ABOUTME: 剪辑台主界面：影片菜单与保存状态、素材库、监视器、检查器、时间线，以及导出与 OpenMontage 服务的接线。
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Redo2, Undo2, Upload } from "lucide-react";
import { useProjects, Notice, download } from "./workspace";
import { useProduction } from "./useProduction";
import { timelineValue, emptyTimeline, duration, clipEnd, active, type Timeline, type TextPreset } from "../contracts/timeline";
import { sampleTimeline, SAMPLE_TITLE } from "../contracts/samples";
import { addAsset, addMediaClip, addTextClip, addTrack, crossfade, duplicateClip, patchClip, patchTrack, removeAsset, removeClip, removeTrack, splitAt } from "../contracts/edit";
import { parseSubtitles, timelineSrt } from "../contracts/subtitles";
import { assetValue, type Asset } from "../contracts/media";
import { Player } from "./engine/player";
import { importFile } from "./media";
import { pack, unpack, PROJECT_EXTENSION } from "./portable";
import { report } from "./report";
import { FileMenu, type MenuAction } from "./FileMenu";
import { Library } from "./Library";
import { Monitor } from "./Monitor";
import { Inspector, type InspectorActions } from "./Inspector";
import { TimelineView } from "./Timeline";
import { TimelineToolbar } from "./TimelineToolbar";
import { ExportPanel } from "./ExportPanel";
import { JsonDialog } from "./JsonDialog";
import { useExport } from "./useExport";
import { NumericDrafts } from "./fields";

const SEED = sampleTimeline();
type Tab = "timeline" | "library" | "inspector";
const editable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("dialog,[role=menu]"));

export function App() {
  const p = useProjects(SEED, timelineValue, SAMPLE_TITLE, { storageKey: "openmontage-production-v1", restoreDraftData: timelineValue });
  const flow = useProduction(p);
  const t = p.data;
  const [player] = useState(() => new Player(SEED));
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [zoom, setZoom] = useState(48);
  const [snapping, setSnapping] = useState(true);
  const [tab, setTab] = useState<Tab>("timeline");
  const [io, setIo] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const projectInput = useRef<HTMLInputElement>(null);
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const data = useRef(t);
  data.current = t;
  const history = useRef({ past: [] as Timeline[], future: [] as Timeline[], key: "", at: 0 });
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const exp = useExport({
    player,
    epoch,
    snapshot: () => ({ timeline: data.current, title: p.title }),
    addOutput: (record) => p.setData((d) => ({ ...d, outputs: [record, ...d.outputs].slice(0, 30) })),
    notify: (message) => {
      p.setError("");
      p.setNotice(message);
    },
  });
  const mutable = !p.loading && !p.busy && !io && !flow.transitioning && !exp.exporting;

  useEffect(() => () => player.destroy(), [player]);
  useEffect(() => {
    player.onMediaError = (names) => setMediaError(`素材无法播放：${names.join("、")}。请在素材库重新导入，或导入含素材的完整工程。`);
  }, [player]);
  useEffect(() => player.setTimeline(t), [player, t]);
  useEffect(() => {
    history.current = { past: [], future: [], key: "", at: 0 };
    setSelected(null);
    setSelectedTrack(null);
    setMediaError("");
    player.pause();
    // 停在开场之后一点，首屏就能看到画面与标题，而不是淡入前的黑场。
    player.seek(Math.min(2, duration(data.current)));
    bump();
  }, [p.documentKey, player]);

  /** 提交一次编辑：先校验，再入撤销栈；同一字段连续输入合并为一步。 */
  const commit = useCallback(
    (next: Timeline, base: Timeline = data.current, key?: string) => {
      if (next === base) return false;
      try {
        timelineValue(next);
      } catch (e) {
        p.report(e);
        return false;
      }
      const h = history.current, now = Date.now();
      if (!(key && key === h.key && now - h.at < 1000)) {
        h.past.push(base);
        if (h.past.length > 120) h.past.shift();
      }
      h.key = key ?? "";
      h.at = now;
      h.future = [];
      data.current = next;
      p.setData(next);
      bump();
      return true;
    },
    [p],
  );
  const apply = (fn: (t: Timeline) => Timeline, key?: string) => {
    try {
      return commit(fn(data.current), data.current, key);
    } catch (e) {
      p.report(e);
      return false;
    }
  };
  function travel(direction: "undo" | "redo") {
    const h = history.current;
    const from = direction === "undo" ? h.past : h.future, to = direction === "undo" ? h.future : h.past;
    const target = from.pop();
    if (!target) return;
    to.push(data.current);
    h.key = "";
    // 成片记录不随撤销回退。
    const next = { ...target, outputs: data.current.outputs };
    data.current = next;
    p.setData(next);
    if (selected && !next.clips.some((c) => c.id === selected)) setSelected(null);
    bump();
  }

  const playhead = () => player.getTime();
  function select(id: string | null) {
    setSelected(id);
    if (id) setSelectedTrack(null);
  }
  function placeAsset(asset: Asset, at?: number, trackId?: string) {
    let created: string | null = null;
    apply((d) => {
      const r = addMediaClip(d, asset, at ?? playhead(), trackId);
      const fallback = r.clip ? r : addMediaClip(d, asset, at ?? playhead());
      created = fallback.clip?.id ?? null;
      return fallback.timeline;
    });
    if (created) select(created);
  }
  function addText(preset: TextPreset, sample: string) {
    let created: string | null = null;
    apply((d) => {
      const r = addTextClip(d, preset, playhead(), sample, undefined, preset === "title" ? 4 : 3);
      created = r.clip?.id ?? null;
      return r.timeline;
    });
    if (created) {
      select(created);
      setTab("inspector");
    }
  }
  function split() {
    const now = playhead();
    const target = selected && t.clips.find((c) => c.id === selected && now > c.start && now < clipEnd(c));
    if (!target && !t.clips.some((c) => active(c, now) && now > c.start + 0.05)) {
      p.setNotice("播放头下没有可分割的片段。");
      return;
    }
    apply((d) => splitAt(d, now, target ? target.id : undefined));
  }
  function remove(id: string | null = selected) {
    if (!id) return;
    apply((d) => removeClip(d, id));
    setSelected(null);
  }
  async function importMedia(files: File[]) {
    const key = epoch.current, failures: string[] = [];
    let added = 0;
    p.setError("");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setIo(`正在导入 ${f.name}（${i + 1}/${files.length}）…`);
      try {
        const asset = await importFile(f, (r) => setIo(`正在上传 ${f.name} ${Math.round(r * 100)}%`));
        if (key !== epoch.current) return;
        apply((d) => addAsset(d, asset));
        added++;
      } catch (e) {
        failures.push(`${f.name}：${e instanceof Error ? e.message : "导入失败"}`);
      }
    }
    setIo("");
    if (key !== epoch.current) return;
    if (failures.length) p.setError(failures.join("\n"));
    else p.setNotice(`已导入 ${added} 个素材，拖到时间线或点“＋”使用。`);
  }
  async function importSubtitles(file: File) {
    try {
      const cues = parseSubtitles(await file.text());
      const track = t.tracks.find((k) => k.kind === "text" && k.name.includes("字幕")) ?? t.tracks.find((k) => k.kind === "text");
      apply((d) => cues.reduce((acc, c) => addTextClip(acc, "subtitle", c.start, c.text, track?.id, c.end - c.start).timeline, d));
      p.setNotice(`已把 ${cues.length} 条字幕放到「${track?.name ?? "文字"}」轨。`);
    } catch (e) {
      p.report(e);
    }
  }
  // 删除可撤销，所以不弹确认框（嵌入页面里原生对话框可能被禁用）。
  function removeFromLibrary(asset: Asset) {
    const n = t.clips.filter((c) => c.assetId === asset.id).length;
    if (apply((d) => removeAsset(d, asset.id))) p.setNotice(`已从素材库移除「${asset.name}」${n ? `及时间线上的 ${n} 个片段` : ""}。按 ⌘/Ctrl+Z 可撤销。`);
  }

  async function importProject(file?: File) {
    if (!file || !flow.canLeave()) return;
    setIo("正在读取工程…");
    try {
      const v = await unpack(file, (r) => setIo(`正在导入工程素材 ${Math.round(r * 100)}%`));
      if (v.draft.pendingRender !== undefined) {
        if (!confirm("导入会创建编辑副本，不继续其中的 OpenMontage 制作任务；原任务保留在原工程。继续吗？")) return;
        v.draft.importedPendingRender = v.draft.pendingRender;
        delete v.draft.pendingRender;
      }
      if (await flow.replace(v.data, v.title, v.draft)) p.setNotice(v.recovery ? "已从恢复稿创建新的编辑副本。若提示素材缺失，请重新导入对应素材。" : "已导入为新的影片。");
    } catch (e) {
      p.report(e);
    } finally {
      setIo("");
    }
  }
  async function menu(a: MenuAction) {
    if (a === "blank" || a === "sample") {
      if (!flow.canLeave()) return;
      await flow.replace(a === "blank" ? emptyTimeline() : sampleTimeline(), a === "blank" ? "未命名影片" : SAMPLE_TITLE);
    } else if (a === "import") projectInput.current?.click();
    else if (a === "export") {
      setIo("正在打包工程与素材…");
      try {
        download(await pack(p.title, structuredClone(t), structuredClone(p.draft), (r) => setIo(`正在打包素材 ${Math.round(r * 100)}%`)), (p.title || "影片") + PROJECT_EXTENSION);
      } catch (e) {
        p.report(e);
      } finally {
        setIo("");
      }
    } else if (a === "srt") {
      const srt = timelineSrt(t);
      if (!srt) p.setNotice("字幕轨上还没有字幕。");
      else download(new Blob([srt], { type: "application/x-subrip" }), (p.title || "影片") + ".srt");
    } else if (a === "report") download(new Blob([report(p.title, t)], { type: "text/markdown" }), (p.title || "影片") + " · 剪辑单.md");
    else if (a === "recovery") p.exportDraft();
    else if (a === "json") setJsonOpen(true);
    else if (a === "delete") await p.remove();
  }

  const actions: InspectorActions = {
    patchClip: (id, patch, key) => apply((d) => patchClip(d, id, patch), key),
    patchTrack: (id, patch, key) => apply((d) => patchTrack(d, id, patch), key),
    patchTimeline: (patch, key) => apply((d) => ({ ...d, ...patch }), key),
    crossfade: (id, s) => apply((d) => crossfade(d, id, s)),
    split,
    duplicate: (id) => apply((d) => duplicateClip(d, id).timeline),
    remove: (id) => remove(id),
    removeTrack: (id) => {
      const n = t.clips.filter((c) => c.trackId === id).length;
      if (!apply((d) => removeTrack(d, id))) return;
      setSelectedTrack(null);
      p.setNotice(`已删除轨道${n ? `及其中 ${n} 个片段` : ""}。按 ⌘/Ctrl+Z 可撤销。`);
    },
  };

  function keys(e: KeyboardEvent) {
    if (e.defaultPrevented) return;
    if (editable(e.target) || !mutable) return;
    const mod = e.metaKey || e.ctrlKey;
    const frame = 1 / t.settings.fps;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      travel(e.shiftKey ? "redo" : "undo");
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      travel("redo");
    } else if (mod) return;
    else if (e.key === " " && !(e.target instanceof HTMLButtonElement) && !(e.target as HTMLElement).closest?.(".clip")) {
      e.preventDefault();
      player.toggle();
    } else if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      split();
    } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
      e.preventDefault();
      remove();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      player.seek(player.getTime() + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : frame));
    } else if (e.key === "Home") player.seek(0);
    else if (e.key === "End") player.seek(duration(t));
  }

  const keyRef = useRef(keys);
  keyRef.current = keys;
  // 快捷键只在本页面文档内生效，输入框、菜单和对话框中不拦截。
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);
  const h = history.current;
  const raw = typeof p.draft.json === "string" ? p.draft.json : JSON.stringify(t, null, 2);
  const save = p.autoState.phase;
  const numeric = p.draft.numericFields;
  const unapplied = typeof p.draft.json === "string" || (numeric && typeof numeric === "object" && Object.keys(numeric).length > 0);
  return (
    <div className={"app tab-" + tab}>
      <a className="skip" href="#timeline">
        跳到时间线
      </a>
      <header className="topbar">
        <FileMenu items={p.items} currentId={p.current?.id} disabled={!mutable || flow.busy} onAction={(a) => void menu(a)} onOpen={(id) => void flow.open(id)} />
        <input className="film-title" aria-label="影片名称" name="film" autoComplete="off" maxLength={120} value={p.title} disabled={!mutable} onChange={(e) => p.setTitle(e.target.value)} />
        <span className={"save-state " + save} role="status">
          {save === "saved" && unapplied ? "工作稿已自动保存，含未应用输入。" : p.autoState.message}
        </span>
        <span className="io" role="status">
          {io}
        </span>
        {save === "offline" || save === "conflict" ? (
          <span className="save-actions">
            <button onClick={() => void p.save()}>重试保存</button>
            {p.current ? <button onClick={() => void flow.open(p.current!.id)}>打开服务器版本</button> : null}
          </span>
        ) : null}
        <span className="history">
          <button className="icon" aria-label="撤销" disabled={!h.past.length || !mutable} onClick={() => travel("undo")}>
            <Undo2 aria-hidden="true" size={16} />
          </button>
          <button className="icon" aria-label="重做" disabled={!h.future.length || !mutable} onClick={() => travel("redo")}>
            <Redo2 aria-hidden="true" size={16} />
          </button>
        </span>
        <button className="primary export-button" onClick={() => setExportOpen(true)}>
          <Upload aria-hidden="true" size={15} />
          导出成片
        </button>
        <input
          hidden
          ref={projectInput}
          type="file"
          aria-label="导入工程文件"
          accept={PROJECT_EXTENSION + ",.json,application/json"}
          onChange={(e) => {
            void importProject(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>
      <Notice
        error={p.error}
        notice={p.notice}
        onDismiss={() => {
          p.setError("");
          p.setNotice("");
        }}
      />
      <Library timeline={t} mutable={mutable} progress="" onImport={(f) => void importMedia(f)} onSubtitles={(f) => void importSubtitles(f)} onAdd={(a) => placeAsset(a)} onRemove={removeFromLibrary} onText={addText} />
      <Monitor player={player} timeline={t} mediaError={mediaError} />
      <NumericDrafts scope={selected ?? ""} values={numeric} set={(key, value) => p.setDraft((d) => {
        const fields = d.numericFields && typeof d.numericFields === "object" && !Array.isArray(d.numericFields) ? { ...d.numericFields as Record<string, unknown> } : {};
        if (value === null) delete fields[key];
        else fields[key] = value;
        const next = { ...d };
        if (Object.keys(fields).length) next.numericFields = fields;
        else delete next.numericFields;
        return next;
      })}>
        <Inspector timeline={t} clipId={selected} trackId={selectedTrack} actions={actions} mutable={mutable} />
      </NumericDrafts>
      <nav className="tabs" aria-label="面板">
        {(
          [
            ["timeline", "时间线"],
            ["library", "素材"],
            ["inspector", "属性"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      <TimelineToolbar
        mutable={mutable}
        canDelete={!!selected}
        snapping={snapping}
        onSplit={split}
        onDelete={() => remove()}
        onSnap={() => setSnapping(!snapping)}
        onZoom={(f) => setZoom((z) => Math.max(6, Math.min(400, z * f)))}
        onFit={() => {
          const box = document.querySelector(".timeline");
          const head = document.querySelector<HTMLElement>(".tl-head")?.offsetWidth ?? 0;
          if (box) setZoom(Math.max(6, Math.min(400, (box.clientWidth - head - 24) / Math.max(5, duration(t) + 1))));
        }}
        onAddTrack={(kind) => apply((d) => addTrack(d, kind))}
      />
      <section id="timeline" className="timeline-area" aria-label="时间线">
        <TimelineView
          timeline={t}
          player={player}
          selected={selected}
          selectedTrack={selectedTrack}
          zoom={zoom}
          snapping={snapping}
          mutable={mutable}
          onSelect={select}
          onSelectTrack={(id) => {
            setSelectedTrack(id);
            setSelected(null);
          }}
          onPreview={(next) => {
            data.current = next;
            p.setData(next);
          }}
          onCommit={(base, next) => {
            data.current = base;
            commit(next, base);
          }}
          onDropAsset={(id, track, time) => {
            const asset = t.assets.find((a) => a.id === id);
            if (asset) placeAsset(asset, time, track);
          }}
          onToggleTrack={(id) => apply((d) => patchTrack(d, id, { muted: !d.tracks.find((k) => k.id === id)!.muted }))}
          onZoom={(f) => setZoom((z) => Math.max(6, Math.min(400, z * f)))}
        />
      </section>
      <ExportPanel
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        timeline={t}
        title={p.title}
        exporting={exp.exporting}
        progress={exp.progress}
        lastError={exp.error}
        onExport={(o) => void exp.run(o)}
        onCancel={exp.cancel}
        onRemoveOutput={(o) => p.setData((d) => ({ ...d, outputs: d.outputs.filter((x) => x !== o) }))}
        onReuse={(o) =>
          apply((d) => addAsset(d, assetValue({ id: o.id, name: o.name, kind: "video", mime: o.mime, bytes: o.bytes, duration: o.duration, width: o.width, height: o.height, hasAudio: true, sample: false })))
        }
        service={flow.status}
        jobs={flow.jobs}
        servicePending={flow.pending}
        serviceBusy={flow.busy}
        onCheckService={() => void flow.check()}
        onServiceRender={() => void flow.run()}
        onServiceVideo={(id) => void flow.video(id)}
        onServiceCancel={(id) => void flow.cancel(id)}
        mutable={mutable}
      />
      <JsonDialog
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        raw={raw}
        mutable={mutable}
        onDraft={(text) =>
          p.setDraft((d) => {
            const n = { ...d };
            if (text === null) delete n.json;
            else n.json = text;
            return n;
          })
        }
        onApply={(next) => commit(next)}
      />
    </div>
  );
}
