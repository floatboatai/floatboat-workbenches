import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  FolderOpen,
  Download,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Cpu,
  AlertTriangle,
  X,
  CheckCircle2,
  CircleDashed,
  BadgeCheck,
} from "lucide-react";
import { useWorkbenchState } from "./autosave-client";
import { request, download } from "./requests";
import { designValue, viewValue, type View } from "../contracts/design";
import { isRecord } from "../contracts/project";
import {
  MAX_FILE_BYTES,
  base64ToBytes,
  bytesToBase64,
  descendants,
  outline,
  readArchive,
  readFile,
  type DevStatus,
  type EditAction,
  type FigDocument,
} from "../contracts/figdoc";
import { handoffMarkdown, STATUS_LABEL } from "../contracts/handoff";
import { FrameRender, FrameThumb, ProofStage, type Overrides } from "./ProofCanvas";
import { frameToSvg, svgToPng } from "./svg-export";
import { EngineCard, parseEngine, type EngineState } from "./EngineCard";
import { ProofFiles } from "./ProofFiles";
import { ReviewPanel, type Tab } from "./ReviewPanel";
import initial from "../contracts/seed.json";

const seed = designValue(initial);
const DEFAULT_TITLE = "Calm Studio · Ridgeline 移动端校样";
const NO_OVERRIDES: Overrides = { texts: {}, fills: {} };
const strings = (v: unknown): Record<string, string> => {
  if (!isRecord(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) if (/^\d{1,12}$/.test(k) && typeof x === "string") out[k] = x;
  return out;
};
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || "校样";
const statusOf = (e: unknown) => (isRecord(e) && typeof e.status === "number" ? e.status : 0);
const message = (e: unknown, fallback: string) =>
  e instanceof TypeError ? "无法连接工作台服务，请确认预览仍在运行后重试。" : e instanceof Error ? e.message : fallback;
function blob(data: string, type: string) {
  return new Blob([base64ToBytes(data) as BlobPart], { type });
}
function withDraftKey(d: Record<string, unknown>, key: string, id: number, value: string | undefined) {
  const map = strings(d[key]);
  if (value === undefined) delete map[id];
  else map[id] = value;
  return { ...d, [key]: map };
}
async function renderForExport(doc: FigDocument, frameId: number): Promise<string> {
  const frame = doc.nodes[String(frameId)];
  const host = document.createElement("div");
  host.className = "export-host";
  const inner = document.createElement("div");
  inner.dataset.scale = "1";
  host.append(inner);
  document.body.append(host);
  const root = createRoot(inner);
  try {
    flushSync(() => root.render(<FrameRender doc={doc} frame={frame} overrides={NO_OVERRIDES} />));
    await document.fonts?.ready;
    return frameToSvg(inner, doc, frame, NO_OVERRIDES);
  } finally {
    root.unmount();
    host.remove();
  }
}

/** 浮层：Escape 或点击外部关闭，并把焦点还给触发按钮。 */
function usePopover(open: boolean, close: () => void, trigger: RefObject<HTMLElement | null>, box: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      trigger.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || trigger.current?.contains(t)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
}

export function App() {
  const p = useWorkbenchState(seed, designValue, DEFAULT_TITLE, { storageKey: "figcraft-review-v1" });
  const latest = useRef(p);
  latest.current = p;
  const parsed = useMemo(() => {
    try {
      return { doc: readFile(p.data.file).doc, error: "" };
    } catch (e) {
      return { doc: null, error: message(e, "无法读取设计文件。") };
    }
  }, [p.data.file]);
  const doc = parsed.doc;
  const info = useMemo(() => (doc ? outline(doc) : null), [doc]);
  const d = p.draft;
  const texts = strings(d.texts),
    names = strings(d.frameNames),
    fills = strings(d.fills);
  const frameInfo = info?.frames.find((f) => f.id === d.frameId) ?? info?.frames[0] ?? null;
  const frame = doc && frameInfo ? doc.nodes[String(frameInfo.id)] : null;
  const frameNodes = useMemo(() => (doc && frame ? descendants(doc, frame) : []), [doc, frame]);
  const layer = typeof d.layerId === "number" ? (frameNodes.find((n) => n.id === d.layerId) ?? null) : null;
  const tab: Tab = d.tab === "layers" || d.tab === "handoff" ? d.tab : "copy";
  const [engine, setEngine] = useState<EngineState>({ phase: "checking", message: "", service: "127.0.0.1:8796", engine: "", checkedAt: "" });
  const [view, setView] = useState<"proof" | "native">("proof");
  const [native, setNative] = useState<{ key: string; view: View } | { key: string; error: string } | null>(null);
  const [busy, setBusy] = useState("");
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<"fit" | 1>("fit");
  const [filesOpen, setFilesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [engineOpen, setEngineOpen] = useState(false);
  const [focusText, setFocusText] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const transitionRef = useRef(false);
  const stageRoot = useRef<HTMLDivElement>(null);
  const designInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null),
    exportButton = useRef<HTMLButtonElement>(null),
    engineButton = useRef<HTMLButtonElement>(null),
    filesButton = useRef<HTMLButtonElement>(null);
  const exportBox = useRef<HTMLDivElement>(null),
    engineBox = useRef<HTMLDivElement>(null);
  usePopover(exportOpen, () => setExportOpen(false), exportButton, exportBox);
  usePopover(engineOpen, () => setEngineOpen(false), engineButton, engineBox);
  const locked = p.loading || p.busy || transitioning;
  const disabled = locked || Boolean(busy);

  useEffect(() => {
    document.title = "原型校样 · FigCraft";
  }, []);
  async function checkEngine() {
    setEngine((e) => ({ ...e, phase: "checking" }));
    try {
      setEngine(parseEngine(await request("/api/engine-status")));
    } catch (e) {
      setEngine((x) => ({ ...x, phase: "missing", message: message(e, "无法检查引擎。"), checkedAt: new Date().toISOString() }));
    }
  }
  useEffect(() => {
    void checkEngine();
  }, []);
  useEffect(() => {
    if (engine.phase === "missing" && view === "native") setView("proof");
  }, [engine.phase, view]);
  useEffect(() => {
    setError("");
    setFocusText(null);
  }, [p.documentKey]);

  const nativeKey = frameInfo ? `${p.documentKey}:${frameInfo.id}:${p.data.file.length}:${p.data.file.slice(-48)}` : "";
  useEffect(() => {
    if (view !== "native" || engine.phase !== "ready" || !frameInfo || native?.key === nativeKey) return;
    let cancelled = false;
    request("/api/engine", { method: "POST", body: JSON.stringify({ file: p.data.file, frameId: frameInfo.id }) })
      .then((raw) => {
        if (!cancelled) setNative({ key: nativeKey, view: viewValue(raw) });
      })
      .catch((e) => {
        if (cancelled) return;
        if (statusOf(e) === 503) {
          setEngine((x) => ({ ...x, phase: "missing", message: message(e, "引擎不可用。"), checkedAt: new Date().toISOString() }));
          setView("proof");
        } else setNative({ key: nativeKey, error: message(e, "原生渲染失败。") });
      });
    return () => {
      cancelled = true;
    };
  }, [view, engine.phase, nativeKey]);

  async function transition(action: () => Promise<unknown>) {
    if (transitionRef.current) return false;
    transitionRef.current = true;
    setTransitioning(true);
    try {
      const ok = await action();
      return ok !== false;
    } catch (e) {
      p.report(e);
      return false;
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  function setDraftKey(key: string, id: number, value: string | undefined) {
    if (transitionRef.current) return;
    p.setDraft((x) => withDraftKey(x, key, id, value));
  }
  function select(id: number) {
    p.setDraft((x) => (x.layerId === id ? x : { ...x, layerId: id }));
  }
  function chooseFrame(id: number) {
    if (transitionRef.current) return;
    p.setDraft((x) => ({ ...x, frameId: id, layerId: undefined }));
    p.setNotice("");
    setNative(null);
  }
  async function runEdit(actions: EditAction[], label: string, clear?: (x: Record<string, unknown>) => Record<string, unknown>) {
    if (busyRef.current || !frameInfo) return;
    const source = p.data.file,
      key = p.documentKey;
    busyRef.current = true;
    setBusy(label);
    setError("");
    p.setNotice("");
    try {
      let next: string | null = null,
        note = "";
      const single = actions.length === 1 && actions[0].kind !== "move" ? actions[0] : null;
      if (single && engine.phase === "ready") {
        try {
          const v = viewValue(
            await request("/api/engine", { method: "POST", body: JSON.stringify({ file: source, frameId: frameInfo.id, action: single }) }),
          );
          next = v.file;
          note = "（原生引擎）";
        } catch (e) {
          if (statusOf(e) !== 503) throw e;
          setEngine((x) => ({ ...x, phase: "missing", message: message(e, "引擎不可用。"), checkedAt: new Date().toISOString() }));
          note = "（原生引擎已断开，改用内置写入）";
        }
      }
      if (next === null) {
        const r = await request("/api/design/edit", { method: "POST", body: JSON.stringify({ file: source, actions }) });
        if (!isRecord(r) || typeof r.file !== "string") throw new Error("写入结果无效。");
        next = r.file;
      }
      if (latest.current.documentKey !== key || latest.current.data.file !== source) {
        setError("写入期间设计已变化，本次修改未采用，请重试。");
        return;
      }
      const file = next;
      p.setData((x) => ({ ...x, file }));
      if (clear) p.setDraft(clear);
      p.setNotice(`${label}已写入设计文件${note}。`);
    } catch (e) {
      if (latest.current.documentKey === key) setError(message(e, "修改未完成，原稿和草稿仍在。"));
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  const clearIf = (key: string, id: number, value: string) => (x: Record<string, unknown>) => {
    const map = strings(x[key]);
    return map[id] === value ? withDraftKey(x, key, id, undefined) : x;
  };
  function applyText(id: number) {
    const value = texts[id];
    if (value === undefined) return;
    void runEdit([{ kind: "text", id, text: value }], "文案", clearIf("texts", id, value));
  }
  function applyAllTexts() {
    const pending = frameNodes.filter((n) => n.type === "text" && texts[n.id] !== undefined && texts[n.id] !== n.characters);
    if (!pending.length) return;
    const snapshot = Object.fromEntries(pending.map((n) => [n.id, texts[n.id]]));
    void runEdit(
      pending.map((n) => ({ kind: "text", id: n.id, text: texts[n.id] })),
      `${pending.length} 条文案`,
      (x) => {
        const map = strings(x.texts);
        for (const [id, v] of Object.entries(snapshot)) if (map[id] === v) delete map[id];
        return { ...x, texts: map };
      },
    );
  }
  function applyName(id: number) {
    const value = names[id]?.trim();
    if (!value) return;
    void runEdit([{ kind: "rename", id, name: value }], "名称", clearIf("frameNames", id, names[id]));
  }
  function applyFill(id: number) {
    const value = fills[id];
    if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return;
    void runEdit([{ kind: "fill", id, color: value }], "填色", clearIf("fills", id, value));
  }
  function setStatus(status: DevStatus) {
    if (!frameInfo) return;
    void runEdit([{ kind: "status", id: frameInfo.id, status }], `交付状态（${STATUS_LABEL[status]}）`);
  }
  function move(offset: -1 | 1) {
    if (!frameInfo) return;
    void runEdit([{ kind: "move", id: frameInfo.id, offset }], "画板顺序");
  }

  async function openDesign(f: File) {
    if (f.size > MAX_FILE_BYTES)
      throw new Error(`“${f.name}” 有 ${(f.size / 1e6).toFixed(2)} MB，超过单次保存上限 ${(MAX_FILE_BYTES / 1e6).toFixed(2)} MB。请在 FigCraft 中拆分页面或压缩图片后导入。`);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const archive = readArchive(bytes);
    const file = bytesToBase64(bytes);
    await request("/api/design/inspect", { method: "POST", body: JSON.stringify({ file }) });
    const title = (archive.doc.name && archive.doc.name !== "未命名设计" ? archive.doc.name : f.name.replace(/\.[^.]+$/, "")).slice(0, 120);
    const ok = await p.replace({ file, notes: {} }, title, {});
    if (ok) {
      setFilesOpen(false);
      p.setNotice(`已打开 ${f.name}，作为新校样保存。`);
    }
    return ok;
  }
  async function importProject(text: string, fallbackTitle: string) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("工程 JSON 无法解析，草稿已保留。");
    }
    if (!isRecord(raw)) throw new Error("工程格式无效。");
    const s = isRecord(raw.snapshot) ? raw.snapshot : raw;
    const data = designValue(s.data);
    readFile(data.file);
    const extra = isRecord(s.extra) ? { ...s.extra } : {};
    delete extra.json;
    const ok = await p.replace(data, typeof s.title === "string" && s.title.trim() ? s.title.slice(0, 120) : fallbackTitle, extra);
    if (ok) {
      setFilesOpen(false);
      p.setNotice("已导入为新校样。");
    }
    return ok;
  }
  async function exportAs(format: "svg" | "png" | "native-png" | "native-pdf" | "md" | "figcraft") {
    if (!doc || !frameInfo) return;
    setExportOpen(false);
    const base = safeName(`${p.title} - ${frameInfo.name}`);
    try {
      if (format === "figcraft") return download(blob(p.data.file, "application/zip"), safeName(p.title) + ".figcraft");
      if (format === "md")
        return download(
          new Blob([handoffMarkdown(doc, p.data.notes, p.title, new Date())], { type: "text/markdown;charset=utf-8" }),
          safeName(p.title) + " 交付说明.md",
        );
      if (format === "svg" || format === "png") {
        setBusy("导出");
        busyRef.current = true;
        const svg = await renderForExport(doc, frameInfo.id);
        if (format === "svg") download(new Blob([svg], { type: "image/svg+xml" }), base + " 近似校样.svg");
        else {
          const pngBlob = await svgToPng(svg, 2);
          download(pngBlob, base + " 近似校样@2x.png");
        }
        p.setNotice(`已导出近似校样 ${format.toUpperCase()}。`);
        return;
      }
      if (engine.phase !== "ready") {
        setEngineOpen(true);
        return;
      }
      setBusy("原生导出");
      busyRef.current = true;
      const kind = format === "native-png" ? "png" : "pdf";
      const result = viewValue(
        await request("/api/engine", { method: "POST", body: JSON.stringify({ file: p.data.file, frameId: frameInfo.id, export: kind }) }),
      );
      if (result.artifact) download(blob(result.artifact.data, kind === "png" ? "image/png" : "application/pdf"), base + "." + kind);
    } catch (e) {
      if (statusOf(e) === 503) {
        setEngine((x) => ({ ...x, phase: "missing", message: message(e, "引擎不可用。"), checkedAt: new Date().toISOString() }));
        setEngineOpen(true);
      } else setError(message(e, "导出失败。"));
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }

  const json =
    typeof d.json === "string"
      ? d.json
      : JSON.stringify({ title: p.title, data: p.data, extra: { ...d, json: undefined } }, null, 2);
  const overrides: Overrides = useMemo(() => ({ texts, fills: Object.fromEntries(Object.entries(fills).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v))) }), [d.texts, d.fills]);
  const framesByPage = info?.pages.filter((pg) => pg.frames.length) ?? [];
  const pendingFor = (id: number) => {
    if (!doc) return 0;
    const node = doc.nodes[String(id)];
    if (!node) return 0;
    return descendants(doc, node).filter(
      (n) => (texts[n.id] !== undefined && texts[n.id] !== n.characters) || fills[n.id] !== undefined || (names[n.id] !== undefined && names[n.id] !== n.name),
    ).length;
  };
  const nativeView = native && native.key === nativeKey ? native : null;
  const saveTone = ["draft", "offline", "conflict"].includes(p.autoState.phase) ? "warn" : p.autoState.phase;
  const pageIndex = frameInfo ? (info?.pages.find((pg) => pg.id === frameInfo.pageId)?.frames ?? []) : [];
  const posInPage = frameInfo ? pageIndex.indexOf(frameInfo.id) : -1;

  return (
    <div className="proof-app">
      <a className="skip" href="#proof-stage">
        跳到画板
      </a>
      <header className="topbar">
        <button
          type="button"
          className="files-button"
          ref={filesButton}
          aria-haspopup="dialog"
          aria-expanded={filesOpen}
          onClick={() => setFilesOpen(true)}
        >
          <FolderOpen size={16} aria-hidden="true" />
          校样文件
        </button>
        <input
          className="title-input"
          aria-label="校样名称"
          name="title"
          autoComplete="off"
          value={p.title}
          disabled={locked}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <div className="topbar-right">
          <span className={"save-state " + saveTone} role="status">
            {p.autoState.message}
          </span>
          {["draft", "offline", "conflict"].includes(p.autoState.phase) ? (
            <span className="save-actions">
              <button type="button" className="small" disabled={locked} onClick={() => void p.save()}>
                重试保存
              </button>
              <button type="button" className="small" onClick={p.exportDraft}>
                下载恢复稿
              </button>
              {p.current ? (
                <button type="button" className="small" disabled={locked} onClick={() => void transition(() => p.open(p.current!.id))}>
                  打开服务器版本
                </button>
              ) : null}
            </span>
          ) : null}
          <button
            type="button"
            ref={engineButton}
            className={"engine-pill " + engine.phase}
            aria-expanded={engineOpen}
            onClick={() => setEngineOpen((x) => !x)}
          >
            <Cpu size={14} aria-hidden="true" />
            {engine.phase === "ready" ? "原生引擎" : engine.phase === "checking" ? "检查引擎…" : "内置校样"}
          </button>
        </div>
      </header>
      {engineOpen ? (
        <div className="popover engine-popover" role="dialog" aria-label="原生引擎" ref={engineBox}>
          <button type="button" className="icon-button close" aria-label="关闭引擎状态" onClick={() => { setEngineOpen(false); engineButton.current?.focus(); }}>
            <X size={16} />
          </button>
          <EngineCard state={engine} onRecheck={() => void checkEngine()} />
        </div>
      ) : null}
      {p.error || error || parsed.error ? (
        <div className="alert" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{parsed.error ? `设计文件无法读取：${parsed.error} 可在“校样文件”中下载恢复稿或打开示例。` : p.error || error}</span>
          {!parsed.error ? (
            <button type="button" className="icon-button" aria-label="关闭提示" onClick={() => { setError(""); p.setError(""); }}>
              <X size={15} />
            </button>
          ) : null}
        </div>
      ) : p.notice ? (
        <p className="notice" role="status">
          {p.notice}
        </p>
      ) : null}
      <main className="proof-room">
        <nav className="filmstrip" aria-label="画板顺序">
          {p.loading ? <p className="film-empty">正在打开校样…</p> : null}
          {framesByPage.map((pg) => (
            <section key={pg.id} className="film-page">
              <h2>
                {doc?.nodes[String(pg.id)]?.name ?? "页面"} <span>{pg.frames.length}</span>
              </h2>
              <ol>
                {pg.frames.map((id, index) => {
                  const f = info!.frames.find((x) => x.id === id)!;
                  const node = doc!.nodes[String(id)];
                  const pending = pendingFor(id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="film-item"
                        aria-current={frameInfo?.id === id ? "true" : undefined}
                        disabled={locked}
                        onClick={() => chooseFrame(id)}
                      >
                        {info!.frames.length <= 40 ? <FrameThumb doc={doc!} frame={node} width={56} /> : null}
                        <span className="film-text">
                          <span className="film-num">{String(index + 1).padStart(2, "0")}</span>
                          <strong>{f.name}</strong>
                          <small>
                            {Math.round(f.width)} × {Math.round(f.height)}
                          </small>
                          <span className="film-badges">
                            <span className={"status-chip " + f.status + (f.changed ? " changed" : "")}>
                              {f.changed ? "已变更" : STATUS_LABEL[f.status]}
                            </span>
                            {p.data.notes[id]?.trim() ? <span className="mini">备注</span> : null}
                            {pending ? <span className="mini warn">{pending} 未应用</span> : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {frameInfo && pageIndex.length > 1 ? (
            <div className="film-order" aria-label="调整当前画板顺序">
              <button type="button" className="small" disabled={disabled || posInPage <= 0} onClick={() => move(-1)}>
                <ChevronUp size={14} aria-hidden="true" />
                上移
              </button>
              <button type="button" className="small" disabled={disabled || posInPage >= pageIndex.length - 1} onClick={() => move(1)}>
                <ChevronDown size={14} aria-hidden="true" />
                下移
              </button>
            </div>
          ) : null}
        </nav>
        <section className="stage" id="proof-stage" aria-label="画板舞台" tabIndex={-1}>
          <div className="stage-bar">
            <div className="stage-title">
              <h1>{frameInfo?.name ?? "设计校样"}</h1>
              <span>
                {frameInfo ? `${Math.round(frameInfo.width)} × ${Math.round(frameInfo.height)}` : ""}
                {info ? ` · ${info.name}` : ""}
              </span>
            </div>
            {frameInfo ? (
              <div className="status-switch" role="group" aria-label="交付状态">
                {(["none", "readyForDev", "completed"] as DevStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={frameInfo.status === s && !(s === "readyForDev" && frameInfo.changed)}
                    className={"status-" + s}
                    disabled={disabled}
                    onClick={() => setStatus(s)}
                  >
                    {s === "none" ? <CircleDashed size={14} aria-hidden="true" /> : s === "readyForDev" ? <CheckCircle2 size={14} aria-hidden="true" /> : <BadgeCheck size={14} aria-hidden="true" />}
                    {s === "readyForDev" && frameInfo.changed ? "重新确认可交付" : STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="stage-tools">
              {engine.phase === "ready" ? (
                <div className="segmented" role="group" aria-label="渲染方式">
                  <button type="button" aria-pressed={view === "proof"} onClick={() => setView("proof")}>
                    近似
                  </button>
                  <button type="button" aria-pressed={view === "native"} onClick={() => setView("native")}>
                    原生
                  </button>
                </div>
              ) : null}
              <button type="button" className="small" aria-pressed={zoom === 1} onClick={() => setZoom((z) => (z === "fit" ? 1 : "fit"))}>
                <Maximize2 size={14} aria-hidden="true" />
                {zoom === "fit" ? "适配" : "100%"}
              </button>
              <div className="export-wrap">
                <button
                  type="button"
                  className="primary"
                  ref={exportButton}
                  aria-expanded={exportOpen}
                  aria-haspopup="true"
                  disabled={!doc || !frameInfo || Boolean(busy)}
                  onClick={() => setExportOpen((x) => !x)}
                >
                  <Download size={15} aria-hidden="true" />
                  {busy === "导出" || busy === "原生导出" ? "导出中…" : "导出"}
                </button>
                {exportOpen ? (
                  <div className="popover export-menu" role="dialog" aria-label="导出" ref={exportBox}>
                    <p className="menu-label">当前画板 · 内置近似渲染</p>
                    <button type="button" autoFocus onClick={() => void exportAs("svg")}>
                      SVG（矢量，近似校样）
                    </button>
                    <button type="button" onClick={() => void exportAs("png")}>
                      PNG 2×（近似校样）
                    </button>
                    <p className="menu-label">原生引擎</p>
                    <button type="button" disabled={engine.phase !== "ready"} onClick={() => void exportAs("native-png")}>
                      PNG（原生渲染）
                    </button>
                    <button type="button" disabled={engine.phase !== "ready"} onClick={() => void exportAs("native-pdf")}>
                      PDF（原生渲染）
                    </button>
                    {engine.phase !== "ready" ? <EngineCard state={engine} onRecheck={() => void checkEngine()} compact /> : null}
                    <p className="menu-label">整份校样</p>
                    <button type="button" onClick={() => void exportAs("md")}>
                      交付说明 .md
                    </button>
                    <button type="button" onClick={() => void exportAs("figcraft")}>
                      设计文件 .figcraft
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="stage-note">
            {view === "native" ? (
              <span className="badge native">原生引擎渲染 · {engine.engine || "FigCraft CLI"}</span>
            ) : (
              <span className="badge approx">近似校样 · 内置渲染，字体与效果为近似{engine.phase === "ready" ? "" : "；原生渲染需引擎"}</span>
            )}
            {busy && busy !== "导出" && busy !== "原生导出" ? <span className="busy">正在写入{busy}…</span> : null}
            <span className="hint">单击选择图层 · 双击文字直接改写</span>
          </div>
          {doc && frame ? (
            view === "native" ? (
              <div className="stage-viewport native-view">
                {nativeView && "view" in nativeView ? (
                  <img
                    src={"data:image/png;base64," + nativeView.view.image}
                    alt={`${frameInfo?.name ?? ""} 原生引擎渲染`}
                    width={nativeView.view.width}
                    height={nativeView.view.height}
                  />
                ) : nativeView && "error" in nativeView ? (
                  <p className="stage-empty" role="status">
                    原生渲染失败：{nativeView.error}（近似校样仍可用）
                  </p>
                ) : (
                  <p className="stage-empty" role="status">
                    正在原生渲染…
                  </p>
                )}
              </div>
            ) : (
              <ProofStage
                doc={doc}
                frame={frame}
                overrides={overrides}
                selected={layer?.id ?? null}
                zoom={zoom}
                rootRef={stageRoot}
                onSelect={(id) => select(id)}
                onOpenText={(id) => {
                  select(id);
                  p.setDraft((x) => ({ ...x, tab: "copy", layerId: id }));
                  setFocusText(id);
                }}
              />
            )
          ) : (
            <div className="stage-viewport">
              <p className="stage-empty">{p.loading ? "正在打开校样…" : "设计中没有可审阅的画板。"}</p>
            </div>
          )}
        </section>
        {doc && frame && info ? (
          <ReviewPanel
            tab={tab}
            onTab={(t) => p.setDraft((x) => ({ ...x, tab: t }))}
            doc={doc}
            info={info}
            frame={frame}
            layer={layer}
            texts={texts}
            names={names}
            fills={fills}
            note={p.data.notes[frame.id] ?? ""}
            notes={p.data.notes}
            disabled={disabled}
            editing={locked}
            focusText={focusText}
            onFocused={() => setFocusText(null)}
            onSelect={select}
            onText={(id, v) => setDraftKey("texts", id, v)}
            onName={(id, v) => setDraftKey("frameNames", id, v)}
            onFill={(id, v) => setDraftKey("fills", id, v)}
            onApplyText={applyText}
            onApplyAll={applyAllTexts}
            onApplyName={applyName}
            onApplyFill={applyFill}
            onNote={(v) => {
              if (transitionRef.current) return;
              const id = frame.id;
              p.setData((x) => {
                const notes = { ...x.notes };
                if (v) notes[id] = v;
                else delete notes[id];
                return { ...x, notes };
              });
            }}
            onHandoff={() => void exportAs("md")}
            onFrame={chooseFrame}
          />
        ) : (
          <aside className="review-panel" aria-label="复核" />
        )}
      </main>
      <ProofFiles
        open={filesOpen}
        busy={locked}
        items={p.items}
        currentId={p.current?.id}
        title={p.title}
        error={filesOpen ? p.error : ""}
        json={json}
        jsonOpen={d.jsonOpen === true}
        onClose={() => {
          setFilesOpen(false);
          p.setError("");
        }}
        onOpen={(id) =>
          void transition(async () => {
            const ok = await p.open(id);
            if (ok) setFilesOpen(false);
            return ok;
          })
        }
        onDesign={() => designInput.current?.click()}
        onProject={() => projectInput.current?.click()}
        onSample={() =>
          void transition(async () => {
            const ok = await p.replace(structuredClone(seed), DEFAULT_TITLE, {});
            if (ok) setFilesOpen(false);
            return ok;
          })
        }
        onDownloadDesign={() => void exportAs("figcraft")}
        onDownloadProject={p.exportDraft}
        onDelete={() =>
          void transition(async () => {
            const ok = await p.remove();
            if (ok) setFilesOpen(false);
            return ok;
          })
        }
        onJsonToggle={() => p.setDraft((x) => ({ ...x, jsonOpen: x.jsonOpen !== true }))}
        onJson={(v) => p.setDraft((x) => ({ ...x, json: v }))}
        onJsonApply={() => void transition(() => importProject(json, "导入的校样"))}
      />
      <input
        hidden
        type="file"
        ref={designInput}
        accept=".figcraft,application/zip"
        aria-label="打开 FigCraft 设计"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void transition(() => openDesign(f));
        }}
      />
      <input
        hidden
        type="file"
        ref={projectInput}
        accept=".json,application/json"
        aria-label="导入校样工程"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void transition(async () => importProject(await f.text(), f.name.replace(/\.[^.]+$/, "")));
        }}
      />
    </div>
  );
}
