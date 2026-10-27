import { isRecord, boundedText } from "./project.ts";
export interface Model {
  source: string;
}
export const seed: Model = {
  source:
    "flowchart LR\n  A[收集需求] --> B{确认范围}\n  B -->|通过| C[实施方案]\n  B -->|补充| A\n  C --> D[交付验收]",
};
export function validate(value: unknown): Model {
  if (!isRecord(value)) throw new Error("项目格式无效。");
  const source = boundedText(value.source, 40000);
  if (!source.trim()) throw new Error("请输入图形源码。");
  if (/(?:img|image)\s*:/i.test(source) || /!\[.*\]\(/.test(source))
    throw new Error("当前图形不支持外部图片，请移除图片节点。");
  return { source };
}
export const instructions =
  '将要求整理为 Mermaid 图形。只返回 JSON {"source":"Mermaid源码"}。优先 flowchart LR 或 sequenceDiagram。使用简短中文节点，不要使用图片、HTML、链接回调或初始化指令。';
