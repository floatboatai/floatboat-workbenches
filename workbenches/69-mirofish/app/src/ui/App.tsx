import {
  Waves,
  Upload,
  Download,
  Plus,
  Check,
  Users,
  Filter,
} from "lucide-react";
import { ProjectPicker, Notice, download } from "./workspace";
import {
  nativeResult,
  actorKey,
  content,
  markdown,
} from "../contracts/simulation";
import { useReviewDesk } from "./useReviewDesk";
import { ReviewPanel } from "./ReviewPanel";
export function App() {
  const desk = useReviewDesk();
  const {
    p,
    mutable,
    raw,
    platform,
    actor,
    round,
    actors,
    rounds,
    filtered,
    chosen,
    note,
    reviewed,
    importOpen,
    setImportOpen,
    file,
    bundle,
    service,
    simulations,
    check,
    annotate,
    readNative,
    applyNative,
    importBundle,
    fromService,
  } = desk;
  return (
    <>
      <a className="skip" href="#timeline">
        跳到动作时间线
      </a>
      <header>
        <div className="brand">
          <Waves aria-hidden="true" />
          <div>
            <strong>MIROFISH</strong>
            <span>情景复核 / SCENARIO REVIEW</span>
          </div>
        </div>
        <input
          aria-label="项目名称"
          name="title"
          autoComplete="off"
          disabled={!mutable}
          value={p.title}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable}
          onOpen={(id) => void p.open(id)}
        />
        <nav>
          <button disabled={!mutable} onClick={() => void p.fresh()}>
            <Plus aria-hidden="true" size={15} />
            新建
          </button>
          <button disabled={!mutable} onClick={() => file.current?.click()}>
            <Upload aria-hidden="true" size={15} />
            导入模拟结果
          </button>
          <button
            onClick={() =>
              download(
                new Blob(
                  [
                    JSON.stringify(
                      {
                        format: "floatboat-mirofish-v1",
                        title: p.title,
                        data: p.data,
                        draft: p.draft,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
                p.title + ".json",
              )
            }
          >
            <Download aria-hidden="true" size={15} />
            复核工程
          </button>
          <button disabled={!mutable} onClick={() => bundle.current?.click()}>
            打开工程
          </button>
        </nav>
        <input
          ref={file}
          hidden
          type="file"
          aria-label="导入原生结果文件"
          accept=".json,.jsonl"
          onChange={(e) => {
            void readNative(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={bundle}
          hidden
          type="file"
          aria-label="导入复核工程文件"
          accept=".json"
          onChange={(e) => {
            void importBundle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>
      <div className="savebar">
        <span className={"save-state " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <span>
          {p.data.origin === "example"
            ? "人工示例 · 非模拟运行"
            : p.data.origin === "service"
              ? "来自MiroFish服务"
              : "来自导入文件"}
        </span>
        <button onClick={() => p.exportDraft()}>恢复草稿</button>
        {["offline", "conflict"].includes(p.autoState.phase) ? (
          <>
            <button onClick={() => void p.save()}>重试保存</button>
            {p.current ? (
              <button onClick={() => void p.open(p.current!.id)}>
                打开服务器版本
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <Notice error={p.error} notice={p.notice} />
      <div className="workspace">
        <aside className="rail">
          <div className="rail-title">
            <Users aria-hidden="true" size={18} />
            <h1>角色与假设</h1>
          </div>
          <button
            className={"actor " + (actor === "all" ? "active" : "")}
            onClick={() => p.setDraft((d) => ({ ...d, actor: "all" }))}
          >
            全部角色<span>{actors.length}</span>
          </button>
          {actors.map((a) => (
            <button
              key={actorKey(a)}
              className={"actor " + (actor === actorKey(a) ? "active" : "")}
              onClick={() => p.setDraft((d) => ({ ...d, actor: actorKey(a) }))}
            >
              <span className={"avatar " + a.platform}>
                {(a.agent_name || String(a.agent_id)).slice(0, 1)}
              </span>
              <span>
                {a.agent_name || "角色 " + a.agent_id}
                <small>
                  {a.platform.toUpperCase()} · {a.agent_id}
                </small>
              </span>
            </button>
          ))}
          {actor !== "all" ? (
            <label>
              角色复核说明
              <textarea
                disabled={!mutable}
                value={p.data.actors[actor] ?? ""}
                maxLength={5000}
                onChange={(e) =>
                  p.setData((d) => ({
                    ...d,
                    actors: { ...d.actors, [actor]: e.target.value },
                  }))
                }
              />
            </label>
          ) : null}
          <label>
            背景材料
            <textarea
              aria-label="背景材料"
              disabled={!mutable}
              value={p.data.background}
              maxLength={15000}
              onChange={(e) =>
                p.setData((d) => ({ ...d, background: e.target.value }))
              }
            />
          </label>
          <label>
            假设与限制
            <textarea
              aria-label="假设与限制"
              disabled={!mutable}
              value={p.data.assumptions}
              maxLength={15000}
              onChange={(e) =>
                p.setData((d) => ({ ...d, assumptions: e.target.value }))
              }
            />
          </label>
          <div className="connection">
            <span>{service.message}</span>
            <button onClick={() => void check()}>重新检查</button>
            {service.available ? (
              <label>
                读取已有模拟
                <select
                  disabled={!mutable}
                  value=""
                  onChange={(e) => void fromService(e.target.value)}
                >
                  <option value="">选择一份模拟结果</option>
                  {simulations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} · {s.status}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </aside>
        <main id="timeline">
          <div className="summary">
            <div>
              <span className="eyebrow">OBSERVE BEFORE YOU CONCLUDE</span>
              <h2>沿着轮次，检查每一次互动。</h2>
              <p>
                {p.data.sourceName}{" "}
                <span>· {p.data.simulationId || "未命名模拟"}</span>
              </p>
            </div>
            <div className="review-count">
              <strong>
                {reviewed}
                <small> / {p.data.actions.length}</small>
              </strong>
              <span>动作已复核</span>
            </div>
          </div>
          <div className="rounds">
            <button
              className={round === "all" ? "chosen" : ""}
              onClick={() => p.setDraft((d) => ({ ...d, round: "all" }))}
            >
              全部轮次
            </button>
            {rounds.map((r) => (
              <button
                key={r}
                className={round === String(r) ? "chosen" : ""}
                onClick={() => p.setDraft((d) => ({ ...d, round: String(r) }))}
              >
                <b>R{String(r).padStart(2, "0")}</b>
                <span>
                  {p.data.actions.filter((a) => a.round_num === r).length} 动作
                </span>
              </button>
            ))}
          </div>
          <div className="list-heading">
            <span>
              <Filter aria-hidden="true" size={13} />
              动作时间线 · {filtered.length} 条
            </span>
            <button onClick={() => setImportOpen(!importOpen)}>
              原生 JSON / JSONL
            </button>
          </div>
          {importOpen ? (
            <section className="import-panel">
              <label htmlFor="native-raw">原生结果草稿</label>
              <textarea
                id="native-raw"
                spellCheck={false}
                disabled={!mutable}
                value={raw}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, nativeRaw: e.target.value }))
                }
              />
              <label>
                JSONL日志平台
                <select
                  aria-label="日志平台"
                  value={platform}
                  onChange={(e) =>
                    p.setDraft((d) => ({ ...d, logPlatform: e.target.value }))
                  }
                >
                  <option value="">记录自身包含平台</option>
                  <option value="reddit">Reddit日志</option>
                  <option value="twitter">Twitter日志</option>
                </select>
              </label>
              <button disabled={!mutable} onClick={() => void applyNative()}>
                读取为新项目
              </button>
            </section>
          ) : null}
          <div className="actions">
            {filtered.length === 0 ? (
              <p className="empty">
                此范围内没有动作。可切回全部角色/轮次，或导入新的结果。
              </p>
            ) : (
              filtered.map(({ a, i, key }) => (
                <button
                  key={key}
                  className={
                    "action " +
                    a.platform +
                    (chosen?.key === key ? " selected" : "")
                  }
                  onClick={() => p.setDraft((d) => ({ ...d, selected: key }))}
                >
                  <div className="action-meta">
                    <b>R{String(a.round_num).padStart(2, "0")}</b>
                    <strong>{a.agent_name || "角色 " + a.agent_id}</strong>
                    <span>{a.action_type}</span>
                    {p.data.annotations[key]?.reviewed ? (
                      <Check aria-label="已复核" size={15} />
                    ) : null}
                  </div>
                  <p>{content(a)}</p>
                  <small>
                    {a.timestamp || "未记录时间"} · {a.platform} ·{" "}
                    {a.success ? "动作成功" : "动作失败"}
                  </small>
                </button>
              ))
            )}
          </div>
          <section className="conclusion">
            <label>
              人工复核结论
              <textarea
                aria-label="人工复核结论"
                disabled={!mutable}
                maxLength={15000}
                value={p.data.conclusion}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, conclusion: e.target.value }))
                }
              />
            </label>
            <div>
              <button
                onClick={() =>
                  download(
                    new Blob([markdown(p.data)], { type: "text/markdown" }),
                    p.title + ".md",
                  )
                }
              >
                导出复核报告
              </button>
              <button
                onClick={() =>
                  download(
                    new Blob([JSON.stringify(nativeResult(p.data), null, 2)], {
                      type: "application/json",
                    }),
                    "mirofish-actions.json",
                  )
                }
              >
                导出原生动作
              </button>
            </div>
          </section>
        </main>
        <ReviewPanel {...desk} />
      </div>
    </>
  );
}
