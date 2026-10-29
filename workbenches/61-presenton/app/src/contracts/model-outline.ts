// ABOUTME: 可选的 Floatboat 模型起草大纲：提示词与对模型输出的宽松解析（版式白名单、长度与数量上限、图表数据校验），结果只作为候选。
import { isRecord } from "./project.ts";
import { LAYOUTS, LIMITS, chartValue, restoreDeck, blank, type Brief, type LayoutId, type OutlineItem } from "./model.ts";

export const MODEL_SOURCE_LIMIT = 60_000;

export function outlinePrompt(brief: Brief): { system: string; prompt: string } {
  const lang = brief.language === "en" ? "English" : brief.language === "zh" ? "简体中文" : "与资料相同的语言";
  const count = brief.length > 0 ? `正好 ${brief.length} 页` : "8–14 页，按资料分量决定";
  const density = { concise: "每页最多 4 条短要点", standard: "每页 3–5 条要点", detailed: "每页最多 6 条要点，可稍长" }[brief.density];
  return {
    system: [
      "你是演示文稿策划。只根据用户提供的资料写大纲，不编造资料里没有的数字、人名或结论。",
      "只输出一个 JSON 对象，不要 Markdown 代码块，不要解释。",
      `JSON 结构：{"slides":[{"layout":"…","title":"…","points":["…"],"points2":["…"],"columnTitles":["…","…"],"notes":"…","sourceRef":"…","chart":{"type":"bar|line|pie|doughnut","categories":["…"],"series":[{"name":"…","values":[1,2]}],"unit":"…"}}]}`,
      `layout 只能取：${LAYOUTS.join(", ")}。第一页用 cover，最后一页用 closing。`,
      "comparison 用 points 与 points2 表示左右两栏，columnTitles 为两栏标题；stats 的每条 point 以数字开头；timeline 的每条 point 写成“时间：事项”；quote 的 points 为 [引语, 出处]；chart 必须提供资料中的真实数据，points 写一两句结论。",
      "notes 写给讲者的口头说明，可引用资料原句；sourceRef 写对应的资料章节标题。",
    ].join("\n"),
    prompt: [
      `语言：${lang}；页数：${count}；密度：${density}。`,
      brief.audience ? `听众：${brief.audience}` : "",
      brief.objective ? `这次演示的目标：${brief.objective}` : "",
      "资料：",
      brief.source.slice(0, MODEL_SOURCE_LIMIT),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

const textList = (v: unknown, max: number) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
        .map((x) => String(x).trim().slice(0, LIMITS.point))
        .filter(Boolean)
        .slice(0, max)
    : [];

/** Parses model text into outline items. Unknown layouts become bullets; malformed charts are dropped, not guessed. */
export function parseModelOutline(text: string): OutlineItem[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{"),
      end = cleaned.lastIndexOf("}");
    try {
      value = start >= 0 && end > start ? JSON.parse(cleaned.slice(start, end + 1)) : null;
    } catch {
      value = null;
    }
  }
  const slides = isRecord(value) && Array.isArray(value.slides) ? value.slides : Array.isArray(value) ? value : null;
  if (!slides || !slides.length) throw new Error("模型没有返回可用的大纲 JSON，请重试或使用本地生成。");
  const items = slides.slice(0, LIMITS.slides).map((raw, i): OutlineItem => {
    const r = isRecord(raw) ? raw : {};
    const layout: LayoutId = (LAYOUTS as readonly string[]).includes(String(r.layout)) ? (r.layout as LayoutId) : "bullets";
    let chart = null;
    try {
      chart = chartValue(r.chart);
    } catch {
      chart = null;
    }
    const cols = textList(r.columnTitles, 2);
    return {
      id: `m${String(i + 1).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8)}`,
      layout: layout === "chart" && !chart ? "bullets" : layout,
      title: (typeof r.title === "string" ? r.title.trim() : "").slice(0, LIMITS.title) || `第 ${i + 1} 页`,
      points: textList(r.points, LIMITS.points),
      points2: textList(r.points2, LIMITS.points),
      columnTitles: [cols[0] ?? "", cols[1] ?? ""],
      chart,
      notes: (typeof r.notes === "string" ? r.notes : "").slice(0, LIMITS.notes),
      sourceRef: (typeof r.sourceRef === "string" ? r.sourceRef : "").slice(0, 300),
    };
  });
  return restoreDeck({ ...blank, outline: items }).outline;
}
