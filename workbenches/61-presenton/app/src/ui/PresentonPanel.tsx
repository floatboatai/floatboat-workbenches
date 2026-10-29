// ABOUTME: 可选的 Presenton 通道：生成按钮旁的状态胶囊与抽屉（启动方式、重新检查、制作设置、提交与制作记录）；保留“先持久化再提交、未知结果不自动重试”的契约。
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Server, X } from "lucide-react";
import { generationRequest, importDeck, type Settings } from "../contracts/deck";
import { jobValue, states, type Job } from "../contracts/jobs";
import { localOperation, mergeJobs, unresolvedOperation, type LocalOperation } from "../contracts/operation";
import { isRecord } from "../contracts/project";
import type { Doc } from "./App";
import { usePresentonStatus } from "./channels";
import { download, request } from "./requests";
import { allowNewSubmission } from "./submission-guard";

const START = `git clone https://github.com/presenton/presenton.git
cd presenton && git checkout 93b9dcf947f70ae107b779b51dd3c491e736748a
docker build -t presenton:93b9dcf947f7 .
docker run --name presenton -p 127.0.0.1:5001:80 \\
  -v "$PWD/app_data:/app_data" presenton:93b9dcf947f7`;
const ENV = `export PRESENTON_URL=http://127.0.0.1:5001
read -rs 'PRESENTON_API_KEY?Presenton API key: '; export PRESENTON_API_KEY
pnpm dev   # 在工作台目录重启预览`;

export function PresentonChip({ doc }: { doc: Doc }) {
  const [open, setOpen] = useState(false);
  const status = usePresentonStatus();
  const chip = useRef<HTMLButtonElement>(null);
  const label = status.state.phase === "ready" ? "Presenton 可用" : status.state.phase === "checking" ? "Presenton 检查中" : status.state.configured ? "Presenton 不可达" : "Presenton 未配置";
  return (
    <>
      <button ref={chip} type="button" className="service-chip" data-phase={status.state.phase} aria-expanded={open} onClick={() => setOpen(true)}>
        <Server size={14} aria-hidden="true" />
        {label}
      </button>
      {open && (
        <PresentonDrawer
          doc={doc}
          status={status}
          onClose={() => {
            setOpen(false);
            chip.current?.focus();
          }}
        />
      )}
    </>
  );
}

function PresentonDrawer({ doc, status, onClose }: { doc: Doc; status: ReturnType<typeof usePresentonStatus>; onClose: () => void }) {
  const ready = status.state.phase === "ready";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [working, setWorking] = useState("");
  const submitting = useRef(false);
  const docKey = useRef(doc.documentKey);
  docKey.current = doc.documentKey;
  const panel = useRef<HTMLDivElement>(null);
  const settings = doc.data.settings;
  const setting = <K extends keyof Settings>(key: K, value: Settings[K]) => doc.setData((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  let persisted: LocalOperation | null = null;
  if (doc.draft.pendingOperation !== undefined)
    try {
      persisted = localOperation(doc.draft.pendingOperation);
    } catch {
      /* invalid state never becomes an executable request */
    }
  const recovery = typeof doc.draft.recoveryTask === "string" ? doc.draft.recoveryTask : "";
  useEffect(() => {
    panel.current?.focus();
  }, []);
  async function loadJob(id: string) {
    const job = jobValue(await request(`/api/jobs/${id}`));
    if (job.id !== id) throw new Error("返回的操作记录 ID 不符。");
    setJobs((old) => mergeJobs(old, [job]));
    return job;
  }
  async function loadJobs() {
    const v = await request("/api/jobs");
    if (!Array.isArray(v)) throw new Error("制作记录格式无效。");
    setJobs((old) => mergeJobs(old, v.map(jobValue)));
  }
  useEffect(() => {
    void loadJobs().catch(() => undefined);
    if (persisted) {
      const op = persisted;
      setJobs((old) => (old.some((j) => j.id === op.id) ? old : mergeJobs(old, [unresolvedOperation(op)])));
      void loadJob(op.id).catch(() => undefined);
    }
  }, []);
  const pendingKey = jobs
    .filter((j) => j.state === "pending")
    .map((j) => j.id)
    .join(",");
  useEffect(() => {
    if (!pendingKey) return;
    let disposed = false,
      polling = false;
    const timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void Promise.allSettled(pendingKey.split(",").map((id) => request(`/api/jobs/${id}/refresh`, { method: "POST" })))
        .then((results) => {
          if (disposed) return;
          const updated = results.filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled").map((r) => jobValue(r.value));
          setJobs((old) => old.map((j) => updated.find((n) => n.id === j.id) || j));
        })
        .finally(() => {
          polling = false;
        });
    }, 8000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [pendingKey]);
  async function action(name: string, fn: () => Promise<void>) {
    setWorking(name);
    doc.setError("");
    try {
      await fn();
    } catch (e) {
      doc.report(e);
    } finally {
      setWorking("");
    }
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const epoch = doc.documentKey;
      generationRequest(doc.data);
      if (!(await allowNewSubmission({ operation: persisted, jobs, projectId: doc.current?.id || "", query: loadJob, confirm: (m) => window.confirm(m) }))) return;
      const snapshot = structuredClone(doc.data),
        title = doc.title;
      const saved = await doc.save();
      if (!saved) throw new Error("请先让文稿完成保存，再交给 Presenton。");
      if (docKey.current !== epoch) throw new Error("文稿已切换，请在当前文稿重新提交。");
      const operation: LocalOperation = { id: crypto.randomUUID(), projectId: saved.id, title, kind: "generate", createdAt: new Date().toISOString() };
      doc.setDraft((d) => ({ ...d, lastOperation: operation.id, pendingOperation: operation }));
      setJobs((old) => mergeJobs(old, [unresolvedOperation(operation, "submitting")]));
      if (!(await doc.save())) throw new Error("提交记录尚未保存，请稍后重试。");
      try {
        const job = jobValue(
          await request("/api/jobs", { method: "POST", body: JSON.stringify({ id: operation.id, projectId: saved.id, title, kind: "generate", deck: snapshot, format: snapshot.settings.format }) }),
        );
        setJobs((old) => mergeJobs(old, [job]));
      } catch (error) {
        setJobs((old) => mergeJobs(old, [unresolvedOperation(operation)]));
        await loadJob(operation.id).catch(() => undefined);
        throw error;
      }
    } finally {
      submitting.current = false;
    }
  }
  async function downloadJob(j: Job) {
    const value = await request(`/api/jobs/${j.id}/artifact`, { method: "POST" });
    if (!isRecord(value) || typeof value.bytes !== "number" || typeof value.format !== "string" || value.bytes > 50 * 1024 * 1024) throw new Error("文件记录无效。");
    const parts: Uint8Array[] = [];
    for (let i = 0; i < Math.ceil(value.bytes / 262144); i++) {
      const c = await request(`/api/jobs/${j.id}/chunks/${i}`);
      if (!isRecord(c) || typeof c.base64 !== "string") throw new Error("下载分块无效。");
      parts.push(Uint8Array.from(atob(c.base64), (ch) => ch.charCodeAt(0)));
    }
    if (parts.reduce((n, c) => n + c.length, 0) !== value.bytes) throw new Error("下载未完整，请重试。");
    download(
      new Blob(parts as BlobPart[], { type: value.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
      `${j.title.replace(/[\\/:*?"<>|]/g, "_")}.${value.format}`,
    );
  }
  async function review(j: Job) {
    const value = await request(`/api/jobs/${j.id}/presentation`);
    const parsed = importDeck(JSON.stringify(value));
    if (await doc.replace(parsed.deck, parsed.title, { step: "deck" })) {
      doc.setNotice("已把 Presenton 生成的页面读入为新文稿。");
      onClose();
    }
  }
  const mine = jobs.filter((j) => j.projectId === doc.current?.id || j.id === persisted?.id);
  return (
    <div className="drawer-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className="drawer" role="dialog" aria-modal="true" aria-labelledby="presenton-title" tabIndex={-1} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="drawer-head">
          <h2 id="presenton-title">Presenton 通道（可选）</h2>
          <button type="button" className="ghost icon" aria-label="关闭" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="hint">本地生成与导出不需要它。连接自建的 Presenton 服务后，可把当前大纲交给 Presenton 用它的模板与模型成稿，并下载原件。</p>
        <div className="service-state" data-phase={status.state.phase} role="status">
          <span className="dot" aria-hidden="true" />
          <span>{status.state.message}</span>
          <button type="button" className="ghost small" disabled={status.state.phase === "checking"} onClick={() => void status.check()}>
            <RefreshCw size={13} aria-hidden="true" />
            重新检查
          </button>
        </div>
        {!ready && (
          <section className="howto">
            <h3>启动方式</h3>
            <ol>
              <li>
                在另一个目录构建并运行固定版本的 Presenton（需要 Docker，镜像较大）：
                <pre>{START}</pre>
              </li>
              <li>在 Presenton 管理页配置文本与图片模型，并在 Admin → API keys 创建密钥。</li>
              <li>
                用服务端环境变量启动本工作台（密钥不会出现在页面或项目里）：
                <pre>{ENV}</pre>
              </li>
              <li>回到这里点“重新检查”。</li>
            </ol>
          </section>
        )}
        {ready && (
          <section className="presenton-settings">
            <div className="row">
              <label>
                模板
                <input value={settings.template} maxLength={120} onChange={(e) => setting("template", e.target.value)} />
              </label>
              <label>
                语言
                <select value={settings.language} onChange={(e) => setting("language", e.target.value)}>
                  <option value="Chinese">中文</option>
                  <option value="English">English</option>
                  <option value="Japanese">日本語</option>
                </select>
              </label>
              <label>
                语气
                <select value={settings.tone} onChange={(e) => setting("tone", e.target.value)}>
                  <option value="professional">专业</option>
                  <option value="educational">教学</option>
                  <option value="casual">轻松</option>
                  <option value="sales_pitch">提案</option>
                  <option value="default">默认</option>
                  <option value="funny">幽默</option>
                </select>
              </label>
              <label>
                输出
                <select value={settings.format} onChange={(e) => setting("format", e.target.value === "pdf" ? "pdf" : "pptx")}>
                  <option value="pptx">PPTX</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
            </div>
            <label>
              给 Presenton 的要求
              <textarea rows={3} value={settings.instructions} maxLength={6000} onChange={(e) => setting("instructions", e.target.value)} />
            </label>
            <div className="checks">
              <label className="checkbox">
                <input type="checkbox" checked={settings.titleSlide} onChange={(e) => setting("titleSlide", e.target.checked)} />
                封面
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={settings.contents} onChange={(e) => setting("contents", e.target.checked)} />
                目录
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={settings.webSearch} onChange={(e) => setting("webSearch", e.target.checked)} />
                允许联网查资料
              </label>
            </div>
            <button type="button" className="primary" disabled={!!working} onClick={() => void action("submit", submit)}>
              {working === "submit" ? "正在提交…" : `交给 Presenton 生成 ${doc.data.outline.length || doc.data.slides.length} 页`}
            </button>
            <p className="hint">会把资料与大纲发送到 {status.state.origin}，由其配置的模型生成，可能产生费用。提交前先保存操作记录；结果不明时不会自动重试。</p>
          </section>
        )}
        <section className="ledger">
          <h3>制作记录</h3>
          {mine.length === 0 && <p className="hint">这份文稿还没有 Presenton 任务。</p>}
          {mine.map((j) => (
            <article key={j.id} className="job">
              <div className="job-head">
                <strong>{j.title}</strong>
                <span data-state={j.state}>{states[j.state]}</span>
              </div>
              <p>{j.message}</p>
              <small>
                {new Date(j.createdAt).toLocaleString()} · 操作 {j.id.slice(0, 8)}
                {j.taskId ? ` · 任务 ${j.taskId}` : ""}
              </small>
              <div className="job-actions">
                <button type="button" disabled={!!working} onClick={() => void action("query", async () => void (await loadJob(j.id)))}>
                  查询
                </button>
                {["pending", "unknown"].includes(j.state) && (
                  <button type="button" disabled={!!working} onClick={() => void action("stop", async () => {
                    await request(`/api/jobs/${j.id}/stop`, { method: "POST" });
                    await loadJobs();
                  })}>
                    停止跟踪
                  </button>
                )}
                {j.state === "completed" && j.path && (
                  <button type="button" className="primary" disabled={!!working} onClick={() => void action("download", () => downloadJob(j))}>
                    下载原件
                  </button>
                )}
                {j.presentationId && ready && (
                  <button type="button" disabled={!!working} onClick={() => void action("review", () => review(j))}>
                    读入为新文稿
                  </button>
                )}
              </div>
              {["unknown", "stopped"].includes(j.state) && !j.taskId && (
                <div className="adopt">
                  <label>
                    关联已存在的 Presenton 任务
                    <input value={recovery} maxLength={100} placeholder="task-…" autoComplete="off" onChange={(e) => doc.setDraft((d) => ({ ...d, recoveryTask: e.target.value }))} />
                  </label>
                  <button type="button" disabled={!!working || !recovery} onClick={() => void action("adopt", async () => {
                    await request(`/api/jobs/${j.id}/adopt`, { method: "POST", body: JSON.stringify({ taskId: recovery }) });
                    await loadJobs();
                  })}>
                    关联并查询
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
