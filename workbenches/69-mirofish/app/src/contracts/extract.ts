// ABOUTME: 无模型的规则抽取：从中文种子资料识别机构/群体/人物、句内关系、初始立场与议题要点，结果待人工确认。
import { lexiconScore } from "./lexicon.ts";
import { hash53 } from "./random.ts";
import {
  ENTITY_TYPES,
  clamp,
  type Aspect,
  type Entity,
  type EntityType,
  type Relation,
  type RelationType,
  type SeedDoc,
} from "./scenario.ts";

const SUFFIXES: Array<[RegExp, EntityType]> = [
  [/(?:人大常委会|委员会|管委会|街道办事处|街道办|人民政府|政府|办公室|交警支队|生态环境局|运输局|管理局|规划局|局)$/, "政府机构"],
  [/(?:日报|晚报|都市报|电视台|广播电台|融媒体中心|报社|周刊|新闻|传媒|公众号|自媒体)$/, "媒体"],
  [/(?:研究院|研究所|研究中心|大学|学院|实验室|智库)$/, "学术机构"],
  [/(?:联合会|促进会|协会|商会|基金会|学会|联盟|工会|合作社|业委会|之友|人民医院|医院|小学|中学|学校)$/, "社会组织"],
  [/(?:有限公司|股份公司|公司|集团|银行|物流|商场|超市|车行|4S店)$/, "企业"],
];
const SUFFIX_SCAN =
  /(人大常委会|委员会|管委会|街道办事处|街道办|人民政府|政府|办公室|交警支队|管理局|局|日报|晚报|都市报|电视台|广播电台|融媒体中心|报社|周刊|传媒|公众号|研究院|研究所|研究中心|大学|学院|实验室|智库|联合会|促进会|协会|商会|基金会|学会|联盟|工会|合作社|业委会|之友|人民医院|医院|小学|中学|有限公司|公司|集团|银行|物流|商场|超市|车行)/g;
const ROLES = [
  "居民", "商户", "摊主", "店主", "家长", "学生", "骑手", "司机", "车主", "租户", "业主", "教师",
  "患者", "游客", "网友", "志愿者", "老人", "老年人", "通勤族", "上班族", "从业者", "经营者", "市民",
  "村民", "农户", "工人", "员工", "消费者", "乘客", "开发商", "投资者", "环保人士", "代表",
];
const TITLES =
  /([王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤])(先生|女士|主任|局长|处长|科长|教授|研究员|记者|经理|会长|书记|律师|医生|老师|博士|店主|摊主|师傅|阿姨|大爷)/g;
const LEADING = [
  "根据", "由于", "按照", "通过", "关于", "对于", "其中", "此外", "同时", "以及", "并且", "但是", "不过", "如果",
  "据", "由", "和", "与", "及", "对", "向", "在", "被", "将", "把", "从", "让", "经", "给", "跟", "同", "为", "是",
  "而", "但", "也", "都", "还", "并", "或", "即", "的", "了", "称", "说", "指出", "表示", "认为",
  "也有", "有", "不少", "很多", "许多", "一些", "部分", "多数", "所有", "各", "该", "这些", "那些",
];
const VERBS = [
  "表示", "认为", "指出", "回应", "发布", "召开", "提出", "要求", "联合", "邀请", "组织", "参加", "通过", "发起",
  "称", "说", "向", "对", "与", "和", "及", "的", "在", "将", "把", "被", "由", "请", "代表", "会同",
  "以后", "以前", "之后", "后", "前", "时", "去", "到", "为", "已", "让", "给", "是",
  "希望", "先做", "做", "引发", "发起", "担心", "支持", "反对", "质疑", "告诉", "采访", "走访", "来自",
];
/** Group names never carry quantities or "among" clauses ("会员中约六成商户" → "商户"). */
const GROUP_CUT = /(?:其中|之中|中|[约近超逾]?[一二三四五六七八九十百千万两半\d.]+(?:成|%|％|个|位|名|户|万|千|百)?(?:的)?)/g;
function cutGroup(prefix: string) {
  let cut = 0;
  for (const m of prefix.matchAll(GROUP_CUT)) cut = Math.max(cut, (m.index ?? 0) + m[0].length);
  return prefix.slice(cut);
}
const RELATION_WORDS: Array<[RelationType, string[]]> = [
  ["反对", ["反对", "抗议", "抵制", "拒绝", "叫停"]],
  ["质疑", ["质疑", "担忧", "担心", "投诉", "批评", "不满", "追问", "吐槽"]],
  ["监管", ["监管", "审批", "约谈", "执法", "要求", "督促", "处罚", "检查"]],
  ["支持", ["支持", "赞成", "欢迎", "认可", "拥护", "力挺", "响应"]],
  ["合作", ["合作", "联合", "会同", "共同", "签约", "协同", "携手", "配合"]],
  ["报道", ["报道", "采访", "走访", "专访", "发文", "曝光", "直播"]],
  ["隶属", ["下属", "旗下", "隶属", "所属", "成员单位"]],
  ["竞争", ["竞争", "抢客", "分流", "替代"]],
];
const CJK = /[一-龥A-Za-z0-9]/;

export function sentencesOf(text: string) {
  return text
    .replace(/\r/g, "")
    .split(/[。！？!?；;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}
function runBefore(sentence: string, end: number, max: number) {
  let start = end;
  while (start > 0 && end - start < max && CJK.test(sentence[start - 1])) start--;
  return sentence.slice(start, end);
}
function trimLead(name: string) {
  let changed = true;
  while (changed && name.length > 2) {
    changed = false;
    for (const w of LEADING)
      if (name.startsWith(w) && name.length - w.length >= 2) {
        name = name.slice(w.length);
        changed = true;
      }
  }
  return name;
}
function cutAtVerb(prefix: string) {
  let cut = 0;
  for (const v of VERBS) {
    const i = prefix.lastIndexOf(v);
    if (i >= 0 && i + v.length > cut) cut = i + v.length;
  }
  return prefix.slice(cut);
}
export function typeOfName(name: string): EntityType | null {
  for (const [re, type] of SUFFIXES) if (re.test(name)) return type;
  if (ROLES.some((r) => name.endsWith(r))) return "群体";
  return null;
}

type Candidate = { name: string; type: EntityType; mentions: number };
function candidates(sentences: string[]): Candidate[] {
  const found = new Map<string, Candidate>();
  const add = (raw: string, type: EntityType) => {
    const name = raw.replace(/[“”"「」《》]/g, "").trim();
    if (name.length < 2 || name.length > 18) return;
    const c = found.get(name);
    if (c) c.mentions++;
    else found.set(name, { name, type, mentions: 1 });
  };
  for (const s of sentences) {
    for (const m of s.matchAll(/【([^【】]{2,18})】/g)) add(m[1], typeOfName(m[1]) ?? "个人");
    for (const m of s.matchAll(/\[\[([^\]|]{2,18})(?:\|([^\]]{2,6}))?\]\]/g)) {
      const hinted = ENTITY_TYPES.find((t) => t === m[2]);
      add(m[1], hinted ?? typeOfName(m[1]) ?? "个人");
    }
    // Collect every suffix candidate with its span; a name nested in a longer one ("滨河大学" in
    // "滨河大学交通研究所") is part of that name, not a separate actor.
    const spans: Array<{ name: string; type: EntityType; a: number; b: number }> = [];
    for (const m of s.matchAll(SUFFIX_SCAN)) {
      const end = (m.index ?? 0) + m[0].length;
      const prefix = cutAtVerb(runBefore(s, m.index ?? 0, 12));
      const name = trimLead(prefix + m[0]);
      const type = typeOfName(name);
      if (!type || name.length < 3 || name === m[0]) continue;
      spans.push({ name, type, a: end - name.length, b: end });
    }
    for (const x of spans)
      if (!spans.some((y) => y !== x && y.a <= x.a && y.b >= x.b && y.b - y.a > x.b - x.a)) add(x.name, x.type);
    for (const m of s.matchAll(TITLES)) add(m[1] + m[2], "个人");
    for (const role of ROLES) {
      let from = 0;
      for (;;) {
        const i = s.indexOf(role, from);
        if (i < 0) break;
        from = i + role.length;
        const prefix = cutGroup(cutAtVerb(runBefore(s, i, 5)));
        const name = trimLead(prefix + role);
        if (name.length >= 2 && !/^\d/.test(name)) add(name, "群体");
      }
    }
  }
  return [...found.values()];
}
/** Merge "交通运输局" into "滨河市交通运输局" and similar suffix-containing variants of one actor. */
function merge(list: Candidate[]) {
  const sorted = [...list].sort((a, b) => b.name.length - a.name.length);
  const out: Array<Candidate & { aliases: string[] }> = [];
  for (const c of sorted) {
    const host = out.find(
      (o) =>
        o.type === c.type &&
        o.name.endsWith(c.name) &&
        o.name.length - c.name.length <= 5 &&
        c.name.length >= (c.type === "群体" ? 2 : 3),
    );
    if (host) {
      host.mentions += c.mentions;
      host.aliases.push(c.name);
    } else out.push({ ...c, aliases: [c.name] });
  }
  return out;
}
function relationType(sentence: string): RelationType {
  for (const [type, words] of RELATION_WORDS) if (words.some((w) => sentence.includes(w))) return type;
  return "关联";
}

export type Extraction = {
  entities: Entity[];
  relations: Relation[];
  aspects: Aspect[];
  sentences: number;
};
/** Deterministic: the same seed documents always produce the same ids, stances and relations. */
export function extractGraph(docs: SeedDoc[], topic = "", maxEntities = 40): Extraction {
  const sentences = docs.flatMap((d) => sentencesOf(d.text));
  const merged = merge(candidates(sentences))
    .filter((c) => c.mentions >= (c.type === "群体" ? 2 : 1))
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name, "zh"))
    .slice(0, maxEntities);
  const idOf = (name: string) => "e-" + hash53(name).toString(36).slice(0, 8);
  const entities: Entity[] = merged.map((c) => {
    const mentionedIn = sentences.filter((s) => c.aliases.some((a) => s.includes(a)));
    const scored = mentionedIn.map(lexiconScore).filter((x) => x.hits > 0);
    const stance = scored.length
      ? clamp((scored.reduce((n, x) => n + x.score, 0) / scored.length) * 1.5)
      : 0;
    return {
      id: idOf(c.name),
      name: c.name,
      type: c.type,
      summary: (mentionedIn[0] ?? "").slice(0, 160),
      stance: Math.round(stance * 100) / 100,
      mentions: c.mentions,
      x: 0,
      y: 0,
      source: "rule",
    };
  });
  if (topic.trim() && !entities.some((e) => e.name === topic.trim()))
    entities.unshift({
      id: idOf("议题:" + topic.trim()),
      name: topic.trim(),
      type: "议题",
      summary: "推演讨论的核心议题",
      stance: 0,
      mentions: sentences.filter((s) => s.includes(topic.trim())).length,
      x: 0,
      y: 0,
      source: "rule",
    });
  const aliases = new Map(merged.map((c) => [idOf(c.name), c.aliases]));
  const relations = new Map<string, Relation>();
  const topicEntity = entities.find((e) => e.type === "议题");
  for (const s of sentences) {
    const present = entities
      .filter((e) => e.type !== "议题")
      .map((e) => ({
        e,
        at: Math.min(
          ...(aliases.get(e.id) ?? [e.name]).map((a) => {
            const i = s.indexOf(a);
            return i < 0 ? Infinity : i;
          }),
        ),
      }))
      .filter((x) => Number.isFinite(x.at))
      .sort((a, b) => a.at - b.at)
      .slice(0, 4);
    for (let i = 0; i < present.length; i++)
      for (let j = i + 1; j < present.length; j++) {
        const a = present[i].e,
          b = present[j].e;
        const between = s.slice(present[i].at, present[j].at + 1);
        const type = relationType(between) === "关联" ? relationType(s) : relationType(between);
        const key = a.id + ">" + b.id,
          reverse = b.id + ">" + a.id;
        const old = relations.get(key) ?? relations.get(reverse);
        if (!old)
          relations.set(key, {
            id: "r-" + hash53(key).toString(36).slice(0, 8),
            source: a.id,
            target: b.id,
            type,
            evidence: s.slice(0, 160),
            source_kind: "rule",
          });
        else if (old.type === "关联" && type !== "关联") {
          old.type = type;
          old.evidence = s.slice(0, 160);
        }
      }
    if (topicEntity && present.length) {
      const { score, hits } = lexiconScore(s);
      if (hits && Math.abs(score) >= 0.3)
        for (const { e } of present.slice(0, 2)) {
          const key = e.id + ">" + topicEntity.id;
          if (!relations.has(key))
            relations.set(key, {
              id: "r-" + hash53(key).toString(36).slice(0, 8),
              source: e.id,
              target: topicEntity.id,
              type: score > 0 ? "支持" : "质疑",
              evidence: s.slice(0, 160),
              source_kind: "rule",
            });
        }
    }
  }
  return {
    entities,
    relations: [...relations.values()].slice(0, 600),
    aspects: extractAspects(sentences),
    sentences: sentences.length,
  };
}

const ASPECT_POS = /(?:有利于改善|有利于提升|改善|提升|有利于|受益于|缓解|减少了?|降低了?)([一-龥]{2,6}?)(?=[，。、；：和与及的]|$)/g;
const ASPECT_NEG = /(?:担心|担忧|顾虑|冲击|影响到?|损失|增加了?)([一-龥]{2,6}?)(?=[，。、；：和与及的]|$)/g;
const ASPECT_STOP = ["家里", "评估", "情况", "问题", "工作", "生活", "大家", "这个", "我们", "他们", "方面", "影响"];
export function extractAspects(sentences: string[], max = 8): Aspect[] {
  const counts = new Map<string, { lean: 1 | -1; n: number }>();
  const bump = (label: string, lean: 1 | -1) => {
    const clean = label.replace(/^(?:了|的|到|在|对|是)+/, "");
    if (clean.length < 2 || ASPECT_STOP.includes(clean)) return;
    const c = counts.get(clean);
    if (c) c.n++;
    else counts.set(clean, { lean, n: 1 });
  };
  for (const s of sentences) {
    for (const m of s.matchAll(ASPECT_POS)) bump(m[1], 1);
    for (const m of s.matchAll(ASPECT_NEG)) bump(m[1], -1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], "zh"))
    .slice(0, max)
    .map(([label, v]) => ({ id: "a-" + hash53(label).toString(36).slice(0, 6), label, lean: v.lean }));
}

/** Deterministic force-directed layout in a 1000×640 box; existing positions are kept unless reset. */
export function layoutGraph(entities: Entity[], relations: Relation[], reset = false): Entity[] {
  const n = entities.length;
  if (!n) return entities;
  const W = 1000,
    H = 640;
  const pos = entities.map((e, i) => {
    const keep = !reset && (e.x !== 0 || e.y !== 0);
    const angle = (i / n) * Math.PI * 2 + (hash53(e.id) % 100) / 400;
    const r = e.type === "议题" ? 0 : 180 + (hash53(e.id) % 120);
    return keep ? { x: e.x, y: e.y, fixed: true } : { x: W / 2 + Math.cos(angle) * r, y: H / 2 + Math.sin(angle) * r * 0.7, fixed: false };
  });
  if (pos.every((p) => p.fixed)) return entities;
  const index = new Map(entities.map((e, i) => [e.id, i]));
  const links = relations
    .map((r) => [index.get(r.source), index.get(r.target)])
    .filter((l): l is [number, number] => l[0] !== undefined && l[1] !== undefined);
  const k = Math.sqrt((W * H) / n) * 0.55;
  for (let step = 0; step < 220; step++) {
    const t = 30 * (1 - step / 220) + 1;
    const disp = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x || 0.01,
          dy = pos[i].y - pos[j].y || 0.01;
        const d = Math.max(Math.hypot(dx, dy), 1),
          f = (k * k) / d;
        disp[i].x += (dx / d) * f;
        disp[i].y += (dy / d) * f;
        disp[j].x -= (dx / d) * f;
        disp[j].y -= (dy / d) * f;
      }
    for (const [a, b] of links) {
      const dx = pos[a].x - pos[b].x,
        dy = pos[a].y - pos[b].y;
      const d = Math.max(Math.hypot(dx, dy), 1),
        f = (d * d) / k;
      disp[a].x -= (dx / d) * f;
      disp[a].y -= (dy / d) * f;
      disp[b].x += (dx / d) * f;
      disp[b].y += (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      if (pos[i].fixed) continue;
      // Gravity keeps disconnected entities from drifting to the corners.
      disp[i].x += (W / 2 - pos[i].x) * 0.25 * k / 50;
      disp[i].y += (H / 2 - pos[i].y) * 0.35 * k / 50;
      const d = Math.max(Math.hypot(disp[i].x, disp[i].y), 0.01);
      pos[i].x = Math.min(W - 70, Math.max(70, pos[i].x + (disp[i].x / d) * Math.min(d, t)));
      pos[i].y = Math.min(H - 50, Math.max(40, pos[i].y + (disp[i].y / d) * Math.min(d, t)));
    }
  }
  return entities.map((e, i) => ({ ...e, x: Math.round(pos[i].x), y: Math.round(pos[i].y) }));
}
