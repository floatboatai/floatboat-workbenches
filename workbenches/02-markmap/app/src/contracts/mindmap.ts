import { isRecord, boundedText } from "./project.ts";
export interface MindmapDocument {
  markdown: string;
}
export function validateMindmap(value: unknown): MindmapDocument {
  if (!isRecord(value)) throw new Error("脑图项目格式不正确。");
  const markdown = boundedText(value.markdown, 50000);
  if (markdown.split("\n").length > 500)
    throw new Error("大纲最多 500 行，请拆分为多个项目。");
  return { markdown };
}
export const seed: MindmapDocument = {
  markdown:
    "# 把想法整理成路线\n\n## 明确目标\n- 想解决什么问题\n- 谁会使用结果\n\n## 收集线索\n- 事实与材料\n- 需要验证的假设\n\n## 决定下一步\n- 优先做什么\n- 如何判断完成",
};
