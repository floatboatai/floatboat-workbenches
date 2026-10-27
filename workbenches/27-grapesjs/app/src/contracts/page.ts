import { isRecord } from "./project.ts";
export interface PageNode {
  tagName: string;
  type?: "text" | "textnode" | "link";
  content?: string;
  attributes?: Record<string, string>;
  components?: PageNode[];
  style?: Record<string, string>;
}
export interface PageRule {
  selector: string;
  style: Record<string, string>;
  media?: string;
}
export interface PageData {
  version: 1;
  components: PageNode[];
  rules: PageRule[];
}
export const MAX_BYTES = 700000;
const tags = new Set(
  "div section header footer main nav article aside h1 h2 h3 h4 p span strong b em i u s br a ul ol li hr".split(
    " ",
  ),
);
const properties = new Set(
  "color background-color background-image display flex-direction flex-wrap align-items justify-content gap row-gap column-gap flex flex-grow flex-shrink flex-basis width min-width max-width height min-height max-height padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left font-family font-size font-weight font-style line-height letter-spacing text-align text-decoration text-transform border border-width border-style border-color border-radius border-top border-bottom box-shadow opacity overflow box-sizing white-space white-space-collapse text-wrap-mode border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius".split(
    " ",
  ),
);
for (const property of "text-decoration-line text-decoration-thickness text-decoration-style text-decoration-color border-image-source border-image-slice border-image-width border-image-outset border-image-repeat overflow-x overflow-y".split(
  " ",
))
  properties.add(property);
for (const side of ["top", "right", "bottom", "left"])
  for (const part of ["width", "style", "color"])
    properties.add(`border-${side}-${part}`);
export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export function styleValue(raw: unknown): Record<string, string> {
  if (!isRecord(raw) || Object.keys(raw).length > 50)
    throw new Error("样式格式无效。");
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      !properties.has(key) ||
      typeof value !== "string" ||
      value.length > 300 ||
      /[<>;{}\\/@]|url\s*\(|expression|image-set|attr\s*\(|behavior|javascript/i.test(
        value,
      )
    )
      throw new Error(`不支持的样式：${key}`);
    const functions = value.matchAll(/([a-z-]+)\s*\(/gi);
    for (const match of functions)
      if (
        ![
          "rgb",
          "rgba",
          "hsl",
          "hsla",
          "linear-gradient",
          "radial-gradient",
          "calc",
          "min",
          "max",
          "clamp",
        ].includes(match[1].toLowerCase())
      )
        throw new Error("样式包含不支持的函数。");
    result[key] = value;
  }
  return result;
}
export function validatePage(raw: unknown): PageData {
  if (
    !isRecord(raw) ||
    raw.version !== 1 ||
    !Array.isArray(raw.components) ||
    !Array.isArray(raw.rules)
  )
    throw new Error("请选择本工作台导出的页面 JSON。");
  if (new TextEncoder().encode(JSON.stringify(raw)).length > MAX_BYTES)
    throw new Error("页面不能超过 700 KB。");
  let count = 0;
  function node(value: unknown, depth: number): PageNode {
    if (!isRecord(value) || depth > 24 || ++count > 1000)
      throw new Error("页面最多 1000 个元素、24 层嵌套。");
    if (
      Object.keys(value).some(
        (key) =>
          ![
            "tagName",
            "type",
            "content",
            "attributes",
            "components",
            "style",
          ].includes(key),
      )
    )
      throw new Error("页面包含不支持的组件属性。");
    if (typeof value.tagName !== "string" || !tags.has(value.tagName))
      throw new Error("页面包含不支持的 HTML 元素。");
    const out: PageNode = { tagName: value.tagName };
    if (value.type !== undefined) {
      if (
        typeof value.type !== "string" ||
        !["text", "textnode", "link"].includes(value.type)
      )
        throw new Error("组件类型无效。");
      out.type = value.type as PageNode["type"];
    }
    if (value.content !== undefined) {
      if (
        typeof value.content !== "string" ||
        value.content.length > 20000 ||
        /[<>]/.test(value.content)
      )
        throw new Error("文字不能包含原始 HTML；请使用组件层级。");
      out.content = value.content;
    }
    if (value.attributes !== undefined) {
      if (!isRecord(value.attributes)) throw new Error("元素属性无效。");
      out.attributes = {};
      for (const [key, val] of Object.entries(value.attributes)) {
        if (
          !["id", "class", "title", "href", "aria-label", "role"].includes(
            key,
          ) ||
          typeof val !== "string" ||
          val.length > 300
        )
          throw new Error("元素属性不受支持。");
        if (["id", "class"].includes(key) && !/^[a-zA-Z0-9_ -]*$/.test(val))
          throw new Error("元素名称格式无效。");
        if (key === "href" && !/^#[a-zA-Z0-9_-]*$/.test(val))
          throw new Error("链接仅支持页面内锚点。");
        out.attributes[key] = val;
      }
    }
    if (value.components !== undefined) {
      if (!Array.isArray(value.components)) throw new Error("组件层级无效。");
      out.components = value.components.map((child) => node(child, depth + 1));
    }
    if (value.style !== undefined) out.style = styleValue(value.style);
    return out;
  }
  if (raw.rules.length > 1200) throw new Error("页面样式数量过多。");
  const rules = raw.rules.map((rule): PageRule => {
    if (
      !isRecord(rule) ||
      typeof rule.selector !== "string" ||
      rule.selector.length > 300 ||
      !rule.selector ||
      !/^[a-zA-Z0-9_.#*, >+:-]+$/.test(rule.selector)
    )
      throw new Error("样式选择器无效。");
    const out: PageRule = {
      selector: rule.selector,
      style: styleValue(rule.style),
    };
    if (rule.media) {
      if (
        typeof rule.media !== "string" ||
        !/^\((max|min)-width: \d{1,4}px\)$/.test(rule.media)
      )
        throw new Error("仅支持按宽度响应的样式。");
      out.media = rule.media;
    }
    return out;
  });
  return {
    version: 1,
    components: raw.components.map((value) => node(value, 0)),
    rules,
  };
}
export function renderCss(data: PageData): string {
  const declarations = (style: Record<string, string>) =>
    Object.entries(style)
      .map(([key, value]) => `${key}:${value}`)
      .join(";");
  return data.rules
    .map((rule) => {
      const css = `${rule.selector}{${declarations(rule.style)}}`;
      return rule.media ? `@media ${rule.media}{${css}}` : css;
    })
    .join("\n");
}
export function renderHtml(data: PageData): string {
  const node = (n: PageNode): string => {
    if (n.type === "textnode") return n.content ?? "";
    const attrs = Object.entries(n.attributes ?? {})
      .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
      .join("");
    const style =
      n.style && Object.keys(n.style).length
        ? ` style="${escapeHtml(
            Object.entries(n.style)
              .map(([k, v]) => `${k}:${v}`)
              .join(";"),
          )}"`
        : "";
    return `<${n.tagName}${attrs}${style}>${n.content ?? ""}${(n.components ?? []).map(node).join("")}${["br", "hr"].includes(n.tagName) ? "" : `</${n.tagName}>`}`;
  };
  return data.components.map(node).join("\n");
}
export function exportHtml(raw: PageData, title: string): string {
  const data = validatePage(raw);
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}\n${renderCss(data)}</style></head><body>${renderHtml(data)}</body></html>`;
}
