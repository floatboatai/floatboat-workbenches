// ABOUTME: 首次打开时的示例文稿：一份普通的门店季度复盘，覆盖全部版式、图表、表格、图片与形状。
import { textBox, type Deck, type LayoutId, type Paragraph, type SlideElement, type SlotName } from "./domain.ts";
import { LAYOUTS, defaultTheme } from "./layouts.ts";

/** sha256 of the bundled storefront illustration (src/server/demo-media.ts). */
export const SEED_MEDIA_ID = "11a2c1dc3b4f1701c57cc1583f7625d70b32b59397d89f87a0f56efe41a1b77b";

function slot(layout: LayoutId, name: SlotName, overrides: Record<string, unknown>): SlideElement {
  const def = LAYOUTS[layout].slots.find((s) => s.name === name);
  if (!def) throw new Error(`missing slot ${layout}/${name}`);
  return { ...def.make(), id: name, slot: name, ...overrides } as SlideElement;
}
const p = (text: string, extra: Partial<Paragraph> = {}): Paragraph => ({ runs: [{ text }], ...extra });
const bullets = (...lines: string[]): Paragraph[] => lines.map((line) => p(line, { bullet: true }));

export const seed: Deck = {
  version: 2,
  theme: defaultTheme(),
  slides: [
    {
      id: "cover",
      layout: "title",
      hidden: false,
      notes: "开场 30 秒：说明这份复盘覆盖 7–9 月、12 家门店，结论先行。",
      elements: [
        slot("title", "kicker", { paragraphs: [p("华东区 · 2026 年第三季度")] }),
        slot("title", "title", { paragraphs: [p("门店运营复盘与第四季度计划")] }),
        slot("title", "subtitle", { paragraphs: [p("销售、客流、会员与新店进展"), p("区域运营部 · 2026 年 10 月")] }),
      ],
    },
    {
      id: "section-results",
      layout: "section",
      hidden: false,
      notes: "",
      elements: [
        slot("section", "kicker", { paragraphs: [p("01")] }),
        slot("section", "title", { paragraphs: [p("业绩概览")] }),
        slot("section", "subtitle", { paragraphs: [p("销售额同比增长 14%，客单价持平，客流是主要驱动")] }),
      ],
    },
    {
      id: "sales-chart",
      layout: "chart",
      hidden: false,
      notes: "强调 9 月开学季的拉动，以及 8 月高温对客流的影响已经恢复。",
      elements: [
        slot("chart", "title", { paragraphs: [p("月度销售额（万元）：三个月均超去年同期")] }),
        slot("chart", "chart", {
          chart: "bar",
          title: "",
          categories: ["7 月", "8 月", "9 月"],
          series: [
            { name: "2025 年", values: ["412", "398", "436"] },
            { name: "2026 年", values: ["455", "447", "521"] },
          ],
          legend: true,
          labels: true,
        }),
      ],
    },
    {
      id: "key-changes",
      layout: "content",
      hidden: false,
      notes: "第二条是本季度最重要的经验，可以展开讲试点门店的排班表。",
      elements: [
        slot("content", "title", { paragraphs: [p("本季度三个关键变化")] }),
        slot("content", "body", {
          paragraphs: [
            { bullet: true, runs: [{ text: "客流回升：", bold: true }, { text: "周末到店人次同比 " }, { text: "+18%", bold: true, color: "accent" }, { text: "，工作日基本持平" }] },
            { bullet: true, runs: [{ text: "排班调整：", bold: true }, { text: "晚高峰增加 1 名店员后，结账等待从 6 分钟降到 " }, { text: "3 分钟", bold: true, color: "accent" }] },
            { bullet: true, level: 1, runs: [{ text: "试点门店：观前街、平江路、湖滨" }] },
            { bullet: true, runs: [{ text: "会员复购：", bold: true }, { text: "90 天复购率 41%，细节见 " }, { text: "会员运营月报", underline: true, color: "accent", link: "https://www.example.com/reports/membership-2026q3" }] },
          ],
        }),
      ],
    },
    {
      id: "store-table",
      layout: "table",
      hidden: false,
      notes: "湖滨店同比下滑与道路施工有关，施工 11 月结束。",
      elements: [
        slot("table", "title", { paragraphs: [p("门店指标对比（第三季度）")] }),
        slot("table", "table", {
          h: 52,
          rows: [
            ["门店", "销售额（万元）", "同比", "客单价（元）", "NPS"],
            ["观前街", "268", "+21%", "86", "62"],
            ["平江路", "214", "+16%", "79", "58"],
            ["湖滨", "187", "-4%", "92", "51"],
            ["金鸡湖", "241", "+12%", "88", "60"],
            ["新街口", "199", "+9%", "75", "55"],
          ],
          size: 14,
        }),
      ],
    },
    {
      id: "channels",
      layout: "two-column",
      hidden: false,
      notes: "",
      elements: [
        slot("two-column", "title", { paragraphs: [p("线上线下一起增长")] }),
        slot("two-column", "body", {
          paragraphs: bullets("小程序自提订单占比升至 23%", "到店自提顺带购买率 37%", "社群团购在社区店效果最好", "线下活动带来 1,200 名新会员"),
        }),
        {
          id: "channel-mix",
          type: "chart",
          x: 52,
          y: 30,
          w: 42,
          h: 60,
          chart: "doughnut",
          title: "销售渠道占比",
          categories: ["门店现场", "小程序自提", "社群团购", "外卖平台"],
          series: [{ name: "占比", values: ["58", "23", "11", "8"] }],
          legend: true,
          labels: true,
        },
      ],
    },
    {
      id: "membership",
      layout: "comparison",
      hidden: false,
      notes: "新方案在 3 家门店试点 6 周后再决定是否推广。",
      elements: [
        slot("comparison", "title", { paragraphs: [p("会员计划：现行方案与新方案")] }),
        slot("comparison", "heading1", { paragraphs: [p("现行：积分抵现")] }),
        slot("comparison", "body", { paragraphs: bullets("每消费 1 元积 1 分", "100 分抵 1 元", "积分 12 个月过期", "核销率 18%") }),
        slot("comparison", "heading2", { paragraphs: [p("新方案：月度权益")] }),
        slot("comparison", "body2", { paragraphs: bullets("每月 2 张满减券", "生日月双倍积分", "到店自提免排队", "预计核销率 35%") }),
      ],
    },
    {
      id: "new-store",
      layout: "image-text",
      hidden: false,
      notes: "门店照片由店长提供，这里使用示意插画。",
      elements: [
        slot("image-text", "media", { mediaId: SEED_MEDIA_ID, alt: "观前街店门头示意插画：蓝白条纹遮阳篷与两侧橱窗" }),
        slot("image-text", "title", { paragraphs: [p("新形象门店：观前街店")] }),
        slot("image-text", "body", {
          paragraphs: bullets("9 月 6 日完成改造，营业面积 180 平方米", "橱窗陈列每两周更换一次", "开业首月销售额 96 万元，超出目标 12%"),
        }),
      ],
    },
    {
      id: "quote",
      layout: "quote",
      hidden: false,
      notes: "",
      elements: [
        slot("quote", "quote", { paragraphs: [p("把每一次到店，都当作顾客第一次来。")] }),
        slot("quote", "byline", { paragraphs: [p("—— 观前街店店长 张敏")] }),
      ],
    },
    {
      id: "roadmap",
      layout: "blank",
      hidden: false,
      notes: "最后请各店长确认第四季度的负责人与检查节点。",
      elements: [
        textBox("roadmap-title", 6, 8, 88, 12, [p("第四季度行动路线")], { font: "head", size: 30, bold: true, valign: "bottom" }),
        textBox("roadmap-sub", 6, 21, 88, 7, [p("每一步都有负责人和检查节点")], { size: 16, color: "muted" }),
        ...(
          [
            ["step-1", 6, "10 月", "排班优化推广到全部 12 家门店"],
            ["step-2", 37, "11 月", "会员新方案 3 店试点"],
            ["step-3", 68, "12 月", "年终活动与湖滨店恢复"],
          ] as const
        ).flatMap(([id, x, month, text]): SlideElement[] => [
          {
            id,
            type: "shape",
            shape: "roundRect",
            x,
            y: 40,
            w: 26,
            h: 34,
            fill: "surface",
            line: "accent",
            lineWidth: 1.5,
            text: "",
            textColor: "text",
            size: 14,
          },
          textBox(`${id}-month`, x + 2, 43, 22, 9, [p(month)], { font: "head", size: 24, bold: true, color: "accent" }),
          textBox(`${id}-text`, x + 2, 53, 22, 18, [p(text)], { size: 16, lineSpacing: 1.1 }),
        ]),
        { id: "arrow-1", type: "shape", shape: "rightArrow", x: 32.5, y: 54, w: 4, h: 6, fill: "accent2", line: null, lineWidth: 0, text: "", textColor: "text", size: 12 },
        { id: "arrow-2", type: "shape", shape: "rightArrow", x: 63.5, y: 54, w: 4, h: 6, fill: "accent2", line: null, lineWidth: 0, text: "", textColor: "text", size: 12 },
      ],
    },
  ],
};
