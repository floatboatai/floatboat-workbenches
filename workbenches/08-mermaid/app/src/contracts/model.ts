// ABOUTME: Mermaid 图形文件的数据模型、正式保存校验与草稿恢复校验。
import { isRecord, boundedText } from "./project.ts";
import { findExternalResources } from "./mermaid-source.ts";

export const MAX_SOURCE = 100000;
export const THEMES = ["default", "neutral", "dark", "forest", "base"] as const;
export const LOOKS = ["classic", "handDrawn"] as const;
export type Theme = (typeof THEMES)[number];
export type Look = (typeof LOOKS)[number];
export const THEME_LABELS: Record<Theme, string> = {
  default: "默认",
  neutral: "中性灰",
  dark: "深色",
  forest: "森林绿",
  base: "基础",
};
export const LOOK_LABELS: Record<Look, string> = {
  classic: "标准线条",
  handDrawn: "手绘草图",
};

export interface Model {
  source: string;
  theme: Theme;
  look: Look;
}

export const seed: Model = {
  source: `---
title: Web 服务发布流程
---
flowchart TD
  dev([合并到 main]) --> ci[运行单元测试与 lint]
  ci --> build[构建 Docker image: web:1.8.2]
  build --> scan{镜像安全扫描}
  scan -->|发现高危漏洞| fix[修复依赖并重新提交]
  fix --> ci
  scan -->|通过| staging[部署到预发环境]
  subgraph verify [预发验证]
    staging --> smoke[冒烟测试]
    smoke --> review{产品验收}
  end
  review -->|需要调整| fix
  review -->|确认| prod[灰度发布 10%]
  prod --> watch[观察错误率与延迟 30 分钟]
  watch --> full([全量发布])
  classDef risk fill:#fde8e4,stroke:#c4553f,color:#5c1f14
  classDef done fill:#e3f2e6,stroke:#3f8a52,color:#173d22
  class fix risk
  class full done`,
  theme: "default",
  look: "classic",
};

export const blankSource =
  "flowchart TD\n  start([开始]) --> step[第一步]\n  step --> finish([完成])";

const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && (THEMES as readonly string[]).includes(value);
const isLook = (value: unknown): value is Look =>
  typeof value === "string" && (LOOKS as readonly string[]).includes(value);

// 0.3.0 及更早的文件只有 source，当时预览固定使用 neutral 主题。
function appearance(
  value: Record<string, unknown>,
): Pick<Model, "theme" | "look"> {
  if (value.theme !== undefined && !isTheme(value.theme))
    throw new Error("图形主题无效。");
  if (value.look !== undefined && !isLook(value.look))
    throw new Error("图形风格无效。");
  return {
    theme: value.theme === undefined ? "neutral" : value.theme,
    look: value.look === undefined ? "classic" : value.look,
  };
}

export function validate(value: unknown): Model {
  if (!isRecord(value)) throw new Error("图形文件格式无效。");
  const source = boundedText(value.source, MAX_SOURCE);
  if (!source.trim()) throw new Error("请输入图形源码。");
  const external = findExternalResources(source);
  if (external.length)
    throw new Error(
      `第 ${external[0].line} 行引用外部资源（${external[0].url.slice(0, 80)}），图形不会联网加载。请改用 data: 内嵌图片或文字节点。`,
    );
  return { source, ...appearance(value) };
}

export function restoreDraftData(value: unknown): Model {
  if (
    !isRecord(value) ||
    typeof value.source !== "string" ||
    value.source.length > MAX_SOURCE
  )
    throw new Error("图形草稿格式无效。");
  return { source: value.source, ...appearance(value) };
}

export const instructions =
  '将要求整理为 Mermaid 12 图形源码。只返回 JSON {"source":"Mermaid源码"}。根据内容选择合适的图类型：流程用 flowchart，交互用 sequenceDiagram，对象结构用 classDiagram 或 erDiagram，状态流转用 stateDiagram-v2，排期用 gantt，层级要点用 mindmap，阶段历史用 timeline，占比用 pie。节点文字使用简短中文，含特殊字符时用双引号包裹。不要使用外部图片、HTML、click 回调或 %%{init}%% 指令。';
