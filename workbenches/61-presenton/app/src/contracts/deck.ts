// ABOUTME: 文稿的外部格式：Presenton 生成请求映射与响应导入、便携项目（含图片）与恢复副本导入、Markdown 大纲导出。
import { localOperation } from "./operation.ts";
import { boundedText, isRecord } from "./project.ts";
import { outlineFromBrief, slidesFromOutline } from "./generate.ts";
import {
  LAYOUT_LABELS,
  LIMITS,
  MEDIA_ID,
  blank,
  defaultSettings,
  identifier,
  markdownPoints,
  restoreDeck,
  validateDeck,
  type Deck,
  type OutlineItem,
  type Slide,
} from "./model.ts";
import { SAMPLE_AUDIENCE, SAMPLE_BRIEF, SAMPLE_OBJECTIVE, SAMPLE_TITLE } from "./sample-brief.ts";

export { blank, identifier, restoreDeck, validateDeck } from "./model.ts";
export type { Deck, Slide, OutlineItem, Settings, Result } from "./model.ts";

export const PORTABLE_FORMAT = "presenton-workbench";

/** The bundled example: an original brief plus the outline and slides the local generator produced from it. */
export function exampleDeck(): Deck {
  const brief = { source: SAMPLE_BRIEF, audience: SAMPLE_AUDIENCE, objective: SAMPLE_OBJECTIVE, language: "auto", length: 0, density: "standard" } as const;
  const outline = outlineFromBrief(brief).items;
  return { ...blank, brief, outline, slides: slidesFromOutline(outline, brief), theme: "paper" };
}
export const example: Deck = exampleDeck();
export const EXAMPLE_TITLE = SAMPLE_TITLE;

const str = (v: unknown, n: number) => boundedText(v, n);

/** Presenton request: the outline (or slides when no outline exists) as per-slide Markdown. */
export function generationRequest(value: unknown) {
  const d = validateDeck(value);
  if (!d.settings.language.trim() || !d.settings.template.trim()) throw new Error("请选择语言并填写模板。");
  const pages: { title: string; points: string[]; notes: string; layout: string }[] = d.outline.length
    ? d.outline.map((o) => ({ title: o.title, points: [...o.points, ...o.points2], notes: o.notes, layout: o.layout }))
    : d.slides.map((s) => ({ title: s.title, points: [s.subtitle, ...s.bullets, ...s.bullets2, ...s.stats.map((x) => `${x.value} ${x.label}`)].filter(Boolean), notes: s.notes, layout: s.layout }));
  if (!pages.length) throw new Error("请先生成或编写大纲。");
  if (pages.some((p) => !p.title.trim())) throw new Error("大纲中有未命名的页面，请补充标题。");
  return {
    content: [d.brief.source, `Audience: ${d.brief.audience}`, `Objective: ${d.brief.objective}`].join("\n\n"),
    slides_markdown: pages.map(
      (p) => `# ${p.title}\n\n${p.points.map((x) => `- ${x}`).join("\n")}${p.notes ? "\n\nSpeaker guidance: " + p.notes.slice(0, 1500) : ""}`,
    ),
    n_slides: pages.length,
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

/** Markdown hand-out of the outline and slide text with notes. */
export function outlineMarkdown(title: string, d: Deck): string {
  const head = `# ${title}\n\n${d.brief.audience ? `- 听众：${d.brief.audience}\n` : ""}${d.brief.objective ? `- 目标：${d.brief.objective}\n` : ""}`;
  const body = (d.slides.length ? d.slides : d.outline).map((s, i) => {
    const slide = "bullets" in s ? (s as Slide) : null;
    const item = slide ? null : (s as OutlineItem);
    const lines = slide
      ? [slide.subtitle, ...slide.stats.map((x) => `${x.value} — ${x.label}`), ...slide.bullets, ...slide.bullets2].filter(Boolean)
      : [...item!.points, ...item!.points2];
    const chart = slide?.chart
      ? `\n\n| ${["", ...slide.chart.series.map((x) => x.name || "数值")].join(" | ")} |\n|${" --- |".repeat(slide.chart.series.length + 1)}\n${slide.chart.categories
          .map((c, ci) => `| ${[c, ...slide.chart!.series.map((x) => x.values[ci] ?? "")].join(" | ")} |`)
          .join("\n")}`
      : "";
    return `## ${i + 1}. ${s.title || "（未命名）"}\n\n_${LAYOUT_LABELS[s.layout]}_\n\n${lines.map((l) => `- ${l}`).join("\n")}${chart}${s.notes ? `\n\n> 演讲备注：${s.notes.replace(/\n/g, "\n> ")}` : ""}`;
  });
  return `${head}\n${body.join("\n\n")}\n`;
}

export type Task = { id: string; status: "pending" | "completed" | "error"; data: Record<string, unknown> | null };
export function taskValue(v: unknown): Task {
  if (
    !isRecord(v) ||
    !["pending", "completed", "error"].includes(String(v.status)) ||
    (v.data !== null && v.data !== undefined && !isRecord(v.data))
  )
    throw new Error("Presenton 任务响应格式无效。");
  return { id: identifier(v.id), status: v.status as Task["status"], data: isRecord(v.data) ? v.data : null };
}
function contentText(v: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof v === "string") return [v.slice(0, 600)];
  if (Array.isArray(v)) return v.flatMap((x) => contentText(x, depth + 1)).slice(0, 80);
  if (isRecord(v))
    return Object.entries(v)
      .filter(([k]) => !/(image|url|html|style|icon|font|color|__)/i.test(k))
      .flatMap(([, x]) => contentText(x, depth + 1))
      .slice(0, 80);
  return [];
}

const EXTRA_TEXT: Record<string, number> = {
  importText: 1_800_000,
  lastOperation: 100,
  recoveryTask: 100,
  presentationId: 100,
  step: 20,
  activeSlide: 100,
  activeItem: 100,
};
/** Decodes persisted UI/working fields by type; unknown keys are dropped. */
export function restoreExtra(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) return {};
  const extra: Record<string, unknown> = {};
  for (const [key, max] of Object.entries(EXTRA_TEXT)) if (typeof v[key] === "string") extra[key] = str(v[key], max);
  if (v.pendingOperation !== undefined) extra.pendingOperation = localOperation(v.pendingOperation);
  if (Array.isArray(v.generationLog))
    extra.generationLog = v.generationLog
      .slice(0, 80)
      .filter(isRecord)
      .map((x) => ({ section: String(x.section ?? "").slice(0, 300), note: String(x.note ?? "").slice(0, 600) }));
  if (v.modelCandidate !== undefined) {
    const c = v.modelCandidate;
    if (isRecord(c) && Array.isArray(c.items) && c.items.length <= LIMITS.slides) {
      const probe = restoreDeck({ ...blank, outline: c.items });
      extra.modelCandidate = { items: probe.outline, model: typeof c.model === "string" ? c.model.slice(0, 120) : "" };
    }
  }
  return extra;
}

export type PortableMedia = Record<string, { mime: string; base64: string; name: string }>;
export type Imported = { title: string; deck: Deck; extra: Record<string, unknown>; media: PortableMedia };

export function portable(title: string, deck: Deck, extra: Record<string, unknown>, media: PortableMedia = {}) {
  return JSON.stringify({ format: PORTABLE_FORMAT, version: 2, title, deck, extra, media }, null, 2);
}
function mediaValue(v: unknown): PortableMedia {
  if (v === undefined) return {};
  if (!isRecord(v)) throw new Error("项目中的图片数据无效。");
  const out: PortableMedia = {};
  for (const [id, m] of Object.entries(v)) {
    if (!MEDIA_ID.test(id) || !isRecord(m) || typeof m.base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(m.base64))
      throw new Error("项目中的图片数据无效。");
    out[id] = { mime: str(m.mime, 40), base64: m.base64, name: typeof m.name === "string" ? m.name.slice(0, 200) : "" };
  }
  return out;
}

/** Imports a portable project (0.4 or 0.9), a recovery working copy, or a Presenton task / PresentationWithSlides JSON. */
export function importDeck(text: string): Imported {
  if (new TextEncoder().encode(text).length > 60_000_000) throw new Error("导入文件超过 60 MB。");
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error("JSON 尚未完整，请检查后再导入。");
  }
  if (!isRecord(v)) throw new Error("需要一个 JSON 对象。");
  if (v.format === PORTABLE_FORMAT && (v.version === 1 || v.version === 2)) {
    const title = str(v.title ?? "", 120);
    return { title: title.trim() || "导入的演示文稿", deck: restoreDeck(v.deck), extra: restoreExtra(v.extra), media: mediaValue(v.media) };
  }
  if (isRecord(v.snapshot) && isRecord(v.snapshot.data)) {
    return {
      title: typeof v.snapshot.title === "string" ? v.snapshot.title.slice(0, 120) : "恢复的演示文稿",
      deck: restoreDeck(v.snapshot.data),
      extra: restoreExtra(v.snapshot.extra),
      media: {},
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
  if (!presentationId && !Array.isArray(data.slides) && typeof data.path !== "string")
    throw new Error("未识别的 JSON：需要本工作台的项目文件、恢复副本，或 Presenton 的任务 / 演示文稿响应。");
  if (text.length > 250000) throw new Error("Presenton 结果 JSON 超过 250,000 字符，请只导出当前演示文稿。");
  let outline: OutlineItem[] = [
    { id: "import-0", layout: "bullets", title: "待复核的生成结果", points: ["已导入生成响应，可在 Presenton 通道按演示文稿 ID 读取页面。"], points2: [], columnTitles: ["", ""], chart: null, notes: "", sourceRef: "" },
  ];
  if (Array.isArray(data.slides)) {
    if (!data.slides.length || data.slides.length > LIMITS.slides) throw new Error(`导入内容需要 1–${LIMITS.slides} 页。`);
    outline = data.slides
      .map((raw, i) => {
        if (!isRecord(raw) || !Number.isInteger(raw.index) || !isRecord(raw.content)) throw new Error("Presenton 页面格式无效。");
        const texts = contentText(raw.content);
        const title = (typeof raw.content.title === "string" ? raw.content.title : texts[0] || `第 ${i + 1} 页`).slice(0, LIMITS.title);
        const points = texts
          .filter((t) => t !== title)
          .flatMap((t) => markdownPoints(t))
          .slice(0, LIMITS.points);
        return {
          item: {
            id: `import-${i}`,
            layout: (Number(raw.index) === 0 ? "cover" : "bullets") as OutlineItem["layout"],
            title,
            points: points.length ? points : ["此页只有视觉内容；请在 Presenton 原件中检查版式。"],
            points2: [],
            columnTitles: ["", ""] as [string, string],
            chart: null,
            notes: typeof raw.speaker_note === "string" ? raw.speaker_note.slice(0, LIMITS.notes) : "",
            sourceRef: "Presenton",
          },
          index: Number(raw.index),
        };
      })
      .sort((a, b) => a.index - b.index)
      .map((x) => x.item);
  }
  const brief = { ...blank.brief, source: typeof data.content === "string" ? data.content.slice(0, LIMITS.source) : "" };
  return {
    title: typeof data.title === "string" ? data.title.slice(0, 120) : "导入的 Presenton 文稿",
    deck: restoreDeck({
      ...blank,
      brief,
      outline,
      slides: slidesFromOutline(outline, brief),
      settings: defaultSettings,
      result: { kind: "imported", presentationId, taskId: task?.id || "", path: typeof data.path === "string" ? data.path : "", importedAt: new Date().toISOString(), raw: text },
    }),
    extra: {},
    media: {},
  };
}
