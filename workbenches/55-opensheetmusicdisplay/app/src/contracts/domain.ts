import { boundedText, isRecord } from "./project.ts";
import { inspectScore, MAX_XML_BYTES } from "./musicxml.ts";
export interface SourceFile {
  fileName: string;
  kind: "xml" | "mxl";
  originalBase64: string;
  xml: string;
}
export interface Annotation {
  id: string;
  partId: string;
  measureIndex: number;
  text: string;
  resolved: boolean;
}
export interface ScoreProject {
  source: SourceFile;
  partId: string;
  layout: "page" | "continuous";
  zoom: number;
  annotations: Annotation[];
  focus: { partId: string; measureIndex: number };
}
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
export function originalBytes(source: SourceFile): Uint8Array {
  if (
    source.originalBase64.length > 270_000 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      source.originalBase64,
    )
  )
    throw new Error("原文件编码无效或过大。");
  const text = atob(source.originalBase64);
  if (text.length > 200_000 || !text.length)
    throw new Error("原文件需要 1–200 KB。");
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}
export function validateScore(value: unknown): ScoreProject {
  return parseScore(value, false);
}
export function restoreScoreDraft(value: unknown): ScoreProject {
  return parseScore(value, true);
}
function parseScore(value: unknown, draft: boolean): ScoreProject {
  if (!isRecord(value) || !isRecord(value.source))
    throw new Error("项目需要乐谱原文件。");
  const input = value.source;
  if (input.kind !== "xml" && input.kind !== "mxl")
    throw new Error("不支持的原文件类型。");
  const source: SourceFile = {
    fileName: boundedText(input.fileName, 160),
    kind: input.kind,
    originalBase64: boundedText(input.originalBase64, 270000),
    xml: boundedText(input.xml, MAX_XML_BYTES),
  };
  if (!source.fileName.trim() || /[\\/\u0000-\u001f]/.test(source.fileName))
    throw new Error("原文件名无效。");
  const bytes = originalBytes(source);
  if (
    source.kind === "xml" &&
    new TextDecoder("utf-8", { fatal: true }).decode(bytes) !== source.xml
  )
    throw new Error("MusicXML 原文件与审阅内容不一致。");
  const info = inspectScore(source.xml);
  if (
    typeof value.partId !== "string" ||
    (value.partId !== "" && !info.parts.some((p) => p.id === value.partId))
  )
    throw new Error("显示声部不存在。");
  if (value.layout !== "page" && value.layout !== "continuous")
    throw new Error("版式无效。");
  if (
    typeof value.zoom !== "number" ||
    ![0.7, 0.85, 1, 1.15, 1.3].includes(value.zoom)
  )
    throw new Error("缩放级别无效。");
  if (!Array.isArray(value.annotations) || value.annotations.length > 100)
    throw new Error("最多保留 100 条批注。");
  const focus =
    value.focus === undefined
      ? { partId: info.parts[0].id, measureIndex: 0 }
      : value.focus;
  if (
    !isRecord(focus) ||
    typeof focus.partId !== "string" ||
    typeof focus.measureIndex !== "number" ||
    !Number.isInteger(focus.measureIndex) ||
    focus.measureIndex < 0 ||
    !info.parts.some(
      (part) =>
        part.id === focus.partId &&
        Number(focus.measureIndex) < part.measures.length,
    )
  )
    throw new Error("当前审阅小节无效。");
  const ids = new Set<string>();
  const annotations = value.annotations.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !/^[-\w]{1,80}$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.partId !== "string" ||
      typeof item.measureIndex !== "number" ||
      !Number.isInteger(item.measureIndex) ||
      typeof item.resolved !== "boolean"
    )
      throw new Error("批注结构无效。");
    ids.add(item.id);
    const part = info.parts.find((part) => part.id === item.partId);
    if (
      !part ||
      item.measureIndex < 0 ||
      item.measureIndex >= part.measures.length
    )
      throw new Error("批注的小节或声部不存在。");
    const text = boundedText(item.text, 1000);
    if (!draft && !text.trim()) throw new Error("批注不能为空。");
    return {
      id: item.id,
      partId: item.partId,
      measureIndex: item.measureIndex,
      text,
      resolved: item.resolved,
    };
  });
  return {
    source,
    partId: value.partId,
    layout: value.layout,
    zoom: value.zoom,
    annotations,
    focus: { partId: focus.partId, measureIndex: focus.measureIndex },
  };
}
