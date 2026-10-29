// ABOUTME: 本地文件进出：读取 CSV/JSON/文本为输入节点、导入导出流水线 JSON、下载节点结果。
import { restoreFlowDraft, validateFlow, type FlowDocument } from "../contracts/flow";
import type { OpKind } from "../contracts/ops";
import { LIMITS, tableToJson, toCsv, valueToText, type Value } from "../contracts/values";
import { download } from "./requests";

const MAX_PIPELINE_FILE = 4 * 1024 * 1024;

export function safeFileName(name: string, fallback = "结果") {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned && !/^\.+$/.test(cleaned) ? cleaned : fallback;
}

/** 读取用户选的数据文件，判断应生成哪种输入节点。 */
export async function readDataFile(file: File): Promise<{ op: OpKind; config: Record<string, unknown>; label: string }> {
  const text = (await file.text()).replace(/^﻿/, "");
  if (text.length > LIMITS.inline)
    throw new Error(
      `「${file.name}」有 ${text.length.toLocaleString("zh-CN")} 个字符，单个输入节点最多 ${LIMITS.inline.toLocaleString("zh-CN")} 个字符（随流水线保存）。请先截取需要的部分。`,
    );
  const label = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || file.name.slice(0, 80);
  const fileName = file.name.slice(0, 200);
  if (/\.(csv|tsv)$/i.test(file.name) || file.type === "text/csv")
    return { op: "csvInput", config: { csv: text, fileName, delimiter: /\.tsv$/i.test(file.name) ? "\t" : "auto" }, label };
  if (/\.json$/i.test(file.name) || file.type === "application/json") {
    try {
      JSON.parse(text);
    } catch {
      throw new Error(`「${file.name}」不是有效的 JSON。`);
    }
    return { op: "jsonInput", config: { json: text, fileName }, label };
  }
  return { op: "textInput", config: { text, fileName }, label };
}

/** 导入流水线 JSON（含旧版单链格式）；无法通过正式校验时按草稿恢复。 */
export async function readPipelineFile(file: File): Promise<{ doc: FlowDocument; title: string; draft: boolean }> {
  if (file.size > MAX_PIPELINE_FILE) throw new Error("流水线文件超过 4 MB。");
  let raw: unknown;
  try {
    raw = JSON.parse((await file.text()).replace(/^﻿/, ""));
  } catch {
    throw new Error("文件不是有效的 JSON。");
  }
  // 兼容：完整导出 { title, pipeline }、恢复稿 { snapshot: { title, data } } 与裸文档。
  const record = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const snapshot = record.snapshot !== null && typeof record.snapshot === "object" ? (record.snapshot as Record<string, unknown>) : null;
  const body = record.pipeline ?? snapshot?.data ?? raw;
  const named = typeof record.title === "string" ? record.title : typeof snapshot?.title === "string" ? snapshot.title : "";
  const title = (named.trim() || file.name.replace(/\.(pipeline\.)?json$/i, "")).slice(0, 120) || "导入的流水线";
  try {
    return { doc: validateFlow(body), title, draft: false };
  } catch (error) {
    try {
      return { doc: restoreFlowDraft(body), title, draft: true };
    } catch {
      throw error;
    }
  }
}

export function exportPipeline(doc: FlowDocument, title: string) {
  const body = JSON.stringify({ format: "floatboat-pipeline", version: 2, title, pipeline: doc }, null, 2);
  download(new Blob([body], { type: "application/json" }), `${safeFileName(title, "流水线")}.pipeline.json`);
}

export function downloadValue(value: Value, format: "csv" | "json" | "txt", name: string) {
  const base = safeFileName(name);
  if (format === "csv") {
    if (value.type !== "table") throw new Error("CSV 需要表格结果。");
    // 带 BOM，便于 Excel 正确识别 UTF-8 中文。
    download(new Blob(["﻿" + toCsv(value)], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
  } else if (format === "json") {
    const json = value.type === "json" ? value.value : value.type === "table" ? tableToJson(value) : value.text;
    download(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }), `${base}.json`);
  } else download(new Blob([valueToText(value)], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
