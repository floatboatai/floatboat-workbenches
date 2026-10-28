import type { useSimulationControl } from "./useSimulationControl";
import type { useReviewDesk } from "./useReviewDesk";
import { terminal } from "../contracts/run";
export function SimulationControl({
  desk,
}: {
  desk: ReturnType<typeof useReviewDesk>;
}) {
  const {
    p,
    mutable,
    service,
    simulations,
    check,
    fromService,
    control: c,
  } = desk;
  const run = c.run,
    ready = simulations.some(
      (s) => s.id === c.selected && s.status === "ready",
    );
  const labels: Record<string, string> = {
    idle: "尚未启动",
    starting: "正在启动",
    running: "正在模拟",
    paused: "已暂停",
    stopping: "正在停止",
    stopped: "已停止",
    completed: "已完成",
    failed: "运行失败",
  };
  const locked = !mutable || c.busy;
  return (
    <section className="simulation-control" aria-label="模拟运行">
      <div className="run-heading">
        <h2>模拟运行</h2>
        <button disabled={c.busy} onClick={() => void check()}>
          检查连接
        </button>
      </div>
      <p role="status">{service.message}</p>
      {p.draft.importedRun ? (
        <p>已保留导入的命令记录，当前副本不会继续或重放该运行。</p>
      ) : null}
      {!service.available ? (
        <p>
          先连接官方 MiroFish
          后端，并在上游完成资料、图谱、角色配置与模拟准备；运行还需要上游的模型及
          Zep 配置。
        </p>
      ) : null}
      <label>
        选择上游模拟
        <select
          aria-label="选择上游模拟"
          disabled={locked || !service.available || Boolean(c.pendingId)}
          value={c.selected}
          onChange={(e) => c.select(e.target.value)}
        >
          <option value="">选择已准备或已有运行</option>
          {simulations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.status}
            </option>
          ))}
        </select>
      </label>
      <div className="run-options">
        <label>
          平台
          <select
            aria-label="运行平台"
            disabled={locked || Boolean(c.pendingId)}
            value={c.platform}
            onChange={(e) =>
              p.setDraft((d) => ({ ...d, runPlatform: e.target.value }))
            }
          >
            <option value="parallel">Twitter + Reddit</option>
            <option value="twitter">Twitter</option>
            <option value="reddit">Reddit</option>
          </select>
        </label>
        <label>
          最多轮次
          <input
            aria-label="最多轮次"
            inputMode="numeric"
            disabled={locked || Boolean(c.pendingId)}
            value={c.rawRounds}
            onChange={(e) =>
              p.setDraft((d) => ({ ...d, runRounds: e.target.value }))
            }
          />
        </label>
      </div>
      <p className="run-boundary">
        启动仅适用于已准备、尚未运行的模拟，最多100轮。将调用上游模型，可能产生费用；不强制重启、不写回图谱。
      </p>
      <p className="run-boundary">
        同一模拟请在一个入口管理。其他客户端重启期间不要停止，以免切换到另一轮运行。
      </p>
      <div className="run-buttons">
        <button
          disabled={
            locked ||
            !service.available ||
            !ready ||
            run?.status !== "idle" ||
            Boolean(c.pendingId) ||
            !/^\d+$/.test(c.rawRounds) ||
            Number(c.rawRounds) < 1 ||
            Number(c.rawRounds) > 100
          }
          onClick={() => void c.execute("start")}
        >
          启动模拟
        </button>
        <button
          disabled={
            locked ||
            !service.available ||
            c.unresolved ||
            !run?.startedAt ||
            !["starting", "running", "paused"].includes(run.status)
          }
          onClick={() => void c.execute("stop")}
        >
          停止本次运行
        </button>
        <button
          disabled={
            c.busy || !service.available || (!c.selected && !c.pendingId)
          }
          onClick={() => void c.observe()}
        >
          核对状态
        </button>
      </div>
      {run ? (
        <div className="run-status" role="status">
          <strong>{labels[run.status]}</strong>
          <span>
            轮次 {run.round} / {run.total} · {run.actions} 动作
          </span>
          <small>
            {run.simulationId}
            {run.startedAt ? " · " + run.startedAt : ""}
          </small>
          {run.error ? <p>{run.error}</p> : null}
        </div>
      ) : null}
      {c.pendingId ? (
        <p className="command-message">
          {c.command?.message ??
            "命令记录已保存；回执待核对，不会自动再次发送。"}
        </p>
      ) : null}
      {c.pendingId && !c.unresolved && (!run || terminal(run.status)) ? (
        <button disabled={locked} onClick={c.archive}>
          保留记录并解除选择
        </button>
      ) : null}
      <button
        disabled={
          locked ||
          !service.available ||
          c.unresolved ||
          !run?.startedAt ||
          run.actions === 0
        }
        onClick={() => void fromService(run!.simulationId, run!.startedAt!)}
      >
        读取本次结果副本
      </button>
    </section>
  );
}
