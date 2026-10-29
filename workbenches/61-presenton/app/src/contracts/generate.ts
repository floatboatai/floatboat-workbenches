// ABOUTME: 本地确定性生成：资料简报 → 大纲（按内容选择版式，表格变图表、数字变关键数字、时间变时间线），大纲 → 幻灯片；附生成说明。
import {
  condense,
  extractStat,
  isCjk,
  numbersIn,
  parseBrief,
  parseNumber,
  plain,
  sectionText,
  sentences,
  timeMarker,
  type Block,
  type Section,
} from "./brief.ts";
import {
  LIMITS,
  isNumeric,
  type ArtId,
  type Brief,
  type Chart,
  type LayoutId,
  type OutlineItem,
  type Slide,
  type Stat,
} from "./model.ts";

type Lang = "zh" | "en";
const TEXT = {
  zh: { agenda: "内容", cont: "（续）", thanks: "谢谢", overview: "概述", for: "面向：", next: "下一步", objective: "目标：", audience: "听众：" },
  en: { agenda: "Agenda", cont: " (cont.)", thanks: "Thank you", overview: "Overview", for: "For: ", next: "Next steps", objective: "Objective: ", audience: "Audience: " },
};
const DENSITY = {
  concise: { points: 4, zh: 28, en: 70, slidesPerSection: 1 },
  standard: { points: 5, zh: 40, en: 96, slidesPerSection: 2 },
  detailed: { points: 6, zh: 60, en: 140, slidesPerSection: 3 },
};
const ASK = /下一步|决定|决策|建议|行动|请求|需要.{0,6}(确定|批准|支持)|结论|总结|呼吁|next step|decision|ask|recommendation|conclusion|call to action/i;
const SHARE = /构成|占比|比例|分配|结构|预算|份额|分布|share|mix|breakdown|split|allocation/i;
const TIMEY = /^(?:\d{4}(?:\s*年)?|\d{1,2}\s*月|Q[1-4]|第.+(?:季度|周|月|期)|20\d\d|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i;

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36).slice(0, 6);
}
export function resolveLanguage(brief: Brief): Lang {
  if (brief.language !== "auto") return brief.language;
  return isCjk(brief.source + brief.objective + brief.audience) || !brief.source.trim() ? "zh" : "en";
}
const item = (layout: LayoutId, title: string, extra: Partial<OutlineItem> = {}): OutlineItem => ({
  id: "",
  layout,
  title: title.slice(0, LIMITS.title),
  points: [],
  points2: [],
  columnTitles: ["", ""],
  chart: null,
  notes: "",
  sourceRef: "",
  ...extra,
});
const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));

/** Strips a parenthesised unit from a table header: "金额（万元）" → { name: "金额", unit: "万元" }. */
function headerUnit(header: string): { name: string; unit: string } {
  const m = header.match(/^(.*?)\s*[（(]\s*([^）)]{1,12})\s*[)）]\s*(.*)$/);
  if (!m) return { name: header.trim(), unit: "" };
  return { name: `${m[1]} ${m[3]}`.trim(), unit: m[2].trim() };
}
function commonPrefix(names: string[]): string {
  if (names.length < 2) return "";
  let p = names[0];
  for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
  p = p.replace(/\d+$/, "");
  return p.length >= 2 && names.every((n) => n.length > p.length) ? p : "";
}

/** Builds a native chart from a Markdown table; returns explanation for the generation log. */
export function chartFromTable(
  header: string[],
  rows: string[][],
  context: string,
): { chart: Chart; insights: string[]; note: string; lang?: Lang } | null {
  if (rows.length < 2 || header.length < 2) return null;
  const strict = /^[-+]?\d[\d,]*(?:\.\d+)?\s*[%％]?$/;
  const labelCol = header.findIndex((_, c) => !rows.every((r) => strict.test((r[c] ?? "").trim())));
  const numericCols = header
    .map((_, c) => c)
    .filter((c) => c !== labelCol && rows.filter((r) => isNumeric(String(parseNumber(r[c] ?? "")))).length >= Math.ceil(rows.length * 0.8));
  if (labelCol < 0 || !numericCols.length) return null;
  const max = (c: number) => Math.max(...rows.map((r) => Math.abs(parseNumber(r[c] ?? "")) || 0));
  const ref = max(numericCols[numericCols.length - 1]) || 1;
  const kept = numericCols.filter((c) => max(c) <= ref * 8 && max(c) >= ref / 8).slice(-LIMITS.chartSeries);
  const dropped = numericCols.filter((c) => !kept.includes(c));
  const parts = kept.map((c) => headerUnit(header[c]));
  const prefix = commonPrefix(parts.map((p) => p.name));
  const unit = parts.every((p) => p.unit === parts[0].unit) ? parts[0].unit : "";
  const categories = rows.slice(0, LIMITS.chartCategories).map((r) => plain(r[labelCol]).slice(0, 120) || "—");
  const series = kept.map((c, i) => ({
    name: (prefix ? parts[i].name.slice(prefix.length) : parts[i].name).trim().slice(0, 120) || header[c].slice(0, 120),
    values: rows.slice(0, LIMITS.chartCategories).map((r) => {
      const n = parseNumber(r[c] ?? "");
      return Number.isFinite(n) ? String(n) : "";
    }),
  }));
  const values = series.map((s) => s.values.map(Number));
  const allPositive = values.flat().every((v) => v > 0);
  const share = series.length === 1 && categories.length <= 6 && allPositive && (SHARE.test(context + header.join(" ")) || Math.abs(values[0].reduce((a, b) => a + b, 0) - 100) < 1.5);
  const timeline = categories.filter((c) => TIMEY.test(c)).length >= Math.ceil(categories.length * 0.8);
  const type: Chart["type"] = share ? "doughnut" : timeline ? "line" : "bar";
  const lang: Lang = isCjk(context + header.join("")) ? "zh" : "en";
  const insights: string[] = [];
  const u = unit === "%" ? "%" : unit ? ` ${unit}` : "";
  if (series.length >= 2) {
    const a = values[0],
      b = values[values.length - 1];
    const deltas = a.map((v, i) => b[i] - v);
    const best = deltas.indexOf(Math.max(...deltas));
    const avgA = a.reduce((x, y) => x + y, 0) / a.length,
      avgB = b.reduce((x, y) => x + y, 0) / b.length;
    const unitWord = unit === "%" ? (lang === "zh" ? " 个百分点" : " pts") : u;
    insights.push(
      lang === "zh"
        ? `平均从 ${fmt(avgA)}${u} 到 ${fmt(avgB)}${u}，${avgB >= avgA ? "提升" : "下降"} ${fmt(Math.abs(avgB - avgA))}${unitWord}`
        : `Average moved from ${fmt(avgA)}${u} to ${fmt(avgB)}${u} (${avgB >= avgA ? "+" : "−"}${fmt(Math.abs(avgB - avgA))}${unitWord})`,
    );
    insights.push(
      lang === "zh"
        ? `${categories[best]}变化最大：${fmt(a[best])}${u} → ${fmt(b[best])}${u}`
        : `${categories[best]} changed most: ${fmt(a[best])}${u} → ${fmt(b[best])}${u}`,
    );
  } else {
    const v = values[0];
    const sum = v.reduce((x, y) => x + y, 0);
    const top = v.indexOf(Math.max(...v));
    if (type === "doughnut") {
      insights.push(lang === "zh" ? `合计 ${fmt(sum)}${u}` : `Total ${fmt(sum)}${u}`);
      insights.push(
        lang === "zh"
          ? `${categories[top]}占比最高，约 ${fmt(Math.round((v[top] / sum) * 100))}%`
          : `${categories[top]} is the largest share, about ${fmt(Math.round((v[top] / sum) * 100))}%`,
      );
    } else {
      const low = v.indexOf(Math.min(...v));
      insights.push(lang === "zh" ? `最高：${categories[top]}（${fmt(v[top])}${u}）` : `Highest: ${categories[top]} (${fmt(v[top])}${u})`);
      if (low !== top) insights.push(lang === "zh" ? `最低：${categories[low]}（${fmt(v[low])}${u}）` : `Lowest: ${categories[low]} (${fmt(v[low])}${u})`);
    }
  }
  const typeName = { bar: "柱形图", line: "折线图", doughnut: "环形图", pie: "饼图" }[type];
  const note = `${series.length} 个系列、${categories.length} 个分类 → ${typeName}${dropped.length ? `；未纳入量级不同的列「${dropped.map((c) => header[c]).join("」「")}」` : ""}`;
  return { chart: { type, categories, series, unit }, insights, note };
}

/** Chart built from numeric bullet points, for layout switches. */
export function chartFromPoints(points: string[]): Chart | null {
  const found = points.map((p) => ({ stat: extractStat(p), p })).filter((x) => x.stat && Number.isFinite(parseNumber(x.stat.value)));
  if (found.length < 2) return null;
  const units = found.map((x) => x.stat!.value.replace(/[-+\d.,\s]/g, ""));
  return {
    type: "bar",
    categories: found.map((x) => condense(x.stat!.label, 14)),
    series: [{ name: "", values: found.map((x) => String(parseNumber(x.stat!.value))) }],
    unit: units.every((u) => u === units[0]) ? units[0] : "",
  };
}

function blockPoints(blocks: Block[], max: number): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === "list") out.push(...b.items.map((t) => condense(t, max)));
    else if (b.kind === "para") out.push(...sentences(b.text).map((t) => condense(t, max)));
    else if (b.kind === "quote") out.push(condense(b.text, max));
  }
  return out.filter((p) => p.length > 1);
}
function notesFor(s: { blocks: Block[]; parts?: Section["parts"] }) {
  return sectionText(s).slice(0, 1500);
}
export function pickArt(text: string, fallback: ArtId = "rings"): ArtId {
  if (/树|绿|植|公园|森林|花|生态|tree|green|park|forest|plant/i.test(text)) return "canopy";
  if (/路|街|交通|出行|线路|物流|地图|route|street|transit|map|travel/i.test(text)) return "route";
  if (/城|社区|建筑|楼|门店|空间|city|building|store|community/i.test(text)) return "blocks";
  if (/增长|收入|销售|营收|利润|用户数|growth|revenue|sales|profit/i.test(text)) return "growth";
  if (/山|水|河|自然|旅行|landscape|river|mountain|nature/i.test(text)) return "hills";
  return fallback;
}

type Classified = { items: OutlineItem[]; note: string };
function classify(section: Section, lang: Lang, density: (typeof DENSITY)["standard"], isLate: boolean): Classified {
  const max = density[lang];
  const title = condense(section.title, 40);
  const all = [...section.blocks, ...section.parts.flatMap((p) => p.blocks)];
  const notes = notesFor(section);
  const base = { notes, sourceRef: section.title.slice(0, 300) };
  const table = all.find((b): b is Extract<Block, { kind: "table" }> => b.kind === "table");
  if (table) {
    const made = chartFromTable(table.header, table.rows, section.title);
    if (made) {
      const extra = blockPoints(
        all.filter((b) => b.kind === "para"),
        max,
      ).slice(0, Math.max(0, density.points - made.insights.length - 1));
      return {
        items: [item("chart", title, { ...base, chart: made.chart, points: [...made.insights, ...extra].slice(0, density.points) })],
        note: `表格 ${made.note}`,
      };
    }
  }
  const quote = all.find((b): b is Extract<Block, { kind: "quote" }> => b.kind === "quote");
  if (quote && !/^示例资料|^注[:：]|^note[:：]/i.test(quote.text)) {
    const items = [item("quote", title, { ...base, points: [condense(quote.text, 160), quote.cite].filter(Boolean) })];
    const rest = blockPoints(
      all.filter((b) => b !== quote),
      max,
    );
    if (rest.length >= 2) items.push(item("bullets", title, { ...base, points: rest.slice(0, density.points) }));
    return { items, note: "引语 → 引语页" };
  }
  if (section.parts.length === 2) {
    const [a, b] = section.parts;
    return {
      items: [
        item("comparison", title, {
          ...base,
          columnTitles: [condense(a.title, 24), condense(b.title, 24)],
          points: blockPoints(a.blocks, max).slice(0, density.points),
          points2: blockPoints(b.blocks, max).slice(0, density.points),
        }),
      ],
      note: "两个小节 → 左右对比",
    };
  }
  const list = all.find((b): b is Extract<Block, { kind: "list" }> => b.kind === "list");
  if (list) {
    const marked = list.items.map(timeMarker);
    if (list.items.length >= 3 && marked.filter(Boolean).length >= Math.ceil(list.items.length * 0.6)) {
      const steps = list.items.map((t, i) => {
        const m = marked[i];
        return m ? `${m.label}：${condense(m.rest, max)}` : condense(t, max);
      });
      const items: OutlineItem[] = [];
      for (let i = 0; i < steps.length; i += 6)
        items.push(item("timeline", i ? title + TEXT[lang].cont : title, { ...base, points: steps.slice(i, i + 6) }));
      return { items, note: `${steps.length} 个时间节点 → 时间线` };
    }
    const numeric = list.items.filter((t) => numbersIn(t).some((n) => /\d/.test(n)));
    const avg = list.items.reduce((n, t) => n + t.length, 0) / list.items.length;
    if (
      !ASK.test(section.title) &&
      list.items.length >= 2 &&
      list.items.length <= LIMITS.stats &&
      numeric.length >= Math.ceil(list.items.length * 0.75) &&
      avg <= 26 &&
      list.items.every((t) => t.length <= 40) &&
      blockPoints(section.blocks.filter((b) => b.kind === "para"), max).length <= 1
    )
      return {
        items: [item("stats", title, { ...base, points: list.items.map((t) => condense(t, 60)) })],
        note: `${list.items.length} 个带数字的要点 → 关键数字`,
      };
  }
  if (section.parts.length > 2) {
    const points = section.parts.map((p) => {
      const first = blockPoints(p.blocks, max)[0];
      return condense(first ? `${p.title}：${first}` : p.title, max + 10);
    });
    return { items: [item("bullets", title, { ...base, points: points.slice(0, density.points + 1) })], note: `${section.parts.length} 个小节 → 要点` };
  }
  const points = blockPoints(all, max);
  const layout: LayoutId = isLate && ASK.test(section.title) ? "closing" : "bullets";
  if (!points.length) return { items: [item("section", title, { ...base })], note: "无正文 → 章节页" };
  const items: OutlineItem[] = [];
  const pages = points.length <= density.points + 1 ? 1 : Math.min(density.slidesPerSection, Math.ceil(points.length / density.points));
  const per = pages === 1 ? Math.min(points.length, density.points + 1) : Math.ceil(Math.min(points.length, pages * density.points) / pages);
  for (let p = 0; p < pages; p++)
    items.push(
      item(layout === "closing" && p < pages - 1 ? "bullets" : layout, p ? title + TEXT[lang].cont : title, {
        ...base,
        points: points.slice(p * per, (p + 1) * per),
      }),
    );
  const omitted = points.length - pages * per;
  return {
    items,
    note: `${points.length} 条要点 → ${pages} 页${layout === "closing" ? "（行动请求 → 结尾页）" : ""}${omitted > 0 ? `；其余 ${omitted} 条保留在演讲备注` : ""}`,
  };
}

export type GenerationLog = { section: string; note: string }[];

/** Deterministic outline from a brief. The same input always produces the same outline. */
export function outlineFromBrief(brief: Brief): { items: OutlineItem[]; log: GenerationLog } {
  const lang = resolveLanguage(brief);
  const t = TEXT[lang];
  const density = DENSITY[brief.density];
  const doc = parseBrief(brief.source);
  const log: GenerationLog = [];
  const sections = doc.sections.filter((s) => s.blocks.length || s.parts.length || s.title);
  const deckTitle = condense(doc.title || brief.objective || sections[0]?.title || (lang === "zh" ? "演示文稿" : "Presentation"), 60);
  const introPoints = blockPoints(
    doc.intro.filter((b) => b.kind !== "quote"),
    density[lang],
  );
  const subtitle = condense(brief.objective || introPoints[0] || "", 70);
  const items: OutlineItem[] = [
    item("cover", deckTitle, {
      points: [subtitle, brief.audience.trim() ? t.for + condense(brief.audience, 50) : ""].filter(Boolean),
      notes: [brief.objective && t.objective + brief.objective, brief.audience && t.audience + brief.audience].filter(Boolean).join("\n"),
      sourceRef: doc.title.slice(0, 300),
    }),
  ];
  log.push({ section: doc.title || "封面", note: "标题与目标 → 封面" });
  if (introPoints.length >= 2) {
    items.push(item("bullets", t.overview, { points: introPoints.slice(0, density.points), notes: notesFor({ blocks: doc.intro }), sourceRef: "" }));
    log.push({ section: t.overview, note: "开头段落 → 概述" });
  }
  const content: OutlineItem[] = [];
  sections.forEach((s, i) => {
    const r = classify(s, lang, density, i >= sections.length - 2);
    content.push(...r.items);
    log.push({ section: s.title, note: r.note });
  });
  if (sections.length >= 5) {
    const agenda = sections.filter((s) => !ASK.test(s.title)).slice(0, 6);
    items.push(item("agenda", t.agenda, { points: agenda.map((s) => condense(s.title, 22)), sourceRef: "" }));
    log.push({ section: t.agenda, note: `${sections.length} 个章节 → 目录` });
  }
  items.push(...content);
  if (!content.some((c) => c.layout === "closing")) {
    const last = items[items.length - 1];
    if (last && last.layout === "bullets" && ASK.test(last.title)) last.layout = "closing";
    else {
      items.push(item("closing", brief.objective ? t.next : t.thanks, { points: brief.objective ? [condense(brief.objective, 60)] : [], sourceRef: "" }));
      log.push({ section: t.thanks, note: "补充结尾页" });
    }
  }
  const visual = items.findIndex((x, i) => i >= 2 && x.layout === "bullets" && x.points.length <= 5 && x.points.length >= 2);
  if (visual >= 0) {
    items[visual].layout = "image-text";
    log.push({ section: items[visual].sourceRef || items[visual].title, note: "篇幅较短的要点页 → 图文页（配插画，可换成自己的图片）" });
  }
  if (brief.length > 0 && items.length > brief.length) {
    const before = items.length;
    const drop = (pred: (x: OutlineItem, i: number) => boolean) => {
      for (let i = items.length - 2; i >= 1 && items.length > brief.length; i--) if (pred(items[i], i)) items.splice(i, 1);
    };
    drop((x) => x.layout === "agenda");
    drop((x) => x.title.endsWith(t.cont));
    drop((x) => x.layout === "bullets" && x.title === t.overview);
    while (items.length > brief.length && items.length > 2) {
      let worst = -1;
      for (let i = 1; i < items.length - 1; i++)
        if (["bullets", "section", "image-text"].includes(items[i].layout) && (worst < 0 || items[i].points.length < items[worst].points.length)) worst = i;
      if (worst < 0) break;
      items.splice(worst, 1);
    }
    while (items.length > brief.length && items.length > 2) items.splice(items.length - 2, 1);
    log.push({ section: "页数", note: `目标 ${brief.length} 页：从 ${before} 页精简为 ${items.length} 页` });
  } else if (brief.length > items.length) log.push({ section: "页数", note: `资料只够生成 ${items.length} 页（目标 ${brief.length} 页）` });
  items.forEach((x, i) => (x.id = `o${String(i + 1).padStart(2, "0")}-${hash(x.title + x.layout + i)}`));
  return { items: items.slice(0, LIMITS.slides), log };
}

const ARTS_ROTATION: ArtId[] = ["hills", "blocks", "growth", "rings", "route", "canopy"];

export function statsFromPoints(points: string[]): Stat[] {
  return points
    .map((p) => extractStat(p))
    .filter((s): s is Stat => !!s)
    .slice(0, LIMITS.stats)
    .map((s) => ({ value: s.value.slice(0, 40), label: s.label.slice(0, 200) }));
}

/** One slide from one outline item. Content fields not used by the layout are kept for later layout switches. */
export function slideFromItem(o: OutlineItem, index: number, deckText = ""): Slide {
  const base: Slide = {
    id: `s-${o.id}`.slice(0, 100),
    layout: o.layout,
    title: o.title,
    subtitle: "",
    bullets: o.points,
    bullets2: o.points2,
    columnTitles: o.columnTitles,
    stats: [],
    chart: o.chart ? structuredClone(o.chart) : null,
    image: null,
    notes: o.notes,
    outlineId: o.id,
    source: o.sourceRef,
  };
  switch (o.layout) {
    case "cover":
      return { ...base, subtitle: o.points[0] ?? "", bullets: o.points.slice(1), image: { kind: "art", art: pickArt(deckText + o.title, "hills"), alt: "" } };
    case "section":
      return { ...base, subtitle: o.points[0] ?? "", bullets: o.points.slice(1) };
    case "image-text":
      return { ...base, image: { kind: "art", art: pickArt(o.title + o.notes, ARTS_ROTATION[index % ARTS_ROTATION.length]), alt: "" } };
    case "chart": {
      const chart = base.chart ?? chartFromPoints(o.points);
      if (!chart) return { ...base, layout: "bullets" };
      return { ...base, chart, subtitle: o.chart ? o.points[0] ?? "" : "", bullets: o.chart ? o.points.slice(1) : [] };
    }
    case "stats": {
      const stats = statsFromPoints(o.points);
      return stats.length >= 2 ? { ...base, stats } : { ...base, layout: "bullets" };
    }
    case "quote":
      return { ...base, title: o.points[0] || o.title, subtitle: o.points[1] ?? "", bullets: [], source: o.sourceRef || o.title };
    default:
      return base;
  }
}
export function slidesFromOutline(outline: OutlineItem[], brief: Brief): Slide[] {
  const text = parseBrief(brief.source).title + brief.objective;
  return outline.map((o, i) => slideFromItem(o, i, text));
}

/** Carries content into another layout, deriving charts/stats from bullets when the slide has none. */
export function switchLayout(slide: Slide, layout: LayoutId): Slide {
  const next: Slide = { ...slide, layout };
  if (layout === "chart" && !next.chart)
    next.chart = chartFromPoints(slide.bullets) ?? {
      type: "bar",
      categories: ["A", "B", "C"],
      series: [{ name: "", values: ["", "", ""] }],
      unit: "",
    };
  if (layout === "stats" && !next.stats.length) {
    const derived = statsFromPoints(slide.bullets);
    next.stats = derived.length ? derived : [{ value: "", label: "" }, { value: "", label: "" }];
  }
  if ((layout === "image-text" || layout === "cover") && !next.image)
    next.image = { kind: "art", art: pickArt(slide.title + slide.bullets.join(""), "rings"), alt: "" };
  if (layout === "comparison" && !next.bullets2.length && next.bullets.length > 1) {
    const half = Math.ceil(next.bullets.length / 2);
    next.bullets2 = next.bullets.slice(half);
    next.bullets = next.bullets.slice(0, half);
  }
  return next;
}
