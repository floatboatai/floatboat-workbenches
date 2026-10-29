// ABOUTME: 三个示例模板：带标志/明细表/合计/收款码的报价单，带条码的发货标签，以及叠加导入底图的结业证书。
import type { Template } from "@pdfme/common";
import type { PdfProject } from "./domain.ts";
import { SAMPLE_LOGO } from "./sample-logo.ts";

const FONT = "NotoSansSC";
const INK = "#24302E";
const MUTED = "#6B7672";
const GREEN = "#1F5F5B";

type Field = Template["schemas"][number][number];
const at = (x: number, y: number) => ({ x, y });
function text(name: string, content: string, x: number, y: number, width: number, height: number, style: Partial<Field> = {}): Field {
  return {
    name,
    type: "text",
    content,
    position: at(x, y),
    width,
    height,
    fontName: FONT,
    fontSize: 10,
    fontColor: INK,
    alignment: "left",
    verticalAlignment: "middle",
    lineHeight: 1.25,
    characterSpacing: 0,
    backgroundColor: "",
    ...style,
  };
}
const label = (name: string, content: string, x: number, y: number, width: number, height: number, style: Partial<Field> = {}) =>
  text(name, content, x, y, width, height, { readOnly: true, fontColor: MUTED, fontSize: 8, ...style });
const line = (name: string, x: number, y: number, width: number, color = GREEN): Field => ({
  name, type: "line", position: at(x, y), width, height: 0.35, rotate: 0, opacity: 1, readOnly: true, color,
});
const date = (name: string, content: string, x: number, y: number, width: number, format: string, style: Partial<Field> = {}): Field => ({
  name, type: "date", content, format, position: at(x, y), width, height: 6, rotate: 0, alignment: "left",
  fontName: FONT, fontSize: 9.5, characterSpacing: 0, fontColor: INK, backgroundColor: "", opacity: 1, locale: "zh", ...style,
});
const qr = (name: string, content: string, x: number, y: number, size: number): Field => ({
  name, type: "qrcode", content, position: at(x, y), width: size, height: size, backgroundColor: "#ffffff", barColor: "#000000", rotate: 0, opacity: 1,
});
const toDataUrl = (mime: string, value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${btoa(binary)}`;
};

const LINE_ITEMS = (rows: string) => `报价明细.reduce((sum, row) => sum + Number(row[2]) * Number(row[3]), 0)${rows}`;

/** First-open sample: a two-column quotation with logo, line-item table, computed totals and a payment QR code. */
export const quotationSample: PdfProject = {
  template: {
    basePdf: {
      width: 210,
      height: 297,
      padding: [10, 10, 10, 10],
      // Repeated on every page, so long line-item tables keep the page footer.
      staticSchema: [label("页脚", "青禾设计工作室 · 报价单 {报价编号} · 第 {currentPage}/{totalPages} 页", 18, 280, 174, 5, { alignment: "center", fontSize: 7.5 })],
    },
    schemas: [
      [
        { name: "标志", type: "image", content: SAMPLE_LOGO, position: at(18, 16), width: 17, height: 17, rotate: 0, opacity: 1, readOnly: true },
        text("公司名称", "青禾设计工作室", 39, 16, 90, 8, { readOnly: true, fontSize: 15, fontColor: GREEN }),
        label("公司信息", "杭州市西湖区文三路 398 号 · 0571-8696 2210", 39, 25, 100, 6, { fontSize: 8.5 }),
        text("单据标题", "报价单", 132, 15, 60, 13, { readOnly: true, fontSize: 24, alignment: "right", fontColor: GREEN, characterSpacing: 2 }),
        label("客户标签", "客户", 18, 44, 30, 5),
        text("客户名称", "杭州远山茶业有限公司", 18, 49, 100, 8, { fontSize: 13, required: true }),
        text("客户联系人", "陈思远 · 138 0571 2468", 18, 57.5, 100, 6, { fontSize: 9.5 }),
        text("客户地址", "杭州市余杭区良渚街道茶园路 12 号", 18, 63.5, 100, 6, { fontSize: 9.5 }),
        label("编号标签", "报价编号", 132, 49, 22, 6, { fontSize: 8.5 }),
        text("报价编号", "QT-2026-1107", 154, 49, 38, 6, { fontSize: 9.5, alignment: "right", required: true }),
        label("日期标签", "报价日期", 132, 56, 22, 6, { fontSize: 8.5 }),
        date("报价日期", "2026/11/07", 154, 56, 38, "yyyy-MM-dd", { alignment: "right" }),
        label("有效期标签", "有效期至", 132, 63, 22, 6, { fontSize: 8.5 }),
        date("有效期至", "2026/12/07", 154, 63, 38, "yyyy-MM-dd", { alignment: "right" }),
        line("分隔线", 18, 74, 174),
        {
          name: "报价明细",
          type: "table",
          position: at(18, 79),
          width: 174,
          height: 44.6,
          content: JSON.stringify([
            ["品牌视觉升级", "标志优化、标准色与字体规范", "1", "18000"],
            ["包装设计", "礼盒与茶罐两款包装结构及印刷稿", "2", "6500"],
            ["产品摄影", "20 款产品白底图与 6 张场景图", "1", "9200"],
            ["电商详情页", "旗舰店 3 款商品详情页", "3", "2800"],
          ]),
          showHead: true,
          head: ["服务项目", "说明", "数量", "单价（元）"],
          headWidthPercentages: [22, 50, 10, 18],
          tableStyles: { borderColor: "#C9D3D0", borderWidth: 0.2 },
          headStyles: {
            fontName: FONT, alignment: "left", verticalAlignment: "middle", fontSize: 9.5, lineHeight: 1, characterSpacing: 0,
            fontColor: "#ffffff", backgroundColor: GREEN, borderColor: "", borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
          },
          bodyStyles: {
            fontName: FONT, alignment: "left", verticalAlignment: "middle", fontSize: 9, lineHeight: 1.2, characterSpacing: 0,
            fontColor: INK, backgroundColor: "", borderColor: "#DDE3E1", borderWidth: { top: 0.1, bottom: 0.1, left: 0, right: 0 },
            padding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 }, alternateBackgroundColor: "#F4F7F6",
          },
          columnStyles: { alignment: { "2": "right", "3": "right" } },
        },
        text("小计", `小计  ¥{${LINE_ITEMS(".toFixed(2)")}}`, 112, 127, 80, 6, { readOnly: true, alignment: "right", fontSize: 9.5 }),
        text("税额", `增值税 6%  ¥{(${LINE_ITEMS("")} * 0.06).toFixed(2)}`, 112, 133.5, 80, 6, { readOnly: true, alignment: "right", fontSize: 9.5 }),
        text("合计", `合计  ¥{(${LINE_ITEMS("")} * 1.06).toFixed(2)}`, 112, 141, 80, 9, { readOnly: true, alignment: "right", fontSize: 14, fontColor: GREEN }),
        {
          name: "付款说明",
          type: "multiVariableText",
          content: JSON.stringify({ 预付比例: "50", 验收天数: "7", 开户行: "招商银行杭州高新支行 5719 0823 6610 801" }),
          text: "签约后支付 {预付比例}% 预付款，交付验收后 {验收天数} 个工作日内付清尾款。\n开户行：{开户行}",
          variables: ["预付比例", "验收天数", "开户行"],
          position: at(18, 128),
          width: 88,
          height: 18,
          rotate: 0, alignment: "left", verticalAlignment: "top", fontName: FONT, fontSize: 8.5, lineHeight: 1.45, characterSpacing: 0,
          fontColor: INK, backgroundColor: "", opacity: 1, readOnly: false,
        },
        qr("收款二维码", "https://pay.example.com/qinghe/QT-2026-1107", 18, 156, 24),
        label("二维码说明", "扫码查看报价并在线确认", 45, 164, 50, 6, { fontSize: 8.5 }),
        {
          name: "签章框", type: "rectangle", position: at(120, 156), width: 72, height: 30, rotate: 0, opacity: 1,
          borderWidth: 0.3, borderColor: "#9AA7A3", color: "", readOnly: true, radius: 1.5,
        },
        label("签章说明", "客户确认（签字 / 盖章）", 123, 158, 66, 6, { fontSize: 8.5 }),
        text("备注", "本报价含两轮修改；超出约定范围的需求另行报价。印刷与打样费用不含在内。", 18, 194, 174, 12, { fontSize: 8.5, lineHeight: 1.45, fontColor: MUTED, verticalAlignment: "top" }),
      ],
    ],
  },
  values: {},
};

const SHIPMENTS = [
  ["运单号", "服务类型", "分拣码", "件数", "收件人", "收件电话", "收件地址", "寄件人", "寄件地址", "重量", "寄件日期", "易碎", "备注"],
  ["SD7708123456CN", "次日达", "杭-03", "1/1", "王雨桐", "139 0571 2087", "浙江省杭州市拱墅区湖墅南路 186 号 3 幢 1202 室", "青禾设计工作室", "杭州市西湖区文三路 398 号", "1.6 kg", "2026-11-07", "是", "工作日 9:00–18:00 收件"],
  ["SD7708123457CN", "标准件", "沪-11", "1/2", "周以宁", "186 2160 3391", "上海市徐汇区漕溪北路 88 号圣爱大厦 1906", "青禾设计工作室", "杭州市西湖区文三路 398 号", "3.2 kg", "2026-11-07", "否", ""],
  ["SD7708123458CN", "标准件", "沪-11", "2/2", "周以宁", "186 2160 3391", "上海市徐汇区漕溪北路 88 号圣爱大厦 1906", "青禾设计工作室", "杭州市西湖区文三路 398 号", "2.9 kg", "2026-11-07", "否", ""],
  ["SD7708123459CN", "冷链", "苏-07", "1/1", "顾清和", "152 5180 6602", "江苏省苏州市姑苏区干将西路 1288 号", "远山茶业", "杭州市余杭区良渚街道茶园路 12 号", "4.5 kg", "2026-11-08", "是", "冷藏茶样，请当日签收"],
  ["SD7708123460CN", "次日达", "京-21", "1/1", "", "135 0102 7745", "北京市朝阳区建国路 93 号万达广场 8 号楼 1501", "青禾设计工作室", "杭州市西湖区文三路 398 号", "0.8 kg", "2026-11-08", "否", "收件人待确认"],
  ["SD7708123461CN", "标准件", "粤-15", "1/1", "梁嘉怡", "137 2290 4418", "广东省广州市天河区珠江新城华夏路 30 号", "远山茶业", "杭州市余杭区良渚街道茶园路 12 号", "2.1 kg", "2026-11-08", "否", ""],
  ["SD7708123462CN", "次日达", "杭-05", "1/1", "沈知远", "158 6812 3307", "浙江省杭州市滨江区网商路 699 号", "青禾设计工作室", "杭州市西湖区文三路 398 号", "1.1 kg", "2026-11-09", "是", "前台代收"],
];
const csv = (rows: string[][]) => rows.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\r\n") + "\r\n";

/** 100 × 150 mm thermal label with Code 128 waybill, QR code and a batch of shipments ready to map. */
export const labelSample: PdfProject = {
  template: {
    basePdf: { width: 100, height: 150, padding: [3, 3, 3, 3] },
    schemas: [
      [
        text("承运商", "顺达快运", 5, 5, 55, 8, { readOnly: true, fontSize: 15, fontColor: "#000000" }),
        {
          name: "服务类型", type: "select", content: "次日达", options: ["标准件", "次日达", "冷链"], position: at(62, 5), width: 33, height: 8,
          rotate: 0, alignment: "right", verticalAlignment: "middle", fontName: FONT, fontSize: 12, lineHeight: 1, characterSpacing: 0,
          fontColor: "#000000", backgroundColor: "", opacity: 1,
        },
        line("顶线", 5, 14, 90, "#000000"),
        text("分拣码", "杭-03", 5, 16, 55, 16, { fontSize: 30, fontColor: "#000000" }),
        {
          name: "件数框", type: "ellipse", position: at(64, 17), width: 31, height: 14, rotate: 0, opacity: 1,
          borderWidth: 0.8, borderColor: "#000000", color: "", readOnly: true, radius: 0,
        },
        text("件数", "1/1", 64, 19, 31, 10, { fontSize: 14, alignment: "center", fontColor: "#000000" }),
        { name: "运单号", type: "code128", content: "SD7708123456CN", position: at(5, 35), width: 90, height: 18, backgroundColor: "#ffffff", barColor: "#000000", textColor: "#000000", includetext: true, rotate: 0, opacity: 1, required: true },
        line("收件线", 5, 56, 90, "#000000"),
        text("收件标记", "收", 5, 59, 8, 8, { readOnly: true, fontSize: 13, alignment: "center", fontColor: "#ffffff", backgroundColor: "#000000" }),
        text("收件人", "王雨桐", 15, 59, 48, 8, { fontSize: 13, fontColor: "#000000", required: true }),
        text("收件电话", "139 0571 2087", 62, 59, 33, 8, { fontSize: 10, alignment: "right", fontColor: "#000000" }),
        text("收件地址", "浙江省杭州市拱墅区湖墅南路 186 号 3 幢 1202 室", 15, 68, 80, 14, { fontSize: 10.5, lineHeight: 1.3, verticalAlignment: "top", fontColor: "#000000", required: true }),
        line("寄件线", 5, 84, 90, "#000000"),
        text("寄件标记", "寄", 5, 87, 6, 6, { readOnly: true, fontSize: 9, alignment: "center", fontColor: "#000000", backgroundColor: "#E6E6E6" }),
        text("寄件人", "青禾设计工作室", 13, 87, 82, 6, { fontSize: 9, fontColor: "#000000" }),
        text("寄件地址", "杭州市西湖区文三路 398 号", 13, 93, 82, 6, { fontSize: 8.5, fontColor: "#333333" }),
        line("底线", 5, 101, 90, "#000000"),
        qr("运单二维码", "SD7708123456CN", 5, 104, 26),
        label("重量标签", "重量", 35, 104, 28, 5, { fontSize: 7.5 }),
        text("重量", "1.6 kg", 35, 109, 28, 6, { fontSize: 11, fontColor: "#000000" }),
        label("日期标签", "寄件日期", 65, 104, 30, 5, { fontSize: 7.5 }),
        date("寄件日期", "2026/11/07", 65, 109, 30, "yyyy-MM-dd", { fontColor: "#000000" }),
        { name: "易碎", type: "checkbox", content: "true", position: at(35, 119), width: 4.5, height: 4.5, color: "#000000" },
        label("易碎说明", "易碎品，轻拿轻放", 41, 118.5, 54, 5.5, { fontSize: 8.5, fontColor: "#000000" }),
        text("备注", "工作日 9:00–18:00 收件", 35, 125, 60, 6, { fontSize: 8, fontColor: "#333333" }),
        label("页脚", "签收前请检查外包装 · 客服 400-820-6600", 5, 140, 90, 5, { alignment: "center", fontSize: 7 }),
      ],
    ],
  },
  values: {},
  dataset: {
    source: toDataUrl("text/csv", csv(SHIPMENTS)),
    name: "11月第2周发货单.csv",
    format: "csv",
    mapping: {
      服务类型: "服务类型", 分拣码: "分拣码", 件数: "件数", 运单号: "运单号", 收件人: "收件人", 收件电话: "收件电话", 收件地址: "收件地址",
      寄件人: "寄件人", 寄件地址: "寄件地址", 运单二维码: "运单号", 重量: "重量", 寄件日期: "寄件日期", 易碎: "易碎", 备注: "备注",
    },
    fileColumn: "运单号",
    selected: 0,
  },
};

const GRADUATES = [
  ["学员姓名", "课程名称", "开始日期", "结束日期", "学时", "成绩等级", "证书编号", "颁发日期", "校验链接"],
  ["林晓雯", "品牌视觉系统设计", "2026年9月6日", "2026年10月25日", "48", "优秀", "QH-2026-0318", "2026-11-07", "https://verify.example.com/cert/QH-2026-0318"],
  ["许嘉禾", "品牌视觉系统设计", "2026年9月6日", "2026年10月25日", "48", "良好", "QH-2026-0319", "2026-11-07", "https://verify.example.com/cert/QH-2026-0319"],
  ["何沐阳", "品牌视觉系统设计", "2026年9月6日", "2026年10月25日", "48", "优秀", "QH-2026-0320", "2026-11-07", "https://verify.example.com/cert/QH-2026-0320"],
  ["唐若溪", "包装结构与印前工艺", "2026年9月13日", "2026年10月18日", "32", "合格", "QH-2026-0321", "2026-11-07", "https://verify.example.com/cert/QH-2026-0321"],
  ["孟清越", "包装结构与印前工艺", "2026年9月13日", "2026年10月18日", "32", "优秀", "QH-2026-0322", "2026-11-07", "https://verify.example.com/cert/QH-2026-0322"],
  ["邵一帆", "包装结构与印前工艺", "2026年9月13日", "2026年10月18日", "32", "良好", "QH-2026-0323", "2026-11-07", "https://verify.example.com/cert/QH-2026-0323"],
];

/** A4 landscape certificate laid over an imported PDF background (passed in after the real import path stores it). */
export function certificateSample(basePdf: string): PdfProject {
  return {
    template: {
      basePdf,
      schemas: [
        [
          text("证书标题", "结业证书", 48.5, 36, 200, 16, { readOnly: true, fontSize: 34, alignment: "center", fontColor: GREEN, characterSpacing: 6 }),
          label("兹证明", "兹证明", 48.5, 63, 200, 7, { alignment: "center", fontSize: 12 }),
          text("学员姓名", "林晓雯", 73.5, 72, 150, 16, { fontSize: 30, alignment: "center", fontColor: INK, required: true }),
          {
            name: "证书正文",
            type: "multiVariableText",
            content: JSON.stringify({ 开始日期: "2026年9月6日", 结束日期: "2026年10月25日", 课程名称: "品牌视觉系统设计", 学时: "48", 成绩等级: "优秀" }),
            text: "已于 {开始日期} 至 {结束日期} 完成「{课程名称}」全部 {学时} 学时课程，\n考核成绩{成绩等级}，特发此证。",
            variables: ["开始日期", "结束日期", "课程名称", "学时", "成绩等级"],
            position: at(38.5, 95),
            width: 220,
            height: 22,
            rotate: 0, alignment: "center", verticalAlignment: "top", fontName: FONT, fontSize: 13, lineHeight: 1.7, characterSpacing: 0,
            fontColor: INK, backgroundColor: "", opacity: 1, readOnly: false,
          },
          text("颁发单位", "青禾设计学院", 42, 154, 74, 8, { readOnly: true, fontSize: 13, alignment: "center" }),
          label("颁发单位标签", "颁发单位", 42, 165.5, 74, 5, { alignment: "center", fontSize: 8.5 }),
          date("颁发日期", "2026/11/07", 42, 172, 74, "yyyy年MM月dd日", { alignment: "center", fontSize: 10 }),
          qr("校验二维码", "https://verify.example.com/cert/QH-2026-0318", 196, 150, 20),
          text("证书编号", "QH-2026-0318", 186, 172, 40, 5, { fontSize: 8, alignment: "center", fontColor: MUTED, required: true }),
          text("印章文字", "青禾设计学院\n教务处", 228, 162.5, 32, 12, { readOnly: true, fontSize: 8.5, lineHeight: 1.3, alignment: "center", fontColor: "#B5463C", opacity: 0.85 }),
        ],
      ],
    },
    values: {},
    dataset: {
      source: toDataUrl("text/csv", csv(GRADUATES)),
      name: "2026秋季结业名单.csv",
      format: "csv",
      mapping: { 学员姓名: "学员姓名", 证书正文: "", 颁发日期: "颁发日期", 校验二维码: "校验链接", 证书编号: "证书编号" },
      fileColumn: "学员姓名",
      selected: 0,
    },
  };
}

export const blankSample = (width: number, height: number): PdfProject => ({
  template: {
    basePdf: { width, height, padding: [10, 10, 10, 10] },
    schemas: [[text("标题", "在此输入标题", 20, 20, Math.min(120, width - 40), 12, { fontSize: 18 })]],
  },
  values: {},
});

export const seed = quotationSample;
