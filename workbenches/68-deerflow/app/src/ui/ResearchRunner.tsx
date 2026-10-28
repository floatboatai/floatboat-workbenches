import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw, ArrowDownToLine } from "lucide-react";
import {
  researchRunValue,
  runLabels,
  type ResearchRun,
} from "../contracts/run";
import { request, download } from "./requests";
import type { Project } from "../contracts/project";
import type { Research } from "../contracts/research";
type Props = {
  projectId: string | null;
  documentKey: string;
  brief: string;
  model: string;
  mutable: boolean;
  configured: boolean;
  onBrief: (v: string) => void;
  onModel: (v: string) => void;
  save: () => Promise<Project<Research> | null>;
  onBusy: (v: boolean) => void;
  onError: (e: unknown) => void;
  onApply: (native: string, threadId: string) => void;
  onCommand: (id: string) => void;
};
const active = [
  "creating_thread",
  "submitting",
  "unknown",
  "pending",
  "running",
];
export function ResearchRunner(p: Props) {
  const [runs, setRuns] = useState<ResearchRun[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [checking, setChecking] = useState(true),
    [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const epoch = useRef(p.documentKey),
    locked = useRef(false);
  epoch.current = p.documentKey;
  useEffect(() => {
    setPendingCommand(null);
  }, [p.documentKey]);
  useEffect(() => {
    let live = true;
    const key = p.documentKey;
    setRuns([]);
    setChecking(Boolean(p.projectId));
    setMessage("");
    if (!p.projectId) return;
    let polling = false;
    async function poll() {
      if (polling) return;
      polling = true;
      try {
        const raw = await request("/api/projects/" + p.projectId + "/research");
        if (!Array.isArray(raw)) throw new Error("研究列表格式无效。");
        let next = raw.map(researchRunValue);
        if (live && epoch.current === key) {
          setRuns(next);
          setChecking(false);
          setPendingCommand((id) =>
            id && next.some((row) => row.id === id) ? null : id,
          );
        }
        if (p.configured) {
          for (const row of next.filter(
            (x) =>
              active.includes(x.phase) ||
              (x.phase === "success" && !x.hasResult && !x.error),
          )) {
            if (!live || epoch.current !== key) return;
            const value = researchRunValue(
              await request("/api/research/" + row.id + "/refresh", {
                method: "POST",
              }),
            );
            next = next.map((x) => (x.id === value.id ? value : x));
          }
        }
        if (live && epoch.current === key) setRuns(next);
      } catch (e) {
        if (live && epoch.current === key)
          setMessage(
            e instanceof Error ? e.message : "研究状态读取失败，已有记录保留。",
          );
      } finally {
        polling = false;
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [p.projectId, p.documentKey, p.configured]);
  async function perform(fn: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    p.onBusy(true);
    try {
      await fn();
    } catch (e) {
      p.onError(e);
    } finally {
      locked.current = false;
      setBusy(false);
      p.onBusy(false);
    }
  }
  async function start() {
    const key = epoch.current;
    await perform(async () => {
      const saved = await p.save();
      if (!saved) throw new Error("请先完善并保存当前研究项目。");
      if (key !== epoch.current) return;
      const id = crypto.randomUUID();
      setPendingCommand(id);
      p.onCommand(id);
      let value: ResearchRun;
      try {
        value = researchRunValue(
          await request("/api/research", {
            method: "POST",
            body: JSON.stringify({
              id,
              projectId: saved.id,
              prompt: saved.data.brief,
              model: p.model,
            }),
          }),
        );
      } catch (e) {
        if (
          e instanceof Error &&
          "status" in e &&
          typeof e.status === "number" &&
          e.status >= 400 &&
          e.status < 500
        )
          setPendingCommand(null);
        throw new Error(
          (e instanceof Error ? e.message : "提交响应未到达。") +
            " 系统会从持久记录核对，不会自动重发研究。",
        );
      }
      if (key === epoch.current) {
        setPendingCommand(null);
        setRuns((v) => [value, ...v.filter((x) => x.id !== value.id)]);
        setMessage("任务命令已保存。后台运行独立于此页面，可刷新查询。");
      }
    });
  }
  async function refresh(row: ResearchRun) {
    const key = epoch.current;
    await perform(async () => {
      const value = researchRunValue(
        await request("/api/research/" + row.id + "/refresh", {
          method: "POST",
        }),
      );
      if (key === epoch.current)
        setRuns((v) => v.map((x) => (x.id === value.id ? value : x)));
    });
  }
  async function load(row: ResearchRun) {
    const key = epoch.current;
    await perform(async () => {
      const value = researchRunValue(await request("/api/research/" + row.id));
      if (!value.native || value.phase !== "success")
        throw new Error("研究结果尚不可读取。");
      if (key === epoch.current) p.onApply(value.native, value.threadId);
    });
  }
  async function receipt(row: ResearchRun) {
    await perform(async () => {
      const value = researchRunValue(await request("/api/research/" + row.id));
      download(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
        "deerflow-research-" + row.id + ".json",
      );
    });
  }
  const occupied = runs.some((r) => active.includes(r.phase));
  return (
    <section className="research-launch" aria-label="发起与跟踪研究">
      <div className="research-command">
        <span className="eyebrow">BRIEF → RESEARCH → DELIVERY</span>
        <h2>把问题交给研究团队</h2>
        <p>
          向已连接的DeerFlow提交研究。任务在上游后台执行，完成后载入会话，再整理交付稿。
        </p>
        <label htmlFor="research-brief">研究任务简报</label>
        <textarea
          id="research-brief"
          aria-label="研究任务简报"
          value={p.brief}
          disabled={!p.mutable || busy}
          onChange={(e) => p.onBrief(e.target.value)}
          rows={8}
        />
        <label htmlFor="research-model">上游模型名称</label>
        <input
          id="research-model"
          aria-label="上游模型名称"
          value={p.model}
          disabled={!p.mutable || busy}
          onChange={(e) => p.onModel(e.target.value)}
          autoComplete="off"
        />
        <small>
          需在DeerFlow模型白名单中配置这个名称；使用上游模型与工具配额。
        </small>
        <button
          className="deliver"
          disabled={
            !p.configured ||
            !p.mutable ||
            busy ||
            occupied ||
            checking ||
            Boolean(pendingCommand) ||
            !p.brief.trim() ||
            !p.model.trim()
          }
          onClick={() => void start()}
        >
          <Play size={15} />
          提交研究任务
        </button>
        {!p.configured && (
          <p className="run-prerequisite" role="status">
            先配置DeerFlow
            Gateway地址、模型、研究工具与服务授权，才能提交。当前仍可导入已有会话并整理报告。
          </p>
        )}
        {(occupied || pendingCommand) && (
          <p className="run-prerequisite">
            已有研究运行或回执待核对。请先核对状态，避免重复提交。
          </p>
        )}
        <p className="run-policy">
          每次任务使用独立上游会话。未知回执只查询，不自动重发。运行中取消、人工确认或恢复中断请在DeerFlow处理。
        </p>
      </div>
      <div className="research-history">
        <div className="sheet-caption">
          <strong>研究记录</strong>
          <span>刷新页面后继续跟踪</span>
        </div>
        {message && <p role="status">{message}</p>}
        {runs.length === 0 ? (
          <div className="run-empty">
            还没有提交研究任务。
            <br />
            写清目标、范围和交付形式，再开始研究。
          </div>
        ) : (
          runs.map((row) => (
            <article className="research-record" key={row.id}>
              <div className="run-heading">
                <strong>{runLabels[row.phase] ?? row.phase}</strong>
                <time>{new Date(row.createdAt).toLocaleString()}</time>
              </div>
              <p>{row.prompt}</p>
              <dl>
                <div>
                  <dt>模型</dt>
                  <dd>{row.model}</dd>
                </div>
                <div>
                  <dt>会话</dt>
                  <dd>{row.threadId}</dd>
                </div>
                {row.runId && (
                  <div>
                    <dt>运行</dt>
                    <dd>{row.runId}</dd>
                  </div>
                )}
              </dl>
              {row.error && (
                <p className="run-error" role="status">
                  {row.error}
                </p>
              )}
              <div className="run-actions">
                <button
                  disabled={!p.configured || !p.mutable || busy}
                  onClick={() => void refresh(row)}
                >
                  <RefreshCw size={13} />
                  查询状态
                </button>
                {row.hasResult && row.phase === "success" && (
                  <button
                    disabled={!p.mutable || busy}
                    onClick={() => void load(row)}
                  >
                    载入研究结果
                  </button>
                )}
                <button disabled={busy} onClick={() => void receipt(row)}>
                  <ArrowDownToLine size={13} />
                  任务记录
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
