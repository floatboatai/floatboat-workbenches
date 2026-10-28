import { boundedText, isRecord } from "./project.ts";
export const kinds = [
  "heading",
  "text",
  "button",
  "divider",
  "columns",
] as const;
export type Kind = (typeof kinds)[number];
export interface Block {
  id: string;
  kind: Kind;
  text: string;
  secondary: string;
  href: string;
}
export interface Recipient {
  id: string;
  label: string;
  values: Record<string, string>;
}
export interface EmailDoc {
  subject: string;
  preheader: string;
  brand: string;
  accent: string;
  width: string;
  blocks: Block[];
  variables: Record<string, string>;
  recipients: Recipient[];
  selectedRecipient: string;
  notes: string;
}
export const seed: EmailDoc = {
  subject: "{{name}}，把灵感留给周末",
  preheader: "本月小报：慢一点，也能走得更远。",
  brand: "慢岛 LETTERS",
  accent: "#68509b",
  width: "600",
  blocks: [
    {
      id: "a",
      kind: "heading",
      text: "给生活，留一点空白。",
      secondary: "",
      href: "",
    },
    {
      id: "b",
      kind: "text",
      text: "你好，{{name}}：\n\n这是慢岛的十月来信。我们收集了几件值得花时间的小事，想与你分享。",
      secondary: "",
      href: "",
    },
    {
      id: "c",
      kind: "columns",
      text: "01 / 阅读一座城市\n从熟悉的街角出发，试着走一条不同的路。",
      secondary: "02 / 给自己半天\n关掉提醒，写一封很久没写的信。",
      href: "",
    },
    {
      id: "d",
      kind: "button",
      text: "打开本月灵感清单",
      secondary: "",
      href: "https://example.com/letters/october",
    },
    { id: "e", kind: "divider", text: "", secondary: "", href: "" },
    {
      id: "f",
      kind: "text",
      text: "愿你的周末，有新的发现。\n慢岛编辑部",
      secondary: "",
      href: "",
    },
  ],
  variables: { name: "朋友" },
  recipients: [
    { id: "lin", label: "林然 · 示例", values: { name: "林然" } },
    { id: "xu", label: "许诺 · 示例", values: { name: "许诺" } },
  ],
  selectedRecipient: "lin",
  notes: "",
};
export function variablesValue(v: unknown): Record<string, string> {
  if (!isRecord(v) || Object.keys(v).length > 60) throw Error("变量最多60项。");
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(v)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key))
      throw Error("变量名需以字母开头，仅含字母、数字或下划线，最多40字符。");
    out[key] = boundedText(value, 5000);
  }
  return out;
}
export function recipientsValue(raw: unknown): Recipient[] {
  if (!Array.isArray(raw) || raw.length > 30)
    throw Error("示例收件人最多30个。");
  const ids = new Set<string>();
  return raw.map((r) => {
    if (!isRecord(r)) throw Error("示例结构无效。");
    const id = boundedText(r.id, 80);
    if (!id || ids.has(id)) throw Error("示例标识必须唯一。");
    ids.add(id);
    return {
      id,
      label: boundedText(r.label, 120),
      values: variablesValue(r.values),
    };
  });
}
export function restoreEmail(raw: unknown): EmailDoc {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.blocks) ||
    raw.blocks.length > 80 ||
    new TextEncoder().encode(JSON.stringify(raw)).length > 2000000
  )
    throw Error("邮件工作稿无效或超过2MB。");
  const ids = new Set<string>();
  return {
    subject: boundedText(raw.subject, 300),
    preheader: boundedText(raw.preheader, 500),
    brand: boundedText(raw.brand, 120),
    accent: boundedText(raw.accent, 100),
    width: boundedText(raw.width, 100),
    notes: boundedText(raw.notes, 30000),
    selectedRecipient: boundedText(raw.selectedRecipient, 80),
    variables: variablesValue(raw.variables),
    recipients: recipientsValue(raw.recipients),
    blocks: raw.blocks.map((b) => {
      if (!isRecord(b) || !kinds.includes(b.kind as Kind))
        throw Error("邮件组件类型无效。");
      const id = boundedText(b.id, 80);
      if (!id || ids.has(id)) throw Error("组件标识必须唯一。");
      ids.add(id);
      return {
        id,
        kind: b.kind as Kind,
        text: boundedText(b.text, 20000),
        secondary: boundedText(b.secondary, 20000),
        href: boundedText(b.href, 2000),
      };
    }),
  };
}
export function validateEmail(raw: unknown): EmailDoc {
  const d = restoreEmail(raw);
  if (new TextEncoder().encode(JSON.stringify(d)).length > 850000)
    throw Error("邮件超过850KB正式预算，完整草稿仍可保留。");
  if (
    d.selectedRecipient &&
    !d.recipients.some((r) => r.id === d.selectedRecipient)
  )
    throw Error("请选择已有示例收件人或默认变量。");
  if (!d.subject.trim()) throw Error("请完成邮件主题。");
  if (!/^#[0-9a-fA-F]{6}$/.test(d.accent))
    throw Error("主题色需为六位十六进制颜色。");
  if (!/^\d+$/.test(d.width) || Number(d.width) < 320 || Number(d.width) > 720)
    throw Error("邮件宽度需为320–720像素。");
  const selected = d.recipients.find((r) => r.id === d.selectedRecipient);
  const vars = { ...d.variables, ...selected?.values };
  for (const b of d.blocks) {
    if (b.kind === "button") hrefValue(substitute(b.href, vars, new Set()));
  }
  return d;
}
export function importEmail(raw: unknown): {
  title: string;
  data: EmailDoc;
  extra: Record<string, unknown>;
} {
  if (!isRecord(raw)) throw Error("工程格式无效。");
  const v = isRecord(raw.snapshot) ? raw.snapshot : raw;
  if (
    typeof v.title !== "string" ||
    v.title.length > 120 ||
    !isRecord(v.extra ?? {})
  )
    throw Error("工作稿标题或编辑区无效。");
  return {
    title: v.title,
    data: restoreEmail(v.data),
    extra: isRecord(v.extra) ? v.extra : {},
  };
}
export function substitute(
  text: string,
  vars: Record<string, string>,
  missing: Set<string>,
) {
  return text.replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (whole, key: string) => {
      if (Object.hasOwn(vars, key)) return vars[key];
      missing.add(key);
      return whole;
    },
  );
}
export function hrefValue(value: string) {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw Error("按钮链接需要完整的 http 或 https 地址。");
  }
  if (!["http:", "https:"].includes(u.protocol))
    throw Error("按钮链接只支持 http 和 https。");
  return value;
}
