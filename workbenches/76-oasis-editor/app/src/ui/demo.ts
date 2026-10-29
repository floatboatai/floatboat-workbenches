import * as native from "../vendor/oasis-editor/oasis-editor.js";
import type { EditorDocument } from "oasis-editor";
import { A4_PORTRAIT, type Block, type Paragraph, type Run } from "../contracts/review";

/** Ordinary demonstration manuscript: a short community project proposal. */
const id = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const REVIEW_DATE = Date.UTC(2026, 9, 20, 2, 30);
type ParagraphStyle = NonNullable<Paragraph["style"]>;
type TextStyle = NonNullable<Run["styles"]>;

function text(value: string, styles?: TextStyle): Run {
  return { id: id("run"), kind: "text", text: value, ...(styles ? { styles } : {}) };
}
function revised(value: string, type: "insert" | "delete", author: string): Run {
  return {
    id: id("run"),
    kind: "text",
    text: value,
    revision: { id: id("rev"), type, author, date: REVIEW_DATE },
  };
}
function paragraph(runs: Run[] | string, style?: ParagraphStyle, list?: Paragraph["list"]): Paragraph {
  const node = native.createParagraph("");
  node.runs = typeof runs === "string" ? [text(runs)] : runs;
  if (style) node.style = style;
  if (list) node.list = list;
  return node;
}
const body = (runs: Run[] | string) =>
  paragraph(runs, { indentFirstLine: 28, lineHeight: 1.5, spacingAfter: 6 });
const heading = (value: string) =>
  paragraph(value, { styleId: "heading2", spacingBefore: 14, spacingAfter: 6, keepWithNext: true });

function table(rows: string[][], widths: number[], styleId: string): Block {
  const node = native.createTable(rows);
  node.style = { ...(node.style ?? {}), styleId, align: "center" };
  node.gridCols = widths;
  node.rows.forEach((row, index) => {
    if (index === 0) row.style = { ...(row.style ?? {}), isHeader: true };
    row.cells.forEach((cell) =>
      cell.blocks.forEach((block) => {
        if (block.type === "paragraph")
          block.style = { ...(block.style ?? {}), spacingAfter: 0, lineHeight: 1.15 };
      }),
    );
  });
  return node;
}

/** A textless plan view of the renovated reading room. */
function floorPlan(): Run {
  const canvas = document.createElement("canvas");
  canvas.width = 1120;
  canvas.height = 420;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#f6f3ec";
  g.fillRect(0, 0, 1120, 420);
  g.strokeStyle = "#4b5563";
  g.lineWidth = 10;
  g.strokeRect(40, 40, 1040, 340);
  g.fillStyle = "#9fc3d9";
  for (let x = 120; x < 1000; x += 220) g.fillRect(x, 34, 140, 12);
  g.fillStyle = "#8a5a44";
  for (let x = 70; x < 640; x += 96) g.fillRect(x, 300, 80, 46);
  g.fillRect(1000, 80, 46, 220);
  g.fillStyle = "#d9c7a5";
  for (const [cx, cy] of [
    [220, 170],
    [420, 170],
    [620, 170],
  ]) {
    g.beginPath();
    g.arc(cx, cy, 48, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#6b8f71";
    for (let a = 0; a < 4; a++) {
      g.beginPath();
      g.arc(cx + Math.cos((a * Math.PI) / 2) * 72, cy + Math.sin((a * Math.PI) / 2) * 72, 14, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#d9c7a5";
  }
  g.fillStyle = "#e8b65b";
  g.fillRect(760, 110, 180, 120);
  g.fillStyle = "#f6f3ec";
  g.fillRect(500, 368, 120, 24);
  return {
    id: id("run"),
    kind: "image",
    text: "￼",
    image: {
      src: canvas.toDataURL("image/png"),
      width: 560,
      height: 210,
      alt: "共享书房改造后平面布置：靠墙书架、三组圆桌阅读区、儿童角与入口",
    },
  };
}

export function demoDocument(): EditorDocument {
  const footnoteId = id("footnote");
  const commentAnchor = body(
    "项目总投资估算36.8万元，其中街道专项资金28万元，社区共建单位捐赠及志愿服务折算8.8万元。设备采购将通过街道集中采购平台比价，图书优先采用捐赠与公共图书馆流转相结合的方式。",
  );
  const blocks: Block[] = [
    paragraph("城南街道 · 社区公共空间微更新 · 2027年度申报", {
      align: "center",
      spacingAfter: 4,
    }),
    paragraph("城南社区共享书房改造项目建议书", { styleId: "heading1", align: "center", spacingAfter: 6 }),
    paragraph("申报单位：城南街道文化服务中心　编制日期：2026年10月", {
      align: "center",
      spacingAfter: 18,
    }),
    heading("一、项目背景"),
    body([
      text("城南社区建成于上世纪九十年代，现有常住居民约3,200人"),
      {
        id: id("run"),
        kind: "footnoteReference",
        text: "1",
        styles: { styleId: "footnoteReference", superscript: true },
        footnoteReference: { footnoteId },
      },
      text(
        "，其中60岁以上老人约占27%，学龄儿童约占11%。社区现有活动室面积86平方米，长期用作临时仓库，采光差、无障碍设施缺失，难以满足居民日常阅读和交流需求。",
      ),
    ]),
    body(
      "2026年上半年，街道通过线上问卷与入户走访共收集有效意见412份。居民最希望增加的公共服务依次为：安静的阅读空间、儿童课后托管、老年人数字技能辅导和周末亲子活动。改造现有活动室为共享书房，可以用较小投入回应多数诉求。",
    ),
    heading("二、建设目标"),
    paragraph("将闲置活动室改造为全天开放、适老适幼的社区共享书房；", { lineHeight: 1.5 }, { kind: "ordered", level: 0 }),
    paragraph("首年入藏图书不少于3,000册，并接入区图书馆通借通还系统；", { lineHeight: 1.5 }, { kind: "ordered", level: 0 }),
    paragraph("组建由居民、学校和共建单位组成的志愿服务队，保障每周开放60小时以上；", { lineHeight: 1.5 }, { kind: "ordered", level: 0 }),
    paragraph("建立借阅、活动与满意度台账，按季度向居民公开运行情况。", { lineHeight: 1.5, spacingAfter: 8 }, { kind: "ordered", level: 0 }),
    heading("三、改造内容与实施安排"),
    body(
      "改造遵循“先安全、后功能、再美化”的原则，保留原有承重结构，重点更新照明、通风和无障碍通道。空间划分为成人阅读区、儿童绘本角、数字服务台和可移动活动区，书架沿墙布置以腾出中部通行空间。",
    ),
    paragraph([floorPlan()], { align: "center", spacingBefore: 6, spacingAfter: 2, lineHeight: 1 }),
    paragraph("图1　共享书房改造后平面布置示意", { styleId: "Caption", align: "center", spacingAfter: 10 }),
    table(
      [
        ["阶段", "时间", "主要工作", "责任方"],
        ["方案深化", "2027年1月", "现场测绘、居民议事会确认方案", "文化服务中心"],
        ["施工改造", "2027年2—3月", "电路照明、地面与无障碍改造", "中标施工单位"],
        ["设备馆藏", "2027年4月", "书架家具进场，图书编目上架", "社区居委会"],
        ["试运行", "2027年5月", "志愿者培训，开放预约与借阅", "志愿服务队"],
        ["评估公开", "2027年12月", "年度满意度调查与运行报告", "第三方评估机构"],
      ],
      [84, 112, 228, 130],
      "LightShading-Accent1",
    ),
    paragraph("", { spacingAfter: 4 }),
    heading("四、投资估算与资金来源"),
    commentAnchor,
    table(
      [
        ["费用项目", "数量", "金额（万元）", "说明"],
        ["装修与照明改造", "86 ㎡", "16.5", "含电路、地面、灯具"],
        ["书架及阅读家具", "1批", "9.2", "可移动书架、桌椅"],
        ["数字服务设备", "1套", "4.6", "自助借还机、电子阅报屏"],
        ["首批图书采购", "1,200册", "4.3", "其余通过捐赠与流转"],
        ["运营与培训", "首年", "2.2", "志愿者培训、活动物料"],
        ["合计", "", "36.8", ""],
      ],
      [140, 84, 110, 220],
      "MediumShading1-Accent1",
    ),
    paragraph("", { spacingAfter: 4 }),
    heading("五、风险与应对"),
    paragraph("施工期间噪声影响居民：限定工作日9:00—17:00施工，提前一周张贴公告。", { lineHeight: 1.5 }, { kind: "bullet", level: 0 }),
    paragraph(
      [
        text("开放时段志愿者不足：与辖区两所中学共建社会实践岗位"),
        revised("，并为连续服务满一年的志愿者颁发证书", "insert", "王敏"),
        text("。"),
      ],
      { lineHeight: 1.5 },
      { kind: "bullet", level: 0 },
    ),
    paragraph("图书损耗与丢失：设置押金免除的信用借阅，并保留5%的年度补书预算。", { lineHeight: 1.5, spacingAfter: 8 }, { kind: "bullet", level: 0 }),
    heading("六、预期成效"),
    body([
      text("项目建成后，预计年接待居民1.5万人次，开展读书会、亲子共读和数字技能课堂"),
      revised("约50场", "delete", "李宁"),
      revised("不少于60场", "insert", "李宁"),
      text(
        "。共享书房将成为社区议事、志愿服务和邻里互助的固定场所，为街道其他老旧小区的公共空间更新提供可复制的做法。",
      ),
    ]),
    body("附件：居民意见汇总表、现场照片、施工图预算书（另附）。"),
    paragraph("联系人：周晓岚　联系电话：（示例）010-0000 0000", { align: "right", spacingBefore: 12 }),
  ];
  const doc = native.createDocument({ title: "城南社区共享书房改造项目建议书", blocks });
  const page = { ...A4_PORTRAIT, margins: { ...A4_PORTRAIT.margins } };
  doc.pageSettings = page;
  for (const section of doc.sections ?? []) section.pageSettings = { ...page, margins: { ...page.margins } };
  doc.footnotes = {
    ...(doc.footnotes ?? {}),
    items: {
      [footnoteId]: {
        id: footnoteId,
        blocks: [
          paragraph("数据来源：城南街道2025年度人口台账，按常住登记口径统计。", { styleId: "footnoteText" }),
        ],
      },
    },
  };
  const commentId = id("comment");
  doc.comments = {
    items: {
      [commentId]: {
        id: commentId,
        author: "陈主任",
        initials: "陈",
        date: REVIEW_DATE,
        text: "请补充设备采购的比价依据，并注明捐赠图书的验收方式。",
        start: { paragraphId: commentAnchor.id, offset: 0 },
        end: { paragraphId: commentAnchor.id, offset: 16 },
      },
    },
    order: [commentId],
  };
  return doc;
}
