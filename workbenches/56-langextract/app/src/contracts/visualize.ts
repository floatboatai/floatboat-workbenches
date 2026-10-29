// Self-contained review report: every document with its grounded records highlighted
// by class, a legend with counts and a record table. Written for this workbench
// (LangExtract's own visualize() HTML is not copied). No scripts, no external assets.
import {
  classStats,
  finalAttributes,
  finalClass,
  finalText,
  locationKind,
  recordSpan,
  type EvidenceProject,
} from "./evidence.ts";

export const CLASS_COLORS = [
  "#f3d58a",
  "#b9dcc4",
  "#c9d4f2",
  "#f2c2b4",
  "#d9c7ec",
  "#bfe3e6",
  "#d7e3a8",
  "#e8d0a9",
  "#f0c6d9",
  "#cfd3cf",
];
export function classColor(p: EvidenceProject, name: string): string {
  const order = [
    ...p.fields.map((f) => f.name),
    ...p.documents.flatMap((d) => d.extractions.map((_, i) => finalClass(d, i))),
  ];
  const i = [...new Set(order)].indexOf(name);
  return CLASS_COLORS[(i < 0 ? 0 : i) % CLASS_COLORS.length];
}
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const statusName = { pending: "待复核", accepted: "已接受", rejected: "已驳回", corrected: "已修订" };

/** Non-overlapping segments; `priority` is drawn first, then earlier-starting (then longer) records. */
export function segments(
  text: string,
  spans: { start: number; end: number; index: number }[],
  priority?: number,
): { text: string; index: number | null; last: boolean }[] {
  const chars = Array.from(text),
    owner: (number | null)[] = new Array(chars.length).fill(null),
    ends = new Map<number, number>();
  const sorted = [...spans].sort(
    (a, b) =>
      Number(b.index === priority) - Number(a.index === priority) ||
      a.start - b.start ||
      b.end - a.end,
  );
  for (const s of sorted) {
    ends.set(s.index, s.end);
    for (let i = s.start; i < s.end && i < chars.length; i++) if (owner[i] === null) owner[i] = s.index;
  }
  const out: { text: string; index: number | null; last: boolean; end: number }[] = [];
  chars.forEach((c, i) => {
    const last = out[out.length - 1];
    if (last && last.index === owner[i]) {
      last.text += c;
      last.end = i + 1;
    } else out.push({ text: c, index: owner[i], last: false, end: i + 1 });
  });
  return out.map(({ end, ...seg }) => ({
    ...seg,
    last: seg.index !== null && Math.min(ends.get(seg.index)!, chars.length) === end,
  }));
}

export function visualizationHtml(p: EvidenceProject, title: string): string {
  const stats = classStats(p).filter((s) => s.total);
  const legend = stats
    .map(
      (s) =>
        `<li><span class="sw" style="background:${classColor(p, s.name)}"></span>${esc(s.name)} <b>${s.total - s.rejected}</b></li>`,
    )
    .join("");
  const docs = p.documents
    .map((d) => {
      const spans = d.extractions.flatMap((_, i) => {
        const s = recordSpan(d, i);
        return s && d.reviews[i].status !== "rejected" ? [{ ...s, index: i }] : [];
      });
      const body = segments(d.originalText, spans)
        .map((seg) =>
          seg.index === null
            ? esc(seg.text)
            : `<mark class="${d.reviews[seg.index].status}" style="background:${classColor(p, finalClass(d, seg.index))}" title="${esc(finalClass(d, seg.index) + "：" + finalText(d, seg.index))}">${esc(seg.text)}${seg.last ? `<sup>${seg.index + 1}</sup>` : ""}</mark>`,
        )
        .join("");
      const rows = d.extractions
        .map((e, i) => {
          const r = d.reviews[i],
            s = recordSpan(d, i),
            attrs = finalAttributes(d, i);
          return `<tr class="${r.status}"><td>${i + 1}</td><td><span class="sw" style="background:${classColor(p, finalClass(d, i))}"></span>${esc(finalClass(d, i))}</td><td>${esc(finalText(d, i))}${r.status === "corrected" ? `<div class="was">原始：${esc(e.extraction_text)}</div>` : ""}</td><td>${statusName[r.status]}${r.source === "manual" ? " · 人工标注" : ""}</td><td>${s ? `${s.start}–${s.end}` : locationKind(d, i) === "stale" ? "原文已变更" : "未定位"}</td><td>${attrs ? esc(Object.entries(attrs).map(([k, v]) => `${k}：${Array.isArray(v) ? v.join("、") : v}`).join("；")) : ""}</td><td>${esc(r.note)}</td></tr>`;
        })
        .join("");
      return `<section><h2>${esc(d.id)}</h2><div class="doc">${body}</div><table><thead><tr><th>#</th><th>类别</th><th>值</th><th>状态</th><th>区间</th><th>属性</th><th>备注</th></tr></thead><tbody>${rows || '<tr><td colspan="7">没有记录</td></tr>'}</tbody></table></section>`;
    })
    .join("");
  const total = p.documents.reduce((n, d) => n + d.extractions.length, 0),
    reviewed = p.documents.reduce((n, d) => n + d.reviews.filter((r) => r.status !== "pending").length, 0);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 抽取审校</title><style>
body{margin:0;background:#f6f3ec;color:#302f29;font:15px/1.7 -apple-system,"PingFang SC","Noto Sans SC",sans-serif}
main{max-width:1000px;margin:0 auto;padding:32px 20px 64px}
h1{font:600 26px/1.3 "Songti SC","Noto Serif SC",serif;margin:0 0 4px}
.meta{color:#68675e;margin:0 0 20px}
ul.legend{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px 18px;margin:0 0 28px}
.sw{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:6px;vertical-align:-1px;border:1px solid #0002}
section{background:#fffef9;border:1px solid #d8d5c9;border-radius:6px;padding:20px 24px;margin:0 0 24px}
h2{font:600 18px/1.4 "Songti SC","Noto Serif SC",serif;margin:0 0 12px}
.doc{white-space:pre-wrap;font-family:"Songti SC","Noto Serif SC",serif;font-size:16px;line-height:2;margin-bottom:16px}
mark{border-radius:2px;padding:1px 0;color:inherit}
mark.pending{outline:1px dashed #8a7b52}
sup{font:600 9px/1 ui-monospace,monospace;margin-left:1px;color:#5b5440}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;border-top:1px solid #e3e0d5;padding:6px 8px;vertical-align:top}
th{color:#68675e;font-weight:500}
tr.rejected td{color:#968f80;text-decoration:line-through}
.was{color:#7d776b;font-size:12px}
@media (max-width:640px){section{padding:16px}table{display:block;overflow-x:auto}}
</style></head><body><main><h1>${esc(title)}</h1><p class="meta">${p.documents.length} 份资料 · ${total} 条记录 · 已复核 ${reviewed} 条 · 导出于 ${esc(new Date().toISOString().slice(0, 16).replace("T", " "))} UTC。虚线框为待复核，删除线为已驳回（不在原文中高亮）。</p><ul class="legend">${legend}</ul>${docs}</main></body></html>`;
}
