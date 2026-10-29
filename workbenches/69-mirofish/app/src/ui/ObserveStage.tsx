// ABOUTME: 观察阶段：舆情构成、平均立场与极化、群体走势、智能体立场热力条与按轮次筛选的动作时间线。
import { useMemo } from "react";
import { Download } from "lucide-react";
import { ShareChart, MeanChart, GroupChart, Heatmap, stanceColor } from "./charts";
import { download } from "./requests";
import { safeName, type Studio } from "./useStudio";
import { actionsJsonl, agentsCsv, graphJson, roundsCsv } from "../contracts/report";
import { content, type Action } from "../contracts/simulation";
import { stanceLabel } from "../contracts/scenario";

const ACTION_LABEL: Record<string, string> = { CREATE_POST: "发帖", CREATE_COMMENT: "评论", QUOTE_POST: "引用", REPOST: "转发", LIKE_POST: "点赞", DISLIKE_POST: "点踩", FOLLOW: "关注", DO_NOTHING: "无动作" };
const PAGE = 120;
function describe(a: Action) {
  const args = a.action_args;
  if (a.action_type === "FOLLOW") return `关注了 ${String(args.followee_name ?? args.followee_id ?? "")}`;
  if (["LIKE_POST", "DISLIKE_POST", "REPOST"].includes(a.action_type)) {
    const who = args.post_author_name ?? args.original_author_name;
    return `${ACTION_LABEL[a.action_type]}了${who ? " " + String(who) + " 的" : ""}帖子 #${String(args.post_id ?? "")}`;
  }
  return content(a);
}
const pct = (v: number) => Math.round(v * 100) + "%";

export function ObserveStage({ st }: { st: Studio }) {
  const { p, s, result, activeRun } = st;
  const roundRaw = typeof p.draft.round === "string" ? p.draft.round : "all";
  const actor = typeof p.draft.actor === "string" ? p.draft.actor : "all";
  const kind = typeof p.draft.kind === "string" ? p.draft.kind : "content";
  const page = typeof p.draft.page === "number" ? p.draft.page : 0;
  const round = roundRaw === "all" ? undefined : Number(roundRaw);
  const rows = useMemo(() => {
    if (!result) return [];
    return result.actions
      .map((a, i) => ({ a, s: result.actionStance[i] ?? 0, i }))
      .filter(({ a }) => (round === undefined || a.round_num === round) && (actor === "all" || String(a.agent_id) === actor) && (kind === "all" || (kind === "content" ? ["CREATE_POST", "CREATE_COMMENT", "QUOTE_POST"].includes(a.action_type) : a.action_type === kind)));
  }, [result, round, actor, kind]);
  if (!activeRun)
    return (
      <div className="panel empty-state">
        <h2>还没有推演结果</h2>
        <p>在“推演”阶段运行本地推演，或从推演档案导入 MiroFish 的原生结果。</p>
        <button className="primary" onClick={() => st.setStage("run")}>
          去推演
        </button>
      </div>
    );
  if (!result)
    return (
      <div className="panel empty-state" role="status">
        {st.resultError && st.resultError !== "loading" ? (
          <>
            <h2>结果没有载入</h2>
            <p className="error-text">{st.resultError}</p>
            <button onClick={() => void st.loadResult(activeRun)}>重试</button>
          </>
        ) : (
          <p>正在载入 {activeRun.label}…</p>
        )}
      </div>
    );
  const first = result.rounds[0],
    last = result.rounds[result.rounds.length - 1];
  const cur = round === undefined ? last : result.rounds.find((r) => r.round === round) ?? last;
  const setRound = (r: number | "all") => p.setDraft((d) => ({ ...d, round: String(r), page: 0 }));
  const exp = (text: string, name: string, type: string) => download(new Blob([text], { type }), `${safeName(p.title)}-${name}`);
  const lexicon = result.stanceKind === "lexicon";
  return (
    <div className="observe-layout">
      <section className="panel observe-head">
        <label className="run-pick">
          运行
          <select value={activeRun.id} onChange={(e) => st.selectRun(e.target.value)}>
            {s.runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <dl className="kpis">
          <div>
            <dt>支持</dt>
            <dd style={{ color: "var(--support)" }}>
              {pct(cur.support)} <small>初始 {pct(first.support)}</small>
            </dd>
          </div>
          <div>
            <dt>中立</dt>
            <dd>
              {pct(cur.neutral)} <small>初始 {pct(first.neutral)}</small>
            </dd>
          </div>
          <div>
            <dt>反对</dt>
            <dd style={{ color: "var(--oppose)" }}>
              {pct(cur.oppose)} <small>初始 {pct(first.oppose)}</small>
            </dd>
          </div>
          <div>
            <dt>平均立场</dt>
            <dd>
              {cur.mean > 0 ? "+" : ""}
              {cur.mean.toFixed(2)} <small>{stanceLabel(cur.mean)}</small>
            </dd>
          </div>
          <div>
            <dt>极化</dt>
            <dd>
              {cur.polarization.toFixed(2)} <small>4×支持×反对</small>
            </dd>
          </div>
          <div>
            <dt>{round === undefined ? "全部动作" : `第 ${round} 轮动作`}</dt>
            <dd>{round === undefined ? result.actions.length : cur.posts + cur.comments + cur.likes + cur.reposts}</dd>
          </div>
        </dl>
        <div className="export-row">
          <span className="muted">
            {activeRun.engine === "local" ? `可复现：种子 ${activeRun.input?.params.seed} · 指纹 ${result.fingerprint}` : `来源：${activeRun.sourceName}`}
            {activeRun.robustness ? ` · 5 种子支持占比 ${pct(Math.min(...activeRun.robustness.endSupport))}–${pct(Math.max(...activeRun.robustness.endSupport))}` : ""}
          </span>
          <button onClick={() => exp(roundsCsv(result), "rounds.csv", "text/csv")}>
            <Download size={14} aria-hidden="true" />
            逐轮指标 CSV
          </button>
          <button onClick={() => exp(agentsCsv(result), "agents.csv", "text/csv")}>智能体 CSV</button>
          <button onClick={() => exp(actionsJsonl(result), "actions.jsonl", "application/x-ndjson")}>原生动作 JSONL</button>
          {s.entities.length ? <button onClick={() => exp(graphJson(s), "graph.json", "application/json")}>图谱 JSON</button> : null}
        </div>
        {lexicon ? <p className="warn">导入结果的立场是按动作文本的词典估计，不是 MiroFish 模型立场；动作数量与时间线是精确统计。</p> : null}
        {result.truncated ? <p className="warn">动作数达到 80000 条上限，后续轮次被截断；请减少智能体或轮次。</p> : null}
      </section>
      <section className="panel chart-card wide">
        <h2>
          舆情构成 <small>点击图表选择轮次 · 圆点为事件</small>
        </h2>
        <ShareChart result={result} round={round} onRound={setRound} />
        <div className="chart-legend">
          <span><i style={{ background: "var(--support)" }} />支持（&gt;0.2）</span>
          <span><i style={{ background: "var(--neutral)" }} />中立</span>
          <span><i style={{ background: "var(--oppose)" }} />反对（&lt;-0.2）</span>
          {result.events.map((e, k) => (
            <span key={e.id + k} className="event-chip">
              {k + 1}. R{e.round} {e.title}
            </span>
          ))}
        </div>
      </section>
      <section className="panel chart-card">
        <h2>
          平均立场与极化 <small>实线：平均（±标准差带）· 虚线：极化</small>
        </h2>
        <MeanChart result={result} round={round} />
      </section>
      <section className="panel chart-card">
        <h2>群体走势</h2>
        <GroupChart result={result} />
      </section>
      <section className="panel chart-card wide heat">
        <h2>
          智能体立场 <small>点击一行筛选时间线</small>
        </h2>
        <div className="scroll-x">
          <Heatmap result={result} selected={actor === "all" ? undefined : Number(actor)} onAgent={(id) => p.setDraft((d) => ({ ...d, actor: d.actor === String(id) ? "all" : String(id), page: 0 }))} onRound={setRound} />
        </div>
      </section>
      <section className="panel timeline wide" aria-label="动作时间线">
        <div className="timeline-head">
          <h2>时间线</h2>
          <label className="inline">
            轮次
            <select value={roundRaw} onChange={(e) => setRound(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">全部</option>
              {result.rounds.slice(1).map((r) => (
                <option key={r.round} value={r.round}>
                  第 {r.round} 轮{r.time ? " · " + r.time.slice(5, 16).replace("T", " ") : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="inline">
            角色
            <select value={actor} onChange={(e) => p.setDraft((d) => ({ ...d, actor: e.target.value, page: 0 }))}>
              <option value="all">全部</option>
              {result.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline">
            动作
            <select value={kind} onChange={(e) => p.setDraft((d) => ({ ...d, kind: e.target.value, page: 0 }))}>
              <option value="content">发帖/评论/引用</option>
              <option value="all">全部</option>
              {Object.entries(ACTION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">{rows.length} 条</span>
        </div>
        {rows.length === 0 ? <p className="muted">此范围内没有动作。</p> : null}
        <ol className="feed">
          {rows.slice(page * PAGE, page * PAGE + PAGE).map(({ a, s: stance, i }) => (
            <li key={i} className={"post " + a.platform}>
              <span className="stance-mark" style={{ background: stanceColor(stance) }} title={`立场 ${stance.toFixed(2)}`} aria-hidden="true" />
              <div>
                <div className="post-meta">
                  <b>{a.agent_name || "角色 " + a.agent_id}</b>
                  <span className="tag">{ACTION_LABEL[a.action_type] ?? a.action_type}</span>
                  <span>
                    R{a.round_num} · {a.timestamp.slice(5, 16).replace("T", " ")} · {a.platform === "twitter" ? "Twitter" : "Reddit"}
                  </span>
                </div>
                <p>{describe(a)}</p>
                {typeof a.action_args.original_content === "string" || typeof a.action_args.post_content === "string" ? <blockquote>{String(a.action_args.original_content ?? a.action_args.post_content)}</blockquote> : null}
              </div>
            </li>
          ))}
        </ol>
        {rows.length > PAGE ? (
          <div className="pager">
            <button disabled={page === 0} onClick={() => p.setDraft((d) => ({ ...d, page: page - 1 }))}>
              上一页
            </button>
            <span>
              {page + 1} / {Math.ceil(rows.length / PAGE)}
            </span>
            <button disabled={(page + 1) * PAGE >= rows.length} onClick={() => p.setDraft((d) => ({ ...d, page: page + 1 }))}>
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
