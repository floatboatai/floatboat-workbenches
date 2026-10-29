// ABOUTME: 底部印样带与对比台：每次运行的产物、可复现参数、载入工作流、PNG/ZIP 下载。

import { useEffect, useMemo, useRef, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import { ChevronUp, Columns2, Download, FileArchive, History, ImageOff, Loader2, Trash2, TriangleAlert, X } from "lucide-react";
import { formatDuration, isFinished, type OutputMeta, type RunDetail, type RunLive, type RunSummary } from "../contracts/run";
import { api, blobToDataUrl } from "./api";
import { download } from "./requests";

const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
/** Object URL for a stored output, fetched once per id. */
export function outputUrl(id: string): Promise<string> {
  const hit = urlCache.get(id);
  if (hit) return Promise.resolve(hit);
  let job = pending.get(id);
  if (!job) {
    job = api.outputBlob(id).then(blobToDataUrl).then((u) => {
      urlCache.set(id, u);
      pending.delete(id);
      return u;
    });
    job.catch(() => pending.delete(id));
    pending.set(id, job);
  }
  return job;
}
export function useOutputUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(id ? (urlCache.get(id) ?? null) : null);
  useEffect(() => {
    if (!id) return setUrl(null);
    const hit = urlCache.get(id);
    if (hit) return setUrl(hit);
    let live = true;
    const job = outputUrl(id);
    job.then((u) => live && setUrl(u)).catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}

interface CellInfo {
  key: string;
  run: RunSummary;
  output: OutputMeta | null;
}
const isImage = (o: OutputMeta) => o.mime.startsWith("image/");
const time = (iso: string) => new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const STATUS: Record<string, string> = { queued: "排队", running: "运行", success: "完成", error: "出错", interrupted: "中断", cancelled: "取消" };

function Cell({ run, output, live, selected, picked, onSelect, onPick }: { run: RunSummary; output: OutputMeta | null; live?: RunLive; selected: boolean; picked: boolean; onSelect: () => void; onPick: () => void }) {
  const url = useOutputUrl(output && isImage(output) ? output.id : null);
  const active = !isFinished(run.status);
  return (
    <div className={`cell ${run.status}${selected ? " sel" : ""}${picked ? " picked" : ""}`}>
      <button type="button" className="thumb" onClick={onSelect} aria-label={`${run.title} ${time(run.createdAt)} ${STATUS[run.status]}`} aria-pressed={selected}>
        {url ? <img src={url} alt="" width={output?.width ?? 112} height={output?.height ?? 80} loading="lazy" /> : active ? <Loader2 size={20} className="spin" aria-hidden="true" /> : run.status === "error" ? <TriangleAlert size={20} aria-hidden="true" /> : <ImageOff size={20} aria-hidden="true" />}
        <span className={"badge " + run.status}>{STATUS[run.status]}{active && live?.progress ? ` ${Math.round((live.progress.value / Math.max(1, live.progress.max)) * 100)}%` : ""}</span>
      </button>
      {output && isImage(output) && (
        <label className="pick" title="加入对比（2–4 张）">
          <input type="checkbox" checked={picked} onChange={onPick} aria-label="加入对比" />
        </label>
      )}
      <span className="cap">{time(run.createdAt)}{run.facts.seeds[0] !== undefined ? ` · ${run.facts.seeds[0]}` : ""}</span>
    </div>
  );
}

function Facts({ run }: { run: RunSummary }) {
  const f = run.facts;
  const rows: [string, string][] = [
    ["状态", STATUS[run.status] + (run.error ? ` · ${run.error.message}` : "")],
    ["耗时", formatDuration(run.durationMs)],
    ["种子", f.seeds.join(", ") || "—"],
    ["模型", f.models.join(", ") || "—"],
    ["LoRA", f.loras.join(", ") || "—"],
    ["步数 / CFG", `${f.steps ?? "—"} / ${f.cfg ?? "—"}`],
    ["采样器", [f.sampler, f.scheduler].filter(Boolean).join(" / ") || "—"],
    ["重绘强度", f.denoise === null ? "—" : String(f.denoise)],
    ["尺寸", f.width ? `${f.width}×${f.height}` : "—"],
    ["正向", f.positive || "—"],
    ["反向", f.negative || "—"],
    ["服务", run.server],
  ];
  return (
    <dl className="facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd title={v}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompareCell({ run, output, other }: { run: RunSummary; output: OutputMeta; other: RunSummary[] }) {
  const url = useOutputUrl(output.id);
  const diff = (key: string, value: string) => other.some((o) => (factText(o, key) !== value));
  const rows: [string, string][] = [
    ["种子", factText(run, "seed")],
    ["步数", factText(run, "steps")],
    ["CFG", factText(run, "cfg")],
    ["采样器", factText(run, "sampler")],
    ["模型", factText(run, "model")],
    ["重绘强度", factText(run, "denoise")],
  ];
  return (
    <figure className="cmp-cell">
      {url ? <img src={url} alt={`${run.title} ${time(run.createdAt)}`} /> : <Loader2 className="spin" size={20} aria-hidden="true" />}
      <figcaption>
        <b>{time(run.createdAt)}</b>
        {rows.map(([k, v]) => (
          <span key={k} className={diff(k, v) ? "diff" : ""}>{k} {v}</span>
        ))}
      </figcaption>
    </figure>
  );
}
function factText(run: RunSummary, key: string): string {
  const f = run.facts;
  switch (key) {
    case "seed": case "种子": return f.seeds.join(",") || "—";
    case "steps": case "步数": return String(f.steps ?? "—");
    case "cfg": case "CFG": return String(f.cfg ?? "—");
    case "sampler": case "采样器": return [f.sampler, f.scheduler].filter(Boolean).join("/") || "—";
    case "model": case "模型": return f.models.join(",") || "—";
    case "denoise": case "重绘强度": return String(f.denoise ?? "—");
    default: return "—";
  }
}

export function Gallery({
  runs,
  lives,
  expanded,
  setExpanded,
  onLoadWorkflow,
  onDeleteRun,
  onError,
}: {
  runs: RunSummary[];
  lives: RunLive[];
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  onLoadWorkflow: (detail: RunDetail) => void;
  onDeleteRun: (run: RunSummary) => void;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const cells = useMemo<CellInfo[]>(
    () =>
      runs.flatMap<CellInfo>((run) => {
        const outs = run.outputs.filter(isImage);
        return outs.length ? outs.map((o) => ({ key: o.id, run, output: o })) : [{ key: run.id, run, output: null }];
      }),
    [runs],
  );
  const current = cells.find((c) => c.key === selected) ?? cells[0] ?? null;
  const pickedCells = picked.map((id) => cells.find((c) => c.key === id)).filter((c): c is NonNullable<typeof c> & { output: OutputMeta } => Boolean(c?.output));
  const previousRuns = useRef(runs.length);
  useEffect(() => {
    if (runs.length > previousRuns.current) setSelected(null);
    previousRuns.current = runs.length;
  }, [runs.length]);
  const bigUrl = useOutputUrl(current?.output ? current.output.id : null);

  async function downloadPng() {
    if (!current?.output) return;
    try {
      download(await api.outputBlob(current.output.id, true), current.output.filename);
    } catch (e) {
      onError(e instanceof Error ? e.message : "下载失败。");
    }
  }
  async function downloadZip() {
    if (!current) return;
    try {
      const detail = await api.runDetail(current.run.id);
      const files: Record<string, Uint8Array> = {
        "workflow.json": strToU8(JSON.stringify(detail.workflow, null, 2)),
        "prompt.json": strToU8(JSON.stringify(detail.prompt, null, 2)),
        "run.json": strToU8(JSON.stringify({ title: detail.title, status: detail.status, createdAt: detail.createdAt, durationMs: detail.durationMs, facts: detail.facts, server: detail.server }, null, 2)),
      };
      for (const o of detail.outputs) files[`images/${o.filename}`] = new Uint8Array(await (await api.outputBlob(o.id, true)).arrayBuffer());
      const zip = zipSync(files, { level: 0 });
      download(new Blob([zip.slice().buffer], { type: "application/zip" }), `${detail.title.replace(/[^\w一-龥.-]+/g, "_")}-${detail.id.slice(0, 8)}.zip`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "打包失败。");
    }
  }
  async function loadWorkflow() {
    if (!current) return;
    try {
      onLoadWorkflow(await api.runDetail(current.run.id));
    } catch (e) {
      onError(e instanceof Error ? e.message : "读取运行记录失败。");
    }
  }
  const togglePick = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : p.length >= 4 ? p : [...p, key]));

  return (
    <section className={"gallery" + (expanded ? " open" : "")} aria-label="运行结果印样">
      <header className="gallery-head">
        <History size={15} aria-hidden="true" />
        <strong>印样</strong>
        <span className="muted">{runs.length} 次运行</span>
        {picked.length >= 2 && (
          <button type="button" className="primary-soft small" onClick={() => { setComparing(true); setExpanded(true); }}>
            <Columns2 size={13} aria-hidden="true" />对比 {picked.length} 张
          </button>
        )}
        {picked.length > 0 && <button type="button" className="link" onClick={() => setPicked([])}>清除选择</button>}
        <button type="button" className="icon-btn push" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={expanded ? "收起详情" : "展开详情"}>
          <ChevronUp size={16} aria-hidden="true" className={expanded ? "flip" : ""} />
        </button>
      </header>
      <div className="strip" role="list">
        {!cells.length && <p className="muted empty">还没有运行记录。连接 ComfyUI 后点击“运行”，每次结果会排在这里。</p>}
        {cells.map((c) => (
          <div role="listitem" key={c.key}>
            <Cell run={c.run} output={c.output} live={lives.find((l) => l.runId === c.run.id)} selected={current?.key === c.key} picked={picked.includes(c.key)} onSelect={() => { setSelected(c.key); }} onPick={() => togglePick(c.key)} />
          </div>
        ))}
      </div>
      {expanded && (
        <div className="detail">
          {comparing && pickedCells.length >= 2 ? (
            <div className="compare">
              <div className="compare-head">
                <strong>对比 {pickedCells.length} 张</strong>
                <span className="muted">不同的参数以琥珀色标出</span>
                <button type="button" className="icon-btn push" onClick={() => setComparing(false)} aria-label="关闭对比"><X size={15} aria-hidden="true" /></button>
              </div>
              <div className={"cmp-grid n" + pickedCells.length}>
                {pickedCells.map((c) => (
                  <CompareCell key={c.key} run={c.run} output={c.output} other={pickedCells.filter((x) => x !== c).map((x) => x.run)} />
                ))}
              </div>
            </div>
          ) : current ? (
            <>
              <div className="big">{bigUrl ? <img src={bigUrl} alt={`${current.run.title} 的结果`} width={current.output?.width ?? 512} height={current.output?.height ?? 512} /> : <span className="muted">{current.run.error?.message ?? "暂无图像"}</span>}</div>
              <div className="info">
                <h4>{current.run.title} · {time(current.run.createdAt)}</h4>
                <Facts run={current.run} />
                <div className="actions">
                  <button type="button" className="primary-soft" onClick={loadWorkflow}><History size={14} aria-hidden="true" />载入这次的工作流</button>
                  <button type="button" className="ghost" disabled={!current.output} onClick={downloadPng}><Download size={14} aria-hidden="true" />PNG（含元数据）</button>
                  <button type="button" className="ghost" onClick={downloadZip}><FileArchive size={14} aria-hidden="true" />ZIP</button>
                  <button type="button" className="ghost danger" onClick={() => { if (confirm("删除这次运行记录及其图片？")) { onDeleteRun(current.run); setSelected(null); } }}><Trash2 size={14} aria-hidden="true" />删除记录</button>
                </div>
              </div>
            </>
          ) : (
            <p className="muted">运行后在这里查看大图、参数与复现入口。</p>
          )}
        </div>
      )}
    </section>
  );
}
