import { Activity, ArrowUpRight, RotateCcw } from "lucide-react";
import type { Job } from "../contracts/evidence";
import type { HostRun } from "../contracts/host-run";

const jobName: Record<Job["status"], string> = {
  submitting: "提交中",
  unknown: "待确认",
  queued: "排队中",
  running: "抽取中",
  succeeded: "待查看",
  failed: "失败",
  interrupted: "已中断",
  cancelled: "已停止接收",
};
const hostName: Record<HostRun["status"], string> = {
  running: "抽取中",
  completed: "待查看",
  failed: "失败",
  interrupted: "已中断",
};
const when = (iso: string) =>
  new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export function RunsView({
  hostRuns,
  jobs,
  onRefresh,
  onOpenHost,
  onOpenJob,
  onQueryJob,
  onCancelJob,
}: {
  hostRuns: HostRun[];
  jobs: Job[];
  onRefresh: () => void;
  onOpenHost: (r: HostRun) => void;
  onOpenJob: (j: Job) => void;
  onQueryJob: (j: Job) => void;
  onCancelJob: (j: Job) => void;
}) {
  const items = [
    ...hostRuns.map((r) => ({ kind: "host" as const, at: r.createdAt, r })),
    ...jobs.map((j) => ({ kind: "service" as const, at: j.createdAt, j })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="jobs-panel">
      <header>
        <div>
          <span className="eyebrow">RUN LOG</span>
          <h2>抽取任务</h2>
          <p>每个任务保存提交时的原文、类别与示例快照。完成的结果另开为新批次，不覆盖正在进行的复核。</p>
        </div>
        <button onClick={onRefresh}>
          <RotateCcw size={15} aria-hidden="true" />
          刷新
        </button>
      </header>
      {items.length ? (
        items.map((it) =>
          it.kind === "host" ? (
            <article className="job" key={it.r.id}>
              <div>
                <span className={"job-status " + it.r.status}>{hostName[it.r.status]}</span>
                <span className="channel-tag">Floatboat 模型 · {it.r.model}</span>
                <h3>{it.r.input.documents.map((d) => d.id).join("、")}</h3>
                {it.r.status === "running" && (
                  <progress max={it.r.progress.total || 1} value={it.r.progress.done} aria-label="抽取进度">
                    {it.r.progress.done}/{it.r.progress.total}
                  </progress>
                )}
                <p>
                  {it.r.message || `已处理 ${it.r.progress.done}/${it.r.progress.total} 段。`}
                </p>
                {it.r.warnings.length > 0 && (
                  <details>
                    <summary>{it.r.warnings.length} 条提示</summary>
                    <ul>
                      {it.r.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <small>
                  {when(it.r.createdAt)} · {it.r.id.slice(0, 8)}
                </small>
              </div>
              <div className="job-actions">
                {it.r.status === "completed" && (
                  <button onClick={() => onOpenHost(it.r)}>
                    <ArrowUpRight size={16} aria-hidden="true" />
                    另开结果批次
                  </button>
                )}
                <details>
                  <summary>输入快照</summary>
                  <pre>{JSON.stringify(it.r.input, null, 2)}</pre>
                </details>
              </div>
            </article>
          ) : (
            <article className="job" key={it.j.id}>
              <div>
                <span className={"job-status " + it.j.status}>{jobName[it.j.status]}</span>
                <span className="channel-tag">Python 服务</span>
                <h3>{it.j.input.documents.map((d) => d.id).join("、")}</h3>
                <p>{it.j.message || "任务已记录。"}</p>
                <small>
                  {when(it.j.createdAt)} · {it.j.id.slice(0, 8)}
                </small>
              </div>
              <div className="job-actions">
                {it.j.status === "succeeded" ? (
                  <button onClick={() => onOpenJob(it.j)}>
                    <ArrowUpRight size={16} aria-hidden="true" />
                    另开结果批次
                  </button>
                ) : ["queued", "running", "unknown", "submitting"].includes(it.j.status) ? (
                  <>
                    <button onClick={() => onQueryJob(it.j)}>查询原任务</button>
                    <button onClick={() => onCancelJob(it.j)}>停止接收结果</button>
                  </>
                ) : null}
                <details>
                  <summary>输入快照</summary>
                  <pre>{JSON.stringify(it.j.input, null, 2)}</pre>
                </details>
              </div>
            </article>
          ),
        )
      ) : (
        <div className="empty jobs-empty">
          <Activity size={30} aria-hidden="true" />
          <h3>还没有抽取任务</h3>
          <p>点顶部“抽取”用 Floatboat 模型或 Python 服务运行；没有模型时可在原文中手工标注，或从档案菜单导入 LangExtract JSONL。</p>
        </div>
      )}
    </section>
  );
}
