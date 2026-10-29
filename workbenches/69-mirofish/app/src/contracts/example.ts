// ABOUTME: 原创示例“滨河市老城区低排放区试行”：三份种子资料、人工复核的图谱、规则人设、事件与已完成推演。
import { simulate, summarize, robustness, type SimResult } from "./engine.ts";
import { layoutGraph } from "./extract.ts";
import { generateAgents } from "./personas.ts";
import { buildReport } from "./report.ts";
import { fingerprint } from "./random.ts";
import {
  defaultParams,
  simInput,
  type Aspect,
  type Entity,
  type EntityType,
  type Relation,
  type RelationType,
  type RunRecord,
  type Scenario,
  type SimInput,
} from "./scenario.ts";

const DOC_PLAN = `滨河市老城区低排放区试行方案（征求意见稿）要点

起草背景。老城区是滨河市人口最密、道路最窄的片区，常住人口约21万，工作日日均进出机动车约14.6万辆次。2025年监测数据显示，老城区站点二氧化氮年均浓度为41微克每立方米，高于全市平均水平约三成；早晚高峰中山路、解放路平均车速不足每小时15公里。为改善老城区空气质量、减少交通拥堵，滨河市生态环境局会同滨河市交通运输局起草了《老城区低排放区试行方案（征求意见稿）》，自即日起公开征求意见三十天。

一、范围与时间。低排放区东至滨江路、西至解放路、南至中山路、北至环城北路，面积约4.6平方公里。拟自2027年3月1日起试行一年，工作日7时至20时，国四及以下排放标准的燃油小客车、轻型货车禁止驶入；国五及以上燃油车、新能源车不受限制。周末与法定节假日是否纳入，将根据征求意见结果确定。

二、配套措施。滨河公交集团将在区内加密6条公交线路，高峰发车间隔由10分钟缩短到5分钟，新增2条社区微循环线；在低排放区边缘的北站、滨江公园和中山路口新建3处停车换乘点，提供约1800个停车位，持当日公交卡换乘可免停车费。共享单车运营企业将在区内增设40个停放点。

三、过渡与豁免。对区内居民名下的受限车辆设置两年过渡期，过渡期内凭居住证明登记后可正常通行；救护车、校车、残疾人专用车辆和保障民生的冷链配送车辆可申请豁免；区内医院的急诊送医车辆可通过电子登记临时通行。网约车与出租车不设专门豁免，需在过渡期内完成车辆更新。

四、补贴与执法。对提前淘汰国四及以下车辆并购买新能源车的车主，市财政给予每辆最高8000元的置换补贴，补贴申请期为试行前十二个月。低排放区入口设置42处电子抓拍点，试行首月只提醒不处罚，之后每次违规驶入罚款100元、不扣分，同一车辆每日最多处罚一次。

五、评估与调整。试行一年后由滨河大学交通研究所开展第三方评估，评估内容包括空气质量、通行时间、公交准点率、商户营业额和居民出行满意度，评估报告向社会公开。滨河市交通运输局表示，将根据征求意见情况完善方案，征求意见结束后召开公开听证会；市民可通过12345热线、政府网站和街道意见箱反馈意见。`;

const DOC_NEWS = `滨河日报：低排放区方案公示一周 各方怎么看

方案公示一周以来，滨河日报记者走访了老城区多个街道。在解放路经营服装店十二年的店主告诉记者，周边商户最担心的是客流下降：“开车来的顾客本来就难停车，再限行，周末生意怎么办？”另一位经营餐馆的店主则认为，到店顾客大多住在附近，影响未必有想象中大，“关键是换乘点离店里有多远”。

老城区商户联合会已向滨河市交通运输局提交书面意见，要求把试行时间推迟一年，并把周末排除在外。商户联合会表示，并不反对改善空气，但担心营业额下降，希望先做商户影响评估，并为货车装卸货设置早晚时段窗口。联合会统计，会员中约六成商户的进货车辆为国四及以下轻型货车。

网约车司机的反应更为强烈。不少网约车司机开的是国四车辆，他们质疑置换补贴“杯水车薪”，担心旧车置换成本过高、收入缩水。一位跑了五年网约车的司机算了一笔账：新能源车即便扣除补贴也要多花七八万元，而老城区的订单占他日常收入的近四成。有司机在车友群里发起联名，反对在2027年就实施。

老城区居民的看法明显分化。住在中山路一带的退休教师赵女士支持方案，她说家门口的空气确实比以前差，公交加密以后去医院更方便。也有老城区居民担心家里的老车要提前报废，增加家庭负担；还有居民关心过渡期结束后，亲友来访的外地车辆如何进出。

清河环保志愿者协会发布公开信，欢迎试行方案，认为低排放区有利于改善空气质量和儿童健康，并建议把轻型柴油货车的限制提前。滨河市汽车经销商协会则认为，二手国四车辆残值将大幅下降，希望延长补贴申请期限，并把二手车置换也纳入补贴范围。

滨河市第一人民医院位于低排放区内，医院方面表示支持改善空气，但需要确保患者家属送医不受影响，建议为急诊陪护车辆开通临时通行。滨河公交集团表示，已为加密线路储备了40辆新能源公交车，愿意配合方案实施，但司机招聘仍有缺口。

面对质疑，滨河市生态环境局回应称，老城区机动车排放贡献了约三成的氮氧化物，国四及以下车辆虽然只占进出车辆的一成左右，排放量却接近机动车总排放的四成；试行方案已为居民、医疗和民生配送留出过渡与豁免，征求意见结束后将召开公开听证会。`;

const DOC_RESEARCH = `滨河大学交通研究所测算简报与网络讨论摘录

测算依据。滨河大学交通研究所基于2026年全年交通卡口数据和老城区4个空气监测站数据测算：老城区工作日7时至20时进入的车辆中，国四及以下燃油车约占11%，其中轻型货车约占三分之一；低排放区实施后，区内氮氧化物浓度预计下降12%至18%，细颗粒物下降3%至5%。

通勤影响。研究所测算，在公交加密和停车换乘点按期建成的前提下，通勤族平均单程通勤时间增加不超过4分钟；如果停车换乘点延期，增加时间可能达到9分钟。受影响最大的是从城郊驾车进入老城区的约1.2万名通勤者，以及接送孩子的家长。

商户影响。研究所的李教授指出，海外城市的经验表明，商户营业额在试行初期可能短暂波动，半年后通常恢复，步行客流增加的街区甚至出现增长；但老城区小商户的抗风险能力较弱，评估需要单独跟踪，建议对营业额下降超过两成的商户提供临时租金减免。

网络讨论摘录。本地自媒体“老滨河”发布视频，称“某城市实施低排放区后商户营业额下降三成”，视频转发量很高，但没有给出数据来源，引发不少网友质疑。通勤族在本地论坛讨论最多的是停车换乘点能否按期建成，以及公交加密后是否真的准点。

有家长在论坛上抱怨，学校在老城区内，接送孩子的私家车如果是国四车辆就无法进入，希望校车和公交接驳能够跟上。也有网友支持低排放区，认为老城区早该治理拥堵，空气改善对所有人都是好事。滨河日报评论员文章认为，方案的关键在于配套与过渡期能否兑现，执法要公平，不能“一刀切”。`;

const DOC_HOTLINE = `12345热线与听证报名意见汇总（征求意见第一周）

征求意见第一周，12345热线、政府网站和街道意见箱共收到与低排放区有关的意见1386条，听证会报名418人。按意见倾向统计：明确支持的占31%，明确反对的占38%，提出修改建议但未表明态度的占31%。

反对意见集中在四个方面：一是网约车司机和个体货运车主认为置换补贴不足、更新车辆时间太紧，占反对意见的41%；二是沿街商户担心客流下降和进货车辆受限，占27%；三是部分老城区居民担心过渡期结束后老车无法使用，占18%；四是家长担心接送不便，占9%。

支持意见主要来自老城区居民、环保组织成员和公共交通通勤者，理由包括空气质量、步行安全和公交加密。不少支持者同时提出，执法要公平，不能出现“抓外地车、放本地车”的情况。

修改建议中出现最多的是：周末暂不纳入试行；延长网约车过渡期；提高置换补贴并覆盖二手车；停车换乘点与公交加密先于限行到位；为医院急诊和学校接送设置临时通行。滨河市交通运输局表示，这些建议将作为听证会的主要议题，听证会拟于征求意见结束后两周内召开。`;

type Def = [string, string, EntityType, number, string];
const ENTITIES: Def[] = [
  ["topic", "低排放区试行方案", "议题", 0, "老城区工作日7–20时限制国四及以下燃油车驶入，2027年3月起试行一年"],
  ["eco", "滨河市生态环境局", "政府机构", 0.62, "方案牵头起草单位，强调老城区机动车排放贡献约三成氮氧化物"],
  ["traffic", "滨河市交通运输局", "政府机构", 0.42, "会同起草方案，负责公交加密、停车换乘与听证"],
  ["merchants-assoc", "老城区商户联合会", "社会组织", -0.5, "已提交书面意见，要求推迟一年并排除周末"],
  ["merchants", "沿街商户", "群体", -0.45, "担心开车来的顾客减少、营业额下降"],
  ["residents", "老城区居民", "群体", 0.12, "看法分化：期待空气改善与公交便利，也担心老车提前报废"],
  ["commuters", "通勤族", "群体", -0.18, "关心停车换乘点能否按期建成、公交是否准点"],
  ["drivers", "网约车司机", "群体", -0.58, "多为国四车辆，质疑补贴不足，发起联名反对2027年实施"],
  ["parents", "老城区家长", "群体", -0.28, "担心学校接送车辆受限，希望校车和公交接驳跟上"],
  ["daily", "滨河日报", "媒体", 0.05, "走访各方并发表评论：关键在配套与过渡期能否兑现"],
  ["laobinhe", "自媒体“老滨河”", "媒体", -0.4, "发布无来源的“营业额下降三成”视频，转发量很高"],
  ["institute", "滨河大学交通研究所", "学术机构", 0.3, "测算氮氧化物下降12–18%、通勤增加不超过4分钟，负责第三方评估"],
  ["green", "清河环保志愿者协会", "社会组织", 0.72, "发布公开信欢迎方案，建议提前限制轻型柴油货车"],
  ["dealers", "滨河市汽车经销商协会", "社会组织", -0.38, "担心国四二手车残值下降，希望延长补贴期限"],
  ["bus", "滨河公交集团", "企业", 0.5, "储备40辆新能源公交车，负责加密6条线路"],
  ["hospital", "滨河市第一人民医院", "社会组织", 0.18, "位于区内，支持改善空气，要求保障急诊陪护通行"],
  ["prof", "李教授", "个人", 0.35, "交通研究所学者，提醒小商户抗风险能力弱，需单独跟踪"],
];
type RelDef = [string, string, RelationType, string];
const RELATIONS: RelDef[] = [
  ["eco", "topic", "支持", "滨河市生态环境局会同滨河市交通运输局起草了试行方案"],
  ["traffic", "topic", "支持", "将根据征求意见情况完善方案"],
  ["eco", "traffic", "合作", "滨河市生态环境局会同滨河市交通运输局起草"],
  ["merchants-assoc", "traffic", "质疑", "老城区商户联合会已向滨河市交通运输局提交书面意见，要求推迟一年"],
  ["merchants-assoc", "merchants", "隶属", "商户联合会代表周边沿街商户"],
  ["merchants", "topic", "质疑", "周边商户最担心的是客流下降"],
  ["drivers", "topic", "反对", "有司机在车友群里发起联名，反对在2027年就实施"],
  ["drivers", "eco", "质疑", "他们质疑置换补贴“杯水车薪”"],
  ["residents", "topic", "关联", "老城区居民的看法明显分化"],
  ["commuters", "bus", "质疑", "讨论最多的是停车换乘点能否按期建成，以及公交加密后是否准点"],
  ["parents", "topic", "质疑", "接送孩子的私家车如果是国四车辆就无法进入"],
  ["daily", "merchants", "报道", "滨河日报记者走访了老城区多个街道"],
  ["daily", "eco", "报道", "面对质疑，滨河市生态环境局回应称"],
  ["laobinhe", "merchants", "报道", "发布视频称商户营业额下降三成"],
  ["laobinhe", "topic", "反对", "视频没有给出数据来源，引发质疑"],
  ["institute", "topic", "关联", "试行一年后由滨河大学交通研究所开展第三方评估"],
  ["institute", "traffic", "合作", "基于交通卡口数据测算通勤时间"],
  ["prof", "institute", "隶属", "研究所的李教授指出"],
  ["green", "topic", "支持", "清河环保志愿者协会发布公开信，欢迎试行方案"],
  ["dealers", "topic", "质疑", "二手国四车辆残值将大幅下降"],
  ["bus", "traffic", "合作", "滨河公交集团表示愿意配合方案实施"],
  ["hospital", "traffic", "监管", "建议为急诊陪护车辆开通临时通行"],
  ["hospital", "topic", "支持", "医院方面表示支持改善空气"],
  ["green", "merchants-assoc", "竞争", "环保组织与商户组织在公开意见中立场相对"],
];
export const EXAMPLE_ASPECTS: Aspect[] = [
  { id: "a-air", label: "空气质量", lean: 1 },
  { id: "a-bus", label: "公交加密", lean: 1 },
  { id: "a-park", label: "停车换乘", lean: 1 },
  { id: "a-shop", label: "商户客流", lean: -1 },
  { id: "a-commute", label: "通勤时间", lean: -1 },
  { id: "a-cost", label: "旧车置换成本", lean: -1 },
  { id: "a-fair", label: "执法公平", lean: -1 },
];

function exampleCore(): Scenario {
  const corpus = [DOC_PLAN, DOC_NEWS, DOC_RESEARCH, DOC_HOTLINE].join("\n");
  const count = (name: string) => Math.max(1, corpus.split(name.replace(/^自媒体“|”$/g, "")).length - 1);
  const entities: Entity[] = ENTITIES.map(([id, name, type, stance, summary]) => ({ id: "e-" + id, name, type, stance, summary, mentions: count(name), x: 0, y: 0, source: "rule" }));
  const relations: Relation[] = RELATIONS.map(([a, b, type, evidence], i) => ({ id: "r-" + (i + 1), source: "e-" + a, target: "e-" + b, type, evidence, source_kind: "rule" }));
  const laid = layoutGraph(entities, relations, true);
  const agents = generateAgents(laid, relations, EXAMPLE_ASPECTS, { perGroup: 3, seed: "binhe-lez" });
  const by = (entity: string) => agents.find((a) => a.entityId === "e-" + entity)?.id ?? null;
  return {
    version: 2,
    question: "2027年3月起在滨河市老城区试行低排放区，公示与听证期间各方舆论会如何演变？过渡期与豁免承诺能否扭转反对声音？",
    topic: "低排放区",
    origin: "example",
    seeds: [
      { id: "doc-plan", name: "试行方案（征求意见稿）要点.md", text: DOC_PLAN },
      { id: "doc-news", name: "滨河日报 · 公示一周各方反应.md", text: DOC_NEWS },
      { id: "doc-research", name: "研究所测算简报与网络讨论.md", text: DOC_RESEARCH },
      { id: "doc-hotline", name: "12345热线与听证报名意见汇总.md", text: DOC_HOTLINE },
    ],
    entities: laid,
    relations,
    agents,
    aspects: EXAMPLE_ASPECTS,
    params: { ...defaultParams(), seed: "binhe-2027", rounds: 36, start: "2027-03-01T08:00" },
    events: [
      { id: "ev-hearing", round: 8, title: "公开听证会宣布延长过渡期", text: "听证会后交通运输局宣布：居民受限车辆过渡期延长至两年半，网约车置换补贴提高到12000元，周末暂不纳入试行。", push: 0.28, target: "all", reach: 0.7, author: by("traffic") },
      { id: "ev-video", round: 16, title: "“营业额下降三成”视频刷屏", text: "自媒体视频称其他城市实施低排放区后商户营业额下降三成，未给出数据来源。", push: -0.35, target: "type:群体", reach: 0.6, author: by("laobinhe") },
      { id: "ev-study", round: 26, title: "研究所公布通勤与空气测算", text: "测算显示公交加密与换乘点按期建成时，通勤时间增加不超过4分钟，氮氧化物下降12%–18%。", push: 0.2, target: "all", reach: 0.5, author: by("institute") },
    ],
    runs: [],
    activeRun: "",
    report: { runId: "", markdown: "", source: "rule", updatedAt: "" },
    notes: "示例为原创虚构场景，人物、机构与数据均为演示而写，不对应真实城市政策。",
  };
}

export const resultIdOf = (input: SimInput) => "L" + fingerprint(JSON.stringify(input));
export function localRun(input: SimInput, result: SimResult, label: string, createdAt: string, withRobustness = true): RunRecord {
  return {
    id: "run-" + resultIdOf(input).slice(1, 9),
    label,
    engine: "local",
    createdAt,
    resultId: resultIdOf(input),
    fingerprint: result.fingerprint,
    sourceName: "本地规则推演",
    summary: summarize(result),
    robustness: withRobustness ? robustness(input) : null,
    input,
  legacyActions: null,
  };
}

let cached: Scenario | null = null;
/** The example ships as a completed simulation with a generated report; computed once per runtime. */
export function exampleScenario(): Scenario {
  if (cached) return cached;
  const core = exampleCore();
  const input = simInput(core);
  const result = simulate(input);
  const run = localRun(input, result, "推演 #1 · 基准情景", "2026-10-29T09:00:00.000Z");
  const withRun = { ...core, runs: [run], activeRun: run.id };
  cached = {
    ...withRun,
    report: { runId: run.id, markdown: buildReport(withRun, run, result), source: "rule", updatedAt: "2026-10-29T09:00:00.000Z" },
  };
  return cached;
}
