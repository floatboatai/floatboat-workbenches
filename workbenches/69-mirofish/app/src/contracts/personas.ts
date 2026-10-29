// ABOUTME: 规则人设：按实体类型、图谱度数与初始立场生成可复现的智能体参数与人设文本。
import { rng, round3 } from "./random.ts";
import {
  SILENT_TYPES,
  clamp,
  stanceLabel,
  type Agent,
  type Aspect,
  type Entity,
  type EntityType,
  type Platform,
  type Relation,
} from "./scenario.ts";

type Profile = {
  activity: number;
  influence: number;
  stubbornness: number;
  platform: Platform | "both";
  hours: number[];
  profession: string;
  role: string;
};
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const PROFILES: Record<EntityType, Profile> = {
  政府机构: { activity: 0.35, influence: 3, stubbornness: 0.85, platform: "twitter", hours: range(9, 18), profession: "政务发布", role: "以官方口径发布政策解读与进展，回应集中关切但措辞克制" },
  企业: { activity: 0.45, influence: 1.4, stubbornness: 0.6, platform: "twitter", hours: range(9, 21), profession: "企业运营", role: "关注成本、客流与经营确定性，倾向用数据和案例说话" },
  媒体: { activity: 0.78, influence: 2.6, stubbornness: 0.45, platform: "twitter", hours: range(7, 23), profession: "新闻记者", role: "追踪各方说法与现场情况，放大有冲突性的细节" },
  社会组织: { activity: 0.6, influence: 1.5, stubbornness: 0.65, platform: "both", hours: range(8, 22), profession: "公益与行业组织", role: "代表成员集体发声，提出具体诉求与替代方案" },
  学术机构: { activity: 0.38, influence: 1.8, stubbornness: 0.5, platform: "reddit", hours: range(9, 23), profession: "研究人员", role: "引用测算与文献，强调证据与不确定性" },
  群体: { activity: 0.5, influence: 0.8, stubbornness: 0.3, platform: "both", hours: [...range(7, 9), ...range(12, 13), ...range(18, 23)], profession: "普通公众", role: "从切身生活出发表达感受，容易被身边的说法影响" },
  个人: { activity: 0.55, influence: 1, stubbornness: 0.4, platform: "both", hours: range(8, 23), profession: "关键人物", role: "以个人身份公开表态，观点鲜明" },
  议题: { activity: 0, influence: 0.1, stubbornness: 1, platform: "twitter", hours: [], profession: "", role: "" },
};
const VARIANTS = [
  { tag: "积极发声者", activity: 1.5, stance: 1.35, stubborn: 1.2 },
  { tag: "观望者", activity: 0.6, stance: 0.5, stubborn: 0.8 },
  { tag: "务实派", activity: 1, stance: 0.9, stubborn: 1 },
  { tag: "新加入者", activity: 0.8, stance: 0.3, stubborn: 0.6 },
];

export type PersonaOptions = { perGroup: number; seed: string };
export function generateAgents(
  entities: Entity[],
  relations: Relation[],
  aspects: Aspect[],
  options: PersonaOptions = { perGroup: 3, seed: "personas" },
): Agent[] {
  const r = rng(options.seed);
  const degree = new Map<string, number>();
  for (const rel of relations) {
    degree.set(rel.source, (degree.get(rel.source) ?? 0) + 1);
    degree.set(rel.target, (degree.get(rel.target) ?? 0) + 1);
  }
  const maxDegree = Math.max(1, ...degree.values());
  const agents: Agent[] = [];
  for (const e of entities) {
    if (SILENT_TYPES.includes(e.type)) continue;
    const base = PROFILES[e.type];
    const copies = e.type === "群体" ? Math.max(1, Math.min(4, options.perGroup)) : 1;
    for (let i = 0; i < copies; i++) {
      const v = copies > 1 ? VARIANTS[i % VARIANTS.length] : { tag: "", activity: 1, stance: 1, stubborn: 1 };
      const stance = clamp(e.stance * v.stance + r.normal() * 0.08);
      const centrality = (degree.get(e.id) ?? 0) / maxDegree;
      const id = agents.length;
      const liked = aspects.filter((a) => (a.lean > 0) === (stance >= 0));
      const topics = (liked.length ? liked : aspects).slice(0, 3).map((a) => a.label);
      const name = v.tag ? `${e.name}·${v.tag}` : e.name;
      agents.push({
        id,
        entityId: e.id,
        name,
        handle: "u" + String(1000 + id),
        type: e.type,
        profession: base.profession,
        bio: (e.summary || `${e.name}，本次议题的相关方。`).slice(0, 300),
        persona: personaText(e, name, base.role, stance, topics, v.tag),
        stance: round3(stance),
        activity: round3(clamp(base.activity * v.activity + r.normal() * 0.04, 0.05, 1)),
        influence: round3(clamp(base.influence * (0.75 + centrality * 0.6), 0.1, 5)),
        stubbornness: round3(clamp(base.stubbornness * v.stubborn + r.normal() * 0.03, 0, 0.95)),
        platform: base.platform,
        activeHours: base.hours,
        topics,
        source: "rule",
      });
    }
  }
  return agents;
}
function personaText(e: Entity, name: string, role: string, stance: number, topics: string[], tag: string) {
  const focus = topics.length ? `最常提到${topics.join("、")}` : "关注事情对自己的直接影响";
  const style = tag === "积极发声者" ? "每天多次发帖、乐于转发同伴观点" : tag === "观望者" ? "多看少说，只在被触动时发言" : tag === "新加入者" ? "刚开始关注此事，立场容易摇摆" : "";
  return `${name}（${e.type}）。${role}。当前${stanceLabel(stance)}，${focus}。${style ? style + "。" : ""}`;
}
