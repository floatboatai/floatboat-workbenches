import { boundedText, isRecord } from "./project.ts";
export const FORMAL_BYTES = 850000,
  RESTORE_BYTES = 2000000,
  MAX_ITEMS = 80;
export const currencies = {
  CNY: { symbol: "¥", subunit: 100 },
  USD: { symbol: "$", subunit: 100 },
  EUR: { symbol: "€", subunit: 100 },
  JPY: { symbol: "¥", subunit: 1 },
} as const;
export type Currency = keyof typeof currencies;
export interface Party {
  name: string;
  address: string;
  email: string;
  phone: string;
  registration: string;
}
export interface ImageAsset {
  name: string;
  mime: "image/png" | "image/jpeg";
  base64: string;
  width: number;
  height: number;
}
export interface Line {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  price: string;
}
export interface InvoiceData {
  kind: "quotation" | "invoice";
  number: string;
  issued: string;
  due: string;
  currency: Currency;
  issuer: Party;
  customer: Party;
  items: Line[];
  discountMode: "none" | "fixed" | "percentage";
  discount: string;
  taxMode: "none" | "exclusive" | "inclusive";
  taxRate: string;
  shipping: string;
  paid: string;
  bank: string;
  notes: string;
  terms: string;
  layout: "classic" | "letterhead";
  pageSize: "A4" | "LETTER";
  fontSize: "small" | "medium" | "large";
  headerStyle: "light" | "dark" | "outline";
  accent: string;
  logo: ImageAsset | null;
  signature: ImageAsset | null;
}
export function bytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
function record(
  raw: unknown,
  keys: string[],
  label: string,
): Record<string, unknown> {
  if (!isRecord(raw) || Object.keys(raw).some((k) => !keys.includes(k)))
    throw Error(label + "结构无效或包含未支持字段。");
  return raw;
}
function choice<T extends string>(
  raw: unknown,
  options: readonly T[],
  label: string,
): T {
  if (typeof raw !== "string" || !options.includes(raw as T))
    throw Error(label + "无效。");
  return raw as T;
}
function party(raw: unknown): Party {
  const p = record(
    raw,
    ["name", "address", "email", "phone", "registration"],
    "参与方",
  );
  return {
    name: boundedText(p.name, 160),
    address: boundedText(p.address, 500),
    email: boundedText(p.email, 160),
    phone: boundedText(p.phone, 80),
    registration: boundedText(p.registration, 120),
  };
}
export function imageAsset(raw: unknown): ImageAsset | null {
  if (raw === null) return null;
  const p = record(raw, ["name", "mime", "base64", "width", "height"], "图片");
  const name = boundedText(p.name, 512),
    mime = choice(p.mime, ["image/png", "image/jpeg"], "图片类型");
  const base64 = boundedText(p.base64, 205000);
  if (!base64 || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
    throw Error("图片编码无效。");
  const binary = atob(base64);
  if (binary.length > 150 * 1024) throw Error("图片原件限150 KiB。");
  const b = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  let width = 0,
    height = 0;
  if (mime === "image/png") {
    if (
      b.length < 33 ||
      b[0] !== 137 ||
      b[1] !== 80 ||
      b[2] !== 78 ||
      b[3] !== 71 ||
      b[12] !== 73 ||
      b[13] !== 72 ||
      b[14] !== 68 ||
      b[15] !== 82
    )
      throw Error("PNG文件头无效。");
    const v = new DataView(b.buffer);
    width = v.getUint32(16);
    height = v.getUint32(20);
  } else {
    if (b[0] !== 255 || b[1] !== 216) throw Error("JPEG文件头无效。");
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 255) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2;
        continue;
      }
      const n = (b[i + 2] << 8) | b[i + 3];
      if (n < 2 || i + n + 2 > b.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        height = (b[i + 5] << 8) | b[i + 6];
        width = (b[i + 7] << 8) | b[i + 8];
        break;
      }
      i += n + 2;
    }
  }
  if (
    !width ||
    !height ||
    width * height > 4000000 ||
    width > 8000 ||
    height > 8000
  )
    throw Error("图片尺寸无法识别或超过400万像素。");
  if (p.width !== width || p.height !== height)
    throw Error("图片尺寸与原件不一致。");
  return { name, mime, base64, width, height };
}
export const imageUrl = (asset: ImageAsset | null) =>
  asset ? "data:" + asset.mime + ";base64," + asset.base64 : undefined;
export function restoreInvoice(raw: unknown): InvoiceData {
  if (bytes(raw) > RESTORE_BYTES) throw Error("工作稿超过2MB，请拆分内容。");
  const p = record(
    raw,
    [
      "kind",
      "number",
      "issued",
      "due",
      "currency",
      "issuer",
      "customer",
      "items",
      "discountMode",
      "discount",
      "taxMode",
      "taxRate",
      "shipping",
      "paid",
      "bank",
      "notes",
      "terms",
      "layout",
      "pageSize",
      "fontSize",
      "headerStyle",
      "accent",
      "logo",
      "signature",
    ],
    "单据",
  );
  if (!Array.isArray(p.items) || p.items.length > MAX_ITEMS)
    throw Error("单据最多80条明细。");
  const ids = new Set<string>();
  const items = p.items.map((raw) => {
    const l = record(
        raw,
        ["id", "description", "unit", "quantity", "price"],
        "明细",
      ),
      id = boundedText(l.id, 80);
    if (!id || ids.has(id)) throw Error("明细编号重复或缺失。");
    ids.add(id);
    return {
      id,
      description: boundedText(l.description, 2000),
      unit: boundedText(l.unit, 24),
      quantity: boundedText(l.quantity, 32),
      price: boundedText(l.price, 32),
    };
  });
  const accent = boundedText(p.accent, 7);
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw Error("颜色应为六位色值。");
  return {
    kind: choice(p.kind, ["quotation", "invoice"], "类型"),
    number: boundedText(p.number, 80),
    issued: boundedText(p.issued, 32),
    due: boundedText(p.due, 32),
    currency: choice(p.currency, Object.keys(currencies) as Currency[], "币种"),
    issuer: party(p.issuer),
    customer: party(p.customer),
    items,
    discountMode: choice(
      p.discountMode,
      ["none", "fixed", "percentage"],
      "折扣方式",
    ),
    discount: boundedText(p.discount, 32),
    taxMode: choice(p.taxMode, ["none", "exclusive", "inclusive"], "税费方式"),
    taxRate: boundedText(p.taxRate, 32),
    shipping: boundedText(p.shipping, 32),
    paid: boundedText(p.paid, 32),
    bank: boundedText(p.bank, 2000),
    notes: boundedText(p.notes, 12000),
    terms: boundedText(p.terms, 12000),
    layout: choice(p.layout, ["classic", "letterhead"], "版式"),
    pageSize: choice(p.pageSize, ["A4", "LETTER"], "纸张"),
    fontSize: choice(p.fontSize, ["small", "medium", "large"], "字号"),
    headerStyle: choice(p.headerStyle, ["light", "dark", "outline"], "表头"),
    accent,
    logo: imageAsset(p.logo),
    signature: imageAsset(p.signature),
  };
}
export function decimal(
  raw: string,
  label: string,
  places = 2,
  max = 1000000,
  positive = false,
) {
  const pattern = new RegExp("^(?:0|[1-9]\\d*)(?:\\.\\d{1," + places + "})?$");
  if (
    !pattern.test(raw) ||
    !Number.isFinite(Number(raw)) ||
    Number(raw) > max ||
    (positive && Number(raw) <= 0)
  )
    throw Error(
      label +
        "需为" +
        (positive ? "大于0的" : "非负") +
        "数字，最多" +
        places +
        "位小数。",
    );
  return Number(raw);
}
export function minor(raw: string, currency: Currency, label: string) {
  const unit = currencies[currency].subunit;
  if (unit === 1) {
    if (!/^(0|[1-9]\d*)$/.test(raw) || Number(raw) > 1000000)
      throw Error(label + "在JPY中需为非负整数。");
    return Number(raw);
  }
  decimal(raw, label, 2);
  const [a, b = ""] = raw.split(".");
  return Number(a) * 100 + Number(b.padEnd(2, "0"));
}
function date(raw: string, label: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
    !Number.isFinite(Date.parse(raw)) ||
    new Date(raw + "T00:00:00Z").toISOString().slice(0, 10) !== raw
  )
    throw Error(label + "需要有效日期。");
}
export function validateInvoice(raw: unknown): InvoiceData {
  const p = restoreInvoice(raw);
  if (bytes(p) > FORMAL_BYTES)
    throw Error("单据超过850KB，已保留工作稿，请减少内容。");
  if (!p.number.trim() || !p.issuer.name.trim() || !p.customer.name.trim())
    throw Error("请填写编号、出具方和客户名称。");
  date(p.issued, "出具日期");
  date(p.due, "到期日期");
  if (p.due < p.issued) throw Error("到期日不能早于出具日。");
  if (!p.items.length) throw Error("请添加至少一条明细。");
  if (
    p.items.reduce((n, l) => n + l.description.length, 0) +
      p.notes.length +
      p.terms.length >
    30000
  )
    throw Error("正式单据文字限30000字，请拆分；工作稿仍保留。");
  if (p.bank.length > 1000)
    throw Error("收款信息限1000字，请拆分；工作稿仍保留。");
  for (const [i, l] of p.items.entries()) {
    if (l.description.length > 360)
      throw Error(
        "明细" + (i + 1) + "项目说明限360字，请拆分条目；工作稿仍保留。",
      );
    if (!l.description.trim()) throw Error("明细" + (i + 1) + "需要项目名称。");
    decimal(l.quantity, "明细" + (i + 1) + "数量", 3, 1000000, true);
    minor(l.price, p.currency, "明细" + (i + 1) + "单价");
  }
  if (p.discountMode === "percentage") decimal(p.discount, "折扣", 2, 100);
  else minor(p.discount, p.currency, "折扣金额");
  decimal(p.taxRate, "税率", 2, 100);
  minor(p.shipping, p.currency, "运费");
  minor(p.paid, p.currency, "已付金额");
  if (p.kind === "quotation" && Number(p.paid) !== 0)
    throw Error("报价单的已付金额应为0。");
  const subtotal = p.items.reduce(
    (s, l) => s + Number(l.quantity) * minor(l.price, p.currency, "单价"),
    0,
  );
  if (
    p.discountMode === "fixed" &&
    minor(p.discount, p.currency, "折扣金额") > subtotal
  )
    throw Error("折扣金额不能超过小计。");
  if (subtotal > 100000000000) throw Error("单据金额超过当前范围。");
  return p;
}
export function importInvoice(raw: unknown): {
  title: string;
  data: InvoiceData;
  extra: Record<string, unknown>;
} {
  if (!isRecord(raw)) throw Error("工程文件需要JSON对象。");
  const source = isRecord(raw.snapshot) ? raw.snapshot : raw;
  if (!isRecord(raw.snapshot) && raw.format !== "invoice-builder-workbench")
    throw Error(
      "请选择本工作台的单据工程或恢复稿。上游原生JSON仅用于导出交互。",
    );
  const title = boundedText(source.title, 120),
    data = restoreInvoice(source.data),
    extra = source.extra ?? {};
  if (!isRecord(extra) || bytes({ title, data, extra }) > 1950000)
    throw Error("恢复内容结构无效或超过1.95MB。");
  return { title, data, extra };
}
export const seed: InvoiceData = {
  kind: "quotation",
  number: "QT-2026-018",
  issued: "2026-10-28",
  due: "2026-11-11",
  currency: "CNY",
  issuer: {
    name: "山海设计工作室",
    address: "杭州 · 良渚文化村",
    email: "studio@example.com",
    phone: "",
    registration: "",
  },
  customer: {
    name: "青禾书店",
    address: "上海 · 梧桐街新店",
    email: "books@example.com",
    phone: "",
    registration: "",
  },
  items: [
    {
      id: "identity",
      description: "门店视觉识别设计\n标志、色彩与字体规范",
      unit: "项",
      quantity: "1",
      price: "4800.00",
    },
    {
      id: "prints",
      description: "开业物料设计\n海报、折页与阅读卡",
      unit: "套",
      quantity: "2",
      price: "1200.00",
    },
  ],
  discountMode: "percentage",
  discount: "5",
  taxMode: "exclusive",
  taxRate: "6",
  shipping: "0",
  paid: "0",
  bank: "山海设计工作室\n示例银行 · 账户尾号 2026",
  notes: "报价包含两轮设计修改与源文件交付。",
  terms: "报价有效期至2026年11月11日。项目开始前确认交付范围与排期。",
  layout: "classic",
  pageSize: "A4",
  fontSize: "medium",
  headerStyle: "dark",
  accent: "#244a58",
  logo: null,
  signature: null,
};
