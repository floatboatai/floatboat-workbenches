// ABOUTME: 识别并解析导入内容：界面工作流 JSON、API 提示词 JSON、嵌有 workflow/prompt 的 PNG。

import { isRecord } from "./project.ts";
import type { NodeDefs } from "./comfy.ts";
import { fromApiPrompt, looksLikePrompt, toApiPrompt } from "./convert.ts";
import { isPng, readComfyPng } from "./png.ts";
import { checkWorkflow, MAX_WORKFLOW_BYTES, type UiWorkflow } from "./workflow.ts";

export type ImportKind = "ui" | "api" | "png-ui" | "png-api";
export interface ImportResult {
  workflow: UiWorkflow;
  title: string;
  kind: ImportKind;
  notes: string[];
}

export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;

const titleFromName = (name: string) =>
  name.replace(/\.(json|png|webp|flac)$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 100) || "导入的工作流";

function fromValue(value: unknown, defs: NodeDefs, name: string, viaPng: boolean): ImportResult {
  if (isRecord(value) && Array.isArray(value.nodes)) {
    const workflow = checkWorkflow(value);
    const notes: string[] = [];
    const unknown = [...new Set(workflow.nodes.map((n) => n.type).filter((t) => !defs[t] && !["Reroute", "PrimitiveNode", "Note", "MarkdownNote"].includes(t)))];
    if (unknown.length) notes.push(`包含当前节点定义里没有的类型：${unknown.slice(0, 6).join("、")}${unknown.length > 6 ? " 等" : ""}。它们以“缺失节点”保留，数据不会丢失。`);
    return { workflow, title: titleFromName(name), kind: viaPng ? "png-ui" : "ui", notes };
  }
  const prompt = looksLikePrompt(value);
  if (prompt) {
    const workflow = fromApiPrompt(prompt, defs);
    const unknown = [...new Set(Object.values(prompt).map((n) => n.class_type).filter((t) => !defs[t]))];
    const notes = ["API 格式不含节点位置，已自动排布；种子控制设为“固定”。"];
    if (unknown.length) notes.push(`未知节点类型：${unknown.slice(0, 6).join("、")}。`);
    return { workflow, title: titleFromName(name), kind: viaPng ? "png-api" : "api", notes };
  }
  throw new Error("无法识别：既不是 ComfyUI 界面工作流（含 nodes），也不是 API 提示词（含 class_type）。");
}

export async function parseImport(input: { name: string; bytes: Uint8Array }, defs: NodeDefs): Promise<ImportResult> {
  if (input.bytes.length > MAX_IMPORT_BYTES) throw new Error("文件超过 64 MB。");
  if (isPng(input.bytes)) {
    const meta = await readComfyPng(input.bytes);
    if (meta.workflow !== undefined) return fromValue(meta.workflow, defs, input.name, true);
    if (meta.prompt !== undefined) return fromValue(meta.prompt, defs, input.name, true);
    throw new Error("这张 PNG 没有嵌入 ComfyUI 的 workflow 或 prompt 元数据（可能被压缩或重新保存过）。");
  }
  const text = new TextDecoder("utf-8").decode(input.bytes).replace(/^﻿/, "").trim();
  if (!text) throw new Error("文件是空的。");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("不是有效的 JSON，也不是 PNG。");
  }
  return fromValue(value, defs, input.name, false);
}

export function parseImportText(text: string, defs: NodeDefs, name = "粘贴的工作流"): Promise<ImportResult> {
  return parseImport({ name, bytes: new TextEncoder().encode(text) }, defs);
}

export function exportUiJson(workflow: UiWorkflow): string {
  return JSON.stringify(workflow, null, 2);
}

export function exportApiJson(workflow: UiWorkflow, defs: NodeDefs): { text: string; notes: string[] } {
  const { prompt, notes } = toApiPrompt(workflow, defs);
  return { text: JSON.stringify(prompt, null, 2), notes };
}

export const workflowTooLarge = (workflow: UiWorkflow) => JSON.stringify(workflow).length > MAX_WORKFLOW_BYTES;
