import { boundedText, isRecord } from "./project.ts";
export type Slide = {
  id: string;
  title: string;
  markdown: string;
  notes: string;
  reviewed: boolean;
};
export type Settings = {
  language: string;
  template: string;
  tone: string;
  verbosity: string;
  format: "pptx" | "pdf";
  instructions: string;
  webSearch: boolean;
  titleSlide: boolean;
  contents: boolean;
};
export type Result = {
  kind: "imported" | "generated";
  presentationId: string;
  taskId: string;
  path: string;
  importedAt: string;
  raw: string;
};
export type Deck = {
  schemaVersion: 1;
  source: string;
  audience: string;
  objective: string;
  slides: Slide[];
  settings: Settings;
  result: Result | null;
};
export const defaults: Settings = {
  language: "Chinese",
  template: "general",
  tone: "professional",
  verbosity: "standard",
  format: "pptx",
  instructions: "",
  webSearch: false,
  titleSlide: true,
  contents: false,
};
export const blank: Deck = {
  schemaVersion: 1,
  source: "",
  audience: "",
  objective: "",
  slides: [
    { id: "opening", title: "", markdown: "", notes: "", reviewed: false },
  ],
  settings: defaults,
  result: null,
};
export const example: Deck = {
  ...blank,
  source:
    "示例资料｜城市绿荫计划\n项目目标：让日常步行路线更凉爽、更宜人。\n试点：三条连接学校、社区与公交站的步行路线。\n行动：补植乡土树种，增加休息座椅，记录夏季体感温度。\n评估：遮荫覆盖、步行体验反馈、树木成活情况。",
  audience: "社区伙伴与项目支持者",
  objective: "就三条试点路线达成共识，确认首轮实地调研安排。",
  slides: [
    {
      id: "vision",
      title: "让每一段步行\n都有树荫相伴",
      markdown:
        "一项从社区街道开始的城市绿荫计划。\n\n- 连接日常目的地\n- 改善夏季步行体验\n- 从三条试点路线开始",
      notes: "开场询问：你每天走的那条路，哪里最需要一片树荫？",
      reviewed: true,
    },
    {
      id: "problem",
      title: "从日常路线找到机会",
      markdown:
        "- 学校到社区：放学高峰的等候与步行\n- 社区到公交站：最后一公里\n- 公园周边：连续的绿色连接",
      notes: "带入现场照片与居民观察；暂无实测温度数据，避免作量化承诺。",
      reviewed: false,
    },
    {
      id: "plan",
      title: "先观察，再共同设计",
      markdown:
        "1. 实地记录遮荫和停留点\n2. 邀请居民标注需求\n3. 与养护团队确认树种和空间\n4. 发布试点方案",
      notes: "强调社区参与贯穿整个过程。",
      reviewed: false,
    },
    {
      id: "next",
      title: "下一步，让路线走起来",
      markdown:
        "- 确认三条试点路线\n- 组织第一轮社区步行\n- 汇总观察，安排方案评审",
      notes: "结尾给出具体的参与方式与时间安排。",
      reviewed: false,
    },
  ],
};
const str = (v: unknown, n = 50000) => boundedText(v, n);
export function identifier(v: unknown): string {
  const s = str(v, 100);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(s)) throw new Error("标识格式无效。");
  return s;
}
export function restoreDeck(value: unknown): Deck {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.slides) ||
    !isRecord(value.settings)
  )
    throw new Error("项目格式不正确。");
  if (value.slides.length < 1 || value.slides.length > 60)
    throw new Error("需要 1–60 页幻灯片。");
  const slides = value.slides.map((v) => {
    if (!isRecord(v) || typeof v.reviewed !== "boolean")
      throw new Error("幻灯片格式不正确。");
    return {
      id: identifier(v.id),
      title: str(v.title, 300),
      markdown: str(v.markdown, 12000),
      notes: str(v.notes, 6000),
      reviewed: v.reviewed,
    };
  });
  if (new Set(slides.map((s) => s.id)).size !== slides.length)
    throw new Error("幻灯片标识重复。");
  const s = value.settings;
  if (
    ![
      "default",
      "casual",
      "professional",
      "funny",
      "educational",
      "sales_pitch",
    ].includes(String(s.tone)) ||
    !["concise", "standard", "text-heavy"].includes(String(s.verbosity)) ||
    !["pptx", "pdf"].includes(String(s.format)) ||
    typeof s.webSearch !== "boolean" ||
    typeof s.titleSlide !== "boolean" ||
    typeof s.contents !== "boolean"
  )
    throw new Error("制作设置无效。");
  const settings: Settings = {
    language: str(s.language, 80),
    template: str(s.template, 120),
    tone: String(s.tone),
    verbosity: String(s.verbosity),
    format: s.format === "pdf" ? "pdf" : "pptx",
    instructions: str(s.instructions, 6000),
    webSearch: s.webSearch,
    titleSlide: s.titleSlide,
    contents: s.contents,
  };
  let result: Result | null = null;
  if (value.result !== null) {
    const r = value.result;
    if (!isRecord(r) || !["imported", "generated"].includes(String(r.kind)))
      throw new Error("结果格式无效。");
    result = {
      kind: r.kind === "generated" ? "generated" : "imported",
      presentationId: str(r.presentationId, 100),
      taskId: str(r.taskId, 100),
      path: str(r.path, 2000),
      importedAt: str(r.importedAt, 60),
      raw: str(r.raw, 250000),
    };
  }
  const deck: Deck = {
    schemaVersion: 1,
    source: str(value.source, 60000),
    audience: str(value.audience, 1000),
    objective: str(value.objective, 2000),
    slides,
    settings,
    result,
  };
  if (new TextEncoder().encode(JSON.stringify(deck)).length > 9000000)
    throw new Error("工作副本超过 9 MB，请先导出并减少内容。");
  return deck;
}
export function validateDeck(value: unknown): Deck {
  const d = restoreDeck(value);
  if (new TextEncoder().encode(JSON.stringify(d)).length > 700000)
    throw new Error(
      "正式项目超过 700 KB；完整工作副本仍按草稿保留，请减少内容后制作。",
    );
  if (d.slides.some((s) => !s.title.trim() || !s.markdown.trim()))
    throw new Error("未完成的页面已保存为草稿；补充标题和内容后可制作。");
  return d;
}
export function generationRequest(value: unknown) {
  const d = validateDeck(value);
  if (!d.settings.language.trim() || !d.settings.template.trim())
    throw new Error("请选择语言并填写模板。");
  return {
    content: [
      d.source,
      `Audience: ${d.audience}`,
      `Objective: ${d.objective}`,
    ].join("\n\n"),
    slides_markdown: d.slides.map(
      (s) =>
        `# ${s.title}\n\n${s.markdown}${s.notes ? "\n\nSpeaker guidance: " + s.notes : ""}`,
    ),
    n_slides: d.slides.length,
    language: d.settings.language,
    template: d.settings.template,
    tone: d.settings.tone,
    verbosity: d.settings.verbosity,
    instructions: d.settings.instructions,
    web_search: d.settings.webSearch,
    include_title_slide: d.settings.titleSlide,
    include_table_of_contents: d.settings.contents,
    export_as: d.settings.format,
    trigger_webhook: false,
  };
}
export function outline(d: Deck): string {
  return (
    `# Presentation outline\n\n## Audience\n${d.audience}\n\n## Objective\n${d.objective}\n\n## Source\n${d.source}\n\n` +
    d.slides
      .map(
        (s, i) =>
          `---\n\n# ${i + 1}. ${s.title}\n\n${s.markdown}\n\n> Speaker notes\n${s.notes}\n`,
      )
      .join("\n")
  );
}
export type Task = {
  id: string;
  status: "pending" | "completed" | "error";
  data: Record<string, unknown> | null;
};
export function taskValue(v: unknown): Task {
  if (
    !isRecord(v) ||
    !["pending", "completed", "error"].includes(String(v.status)) ||
    (v.data !== null && v.data !== undefined && !isRecord(v.data))
  )
    throw new Error("Presenton 任务响应格式无效。");
  return {
    id: identifier(v.id),
    status: v.status as Task["status"],
    data: isRecord(v.data) ? v.data : null,
  };
}
function contentText(v: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof v === "string") return [v.slice(0, 12000)];
  if (Array.isArray(v))
    return v.flatMap((x) => contentText(x, depth + 1)).slice(0, 80);
  if (isRecord(v))
    return Object.entries(v)
      .filter(([k]) => !/(image|url|html|style|icon|font|color)/i.test(k))
      .flatMap(([, x]) => contentText(x, depth + 1))
      .slice(0, 80);
  return [];
}
export function restoreExtra(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) return {};
  const extra: Record<string, unknown> = {};
  for (const key of [
    "importText",
    "lastOperation",
    "recoveryTask",
    "presentationId",
  ])
    if (v[key] !== undefined)
      extra[key] = str(v[key], key === "importText" ? 1800000 : 100);
  return extra;
}
export function importDeck(text: string): {
  title: string;
  deck: Deck;
  extra: Record<string, unknown>;
} {
  if (new TextEncoder().encode(text).length > 24000000)
    throw new Error("导入文件超过 24 MB。");
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("JSON 尚未完整，请检查后再导入。");
  }
  if (!isRecord(v)) throw new Error("需要一个 JSON 对象。");
  if (v.format === "presenton-workbench" && v.version === 1) {
    const title = str(v.title, 120);
    return {
      title: title.trim() || "导入的演示文稿",
      deck: restoreDeck(v.deck),
      extra: restoreExtra(v.extra),
    };
  }
  if (isRecord(v.snapshot) && isRecord(v.snapshot.data)) {
    return {
      title:
        typeof v.snapshot.title === "string"
          ? v.snapshot.title.slice(0, 120)
          : "恢复的演示文稿",
      deck: restoreDeck(v.snapshot.data),
      extra: restoreExtra(v.snapshot.extra),
    };
  }
  const task = typeof v.status === "string" ? taskValue(v) : null;
  const data = task ? task.data : v;
  if (!data) throw new Error("任务尚无可导入的结果。");
  const presentationId =
    typeof data.presentation_id === "string"
      ? identifier(data.presentation_id)
      : typeof data.id === "string" && Array.isArray(data.slides)
        ? identifier(data.id)
        : "";
  if (
    !presentationId &&
    !Array.isArray(data.slides) &&
    typeof data.path !== "string"
  )
    throw new Error("未找到 Presenton 演示文稿或生成响应。");
  if (text.length > 250000)
    throw new Error("结果 JSON 超过 250,000 字符，请精简为当前演示文稿。");
  let slides: Slide[] = [
    {
      ...blank.slides[0],
      title: "待复核的生成结果",
      markdown: "已导入生成响应。可在制作页按演示文稿 ID 获取页面内容。",
    },
  ];
  if (Array.isArray(data.slides)) {
    if (!data.slides.length || data.slides.length > 60)
      throw new Error("导入内容需要 1–60 页。");
    slides = data.slides
      .map((raw, i) => {
        if (
          !isRecord(raw) ||
          !Number.isInteger(raw.index) ||
          !isRecord(raw.content)
        )
          throw new Error("Presenton 页面格式无效。");
        const texts = contentText(raw.content);
        return {
          id: `import-${i}`,
          title: (typeof raw.content.title === "string"
            ? raw.content.title
            : texts[0] || `第 ${i + 1} 页`
          ).slice(0, 300),
          markdown:
            texts.join("\n\n").slice(0, 12000) ||
            "此页仅有视觉内容；请下载原件检查版式。",
          notes:
            typeof raw.speaker_note === "string"
              ? raw.speaker_note.slice(0, 6000)
              : "",
          reviewed: false,
          index: Number(raw.index),
        };
      })
      .sort((a, b) => a.index - b.index);
  }
  return {
    title:
      typeof data.title === "string"
        ? data.title.slice(0, 120)
        : "导入的 Presenton 文稿",
    deck: restoreDeck({
      ...blank,
      source:
        typeof data.content === "string" ? data.content.slice(0, 60000) : "",
      slides,
      result: {
        kind: "imported",
        presentationId,
        taskId: task?.id || "",
        path: typeof data.path === "string" ? data.path : "",
        importedAt: new Date().toISOString(),
        raw: text,
      },
    }),
    extra: {},
  };
}
export const portable = (
  title: string,
  deck: Deck,
  extra: Record<string, unknown>,
) =>
  JSON.stringify(
    { format: "presenton-workbench", version: 1, title, deck, extra },
    null,
    2,
  );
