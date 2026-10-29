// ABOUTME: MusicXML 文本解码、安全检查与声部/小节索引；浏览器与 Node 共用。
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { isRecord } from "./project.ts";

/** 解压或解码后的 MusicXML 文本上限（UTF-16 文件按字节计）。 */
export const MAX_XML_BYTES = 64 * 1024 * 1024;
export const MAX_PARTS = 64;
export const MAX_MEASURES = 5000;
export const MAX_NOTES = 400_000;

export interface PartInfo {
  id: string;
  name: string;
  abbreviation: string;
  staves: number;
  measures: number;
}
export interface MeasureInfo {
  /** 乐谱中印的小节号（弱起、重复编号时与序号不同）。 */
  n: string;
  /** 拍号，例如 "3/4"；未声明时为空。 */
  t: string;
}
export interface ScoreIndex {
  title: string;
  subtitle: string;
  composer: string;
  lyricist: string;
  arranger: string;
  rights: string;
  parts: PartInfo[];
  measures: MeasureInfo[];
  notes: number;
  /** 导入时被忽略的内容（外部图片、链接等），不影响渲染。 */
  warnings: string[];
}

const ENCODINGS = new Set(["utf-8", "utf8", "utf-16", "utf-16le", "utf-16be", "iso-8859-1", "latin1", "windows-1252", "us-ascii", "ascii"]);

/** 按 BOM 与 XML 声明解码；无法识别或包含非法字节时报错，不做静默替换。 */
export function decodeXml(bytes: Uint8Array): string {
  if (!bytes.length) throw new Error("文件为空。");
  if (bytes.length > MAX_XML_BYTES) throw new Error(`MusicXML 超过 ${MAX_XML_BYTES / 1048576} MB。`);
  let label = "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) label = "utf-16le";
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) label = "utf-16be";
  else if (bytes[0] === 0x3c && bytes[1] === 0x00) label = "utf-16le";
  else if (bytes[0] === 0x00 && bytes[1] === 0x3c) label = "utf-16be";
  else {
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
    const declared = /^\s*(?:﻿|ï»¿)?<\?xml[^>]*encoding\s*=\s*["']([\w.-]+)["']/i.exec(head)?.[1]?.toLowerCase();
    if (declared && !declared.startsWith("utf-16")) {
      if (!ENCODINGS.has(declared)) throw new Error(`不支持的文本编码 ${declared}，请导出 UTF-8 MusicXML。`);
      label = declared;
    }
  }
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    throw new Error("文件编码无效：请确认是完整的 MusicXML（UTF-8 或 UTF-16）。");
  }
}

/**
 * 检查后解析 XML。标准的 MusicXML DOCTYPE（只引用公开 DTD、无内部子集）被接受且从不下载；
 * 内部子集、ENTITY 声明与自定义实体被拒绝。外部图片与链接仅记为警告，渲染器不会加载它们。
 */
export function safeXml(xml: string): { tree: Record<string, unknown>; warnings: string[] } {
  if (xml.length > MAX_XML_BYTES)
    throw new Error(`MusicXML 超过 ${MAX_XML_BYTES / 1048576} MB。`);
  const doctype = /<!DOCTYPE[^>[]*(\[)?/i.exec(xml);
  if (doctype?.[1] || /<!ENTITY/i.test(xml))
    throw new Error("文件含 DTD 内部子集或实体声明，出于安全原因不予加载；请从制谱软件重新导出 MusicXML。");
  if (/<\?xml-stylesheet/i.test(xml)) throw new Error("文件引用了外部样式表，不予加载。");
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)[\w#]+;/i.test(xml))
    throw new Error("XML 含未定义的实体引用。");
  const validity = XMLValidator.validate(xml);
  if (validity !== true)
    throw new Error(`XML 语法无效（第 ${validity.err.line} 行：${validity.err.msg}），请检查文件是否完整。`);
  const parsed: unknown = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    htmlEntities: false,
    trimValues: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
  }).parse(xml);
  if (!isRecord(parsed)) throw new Error("XML 内容无效。");
  const warnings: string[] = [];
  const images = (xml.match(/<(?:credit-)?image\b/g) ?? []).length;
  const links = (xml.match(/<link\b/g) ?? []).length;
  if (images) warnings.push(`已忽略 ${images} 处外部图片引用`);
  if (links) warnings.push(`已忽略 ${links} 处外部链接`);
  return { tree: parsed, warnings };
}

const list = (v: unknown): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown, fallback = ""): string => {
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim().slice(0, 200) || fallback;
  if (Array.isArray(v)) return text(v[0], fallback);
  if (isRecord(v) && typeof v["#text"] === "string") return text(v["#text"], fallback);
  return fallback;
};

/** 读取 score-partwise 的声部、小节号、拍号与著录信息。 */
export function inspectScore(xml: string): ScoreIndex {
  const { tree, warnings } = safeXml(xml);
  if (isRecord(tree["score-timewise"]))
    throw new Error("这是按时间组织（score-timewise）的 MusicXML；请在制谱软件中导出 score-partwise。");
  const score = tree["score-partwise"];
  if (!isRecord(score)) throw new Error("不是 MusicXML 乐谱：缺少 score-partwise 根元素。");
  const partList = score["part-list"];
  if (!isRecord(partList)) throw new Error("乐谱缺少声部列表（part-list）。");
  const declarations = list(partList["score-part"]);
  const bodies = list(score.part);
  if (!declarations.length) throw new Error("乐谱没有声部。");
  if (declarations.length > MAX_PARTS) throw new Error(`最多支持 ${MAX_PARTS} 个声部。`);
  const byId = new Map<string, Record<string, unknown>>();
  for (const body of bodies)
    if (isRecord(body) && typeof body["@_id"] === "string") byId.set(body["@_id"], body);
  const seen = new Set<string>();
  let notes = 0;
  let longest: unknown[] = [];
  const parts: PartInfo[] = declarations.map((declaration) => {
    if (!isRecord(declaration)) throw new Error("声部声明无效。");
    const id = declaration["@_id"];
    if (typeof id !== "string" || !/^[-\w.:]{1,80}$/.test(id) || seen.has(id))
      throw new Error("声部标识无效或重复。");
    seen.add(id);
    const body = byId.get(id);
    if (!body) throw new Error(`声部 ${id} 已声明但没有内容。`);
    const measures = list(body.measure);
    if (!measures.length) throw new Error(`声部 ${id} 没有小节。`);
    if (measures.length > MAX_MEASURES) throw new Error(`每个声部最多 ${MAX_MEASURES} 小节。`);
    if (measures.length > longest.length) longest = measures;
    let staves = 1;
    for (const measure of measures) {
      if (!isRecord(measure)) throw new Error("小节内容无效。");
      notes += list(measure.note).length;
      for (const attributes of list(measure.attributes))
        if (isRecord(attributes) && attributes.staves !== undefined) {
          const count = Number.parseInt(text(attributes.staves), 10);
          if (Number.isInteger(count) && count > staves && count <= 8) staves = count;
        }
    }
    if (notes > MAX_NOTES) throw new Error(`乐谱超过 ${MAX_NOTES.toLocaleString("en-US")} 个音符/休止符。`);
    return {
      id,
      name: text(declaration["part-name"], id),
      abbreviation: text(declaration["part-abbreviation"]),
      staves,
      measures: measures.length,
    };
  });
  if (!notes) throw new Error("乐谱没有音符或休止符。");
  let time = "";
  const measures: MeasureInfo[] = longest.map((measure, index) => {
    const record = isRecord(measure) ? measure : {};
    for (const attributes of list(record.attributes)) {
      if (!isRecord(attributes)) continue;
      const signature = list(attributes.time)[0];
      if (isRecord(signature)) {
        const beats = text(signature.beats),
          type = text(signature["beat-type"]);
        if (/^\d+(?:\+\d+)*$/.test(beats) && /^\d+$/.test(type)) time = `${beats}/${type}`;
      }
    }
    return { n: text(record["@_number"], String(index + 1)).slice(0, 16), t: time };
  });
  const work = isRecord(score.work) ? score.work : {};
  const identification = isRecord(score.identification) ? score.identification : {};
  const creator = (type: string) =>
    text(list(identification.creator).find((item) => isRecord(item) && item["@_type"] === type));
  const credit = (type: string) => {
    for (const item of list(score.credit))
      if (isRecord(item) && list(item["credit-type"]).some((value) => text(value) === type))
        return text(list(item["credit-words"])[0]);
    return "";
  };
  return {
    title: text(work["work-title"]) || text(score["movement-title"]) || credit("title") || "未命名乐谱",
    subtitle: text(work["work-title"]) ? text(score["movement-title"]) || credit("subtitle") : credit("subtitle"),
    composer: creator("composer") || credit("composer"),
    lyricist: creator("lyricist") || creator("poet") || credit("lyricist"),
    arranger: creator("arranger"),
    rights: text(list(identification.rights)[0]) || credit("rights"),
    parts,
    measures,
    notes,
    warnings,
  };
}

/** 拍位（小节内的全音符分数）转为第几拍，例如 3/4 拍中 1/4 → 2。 */
export function beatLabel(beat: readonly [number, number] | null, time: string): string {
  if (!beat) return "";
  const type = Number(time.split("/")[1]) || 4;
  const value = 1 + (beat[0] / beat[1]) * type;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
