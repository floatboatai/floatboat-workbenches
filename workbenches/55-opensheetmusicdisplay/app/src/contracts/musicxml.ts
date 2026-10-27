import { XMLParser, XMLValidator } from "fast-xml-parser";
import { isRecord } from "./project.ts";
export const MAX_XML_BYTES = 180_000;
export interface PartInfo {
  id: string;
  name: string;
  measures: { index: number; number: string; notes: number }[];
}
export interface ScoreInfo {
  title: string;
  composer: string;
  parts: PartInfo[];
  noteCount: number;
  measureCount: number;
}
export function safeXml(xml: string): Record<string, unknown> {
  if (new TextEncoder().encode(xml).length > MAX_XML_BYTES)
    throw new Error("XML 超过 180 KB，请导出较短的乐谱。");
  if (/<!\s*(DOCTYPE|ENTITY)|<\?\s*(?!xml\s)[\w-]+/i.test(xml))
    throw new Error(
      "不接受 DTD、实体声明或处理指令；请导出不含外部声明的 MusicXML。",
    );
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)[\w#]+;/i.test(xml))
    throw new Error("XML 含未允许的实体引用。");
  const cleaned = xml.replace(/<!--[\s\S]*?-->/g, "");
  let depth = 0;
  for (const match of cleaned.matchAll(/<(?:(?:"[^"]*"|'[^']*')|[^'">])*>/g)) {
    const tag = match[0];
    if (tag.startsWith("<?") || tag.startsWith("<!")) continue;
    if (tag.startsWith("</")) depth--;
    else if (!tag.endsWith("/>")) depth++;
    if (depth > 40) throw new Error("XML 层级过深。");
  }
  const validity = XMLValidator.validate(xml);
  if (validity !== true) throw new Error("XML 语法无效，请检查文件是否完整。");
  const parsed: unknown = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    trimValues: true,
  }).parse(xml);
  if (!isRecord(parsed)) throw new Error("XML 内容无效。");
  let count = 0;
  const walk = (node: unknown, level = 0) => {
    if (++count > 30_000 || level > 45)
      throw new Error("XML 结构超出支持范围。");
    if (Array.isArray(node)) {
      for (const item of node) walk(item, level + 1);
    } else if (isRecord(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (
          /(?:^|:)(?:image|credit-image|link|script|iframe|object)$/i.test(
            key,
          ) ||
          (/^@_/.test(key) && /(?:href|src|schemaLocation)$/i.test(key)) ||
          /^@_(?:on[a-z]+|style)$/i.test(key)
        )
          throw new Error("乐谱不能引用图片、链接、脚本或其他外部资源。");
        walk(value, level + 1);
      }
    }
  };
  walk(parsed);
  return parsed;
}
const list = (v: unknown): unknown[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const label = (v: unknown, fallback = "") =>
  typeof v === "string"
    ? v.slice(0, 200)
    : isRecord(v) && typeof v["#text"] === "string"
      ? v["#text"].slice(0, 200)
      : fallback;
export function inspectScore(xml: string): ScoreInfo {
  const tree = safeXml(xml),
    score = tree["score-partwise"];
  if (!isRecord(score))
    throw new Error(
      "仅支持 score-partwise MusicXML；请在制谱软件中导出按声部组织的文件。",
    );
  const partList = score["part-list"];
  if (!isRecord(partList)) throw new Error("乐谱缺少声部列表。");
  const declarations = list(partList["score-part"]);
  const bodies = list(score.part);
  if (
    !declarations.length ||
    declarations.length > 12 ||
    bodies.length !== declarations.length
  )
    throw new Error("乐谱需要 1–12 个完整声部。");
  const seen = new Set<string>();
  let noteCount = 0;
  const parts = declarations.map((declaration) => {
    if (!isRecord(declaration)) throw new Error("声部声明无效。");
    const id = declaration["@_id"];
    if (typeof id !== "string" || !/^[-\w.]{1,80}$/.test(id) || seen.has(id))
      throw new Error("声部标识无效或重复。");
    seen.add(id);
    const matches = bodies.filter(
      (body) => isRecord(body) && body["@_id"] === id,
    );
    if (matches.length !== 1 || !isRecord(matches[0]))
      throw new Error("声部内容与声明不一致。");
    const measures = list(matches[0].measure);
    if (!measures.length || measures.length > 200)
      throw new Error("每个声部需要 1–200 个小节。");
    return {
      id,
      name: label(declaration["part-name"], id),
      measures: measures.map((measure, index) => {
        if (!isRecord(measure)) throw new Error("小节内容无效。");
        const notes = list(measure.note);
        noteCount += notes.length;
        return {
          index,
          number: label(measure["@_number"], String(index + 1)),
          notes: notes.length,
        };
      }),
    };
  });
  if (!noteCount || noteCount > 4000)
    throw new Error("乐谱需要 1–4000 个音符或休止符。");
  const work = isRecord(score.work) ? score.work : {},
    identification = isRecord(score.identification) ? score.identification : {};
  const composer = list(identification.creator).find(
    (item) => isRecord(item) && item["@_type"] === "composer",
  );
  return {
    title: label(
      work["work-title"],
      label(score["movement-title"], "未命名乐谱"),
    ),
    composer: label(composer),
    parts,
    noteCount,
    measureCount: Math.max(...parts.map((part) => part.measures.length)),
  };
}
