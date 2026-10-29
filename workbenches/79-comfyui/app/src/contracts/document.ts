// ABOUTME: 自动保存的工作副本：一份 ComfyUI 界面工作流；允许未完成的图（缺失输入、未知节点）。

import { isRecord } from "./project.ts";
import { checkWorkflow, MAX_WORKFLOW_BYTES, type UiWorkflow } from "./workflow.ts";

export const DOC_FORMAT = "floatboat-comfyui";

export interface ComfyDoc {
  format: typeof DOC_FORMAT;
  version: 1;
  workflow: UiWorkflow;
}

export function validateDoc(value: unknown): ComfyDoc {
  if (!isRecord(value) || value.format !== DOC_FORMAT) throw new Error("不是 ComfyUI 工作台文稿。");
  const workflow = checkWorkflow(value.workflow);
  if (JSON.stringify(workflow).length > MAX_WORKFLOW_BYTES) throw new Error("工作流超过 880 KB，请拆分后再保存。");
  return { format: DOC_FORMAT, version: 1, workflow };
}

/** Restoring a persisted working copy uses the same structural rules; semantic gaps are for validation. */
export const restoreDoc = validateDoc;

export const docOf = (workflow: UiWorkflow): ComfyDoc => ({ format: DOC_FORMAT, version: 1, workflow });
