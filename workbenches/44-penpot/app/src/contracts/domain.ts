import { isRecord, boundedText } from "./project.ts";
export type Color = { id: string; name: string; value: string };
export type Font = {
  id: string;
  name: string;
  family: string;
  size: string;
  weight: string;
};
export type Sample = {
  id: string;
  kind: "button" | "card";
  name: string;
  label: string;
  body: string;
  colorId: string;
  foregroundId: string;
  fontId: string;
  width: string;
  height: string;
  radius: string;
};
export type Kit = {
  colors: Color[];
  fonts: Font[];
  samples: Sample[];
  notes: string;
};
const id = (x: unknown) => {
  const v = boundedText(x, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(v)) throw new Error("资产编号无效。");
  return v;
};
export function numberValue(v: string, min: number, max: number) {
  if (
    !v.trim() ||
    !Number.isFinite(Number(v)) ||
    Number(v) < min ||
    Number(v) > max
  )
    throw new Error(`请输入${min}–${max}之间的完整数字。`);
  return Number(v);
}
export function decode(v: unknown, working = false): Kit {
  if (
    !isRecord(v) ||
    !Array.isArray(v.colors) ||
    !Array.isArray(v.fonts) ||
    !Array.isArray(v.samples) ||
    v.colors.length > 100 ||
    v.fonts.length > 50 ||
    v.samples.length > 100
  )
    throw new Error("最多100种颜色、50种字体、100个样本。");
  const colors = v.colors.map((x) => {
    if (!isRecord(x)) throw new Error("颜色资产无效。");
    const r = {
      id: id(x.id),
      name: boundedText(x.name, 80),
      value: boundedText(x.value, 40),
    };
    if (!working && (!r.name.trim() || !/^#[0-9a-f]{6}$/i.test(r.value)))
      throw new Error("颜色名称与六位HEX色值需要完整。");
    return r;
  });
  const fonts = v.fonts.map((x) => {
    if (!isRecord(x)) throw new Error("字体资产无效。");
    const r = {
      id: id(x.id),
      name: boundedText(x.name, 80),
      family: boundedText(x.family, 100),
      size: boundedText(x.size, 20),
      weight: boundedText(x.weight, 20),
    };
    if (!working) {
      if (!r.name.trim() || !r.family.trim())
        throw new Error("请填写字体名称。");
      numberValue(r.size, 8, 120);
      numberValue(r.weight, 100, 900);
    }
    return r;
  });
  const samples = v.samples.map((x) => {
    if (!isRecord(x) || (x.kind !== "button" && x.kind !== "card"))
      throw new Error("样本格式无效。");
    const r: Sample = {
      id: id(x.id),
      kind: x.kind,
      name: boundedText(x.name, 100),
      label: boundedText(x.label, 500),
      body: boundedText(x.body, 3000),
      colorId: id(x.colorId),
      foregroundId: id(x.foregroundId),
      fontId: id(x.fontId),
      width: boundedText(x.width, 20),
      height: boundedText(x.height, 20),
      radius: boundedText(x.radius, 20),
    };
    if (!working) {
      if (
        !r.name.trim() ||
        !colors.some((c) => c.id === r.colorId) ||
        !colors.some((c) => c.id === r.foregroundId) ||
        !fonts.some((f) => f.id === r.fontId)
      )
        throw new Error("样本引用的颜色或字体缺失。");
      numberValue(r.width, 80, 1200);
      numberValue(r.height, 32, 1200);
      numberValue(r.radius, 0, 200);
    }
    return r;
  });
  for (const items of [colors, fonts, samples])
    if (new Set(items.map((x) => x.id)).size !== items.length)
      throw new Error("资产编号重复。");
  return { colors, fonts, samples, notes: boundedText(v.notes, 12000) };
}
export const kitValue = (v: unknown) => decode(v, false),
  restoreKit = (v: unknown) => decode(v, true);
export const seed: Kit = {
  colors: [
    { id: "pine", name: "Brand / Pine", value: "#255c4a" },
    { id: "sand", name: "Surface / Sand", value: "#f3eee4" },
    { id: "white", name: "Text / Inverse", value: "#ffffff" },
    { id: "ink", name: "Text / Primary", value: "#26312d" },
    { id: "terracotta", name: "Accent / Clay", value: "#c88262" },
  ],
  fonts: [
    {
      id: "heading",
      name: "Heading / Display",
      family: "Source Sans Pro",
      size: "30",
      weight: "700",
    },
    {
      id: "body",
      name: "Body / Regular",
      family: "Source Sans Pro",
      size: "16",
      weight: "400",
    },
  ],
  samples: [
    {
      id: "primary",
      kind: "button",
      name: "Button / Primary",
      label: "Explore the collection",
      body: "",
      colorId: "pine",
      foregroundId: "white",
      fontId: "body",
      width: "260",
      height: "56",
      radius: "8",
    },
    {
      id: "card",
      kind: "card",
      name: "Card / Editorial",
      label: "A little room to grow.",
      body: "Objects, ideas and stories for a considered everyday.",
      colorId: "sand",
      foregroundId: "ink",
      fontId: "heading",
      width: "390",
      height: "250",
      radius: "16",
    },
  ],
  notes: "FIELDNOTES / 秋季设计资产，供产品与开发共同复核。",
};
export function css(kit: Kit) {
  kit = kitValue(kit);
  const key = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "-");
  return (
    ":root {\n" +
    kit.colors
      .map((c) => `  --color-${key(c.id)}: ${c.value};`)
      .concat(
        kit.fonts.flatMap((f) => [
          `  --font-${key(f.id)}-family: ${JSON.stringify(f.family)};`,
          `  --font-${key(f.id)}-size: ${f.size}px;`,
          `  --font-${key(f.id)}-weight: ${f.weight};`,
        ]),
      )
      .join("\n") +
    "\n}\n"
  );
}
