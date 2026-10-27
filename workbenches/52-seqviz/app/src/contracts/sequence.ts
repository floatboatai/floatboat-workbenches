import { boundedText, isRecord } from "./project.ts";
export type Topology = "circular" | "linear";
export interface Range {
  start: number;
  end: number;
  strand: 1 | -1;
}
export interface Feature extends Range {
  id: string;
  name: string;
  color: string;
}
export interface Review extends Range {
  id: string;
  note: string;
  done: boolean;
  createdAt: string;
}
export interface SequenceDocument {
  sequence: string;
  topology: Topology;
  features: Feature[];
  reviews: Review[];
}
export const seed: SequenceDocument = {
  sequence: "",
  topology: "circular",
  features: [],
  reviews: [],
};
export function normalizeSequence(text: string) {
  const sequence = text.replace(/\s/g, "").toUpperCase();
  if (sequence.length < 1 || sequence.length > 10000)
    throw new Error("DNA 序列需要 1–10,000 个碱基。");
  if (!/^[ACGTRYSWKMBDHVN]+$/.test(sequence))
    throw new Error(
      "仅接受 IUPAC DNA 字母 ACGTRYSWKMBDHVN，不包含数字或其他符号。",
    );
  return sequence;
}
export function parseSequence(text: string) {
  if (text.length > 100000) throw new Error("输入文件不能超过 100 KB。");
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  let name = "";
  if (lines[0]?.startsWith(">")) {
    name = lines.shift()!.slice(1).trim();
    if (!name || name.length > 120)
      throw new Error("FASTA 标题需要 1–120 个字符。");
  }
  if (lines.some((line) => line.trim().startsWith(">")))
    throw new Error("仅支持单条 FASTA，请拆分多序列文件。");
  return { name, sequence: normalizeSequence(lines.join("")) };
}
export function validateRange(
  value: unknown,
  length: number,
  topology: Topology,
): Range {
  if (
    !isRecord(value) ||
    typeof value.start !== "number" ||
    typeof value.end !== "number" ||
    !Number.isInteger(value.start) ||
    !Number.isInteger(value.end) ||
    value.start < 1 ||
    value.end < 1 ||
    value.start > length ||
    value.end > length ||
    (value.strand !== 1 && value.strand !== -1)
  )
    throw new Error(`起止坐标须为 1–${length} 的整数，方向须为正向或反向。`);
  if (topology === "linear" && value.start > value.end)
    throw new Error("线性序列的起点不能晚于终点。");
  return { start: value.start, end: value.end, strand: value.strand };
}
export function rangeLength(range: Range, length: number) {
  return range.end >= range.start
    ? range.end - range.start + 1
    : length - range.start + 1 + range.end;
}
const complements: Record<string, string> = {
  A: "T",
  C: "G",
  G: "C",
  T: "A",
  R: "Y",
  Y: "R",
  S: "S",
  W: "W",
  K: "M",
  M: "K",
  B: "V",
  D: "H",
  H: "D",
  V: "B",
  N: "N",
};
export function reverseComplement(sequence: string) {
  return [...sequence]
    .reverse()
    .map((base) => complements[base])
    .join("");
}
export function extractSequence(
  sequence: string,
  range: Range,
  topology: Topology,
) {
  validateRange(range, sequence.length, topology);
  const forward =
    range.start <= range.end
      ? sequence.slice(range.start - 1, range.end)
      : sequence.slice(range.start - 1) + sequence.slice(0, range.end);
  return range.strand === -1 ? reverseComplement(forward) : forward;
}
export function toViewerBounds(range: Range, length: number) {
  if (rangeLength(range, length) === length) return { start: 0, end: length };
  return { start: range.start - 1, end: range.end };
}
export function toViewerRange(range: Range, length: number) {
  const bounds = toViewerBounds(range, length);
  return range.strand === 1
    ? { ...bounds, clockwise: true }
    : { start: bounds.end, end: bounds.start, clockwise: false };
}
export function fromViewerSelection(
  value: unknown,
  length: number,
  topology: Topology,
): Range | null {
  if (
    !isRecord(value) ||
    typeof value.start !== "number" ||
    typeof value.end !== "number" ||
    value.length === 0
  )
    return null;
  let start = value.start,
    end = value.end;
  if (value.clockwise === false) [start, end] = [end, start];
  if (start === end && value.length !== length) return null;
  const range = {
    start: start + 1,
    end: end === 0 ? length : end,
    strand: value.direction === -1 || value.clockwise === false ? -1 : 1,
  };
  try {
    return validateRange(range, length, topology);
  } catch {
    return null;
  }
}
function idValue(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(value))
    throw new Error("记录标识无效。");
  return value;
}
export function validateDocument(value: unknown): SequenceDocument {
  if (
    !isRecord(value) ||
    typeof value.sequence !== "string" ||
    !["linear", "circular"].includes(String(value.topology)) ||
    !Array.isArray(value.features) ||
    value.features.length > 100 ||
    !Array.isArray(value.reviews) ||
    value.reviews.length > 100
  )
    throw new Error("序列项目格式无效，最多 100 个特征和 100 条意见。");
  const sequence = normalizeSequence(value.sequence),
    topology = value.topology as Topology;
  const features = value.features.map((item): Feature => {
    if (
      !isRecord(item) ||
      typeof item.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(item.color)
    )
      throw new Error("特征颜色无效。");
    const name = boundedText(item.name, 100).trim();
    if (!name) throw new Error("特征名称不能为空。");
    return {
      ...validateRange(item, sequence.length, topology),
      id: idValue(item.id),
      name,
      color: item.color,
    };
  });
  const reviews = value.reviews.map((item): Review => {
    if (
      !isRecord(item) ||
      typeof item.done !== "boolean" ||
      typeof item.createdAt !== "string" ||
      !Number.isFinite(Date.parse(item.createdAt))
    )
      throw new Error("审阅记录格式无效。");
    const note = boundedText(item.note, 2000).trim();
    if (!note) throw new Error("审阅意见不能为空。");
    return {
      ...validateRange(item, sequence.length, topology),
      id: idValue(item.id),
      note,
      done: item.done,
      createdAt: item.createdAt,
    };
  });
  if (
    new Set(features.map((item) => item.id)).size !== features.length ||
    new Set(reviews.map((item) => item.id)).size !== reviews.length
  )
    throw new Error("记录标识不能重复。");
  return { sequence, topology, features, reviews };
}
export function fasta(name: string, sequence: string) {
  return (
    ">" +
    name.replace(/[\r\n>]/g, " ").trim() +
    "\n" +
    (sequence.match(/.{1,70}/g) || []).join("\n") +
    "\n"
  );
}
export function importProject(value: unknown) {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.coordinates !== "1-based-inclusive" ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.trim().length > 120
  )
    throw new Error("项目 JSON 需要版本 1、1-based-inclusive 坐标和项目名称。");
  return { title: value.title.trim(), data: validateDocument(value.data) };
}
