// Demonstration batch: five ordinary business documents from one exhibition lighting
// procurement, hand-written for this workbench. Records are hand-annotated (not model
// output) and grounded with the same Node aligner the Host channel uses.
import { alignContext, alignExtraction } from "./align.ts";
import {
  blankReview,
  DEFAULT_MODEL,
  type EvidenceDocument,
  type EvidenceProject,
  type Extraction,
  type Review,
} from "./evidence.ts";

const interview = `采购访谈记录 · 2026年10月14日
记录人：周岚（青禾工作室 行政）

🌿 青禾工作室正在为冬季展览《城市的灯》采购灯具。项目负责人林晓确认，首批需要24套可调光射灯，用于西岸展厅一层的主展区；另需6套洗墙灯，安装在入口长廊。整体硬件预算为18,000元，不含安装人工。

林晓说明，展览定于12月6日开幕，布展团队12月1日进场，因此灯具必须在11月15日前交付到西岸展厅，留出两周做调光测试。她希望每套灯具附带两年质保，并在交付前提供色温测试报告，色温范围要求在3000K–4000K之间。

供应商方面，目前已询价三家，倾向北辰照明，原因是其去年为美术馆项目供货稳定。林晓提到上一次合作时出现过一次延期，延误约4天，最后由对方承担了加急运费。

待确认：第二批追加数量尚未决定，需要等策展人宋知远确认二楼展区方案后再定。安装人工另行招标，预算不超过5,000元。`;

const contract = `供货合同（摘要）
合同编号：QH-2026-031

甲方：青禾文化传播有限公司（以下简称“青禾工作室”）
乙方：北辰照明科技有限公司

第一条 供货内容
乙方向甲方供应可调光LED射灯24套、洗墙灯6套，规格以附件一技术清单为准。

第二条 合同金额与付款
合同总价为人民币17,640元（含税）。甲方于合同签订后5个工作日内支付30%预付款，即5,292元；货物验收合格后15日内支付其余70%。

第三条 交付
乙方应于2026年11月15日前将全部货物送达甲方指定地点（西岸展厅，滨江路88号），运输及保险费用由乙方承担。

第四条 质量与质保
乙方提供自验收合格之日起24个月的免费质保。交付时须随货提供每批次的色温与显色指数测试报告。

第五条 违约责任
乙方逾期交付的，每逾期一日按合同总价的0.5%向甲方支付违约金，累计不超过合同总价的10%。逾期超过10日的，甲方有权解除合同。

签署日期：2026年10月20日
甲方代表：林晓　乙方代表：韩启明`;

const minutes = `《城市的灯》项目周会纪要
时间：2026年10月27日 14:00–15:10
地点：青禾工作室 会议室
参会：林晓、宋知远、周岚、陈默（布展）

一、二楼展区方案
宋知远确认二楼展区采用暗场设计，需要追加12套射灯，并请林晓与北辰照明确认能否同批交付。林晓负责在10月30日前给出答复。

二、布展进度
陈默汇报，展墙施工已完成70%，预计11月20日完工。若灯具晚于11月18日到场，调光测试将压缩到3天以内，存在开幕前调试不足的风险。

三、预算
追加12套射灯后，硬件预算预计增加约8,800元。周岚提醒，年度展览总预算剩余32,000元，追加后仍在范围内，但安装人工需控制在5,000元以内。

四、待办
1. 林晓：10月30日前与北辰照明确认追加数量及交付日期。
2. 周岚：本周五前完成安装人工招标文件。
3. 陈默：11月1日前提交布展灯位图。`;

const inspection = `到货验收报告
项目：《城市的灯》展览灯具
验收日期：2026年11月14日
验收地点：西岸展厅（滨江路88号）
验收人：陈默、周岚　供方在场人员：北辰照明 售后工程师 吴桐

一、到货数量
本批到货可调光LED射灯24套、洗墙灯6套，与合同QH-2026-031一致。追加的12套射灯未随本批到货，供方称将于11月21日另行送达。

二、外观与功能
抽检射灯8套、洗墙灯2套，外观无破损，调光功能正常。其中1套射灯（编号S-17）调光至20%以下时有明显闪烁，已现场更换备件。

三、技术资料
随货提供色温测试报告一份，实测色温3200K–3900K，符合要求；显色指数报告未随货提供，供方承诺11月16日前补交电子版。

四、结论
本批货物验收合格，可进入付款流程。显色指数报告补交后归档。追加批次单独验收。`;

const letter = `致：青禾工作室 林晓女士
发件：北辰照明科技有限公司 销售部 韩启明
日期：2026年11月17日
主题：关于追加射灯交付日期的说明

林女士您好：

感谢贵司对我司产品的信任。关于10月31日确认追加的12套可调光射灯，因上游驱动电源供应商停产检修，我司原定11月21日的交付需推迟至11月26日。

为减少对布展的影响，我司将：
（1）先行调拨库存4套射灯，于11月21日送达西岸展厅；
（2）其余8套于11月26日前送达，加急运费由我司承担；
（3）安排吴桐工程师于11月27日到场协助调光测试。

追加部分单价与原合同一致，每套588元，合计7,056元（含税）。如贵司同意上述安排，请于11月19日前书面回复确认。

由此带来的不便，深表歉意。

北辰照明科技有限公司
韩启明`;

type Seed = [
  cls: string,
  text: string,
  attrs?: Record<string, string>,
  review?: Partial<Review>,
];
const records: Record<string, Seed[]> = {
  "01 采购访谈": [
    ["人员", "周岚", { 职务: "行政", 所属: "青禾工作室" }],
    ["组织", "青禾工作室", { 角色: "采购方" }, { status: "accepted" }],
    ["人员", "林晓", { 职务: "项目负责人", 所属: "青禾工作室" }, { status: "accepted" }],
    ["数量", "24套", { 对象: "可调光射灯" }, { status: "corrected", correctedText: "24套（首批）", note: "访谈中明确为首批数量，第二批待定。" }],
    ["数量", "6套", { 对象: "洗墙灯" }],
    ["金额", "18,000元", { 用途: "硬件预算", 含税: "未说明" }, { status: "accepted", note: "不含安装人工。" }],
    ["日期", "12月6日", { 事件: "展览开幕" }],
    ["日期", "11月15日前", { 事件: "灯具交付" }, { status: "accepted" }],
    ["义务条款", "每套灯具附带两年质保", { 责任方: "供应商" }],
    ["义务条款", "交付前提供色温测试报告", { 责任方: "供应商" }],
    ["组织", "北辰照明", { 角色: "候选供应商" }],
    ["风险", "出现过一次延期，延误约4天", { 影响: "交付" }],
    ["人员", "宋知远", { 职务: "策展人" }],
    ["数量", "第二批追加数量", { 对象: "射灯" }, { status: "rejected", note: "原文写明尚未决定，不是数量。" }],
    ["金额", "5000元以内", { 用途: "安装人工" }, { note: "模型改写了原文“不超过5,000元”，需人工核对。" }],
  ],
  "02 供货合同": [
    ["组织", "青禾文化传播有限公司", { 角色: "甲方" }, { status: "accepted" }],
    ["组织", "北辰照明科技有限公司", { 角色: "乙方" }, { status: "accepted" }],
    ["数量", "可调光LED射灯24套", { 对象: "射灯" }],
    ["数量", "洗墙灯6套", { 对象: "洗墙灯" }],
    ["金额", "人民币17,640元（含税）", { 用途: "合同总价", 含税: "是" }, { status: "accepted" }],
    ["金额", "5,292元", { 用途: "30%预付款" }],
    ["义务条款", "合同签订后5个工作日内支付30%预付款", { 责任方: "甲方" }],
    ["日期", "2026年11月15日前", { 事件: "全部货物送达" }, { status: "accepted" }],
    ["义务条款", "运输及保险费用由乙方承担", { 责任方: "乙方" }],
    ["义务条款", "24个月的免费质保", { 责任方: "乙方" }],
    ["义务条款", "每逾期一日按合同总价的0.5%向甲方支付违约金", { 责任方: "乙方" }],
    ["风险", "逾期超过10日的，甲方有权解除合同", { 影响: "合同解除" }],
    ["日期", "2026年10月20日", { 事件: "合同签署" }],
    ["人员", "韩启明", { 职务: "乙方代表", 所属: "北辰照明" }],
  ],
  "03 项目周会": [
    ["日期", "2026年10月27日", { 事件: "周会" }],
    ["人员", "陈默", { 职务: "布展", 所属: "青禾工作室" }],
    ["数量", "追加12套射灯", { 对象: "射灯" }, { status: "accepted" }],
    ["义务条款", "由林晓负责在10月30日前答复", { 责任方: "林晓" }],
    ["日期", "11月20日", { 事件: "展墙完工" }],
    ["风险", "调光测试将压缩到3天以内，存在开幕前调试不足的风险", { 影响: "开幕质量" }, { status: "accepted" }],
    ["金额", "8,800元", { 用途: "追加硬件预算" }],
    ["金额", "32,000元", { 用途: "年度展览剩余预算" }],
    ["义务条款", "本周五前完成安装人工招标文件", { 责任方: "周岚" }],
    ["义务条款", "11月1日前提交布展灯位图", { 责任方: "陈默" }],
  ],
  "04 到货验收": [
    ["日期", "2026年11月14日", { 事件: "到货验收" }],
    ["人员", "吴桐", { 职务: "售后工程师", 所属: "北辰照明" }],
    ["数量", "可调光LED射灯24套", { 对象: "到货射灯" }, { status: "accepted" }],
    ["日期", "11月21日", { 事件: "追加批次送达（供方口径）" }],
    ["风险", "调光至20%以下时有明显闪烁", { 影响: "设备质量" }, { note: "S-17 已现场更换备件。" }],
    ["义务条款", "11月16日前补交电子版", { 责任方: "北辰照明" }],
    ["风险", "显色指数报告未随货提供", { 影响: "资料归档" }],
  ],
  "05 供应商来函": [
    ["人员", "韩启明", { 职务: "销售部", 所属: "北辰照明" }],
    ["风险", "上游驱动电源供应商停产检修", { 影响: "追加批次交付" }],
    ["日期", "推迟至11月26日", { 事件: "追加批次交付" }],
    ["数量", "库存4套射灯", { 对象: "先行调拨" }],
    ["义务条款", "加急运费由我司承担", { 责任方: "北辰照明" }],
    ["金额", "每套588元", { 用途: "追加单价", 含税: "是" }],
    ["金额", "合计7,056元（含税）", { 用途: "追加总价", 含税: "是" }],
    ["日期", "11月19日前书面回复确认", { 事件: "回复截止" }],
    ["义务条款", "安排吴桐工程师于11月27日到场协助调光测试", { 责任方: "北辰照明" }],
  ],
};
const texts: Record<string, string> = {
  "01 采购访谈": interview,
  "02 供货合同": contract,
  "03 项目周会": minutes,
  "04 到货验收": inspection,
  "05 供应商来函": letter,
};

function grounded(id: string, list: Seed[]): EvidenceDocument {
  const source = texts[id],
    ctx = alignContext(source);
  let cursor = 0;
  const extractions: Extraction[] = [],
    reviews: Review[] = [];
  list.forEach(([cls, value, attrs, review], i) => {
    const hit = alignExtraction(ctx, value, cursor);
    if (hit) cursor = hit.end;
    extractions.push({
      extraction_class: cls,
      extraction_text: value,
      char_interval: hit ? { start_pos: hit.start, end_pos: hit.end } : null,
      alignment_status: hit?.status ?? null,
      extraction_index: i + 1,
      group_index: 0,
      description: null,
      attributes: attrs ?? null,
    });
    reviews.push({ ...blankReview(), ...review });
  });
  return { id, text: source, originalText: source, extractions, reviews };
}

export const sampleTitle = "《城市的灯》灯具采购 · 资料批次";
export function sampleProject(): EvidenceProject {
  return {
    schemaVersion: 1,
    origin: "example",
    documents: Object.entries(records).map(([id, list]) => grounded(id, list)),
    fields: [
      { name: "组织", description: "公司、机构或团队的名称，按原文全称或简称", attributes: ["角色"] },
      { name: "人员", description: "具体人名，不含泛称", attributes: ["职务", "所属"] },
      { name: "金额", description: "带单位或币种的金额，保留原文写法", attributes: ["用途", "含税"] },
      { name: "日期", description: "日期、期限或时间点，保留“前/内”等限定词", attributes: ["事件"] },
      { name: "数量", description: "明确的数量与单位，以及被计数的对象", attributes: ["对象"] },
      { name: "义务条款", description: "某一方必须完成的事项或承担的责任", attributes: ["责任方"] },
      { name: "风险", description: "原文明确提到的问题、延误或可能的不利后果", attributes: ["影响"] },
    ],
    prompt:
      "从采购、合同和项目沟通资料中按出现顺序抽取组织、人员、金额、日期、数量、义务条款和风险。只使用原文逐字片段，不改写、不合并；未决定或推测的事项不要抽取。用属性说明角色、用途、责任方等上下文。",
    examples: [
      {
        text: "陈越代表远山设备与我方签订采购单：12台投影机，总价6,000元（含税），须于6月1日前交付，逾期每日扣款1%。",
        extractions: [
          { extraction_class: "人员", extraction_text: "陈越", attributes: { 所属: "远山设备" } },
          { extraction_class: "组织", extraction_text: "远山设备", attributes: { 角色: "供应商" } },
          { extraction_class: "数量", extraction_text: "12台投影机", attributes: { 对象: "投影机" } },
          { extraction_class: "金额", extraction_text: "总价6,000元（含税）", attributes: { 用途: "采购总价", 含税: "是" } },
          { extraction_class: "日期", extraction_text: "6月1日前", attributes: { 事件: "交付" } },
          { extraction_class: "义务条款", extraction_text: "逾期每日扣款1%", attributes: { 责任方: "远山设备" } },
        ],
      },
      {
        text: "周会决定：施工方若不能在3月10日前完成吊顶，开馆将推迟一周。由王蕾负责每日跟进进度。",
        extractions: [
          { extraction_class: "日期", extraction_text: "3月10日前", attributes: { 事件: "完成吊顶" } },
          { extraction_class: "风险", extraction_text: "开馆将推迟一周", attributes: { 影响: "开馆时间" } },
          { extraction_class: "人员", extraction_text: "王蕾", attributes: { 职务: "进度跟进" } },
          { extraction_class: "义务条款", extraction_text: "负责每日跟进进度", attributes: { 责任方: "王蕾" } },
        ],
      },
    ],
    model: DEFAULT_MODEL,
  };
}
export const seed: EvidenceProject = sampleProject();

/** An empty batch for a new user: one blank document and the default recipe. */
export function blankProject(): EvidenceProject {
  return {
    ...sampleProject(),
    origin: "manual",
    documents: [
      { id: "资料-01", text: "", originalText: "", extractions: [], reviews: [] },
    ],
  };
}
