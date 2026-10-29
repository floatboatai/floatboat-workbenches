// ABOUTME: 推演阶段：模型参数、事件注入时间轴、本地推演/MiroFish 后端两种引擎与运行记录。
import { Play, Plus, Trash2, RefreshCw, Server, Cpu } from "lucide-react";
import { LIMITS, newId, type Params, type SimEvent } from "../contracts/scenario";
import { terminal } from "../contracts/run";
import type { Studio } from "./useStudio";

const PARAMS: Array<{ key: keyof Params; label: string; hint: string; min: number; max: number; step: number }> = [
  { key: "rounds", label: "轮次", hint: "1–240", min: 1, max: LIMITS.rounds, step: 1 },
  { key: "minutesPerRound", label: "每轮分钟", hint: "模拟时钟", min: 10, max: 1440, step: 10 },
  { key: "confidence", label: "信任阈值 ε", hint: "立场差小于它才会被说服", min: 0.05, max: 2, step: 0.05 },
  { key: "influenceRate", label: "影响速率 μ", hint: "每次阅读的靠拢幅度", min: 0.01, max: 0.6, step: 0.01 },
  { key: "echoChamber", label: "回音室强度", hint: "推荐流偏向同立场", min: 0, max: 1, step: 0.05 },
  { key: "backfire", label: "逆火强度", hint: "差距过大时反向远离", min: 0, max: 1, step: 0.05 },
  { key: "noise", label: "随机扰动", hint: "每轮立场噪声", min: 0, max: 0.3, step: 0.01 },
  { key: "feedSize", label: "每轮阅读条数", hint: "推荐流长度", min: 1, max: 12, step: 1 },
];

export function RunStage({ st }: { st: Studio }) {
  const { p, s, mutable } = st;
  const engine = p.draft.engine === "mirofish" ? "mirofish" : "local";
  const setParam = (key: keyof Params, value: string | number) => p.setData((d) => ({ ...d, params: { ...d.params, [key]: value } }));
  const patchEvent = (id: string, x: Partial<SimEvent>) => p.setData((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...x } : e)) }));
  const types = [...new Set(s.agents.map((a) => a.type))];
  return (
    <div className="run-layout">
      <section className="panel params">
        <h2>推演参数</h2>
        <div className="param-grid">
          <label>
            随机种子
            <input value={s.params.seed} maxLength={60} disabled={!mutable} onChange={(e) => setParam("seed", e.target.value)} />
            <small>同一种子与输入必得同一结果</small>
          </label>
          <label>
            开始时间
            <input type="datetime-local" value={s.params.start} disabled={!mutable} onChange={(e) => setParam("start", e.target.value.slice(0, 16))} />
            <small>决定昼夜活跃度</small>
          </label>
          <label>
            平台
            <select value={s.params.platform} disabled={!mutable} onChange={(e) => setParam("platform", e.target.value)}>
              <option value="parallel">Twitter + Reddit 并行</option>
              <option value="twitter">仅 Twitter</option>
              <option value="reddit">仅 Reddit</option>
            </select>
            <small>Twitter 转发/引用，Reddit 评论/踩</small>
          </label>
          {PARAMS.map((x) => (
            <label key={x.key}>
              {x.label}
              <input type="number" inputMode="decimal" min={x.min} max={x.max} step={x.step} value={Number.isFinite(s.params[x.key] as number) ? (s.params[x.key] as number) : ""} disabled={!mutable} onChange={(e) => setParam(x.key, e.target.value === "" ? 0 : Number(e.target.value))} />
              <small>{x.hint}</small>
            </label>
          ))}
        </div>
        <h2>事件注入</h2>
        <p className="muted">在指定轮次改变部分智能体的立场（推力 -1 反对至 +1 支持），可指定一个智能体发布事件帖。对应 MiroFish 的“上帝视角”变量注入。</p>
        <ol className="events">
          {[...s.events]
            .sort((a, b) => a.round - b.round)
            .map((e) => (
              <li key={e.id}>
                <div className="event-head">
                  <input aria-label="事件轮次" type="number" min={0} max={LIMITS.rounds} value={e.round} disabled={!mutable} onChange={(ev) => patchEvent(e.id, { round: ev.target.value === "" ? 0 : Number(ev.target.value) })} />
                  <input aria-label="事件标题" className="grow" value={e.title} maxLength={80} disabled={!mutable} onChange={(ev) => patchEvent(e.id, { title: ev.target.value })} />
                  <button className="ghost" aria-label={`删除事件 ${e.title}`} disabled={!mutable} onClick={() => p.setData((d) => ({ ...d, events: d.events.filter((x) => x.id !== e.id) }))}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                <textarea aria-label="事件内容" rows={2} value={e.text} maxLength={1000} disabled={!mutable} onChange={(ev) => patchEvent(e.id, { text: ev.target.value })} />
                <div className="event-grid">
                  <label>
                    推力 <output>{e.push > 0 ? "+" : ""}{e.push.toFixed(2)}</output>
                    <input type="range" min={-1} max={1} step={0.05} value={e.push} disabled={!mutable} onChange={(ev) => patchEvent(e.id, { push: Number(ev.target.value) })} />
                  </label>
                  <label>
                    触达 <output>{Math.round(e.reach * 100)}%</output>
                    <input type="range" min={0} max={1} step={0.05} value={e.reach} disabled={!mutable} onChange={(ev) => patchEvent(e.id, { reach: Number(ev.target.value) })} />
                  </label>
                  <label>
                    对象
                    <select value={e.target} disabled={!mutable} onChange={(ev) => patchEvent(e.id, { target: ev.target.value })}>
                      <option value="all">全部智能体</option>
                      {types.map((t) => (
                        <option key={t} value={"type:" + t}>
                          类型：{t}
                        </option>
                      ))}
                      {s.entities
                        .filter((x) => s.agents.some((a) => a.entityId === x.id))
                        .map((x) => (
                          <option key={x.id} value={"entity:" + x.id}>
                            实体：{x.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    发布者
                    <select value={e.author ?? ""} disabled={!mutable} onChange={(ev) => patchEvent(e.id, { author: ev.target.value === "" ? null : Number(ev.target.value) })}>
                      <option value="">不发帖</option>
                      {s.agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            ))}
        </ol>
        <button disabled={!mutable || s.events.length >= LIMITS.events} onClick={() => p.setData((d) => ({ ...d, events: [...d.events, { id: newId("ev"), round: Math.min(d.params.rounds, 6), title: "新事件", text: "", push: 0.2, target: "all", reach: 0.5, author: null }] }))}>
          <Plus size={15} aria-hidden="true" />
          添加事件
        </button>
      </section>
      <section className="panel engines">
        <div className="tabs" role="tablist" aria-label="推演引擎">
          <button role="tab" aria-selected={engine === "local"} onClick={() => st.setPick("engine", "local")}>
            <Cpu size={15} aria-hidden="true" />
            本地推演
          </button>
          <button role="tab" aria-selected={engine === "mirofish"} onClick={() => st.setPick("engine", "mirofish")}>
            <Server size={15} aria-hidden="true" />
            MiroFish 后端
            <i className={"led " + (st.service.available ? "ok" : "off")} aria-label={st.service.available ? "已连接" : "未连接"} />
          </button>
        </div>
        {engine === "local" ? <LocalEngine st={st} /> : <MiroFishEngine st={st} />}
        <h2>运行记录</h2>
        {s.runs.length === 0 ? <p className="muted">还没有运行。</p> : null}
        <ul className="runs">
          {s.runs.map((r) => (
            <li key={r.id} className={r.id === st.activeRun?.id ? "current" : ""}>
              <button className="link" onClick={() => (st.selectRun(r.id), st.setStage("observe"))}>
                {r.label}
              </button>
              <small>
                {r.engine === "local" ? "本地" : r.engine === "mirofish" ? "MiroFish" : "导入"} · {r.summary.actions} 动作 · 支持 {Math.round(r.summary.endSupport * 100)}% / 反对 {Math.round(r.summary.endOppose * 100)}%{r.fingerprint ? ` · ${r.fingerprint}` : ""}
              </small>
              <button className="ghost" aria-label={`删除运行 ${r.label}`} disabled={!mutable} onClick={() => st.removeRun(r.id)}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function LocalEngine({ st }: { st: Studio }) {
  const { s, mutable } = st;
  const reason = !s.agents.length ? "还没有智能体：先在“人设”阶段生成。" : st.problem ? "需要先修正：" + st.problem : s.runs.length >= LIMITS.runs ? `最多保留 ${LIMITS.runs} 次运行，请先删除旧运行。` : "";
  return (
    <div className="engine-body">
      <p>
        在工作台内运行基于规则与概率的多智能体意见动力学：有界信任（Deffuant）同化、距离过大时的逆火、按新鲜度/热度/关注/同温层打分的推荐流，以及事件注入。输出 MiroFish 原生动作格式（发帖、评论、点赞、转发、引用、关注）。
      </p>
      <dl className="run-facts">
        <div>
          <dt>智能体</dt>
          <dd>{s.agents.length}</dd>
        </div>
        <div>
          <dt>轮次</dt>
          <dd>{s.params.rounds}</dd>
        </div>
        <div>
          <dt>事件</dt>
          <dd>{s.events.length}</dd>
        </div>
        <div>
          <dt>种子</dt>
          <dd>{s.params.seed || "—"}</dd>
        </div>
      </dl>
      <button className="primary big" disabled={!mutable || Boolean(reason)} onClick={() => void st.runLocal()}>
        <Play size={17} aria-hidden="true" />
        开始推演
      </button>
      {reason ? (
        <p className="error-text" role="status">
          {reason}
        </p>
      ) : (
        <p className="muted">同时用 5 个派生种子重跑做稳健性检验。不调用任何模型。</p>
      )}
    </div>
  );
}

const LABELS: Record<string, string> = { idle: "尚未启动", starting: "正在启动", running: "正在模拟", paused: "已暂停", stopping: "正在停止", stopped: "已停止", completed: "已完成", failed: "运行失败" };
function MiroFishEngine({ st }: { st: Studio }) {
  const { p, mutable, service, simulations, control: c } = st;
  const run = c.run;
  const ready = simulations.some((x) => x.id === c.selected && x.status === "ready");
  const locked = !mutable || c.busy;
  return (
    <div className="engine-body">
      <div className={"service " + (service.available ? "ok" : "off")} role="status">
        <strong>{service.available ? "已连接" : "未连接"}</strong>
        <span>
          {service.message}
          {service.url ? ` · ${service.url}` : ""}
        </span>
        <button className="ghost" onClick={() => void st.checkService()}>
          <RefreshCw size={14} aria-hidden="true" />
          重新检查
        </button>
      </div>
      {!service.available ? (
        <details className="howto" open>
          <summary>如何启动官方 MiroFish 后端</summary>
          <ol>
            <li>
              获取源码：<code>git clone https://github.com/666ghj/MiroFish</code>，复制 <code>.env.example</code> 为 <code>.env</code>，填入 <code>LLM_API_KEY</code>（OpenAI 兼容接口）与 <code>ZEP_API_KEY</code>。
            </li>
            <li>
              安装并启动后端：<code>npm run setup:all</code>，然后 <code>npm run backend</code>（Flask，默认端口 5001）。
            </li>
            <li>
              在 MiroFish 前端完成资料上传、图谱构建、人设与模拟准备，使模拟处于 <code>ready</code>。
            </li>
            <li>
              非默认地址时，用 <code>MIROFISH_URL=http://127.0.0.1:端口 pnpm workbench dev mirofish</code> 启动本工作台（远程地址须 HTTPS），再点“重新检查”。
            </li>
          </ol>
          <p className="muted">后端运行会调用你配置的模型与 Zep，可能产生费用。未连接时本地推演、观察与报告全部可用。</p>
        </details>
      ) : null}
      {service.available ? (
        <>
          {p.draft.importedRun ? <p className="muted">已保留导入的命令记录，当前副本不会继续或重放该运行。</p> : null}
          <label>
            上游模拟
            <select value={c.selected} disabled={locked || Boolean(c.pendingId)} onChange={(e) => c.select(e.target.value)}>
              <option value="">选择已准备或已有运行的模拟</option>
              {simulations.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id} · {x.status}
                </option>
              ))}
            </select>
          </label>
          <div className="two">
            <label>
              平台
              <select value={c.platform} disabled={locked || Boolean(c.pendingId)} onChange={(e) => p.setDraft((d) => ({ ...d, runPlatform: e.target.value }))}>
                <option value="parallel">Twitter + Reddit</option>
                <option value="twitter">Twitter</option>
                <option value="reddit">Reddit</option>
              </select>
            </label>
            <label>
              最多轮次
              <input inputMode="numeric" value={c.rawRounds} disabled={locked || Boolean(c.pendingId)} onChange={(e) => p.setDraft((d) => ({ ...d, runRounds: e.target.value }))} />
            </label>
          </div>
          <p className="muted">仅可启动已准备、尚未运行的模拟（1–100 轮）；不强制重启、不写回图谱。命令先保存再发送一次，回执丢失时只核对状态、不重发。同一模拟请只在一个入口管理。</p>
          <div className="row">
            <button className="primary" disabled={locked || !ready || run?.status !== "idle" || Boolean(c.pendingId) || !/^\d+$/.test(c.rawRounds) || Number(c.rawRounds) < 1 || Number(c.rawRounds) > 100} onClick={() => void c.execute("start")}>
              启动模拟
            </button>
            <button disabled={locked || c.unresolved || !run?.startedAt || !["starting", "running", "paused"].includes(run.status)} onClick={() => void c.execute("stop")}>
              停止本次运行
            </button>
            <button disabled={c.busy || (!c.selected && !c.pendingId)} onClick={() => void c.observe()}>
              核对状态
            </button>
          </div>
          {run ? (
            <div className="run-status" role="status">
              <strong>{LABELS[run.status]}</strong>
              <span>
                轮次 {run.round} / {run.total} · {run.actions} 动作
              </span>
              <small>
                {run.simulationId}
                {run.startedAt ? " · " + run.startedAt : ""}
              </small>
              {run.error ? <p className="error-text">{run.error}</p> : null}
            </div>
          ) : null}
          {c.pendingId ? <p className="muted">{c.command?.message ?? "命令记录已保存；回执待核对，不会自动再次发送。"}</p> : null}
          {c.pendingId && !c.unresolved && (!run || terminal(run.status)) ? (
            <button disabled={locked} onClick={c.archive}>
              保留记录并解除选择
            </button>
          ) : null}
          <button disabled={locked || c.unresolved || !run?.startedAt || run.actions === 0} onClick={() => void st.fromService(run!.simulationId, run!.startedAt!)}>
            读取本次结果到运行记录
          </button>
        </>
      ) : null}
    </div>
  );
}
