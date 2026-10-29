// ABOUTME: 导出成片：浏览器内 WebCodecs 编码（默认、无需服务）、成片架回看与下载、OpenMontage 服务高级渲染（可选）。
import { useEffect, useRef, useState } from "react";
import { Download, Film, RefreshCw, Server, Trash2, X } from "lucide-react";
import { formatBytes } from "../contracts/media";
import { servicePlan } from "../contracts/service-plan";
import { duration, timecode, type OutputRecord, type Timeline } from "../contracts/timeline";
import type { RenderJob } from "../contracts/render-state";
import type { RendererStatus } from "./useProduction";
import { mediaUrl } from "./engine/player";
import { webCodecsAvailable, type ExportOptions } from "./engine/export";

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
export function sizes(t: Timeline) {
  const { width: w, height: h } = t.settings;
  const short = Math.min(w, h);
  const list = [{ label: `项目尺寸 ${w}×${h}`, width: w, height: h }];
  for (const target of [720, 480]) {
    if (target >= short) continue;
    const k = target / short;
    list.push({ label: `${target}p · ${even(w * k)}×${even(h * k)}`, width: even(w * k), height: even(h * k) });
  }
  return list;
}
const JOB_LABEL: Record<string, string> = {
  submitting: "正在提交",
  queued: "排队中",
  running: "正在裁切与拼接",
  completed: "已完成",
  failed: "失败",
  unknown: "提交待核对",
  interrupted: "中断",
  cancelled: "已取消",
};

export function ExportPanel({
  open,
  onClose,
  timeline,
  title,
  exporting,
  progress,
  lastError,
  onExport,
  onCancel,
  onRemoveOutput,
  onReuse,
  service,
  jobs,
  servicePending,
  serviceBusy,
  onCheckService,
  onServiceRender,
  onServiceVideo,
  onServiceCancel,
  mutable,
}: {
  open: boolean;
  onClose: () => void;
  timeline: Timeline;
  title: string;
  exporting: boolean;
  progress: { ratio: number; message: string } | null;
  lastError: string;
  onExport: (o: ExportOptions) => void;
  onCancel: () => void;
  onRemoveOutput: (o: OutputRecord) => void;
  onReuse: (o: OutputRecord) => void;
  service: RendererStatus;
  jobs: RenderJob[];
  servicePending: boolean;
  serviceBusy: boolean;
  onCheckService: () => void;
  onServiceRender: () => void;
  onServiceVideo: (id: string) => void;
  onServiceCancel: (id: string) => void;
  mutable: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState(0);
  const [quality, setQuality] = useState<ExportOptions["quality"]>("high");
  const [watch, setWatch] = useState<string | null>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const choices = sizes(timeline);
  const pick = choices[Math.min(size, choices.length - 1)];
  const total = duration(timeline);
  const plan = servicePlan(timeline);
  const supported = webCodecsAvailable();
  return (
    <dialog ref={dialog} className="export" aria-labelledby="export-title" onClose={onClose} onCancel={(e) => { if (exporting) e.preventDefault(); }}>
      <header>
        <h2 id="export-title">导出成片</h2>
        <button className="icon" aria-label="关闭" onClick={onClose} disabled={exporting}>
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      <section className="export-local">
        <h3>
          <Film aria-hidden="true" size={15} />
          在本机导出
        </h3>
        <p className="hint">导出全部画面、转场、文字、字幕和声音。不需要外部服务，素材保留在本机。</p>
        <div className="field-row">
          <label className="field">
            分辨率
            <select value={size} disabled={exporting} onChange={(e) => setSize(Number(e.target.value))}>
              {choices.map((c, i) => (
                <option key={c.label} value={i}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            质量
            <select value={quality} disabled={exporting} onChange={(e) => setQuality(e.target.value as ExportOptions["quality"])}>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">小文件</option>
            </select>
          </label>
        </div>
        <p className="readout">
          {timecode(total, timeline.settings.fps)} · {timeline.settings.fps} fps · 优先 MP4（H.264 + AAC），本机不支持时改用 WebM
        </p>
        {!supported ? (
          <p className="notice error" role="alert">
            当前浏览器不支持 WebCodecs，无法在本机编码。请用 Chrome 或 Edge 116 以上版本打开，或使用下方 OpenMontage 服务。
          </p>
        ) : null}
        {exporting && progress ? (
          <div className="export-progress">
            <progress max={1} value={progress.ratio} aria-label="导出进度" />
            <span role="status">
              {progress.message} {Math.round(progress.ratio * 100)}%
            </span>
            <button onClick={onCancel}>取消导出</button>
          </div>
        ) : (
          <button className="primary" disabled={!mutable || !supported || total <= 0} onClick={() => onExport({ width: pick.width, height: pick.height, fps: timeline.settings.fps, quality })}>
            导出「{title}」
          </button>
        )}
        {total <= 0 ? <small className="hint">时间线为空，先放入素材。</small> : null}
        {lastError ? (
          <p className="notice error" role="alert">
            {lastError}
          </p>
        ) : null}
      </section>
      <section className="shelf" aria-label="成片架">
        <h3>成片架</h3>
        {timeline.outputs.length === 0 ? <p className="empty">导出的成片会保存在这里，可回看、下载，或放回素材库继续剪。</p> : null}
        <ul>
          {timeline.outputs.map((o) => (
            <li key={o.id + o.createdAt}>
              <div>
                <strong>{o.name}</strong>
                <small>
                  {new Date(o.createdAt).toLocaleString()} · {o.width}×{o.height} · {o.duration.toFixed(1)} 秒 · {formatBytes(o.bytes)} · {o.engine === "browser" ? "本机导出" : "OpenMontage"}
                </small>
              </div>
              <span className="shelf-actions">
                <button onClick={() => setWatch(watch === o.id ? null : o.id)} aria-expanded={watch === o.id}>
                  {watch === o.id ? "收起" : "回看"}
                </button>
                <a className="button" href={mediaUrl(o.id) + "?download=" + encodeURIComponent(o.name)} download={o.name}>
                  <Download aria-hidden="true" size={14} />
                  下载
                </a>
                <button disabled={!mutable || timeline.assets.some((a) => a.id === o.id)} onClick={() => onReuse(o)}>
                  {timeline.assets.some((a) => a.id === o.id) ? "已在素材库" : "放入素材库"}
                </button>
                <button className="icon quiet" aria-label={"从成片架移除 " + o.name} disabled={!mutable} onClick={() => { if (confirm(`从成片架移除「${o.name}」？`)) onRemoveOutput(o); }}>
                  <Trash2 aria-hidden="true" size={13} />
                </button>
              </span>
              {watch === o.id ? <video className="shelf-video" src={mediaUrl(o.id)} controls aria-label={"回看 " + o.name} /> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="service" aria-label="OpenMontage 服务">
        <h3>
          <Server aria-hidden="true" size={15} />
          OpenMontage 服务渲染 <small>可选</small>
        </h3>
        <p className={"service-state " + service.state} role="status">
          <span className="dot" aria-hidden="true" />
          <span className="service-message">{service.message}</span>
          <button onClick={onCheckService}>
            <RefreshCw aria-hidden="true" size={13} />
            重新检查
          </button>
        </p>
        <p className="hint">用固定版本的 OpenMontage VideoTrimmer / VideoStitch（Python + FFmpeg）按主画面轨裁切、统一为 720p/24fps 并硬切拼接。适合需要上游工具链核对的交付；文字、转场、其他轨道请用本机导出。</p>
        {service.state !== "ready" && service.command ? (
          <div className="command">
            <span>在完整仓库里启动服务（需 Node 22、Python 3.10+、Git、FFmpeg）：</span>
            <code>{service.command}</code>
            <small>默认地址 {service.url}；工作台用 OPENMONTAGE_SERVICE_URL 指定其他地址。</small>
          </div>
        ) : null}
        {plan.montage ? (
          <p className="readout">主画面轨 {plan.montage.shots.length} 段 MP4 可交给服务。{plan.omitted.length ? "不含：" + plan.omitted.join("、") + "。" : ""}</p>
        ) : (
          <p className="readout warn">{plan.reason}</p>
        )}
        {service.available && plan.montage ? (
          <button disabled={!mutable || serviceBusy} onClick={onServiceRender}>
            {serviceBusy ? "正在提交…" : servicePending ? "核对同一任务" : "用 OpenMontage 渲染"}
          </button>
        ) : null}
        {servicePending ? <p role="status">任务编号和输入快照已保留，核对不会重复制作。</p> : null}
        {jobs.length ? (
          <ul className="jobs">
            {jobs.map((j) => (
              <li key={j.id}>
                <strong>{JOB_LABEL[j.state] ?? j.state}</strong>
                <time>{new Date(j.createdAt).toLocaleString()}</time>
                {j.error ? <small role="alert">{j.error}</small> : null}
                {j.state === "completed" ? <button onClick={() => onServiceVideo(j.id)}>下载 MP4</button> : null}
                {["queued", "running"].includes(j.state) ? <button onClick={() => onServiceCancel(j.id)}>取消</button> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </dialog>
  );
}
