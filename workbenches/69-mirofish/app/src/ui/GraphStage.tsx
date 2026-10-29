// ABOUTME: 图谱阶段：可拖动的实体关系画布、连线模式、实体/关系检查器与可访问的列表视图。
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Plus, Link2, LayoutGrid, Trash2, List } from "lucide-react";
import { ENTITY_TYPES, RELATION_TYPES, newId, stanceLabel, type Entity, type Relation, type RelationType } from "../contracts/scenario";
import { layoutGraph } from "../contracts/extract";
import { stanceColor, typeColor } from "./charts";
import type { Studio } from "./useStudio";

const REL_STYLE: Record<RelationType, { color: string; dash?: string }> = {
  支持: { color: "#2b7a84" },
  反对: { color: "#bf4f2e" },
  质疑: { color: "#d08a3a" },
  监管: { color: "#6b4f86" },
  合作: { color: "#33557a" },
  报道: { color: "#8b8679", dash: "5 4" },
  隶属: { color: "#8b8679", dash: "2 3" },
  竞争: { color: "#9a3b2a", dash: "6 3" },
  关联: { color: "#bdb6a6" },
};
const W = 1000,
  H = 640;

export function GraphStage({ st }: { st: Studio }) {
  const { p, s, mutable } = st;
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [listView, setListView] = useState(false);
  const selEntity = typeof p.draft.selEntity === "string" ? p.draft.selEntity : "";
  const selRelation = typeof p.draft.selRelation === "string" ? p.draft.selRelation : "";
  const entity = s.entities.find((e) => e.id === selEntity);
  const relation = s.relations.find((r) => r.id === selRelation);
  const pos = (e: Entity) => (drag?.id === e.id ? drag : e);
  const byId = new Map(s.entities.map((e) => [e.id, e]));
  const select = (kind: "entity" | "relation", id: string) => p.setDraft((d) => ({ ...d, selEntity: kind === "entity" ? id : "", selRelation: kind === "relation" ? id : "" }));
  const point = (ev: { clientX: number; clientY: number }) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return { x: Math.round(Math.min(W - 20, Math.max(20, pt.x))), y: Math.round(Math.min(H - 20, Math.max(20, pt.y))) };
  };
  const patchEntity = (id: string, patch: Partial<Entity>) => p.setData((d) => ({ ...d, entities: d.entities.map((e) => (e.id === id ? { ...e, ...patch, source: patch.x === undefined ? "manual" : e.source } : e)) }));
  const patchRelation = (id: string, patch: Partial<Relation>) => p.setData((d) => ({ ...d, relations: d.relations.map((r) => (r.id === id ? { ...r, ...patch, source_kind: "manual" } : r)) }));
  function removeEntity(id: string) {
    p.setData((d) => ({ ...d, entities: d.entities.filter((e) => e.id !== id), relations: d.relations.filter((r) => r.source !== id && r.target !== id) }));
    select("entity", "");
  }
  function removeRelation(id: string) {
    p.setData((d) => ({ ...d, relations: d.relations.filter((r) => r.id !== id) }));
    select("relation", "");
  }
  function addEntity() {
    const id = newId("e");
    p.setData((d) => ({ ...d, entities: [...d.entities, { id, name: "新实体", type: "群体", summary: "", stance: 0, mentions: 0, x: W / 2 + ((d.entities.length * 37) % 200) - 100, y: H / 2 + ((d.entities.length * 53) % 160) - 80, source: "manual" }] }));
    select("entity", id);
  }
  function clickNode(id: string) {
    if (!linking) return select("entity", id);
    if (!linkFrom) return setLinkFrom(id);
    if (linkFrom !== id) {
      const rid = newId("r");
      p.setData((d) => ({ ...d, relations: [...d.relations, { id: rid, source: linkFrom, target: id, type: "关联", evidence: "", source_kind: "manual" }] }));
      select("relation", rid);
    }
    setLinkFrom(null);
    setLinking(false);
  }
  const agentsOf = (id: string) => s.agents.filter((a) => a.entityId === id).length;
  return (
    <div className="graph-layout">
      <section className="panel canvas-panel">
        <div className="toolbar" role="toolbar" aria-label="图谱工具">
          <button disabled={!mutable} onClick={addEntity}>
            <Plus size={15} aria-hidden="true" />
            实体
          </button>
          <button aria-pressed={linking} disabled={!mutable || s.entities.length < 2} onClick={() => (setLinking(!linking), setLinkFrom(null))}>
            <Link2 size={15} aria-hidden="true" />
            {linking ? (linkFrom ? "点击终点实体" : "点击起点实体") : "连线"}
          </button>
          <button disabled={!mutable || !s.entities.length} onClick={() => p.setData((d) => ({ ...d, entities: layoutGraph(d.entities, d.relations, true) }))}>
            <LayoutGrid size={15} aria-hidden="true" />
            重新布局
          </button>
          <button aria-pressed={listView} onClick={() => setListView(!listView)}>
            <List size={15} aria-hidden="true" />
            列表
          </button>
          <span className="muted counts">
            {s.entities.length} 实体 · {s.relations.length} 关系
          </span>
        </div>
        {s.entities.length === 0 ? (
          <div className="empty-state">
            <h2>还没有图谱</h2>
            <p>回到“资料”阶段从种子资料抽取，或直接添加实体并连线。</p>
            <div className="row">
              <button className="primary" onClick={() => st.setStage("seed")}>
                去抽取
              </button>
              <button disabled={!mutable} onClick={addEntity}>
                手动添加实体
              </button>
            </div>
          </div>
        ) : listView ? (
          <GraphList st={st} select={select} />
        ) : (
          <div className="canvas-wrap">
            <svg
              ref={svg}
              viewBox={`0 0 ${W} ${H}`}
              className="graph"
              role="application"
              aria-label="实体关系图谱。选中实体后可在右侧编辑，Delete 删除。"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Delete" || e.key === "Backspace") && mutable) {
                  if (entity) removeEntity(entity.id);
                  else if (relation) removeRelation(relation.id);
                }
                if (e.key === "Escape") (setLinking(false), setLinkFrom(null), select("entity", ""));
              }}
              onPointerMove={(e) => drag && setDrag({ id: drag.id, ...point(e) })}
              onPointerUp={() => {
                if (drag) {
                  const before = byId.get(drag.id);
                  if (before && (before.x !== drag.x || before.y !== drag.y)) patchEntity(drag.id, { x: drag.x, y: drag.y });
                  setDrag(null);
                }
              }}
            >
              <defs>
                {Object.entries(REL_STYLE).map(([t, v]) => (
                  <marker key={t} id={"arrow-" + t} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill={v.color} />
                  </marker>
                ))}
              </defs>
              {s.relations.map((r) => {
                const a = byId.get(r.source),
                  b = byId.get(r.target);
                if (!a || !b) return null;
                const pa = pos(a),
                  pb = pos(b);
                const d = Math.max(1, Math.hypot(pb.x - pa.x, pb.y - pa.y));
                const rb = radius(b) + 3;
                const tx = pb.x - ((pb.x - pa.x) / d) * rb,
                  ty = pb.y - ((pb.y - pa.y) / d) * rb;
                const style = REL_STYLE[r.type];
                return (
                  <g key={r.id} className={"edge" + (r.id === selRelation ? " selected" : "")} onClick={() => select("relation", r.id)}>
                    <line x1={pa.x} y1={pa.y} x2={tx} y2={ty} stroke="transparent" strokeWidth="12" />
                    <line x1={pa.x} y1={pa.y} x2={tx} y2={ty} stroke={style.color} strokeWidth={r.id === selRelation ? 3 : 1.6} strokeDasharray={style.dash} markerEnd={`url(#arrow-${r.type})`} />
                    <text x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 - 4} fontSize="11" fill={style.color} textAnchor="middle" className="edge-label">
                      {r.type === "关联" ? "" : r.type}
                    </text>
                  </g>
                );
              })}
              {s.entities.map((e) => {
                const at = pos(e);
                const rad = radius(e);
                return (
                  <g
                    key={e.id}
                    className={"node" + (e.id === selEntity ? " selected" : "") + (linkFrom === e.id ? " linking" : "")}
                    transform={`translate(${at.x},${at.y})`}
                    onPointerDown={(ev: ReactPointerEvent<SVGGElement>) => {
                      if (!mutable || linking) return;
                      (ev.currentTarget.ownerSVGElement ?? ev.currentTarget).setPointerCapture?.(ev.pointerId);
                      setDrag({ id: e.id, x: e.x, y: e.y });
                    }}
                    onClick={() => clickNode(e.id)}
                  >
                    <circle r={rad} fill={e.type === "议题" ? "#20292c" : stanceColor(e.stance)} stroke={typeColor(e.type)} strokeWidth={e.id === selEntity ? 4 : 2.5} />
                    <text y={4} fontSize="11" textAnchor="middle" fill={e.type === "议题" || Math.abs(e.stance) > 0.55 ? "#fff" : "#20292c"} fontWeight="600">
                      {e.type.slice(0, 2)}
                    </text>
                    <text y={rad + 14} fontSize="12.5" textAnchor="middle" className="node-label">
                      {e.name.length > 12 ? e.name.slice(0, 11) + "…" : e.name}
                    </text>
                    <title>{`${e.name}（${e.type}）初始立场 ${e.stance.toFixed(2)} ${stanceLabel(e.stance)}`}</title>
                  </g>
                );
              })}
            </svg>
            <ul className="legend" aria-label="关系图例">
              {RELATION_TYPES.map((t) => (
                <li key={t}>
                  <svg width="22" height="8" aria-hidden="true">
                    <line x1="0" y1="4" x2="22" y2="4" stroke={REL_STYLE[t].color} strokeWidth="2" strokeDasharray={REL_STYLE[t].dash} />
                  </svg>
                  {t}
                </li>
              ))}
              <li className="legend-stance">
                <span style={{ background: stanceColor(-0.8) }} />
                反对 · 中立 · 支持
                <span style={{ background: stanceColor(0.8) }} />
              </li>
            </ul>
          </div>
        )}
      </section>
      <aside className="panel inspector" aria-label="检查器">
        {entity ? (
          <>
            <span className="eyebrow">实体</span>
            <label>
              名称
              <input value={entity.name} maxLength={60} disabled={!mutable} onChange={(e) => patchEntity(entity.id, { name: e.target.value })} />
            </label>
            {!entity.name.trim() ? <p className="error-text">名称不能为空（草稿已保留）</p> : null}
            <label>
              类型
              <select value={entity.type} disabled={!mutable} onChange={(e) => patchEntity(entity.id, { type: e.target.value as Entity["type"] })}>
                {ENTITY_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              初始立场 <output>{entity.stance.toFixed(2)} · {stanceLabel(entity.stance)}</output>
              <input type="range" min={-1} max={1} step={0.05} value={entity.stance} disabled={!mutable} onChange={(e) => patchEntity(entity.id, { stance: Number(e.target.value) })} />
            </label>
            <label>
              说明与依据
              <textarea rows={5} value={entity.summary} maxLength={2000} disabled={!mutable} onChange={(e) => patchEntity(entity.id, { summary: e.target.value })} />
            </label>
            <p className="muted">
              来源：{entity.source === "rule" ? "规则抽取" : entity.source === "host" ? "模型" : "人工"} · 资料中提及 {entity.mentions} 次 · {agentsOf(entity.id)} 个智能体
            </p>
            <h3>关系</h3>
            <ul className="mini-list">
              {s.relations
                .filter((r) => r.source === entity.id || r.target === entity.id)
                .map((r) => (
                  <li key={r.id}>
                    <button onClick={() => select("relation", r.id)}>
                      {byId.get(r.source)?.name} → {r.type} → {byId.get(r.target)?.name}
                    </button>
                  </li>
                ))}
            </ul>
            <button className="danger" disabled={!mutable} onClick={() => removeEntity(entity.id)}>
              <Trash2 size={15} aria-hidden="true" />
              删除实体
            </button>
          </>
        ) : relation ? (
          <>
            <span className="eyebrow">关系</span>
            <p className="relation-ends">
              {byId.get(relation.source)?.name} → {byId.get(relation.target)?.name}
            </p>
            <label>
              关系类型
              <select value={relation.type} disabled={!mutable} onChange={(e) => patchRelation(relation.id, { type: e.target.value as RelationType })}>
                {RELATION_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              资料依据
              <textarea rows={4} value={relation.evidence} maxLength={600} disabled={!mutable} onChange={(e) => patchRelation(relation.id, { evidence: e.target.value })} />
            </label>
            <div className="row">
              <button disabled={!mutable} onClick={() => patchRelation(relation.id, { source: relation.target, target: relation.source })}>
                调换方向
              </button>
              <button className="danger" disabled={!mutable} onClick={() => removeRelation(relation.id)}>
                <Trash2 size={15} aria-hidden="true" />
                删除关系
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="eyebrow">图谱</span>
            <p>点选实体或关系进行编辑；拖动实体调整位置。节点底色表示初始立场，描边颜色表示类型。</p>
            <ul className="type-counts">
              {ENTITY_TYPES.map((t) => {
                const n = s.entities.filter((e) => e.type === t).length;
                return n ? (
                  <li key={t}>
                    <i style={{ background: typeColor(t) }} aria-hidden="true" />
                    {t} <b>{n}</b>
                  </li>
                ) : null;
              })}
            </ul>
            <button className="primary" disabled={!s.entities.length} onClick={() => st.setStage("agents")}>
              下一步：生成人设 →
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
const radius = (e: Entity) => (e.type === "议题" ? 26 : 15 + Math.min(10, e.mentions * 1.5));

function GraphList({ st, select }: { st: Studio; select: (kind: "entity" | "relation", id: string) => void }) {
  const { s } = st;
  const name = (id: string) => s.entities.find((e) => e.id === id)?.name ?? "?";
  return (
    <div className="graph-list">
      <table>
        <caption>实体</caption>
        <thead>
          <tr>
            <th scope="col">名称</th>
            <th scope="col">类型</th>
            <th scope="col">初始立场</th>
            <th scope="col">提及</th>
          </tr>
        </thead>
        <tbody>
          {s.entities.map((e) => (
            <tr key={e.id}>
              <td>
                <button className="link" onClick={() => select("entity", e.id)}>
                  {e.name || "（未命名）"}
                </button>
              </td>
              <td>{e.type}</td>
              <td>
                <span className="dot" style={{ background: stanceColor(e.stance) }} aria-hidden="true" />
                {e.stance.toFixed(2)}
              </td>
              <td>{e.mentions}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table>
        <caption>关系</caption>
        <thead>
          <tr>
            <th scope="col">起点</th>
            <th scope="col">类型</th>
            <th scope="col">终点</th>
          </tr>
        </thead>
        <tbody>
          {s.relations.map((r) => (
            <tr key={r.id}>
              <td>{name(r.source)}</td>
              <td>
                <button className="link" onClick={() => select("relation", r.id)}>
                  {r.type}
                </button>
              </td>
              <td>{name(r.target)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
