// ABOUTME: 报告：本地底稿汇编、引用链接化、Markdown/HTML 导出与模型起草材料。
import { boundedText, isRecord } from "./project.ts";
import { citationsIn, kindLabels, safeUrl, originLabels, type Research, type Source } from "./research.ts";

export const citeAnchor = (n: number) => "source-" + n;

/** Render [n] markers as in-page links for preview and HTML export. */
export function linkCitations(report: string, sources: Source[]) {
  const known = new Set(sources.map((s) => s.cite));
  return report.replace(/\[(\d{1,4}(?:\s*[,，]\s*\d{1,4})*)\](?!\()/g, (_m, list: string) =>
    list
      .split(/[,，]/)
      .map((x) => Number(x.trim()))
      .map((n) => (known.has(n) ? `[\\[${n}\\]](#${citeAnchor(n)})` : `\\[${n}?\\]`))
      .join(""),
  );
}

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};
/** Structured working draft from the plan's findings and the collected sources (no model). */
export function compileReport(data: Research, title: string) {
  const parts = [`# ${title.trim() || data.question.trim() || "研究报告"}`, ""];
  parts.push(`> 研究问题：${data.question.trim() || "（未填写）"}`, "");
  parts.push("## 结论", "", "（根据下方分步发现写出 2–4 条结论，每条用 [编号] 标注依据。）", "");
  parts.push("## 研究方法", "");
  data.plan.steps.forEach((s, i) => {
    const detail = s.kind === "read" ? "" : s.query ? `：${s.query}` : "";
    parts.push(`${i + 1}. ${s.title}（${kindLabels[s.kind]}${detail}）`);
  });
  parts.push("");
  parts.push("## 分步发现", "");
  for (const s of data.plan.steps) {
    const own = data.sources.filter((x) => x.stepId === s.id);
    parts.push(`### ${s.title}`, "");
    parts.push(s.findings.trim() || "（尚未记录这一步的发现。）", "");
    for (const x of own.slice(0, 8)) parts.push(`- ${x.title}：${clip(x.note || x.excerpt || x.text, 160) || "（无摘要）"} [${x.cite}]`);
    if (own.length) parts.push("");
  }
  const loose = data.sources.filter((x) => !data.plan.steps.some((s) => s.id === x.stepId));
  if (loose.length) {
    parts.push("### 其他来源", "");
    for (const x of loose.slice(0, 20)) parts.push(`- ${x.title}：${clip(x.note || x.excerpt, 160) || "（无摘要）"} [${x.cite}]`);
    parts.push("");
  }
  const pending = data.sources.filter((x) => !x.checked);
  parts.push("## 待核实", "");
  parts.push(pending.length ? pending.map((x) => `- [${x.cite}] ${x.title}`).join("\n") : "- 所有来源均已核验。", "");
  return parts.join("\n");
}

export function sourceLine(s: Source) {
  const url = safeUrl(s.url);
  return `[${s.cite}] ${s.title.replace(/[[\]]/g, "")}${url ? ` — <${url}>` : ""}（${originLabels[s.origin] ?? s.origin}${s.checked ? " · 已核验" : " · 待核验"}${s.fetchedAt ? " · 读取于 " + s.fetchedAt.slice(0, 10) : ""}）`;
}
/** References section: every cited source, then uncited ones as further reading. */
export function referenceList(data: Research) {
  const cited = new Set(citationsIn(data.report));
  const sorted = [...data.sources].sort((a, b) => a.cite - b.cite);
  return { cited: sorted.filter((s) => cited.has(s.cite)), other: sorted.filter((s) => !cited.has(s.cite)) };
}
export function exportMarkdown(data: Research) {
  const { cited, other } = referenceList(data);
  let out = data.report.trimEnd() + "\n\n---\n\n## 参考来源\n\n";
  out += cited.length ? cited.map((s) => "- " + sourceLine(s)).join("\n") : "- （报告尚未引用来源）";
  if (other.length) out += "\n\n### 延伸阅读（未在正文引用）\n\n" + other.map((s) => "- " + sourceLine(s)).join("\n");
  return out + "\n";
}
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Standalone HTML file: rendered report body plus the reference list with anchors. */
export function htmlDocument(title: string, bodyHtml: string, data: Research) {
  const { cited, other } = referenceList(data);
  const item = (s: Source) => {
    const url = safeUrl(s.url);
    return `<li id="${citeAnchor(s.cite)}"><span class="n">[${s.cite}]</span> ${url ? `<a href="${escapeHtml(url)}">${escapeHtml(s.title)}</a>` : escapeHtml(s.title)} <small>${escapeHtml(originLabels[s.origin] ?? s.origin)}${s.checked ? " · 已核验" : " · 待核验"}</small></li>`;
  };
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{margin:0;background:#f4f1ec;color:#25211d;font:17px/1.75 "Songti SC","Noto Serif CJK SC",serif}main{max-width:760px;margin:40px auto;background:#fffdf9;padding:56px 64px;box-shadow:0 1px 3px #0002}h1,h2,h3{font-family:"PingFang SC","Noto Sans CJK SC",sans-serif;line-height:1.35}h1{font-size:30px}a{color:#8a2f22}a[href^="#source-"]{text-decoration:none;font-size:.8em;vertical-align:super}blockquote{margin:0;padding:4px 18px;border-left:3px solid #c9b9a6;color:#5d554c}table{border-collapse:collapse}td,th{border:1px solid #ddd2c4;padding:4px 8px}ol.refs{list-style:none;padding:0}ol.refs li{margin:6px 0}ol.refs .n{font-weight:600;color:#8a2f22}small{color:#7b7268}:target{background:#f6e6c8}@media(max-width:600px){main{margin:0;padding:28px 20px}}</style>
</head><body><main>
${bodyHtml}
<hr><h2>参考来源</h2><ol class="refs">${cited.map(item).join("") || "<li>（报告尚未引用来源）</li>"}</ol>
${other.length ? `<h3>延伸阅读（未在正文引用）</h3><ol class="refs">${other.map(item).join("")}</ol>` : ""}
</main></body></html>
`;
}

export type DraftSource = { cite: number; title: string; url: string; excerpt: string; text: string; note: string };
export type ReportDraftRequest = {
  question: string;
  scope: string;
  steps: { title: string; findings: string }[];
  sources: DraftSource[];
};
export const DRAFT_TEXT_CHARS = 2500;
export function reportMaterial(data: Research): ReportDraftRequest {
  const sources = [...data.sources].sort((a, b) => Number(b.checked) - Number(a.checked) || a.cite - b.cite).slice(0, 24);
  return {
    question: data.question.slice(0, 2000),
    scope: data.scope.slice(0, 6000),
    steps: data.plan.steps.map((s) => ({ title: s.title.slice(0, 200), findings: s.findings.slice(0, 4000) })),
    sources: sources.map((s) => ({
      cite: s.cite,
      title: s.title.slice(0, 300),
      url: s.url.slice(0, 2000),
      excerpt: s.excerpt.slice(0, 1200),
      text: s.text.slice(0, DRAFT_TEXT_CHARS),
      note: s.note.slice(0, 2000),
    })),
  };
}
export function reportRequestValue(v: unknown): ReportDraftRequest {
  if (!isRecord(v) || !Array.isArray(v.sources) || !Array.isArray(v.steps)) throw new Error("起草请求无效。");
  if (!v.sources.length || v.sources.length > 24) throw new Error("请提供1–24条来源再起草报告。");
  if (v.steps.length > 12) throw new Error("计划最多12步。");
  return {
    question: boundedText(v.question, 2000),
    scope: boundedText(v.scope ?? "", 6000),
    steps: v.steps.map((s) => {
      if (!isRecord(s)) throw new Error("计划步骤无效。");
      return { title: boundedText(s.title, 200), findings: boundedText(s.findings, 4000) };
    }),
    sources: v.sources.map((s) => {
      if (!isRecord(s) || typeof s.cite !== "number" || !Number.isInteger(s.cite)) throw new Error("来源材料无效。");
      return {
        cite: s.cite,
        title: boundedText(s.title, 300),
        url: boundedText(s.url, 2000),
        excerpt: boundedText(s.excerpt, 1200),
        text: boundedText(s.text, DRAFT_TEXT_CHARS),
        note: boundedText(s.note, 2000),
      };
    }),
  };
}
export const REPORT_SYSTEM =
  "你是严谨的研究分析师。只依据用户提供的来源材料与研究者记录写中文研究报告，不补充材料以外的事实。每个事实性陈述后用 [编号] 标注来源，编号只能使用材料中给出的编号。材料不足或互相矛盾时明确写出。";
export function reportPrompt(r: ReportDraftRequest) {
  return (
    `研究问题：${r.question}\n` +
    (r.scope ? `范围与要求：${r.scope}\n` : "") +
    "\n研究计划与研究者记录：\n" +
    r.steps.map((s, i) => `${i + 1}. ${s.title}${s.findings ? "\n   记录：" + s.findings.replace(/\n/g, " ") : ""}`).join("\n") +
    "\n\n来源材料：\n" +
    r.sources
      .map(
        (s) =>
          `[${s.cite}] ${s.title}\n链接：${s.url}\n` +
          (s.note ? `研究者判断：${s.note}\n` : "") +
          (s.excerpt ? `要点：${s.excerpt}\n` : "") +
          (s.text ? `正文节选：${s.text}\n` : ""),
      )
      .join("\n---\n") +
    "\n\n输出 Markdown：以“# 标题”开头，包含“## 结论”“## 分析”“## 风险与限制”“## 待核实”四节。不要另写参考文献列表。"
  );
}
