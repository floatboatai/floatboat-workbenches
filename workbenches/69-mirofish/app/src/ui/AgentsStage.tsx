// ABOUTME: 人设阶段：按图谱规则生成智能体、可选 Floatboat 模型改写人设、名册与逐个参数编辑。
import { useState } from "react";
import { Sparkles, Users, RefreshCw } from "lucide-react";
import { stanceLabel, type Agent } from "../contracts/scenario";
import { stanceColor, typeColor } from "./charts";
import type { Studio } from "./useStudio";

const PLATFORM = { twitter: "Twitter", reddit: "Reddit", both: "双平台" } as const;

export function AgentsStage({ st }: { st: Studio }) {
  const { p, s, mutable } = st;
  const [perGroup, setPerGroup] = useState(3);
  const [confirm, setConfirm] = useState(false);
  const sel = typeof p.draft.selAgent === "string" ? Number(p.draft.selAgent) : NaN;
  const agent = s.agents.find((a) => a.id === sel) ?? s.agents[0];
  const patch = (id: number, x: Partial<Agent>) => p.setData((d) => ({ ...d, agents: d.agents.map((a) => (a.id === id ? { ...a, ...x, source: "manual" } : a)) }));
  const regenerate = () => (s.agents.length && !confirm ? setConfirm(true) : (setConfirm(false), st.generate(perGroup)));
  const suggestion = st.personaSuggestion;
  return (
    <div className="agents-layout">
      <section className="panel agent-tools">
        <div className="tool-block">
          <h2>
            <Users size={16} aria-hidden="true" />
            规则人设
          </h2>
          <p className="muted">每个可发言实体生成一个智能体；群体按“积极发声者 / 观望者 / 务实派 / 新加入者”拆分。活跃度、影响力（随图谱度数）与坚持度按类型设定。</p>
          <div className="row">
            <label className="inline">
              每个群体
              <select value={perGroup} onChange={(e) => setPerGroup(Number(e.target.value))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} 个
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" disabled={!mutable || !s.entities.length} onClick={regenerate}>
              {s.agents.length ? (confirm ? "确认覆盖现有人设" : "重新生成") : "按图谱生成人设"}
            </button>
            {confirm ? <button onClick={() => setConfirm(false)}>取消</button> : null}
          </div>
        </div>
        <div className="tool-block host">
          <h2>
            <Sparkles size={16} aria-hidden="true" />
            Floatboat 模型改写（可选）
          </h2>
          <p className="muted">把实体列表、议题要点与前 6000 字资料发给 Floatboat 模型，生成更细的简介与人设文本，确认后才写入。</p>
          <p className={"status-line " + (st.model.available ? "ok" : "off")} role="status">
            {st.model.available ? `模型可用：${st.model.model}` : "未连接 Floatboat：请启动并登录 Floatboat 客户端后重新检查。规则人设不受影响。"}
          </p>
          <div className="row">
            <button disabled={!mutable || !st.model.available || !s.agents.length} onClick={() => void st.hostPersonas()}>
              用模型改写人设
            </button>
            <button className="ghost" onClick={() => void st.checkModel()}>
              <RefreshCw size={14} aria-hidden="true" />
              重新检查
            </button>
          </div>
        </div>
        {suggestion ? (
          <div className="tool-block suggestion" role="region" aria-label="模型人设建议">
            <h3>模型建议 · {suggestion.model}</h3>
            <ul>
              {suggestion.personas.map((x) => (
                <li key={x.entityId}>
                  <b>{s.entities.find((e) => e.id === x.entityId)?.name}</b> {stanceLabel(x.stance)} · {x.profession}
                  <p>{x.persona}</p>
                </li>
              ))}
            </ul>
            <div className="row">
              <button className="primary" disabled={!mutable} onClick={st.applyPersonas}>
                采用
              </button>
              <button onClick={() => st.discard("personaSuggestion")}>放弃</button>
            </div>
          </div>
        ) : null}
      </section>
      <section className="panel roster">
        {s.agents.length === 0 ? (
          <div className="empty-state">
            <h2>还没有智能体</h2>
            <p>{s.entities.length ? "按图谱生成规则人设，之后可逐个修改。" : "先在“图谱”阶段准备实体。"}</p>
          </div>
        ) : (
          <table className="roster-table">
            <thead>
              <tr>
                <th scope="col">智能体</th>
                <th scope="col">平台</th>
                <th scope="col">立场</th>
                <th scope="col">活跃</th>
                <th scope="col">影响</th>
              </tr>
            </thead>
            <tbody>
              {s.agents.map((a) => (
                <tr key={a.id} className={a.id === agent?.id ? "selected" : ""}>
                  <td>
                    <button className="link" onClick={() => st.setPick("selAgent", String(a.id))}>
                      <i className="type-dot" style={{ background: typeColor(a.type) }} aria-hidden="true" />
                      {a.name || "（未命名）"}
                      <small>
                        @{a.handle} · {a.type}
                        {a.source === "host" ? " · 模型" : a.source === "manual" ? " · 已改" : ""}
                      </small>
                    </button>
                  </td>
                  <td>{PLATFORM[a.platform]}</td>
                  <td>
                    <span className="stance-bar" aria-label={`${a.stance.toFixed(2)} ${stanceLabel(a.stance)}`}>
                      <span style={{ left: `${((a.stance + 1) / 2) * 100}%`, background: stanceColor(a.stance) }} />
                    </span>
                  </td>
                  <td>{Math.round(a.activity * 100)}%</td>
                  <td>{a.influence.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {agent ? (
        <aside className="panel inspector agent-editor" aria-label="智能体编辑">
          <span className="eyebrow">智能体 #{agent.id}</span>
          <label>
            名称
            <input value={agent.name} maxLength={60} disabled={!mutable} onChange={(e) => patch(agent.id, { name: e.target.value })} />
          </label>
          <div className="two">
            <label>
              职业
              <input value={agent.profession} maxLength={80} disabled={!mutable} onChange={(e) => patch(agent.id, { profession: e.target.value })} />
            </label>
            <label>
              平台
              <select value={agent.platform} disabled={!mutable} onChange={(e) => patch(agent.id, { platform: e.target.value as Agent["platform"] })}>
                <option value="both">双平台</option>
                <option value="twitter">Twitter</option>
                <option value="reddit">Reddit</option>
              </select>
            </label>
          </div>
          <Slider label="立场" value={agent.stance} min={-1} max={1} step={0.05} text={stanceLabel(agent.stance)} disabled={!mutable} onChange={(v) => patch(agent.id, { stance: v })} />
          <Slider label="活跃度" value={agent.activity} min={0} max={1} step={0.05} text={`${Math.round(agent.activity * 100)}%`} disabled={!mutable} onChange={(v) => patch(agent.id, { activity: v })} />
          <Slider label="影响力" value={agent.influence} min={0.1} max={5} step={0.1} text={agent.influence.toFixed(1)} disabled={!mutable} onChange={(v) => patch(agent.id, { influence: v })} />
          <Slider label="坚持度" value={agent.stubbornness} min={0} max={1} step={0.05} text={agent.stubbornness >= 0.7 ? "很难被说服" : agent.stubbornness <= 0.3 ? "容易被影响" : "中等"} disabled={!mutable} onChange={(v) => patch(agent.id, { stubbornness: v })} />
          <fieldset className="hours">
            <legend>活跃时段</legend>
            <div>
              {Array.from({ length: 24 }, (_, h) => (
                <label key={h} className={agent.activeHours.includes(h) ? "on" : ""}>
                  <input
                    type="checkbox"
                    checked={agent.activeHours.includes(h)}
                    disabled={!mutable}
                    onChange={(e) => patch(agent.id, { activeHours: e.target.checked ? [...agent.activeHours, h].sort((a, b) => a - b) : agent.activeHours.filter((x) => x !== h) })}
                  />
                  {h}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            简介
            <textarea rows={2} value={agent.bio} maxLength={600} disabled={!mutable} onChange={(e) => patch(agent.id, { bio: e.target.value })} />
          </label>
          <label>
            人设
            <textarea rows={5} value={agent.persona} maxLength={3000} disabled={!mutable} onChange={(e) => patch(agent.id, { persona: e.target.value })} />
          </label>
          <label>
            关注议题
            <input value={agent.topics.join("、")} disabled={!mutable} onChange={(e) => patch(agent.id, { topics: e.target.value.split(/[、,，]/).map((t) => t.trim()).slice(0, 8) })} />
          </label>
        </aside>
      ) : null}
    </div>
  );
}

function Slider({ label, value, min, max, step, text, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; text: string; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>
        {label}
        <output>
          {value.toFixed(2)} · {text}
        </output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
