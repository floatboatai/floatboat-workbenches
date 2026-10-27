import type { Template } from "@pdfme/common";
import { isRecord, boundedText } from "./project.ts";
export interface PdfProject {
  template: Template;
  values: Record<string, string>;
}
export function pdfInput(document: PdfProject): Record<string, string> {
  return Object.fromEntries(
    document.template.schemas
      .flat()
      .filter((field) => field.type === "text" && !field.readOnly)
      .map((field) => [
        field.name,
        document.values[field.name] ?? field.content ?? "",
      ]),
  );
}
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function validatePdf(value: unknown): PdfProject {
  if (
    !isRecord(value) ||
    !isRecord(value.template) ||
    !isRecord(value.template.basePdf) ||
    !Array.isArray(value.template.schemas) ||
    !isRecord(value.values)
  )
    throw new Error("需要有效的模板和字段数据。");
  const base = value.template.basePdf;
  if (
    !finite(base.width, 50, 500) ||
    !finite(base.height, 50, 700) ||
    !Array.isArray(base.padding) ||
    base.padding.length !== 4 ||
    !base.padding.every((n) => finite(n, 0, 100))
  )
    throw new Error("页面尺寸无效。仅支持空白纸张模板。");
  if (value.template.schemas.length < 1 || value.template.schemas.length > 10)
    throw new Error("模板需要 1–10 页。");
  const keys = new Set<string>();
  let count = 0;
  for (const page of value.template.schemas) {
    if (!Array.isArray(page)) throw new Error("页面字段格式无效。");
    for (const field of page) {
      count++;
      if (
        !isRecord(field) ||
        typeof field.name !== "string" ||
        !field.name.trim() ||
        field.name.length > 80 ||
        field.name in Object.prototype ||
        !["text", "rectangle"].includes(String(field.type)) ||
        !isRecord(field.position) ||
        !finite(field.position.x, 0, 500) ||
        !finite(field.position.y, 0, 700) ||
        !finite(field.width, 0.1, 500) ||
        !finite(field.height, 0.1, 700)
      )
        throw new Error("字段名称、类型或尺寸无效。");
      if (keys.has(field.name)) throw new Error("字段名称不能重复。");
      keys.add(field.name);
      if (field.content !== undefined) boundedText(field.content, 5000);
      if (
        field.type === "text" &&
        field.fontName !== undefined &&
        field.fontName !== "NotoSansSC"
      )
        throw new Error("文本字段必须使用已安装的中文字体。");
    }
  }
  if (count > 80) throw new Error("最多支持 80 个字段。");
  const values: Record<string, string> = {};
  for (const [key, item] of Object.entries(value.values)) {
    if (keys.has(key)) values[key] = boundedText(item, 5000);
  }
  const template = structuredClone(value.template) as unknown as Template;
  for (const page of template.schemas)
    for (const field of page)
      if (field.type === "text") field.fontName = "NotoSansSC";
  return { template, values };
}
const textField = (
  name: string,
  content: string,
  y: number,
  readOnly = false,
  fontSize = 14,
) => ({
  name,
  type: "text",
  content,
  position: { x: 22, y },
  width: 165,
  height: 12,
  fontName: "NotoSansSC",
  fontSize,
  fontColor: "#26313B",
  alignment: "left",
  verticalAlignment: "middle",
  lineHeight: 1.2,
  characterSpacing: 0,
  backgroundColor: "",
  readOnly,
});
export const seed: PdfProject = {
  template: {
    basePdf: { width: 210, height: 297, padding: [16, 16, 16, 16] },
    schemas: [
      [
        textField("heading", "项目报价单", 22, true, 26),
        textField("reference", "编号：FB-2026-001", 43),
        {
          name: "divider",
          type: "rectangle",
          position: { x: 22, y: 64 },
          width: 165,
          height: 1,
          color: "#A76C3F",
          borderWidth: 0,
          borderColor: "",
          readOnly: true,
        },
        textField("customer", "客户：示例客户", 78),
        textField("service", "服务：品牌设计与内容制作", 100),
        textField("amount", "报价：人民币 12,000 元", 122),
        textField("delivery", "交付日期：2026 年 11 月 15 日", 144),
        textField("notes", "备注：请核对服务范围及交付内容。", 176),
        textField("footer", "感谢信任，期待合作。", 245, true, 11),
      ],
    ],
  },
  values: {
    reference: "编号：FB-2026-001",
    customer: "客户：示例客户",
    service: "服务：品牌设计与内容制作",
    amount: "报价：人民币 12,000 元",
    delivery: "交付日期：2026 年 11 月 15 日",
    notes: "备注：请核对服务范围及交付内容。",
  },
};
