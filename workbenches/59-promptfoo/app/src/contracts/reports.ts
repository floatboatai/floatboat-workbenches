// ABOUTME: 评测报告导出：逐单元格 CSV（含复核与基线差异）与自包含 HTML 发布报告。
import { testTitle } from "./config.ts";
import { columnStats, diffCell, isBaselineColumn, pct, recommend, type Baseline, type Gate } from "./compare.ts";
import { releaseKey, reviewKey, type Release, type Review } from "./evaluation.ts";
import type { RunView } from "./results.ts";

export interface ReportInput {
  title: string;
  runId: string;
  runName: string;
  run: RunView;
  baseline: Baseline;
  baselineRun: RunView | null;
  baselineName: string;
  reviews: Record<string, Review>;
  releases: Record<string, Release>;
  gate: Gate;
}
const decisionText: Record<string, string> = { pending: "待复核", accept: "接受", reject: "需修改" };
const releaseText: Record<string, string> = { pending: "待定", ship: "可发布", hold: "暂缓", block: "阻止" };
const stateText: Record<string, string> = {
  regressed: "退步",
  fixed: "修复",
  "same-pass": "保持通过",
  "same-fail": "仍失败",
  new: "无基线",
  baseline: "基线列",
};
const csvCell = (v: unknown) =>
  '"' +
  String(v ?? "")
    .replace(/^[\t\r\n ]*[=+@-]/, "'$&")
    .replaceAll('"', '""') +
  '"';

export function reportCsv(input: ReportInput): string {
  const { run } = input;
  const rows: unknown[][] = [
    ["用例", "说明", "提示版本", "Provider", "结果", "分数", "耗时毫秒", "成本", "对比基线", "失败原因", "人工判断", "复核意见", "实际输出"],
  ];
  for (const t of run.tests)
    for (const col of run.columns) {
      const cell = run.byKey.get(`${t.key}|${col.key}`);
      if (!cell) continue;
      const d = diffCell(run, cell, input.baseline, input.baselineRun);
      const r = input.reviews[reviewKey(input.runId, cell.key)];
      rows.push([
        t.index + 1,
        testTitle(t, t.index),
        col.prompt,
        col.provider,
        cell.pass ? "通过" : cell.error ? "错误" : "失败",
        cell.score ?? "",
        cell.latency ?? "",
        cell.cost ?? "",
        stateText[d.state],
        cell.pass ? "" : cell.reason,
        decisionText[r?.decision ?? "pending"],
        r?.note ?? "",
        cell.output,
      ]);
    }
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (v: number | null, digits = 0, suffix = "") =>
  v === null ? "—" : `${v.toLocaleString("zh-CN", { maximumFractionDigits: digits })}${suffix}`;

export function reportHtml(input: ReportInput): string {
  const { run } = input;
  const stats = columnStats(run, input.baseline, input.baselineRun);
  const head = stats
    .map((s) => {
      const isBase = isBaselineColumn(run, s.column, input.baseline);
      const rec = recommend(s, input.gate, isBase);
      const human = input.releases[releaseKey(input.runId, s.column.key)];
      return `<tr><th scope="row">${esc(s.column.prompt)}<small>${esc(s.column.provider)}</small></th><td>${s.pass}/${s.total}<small>${pct(s.passRate)}</small></td><td>${s.compared ? `${s.regressions} 退步 · ${s.fixes} 修复` : "—"}</td><td>${num(s.latencyP50, 0, " ms")}</td><td>${s.cost === null ? "—" : "$" + s.cost.toFixed(4)}</td><td class="v-${rec.verdict}">${esc(rec.verdict === "baseline" ? "基线" : releaseText[rec.verdict === "ship" ? "ship" : rec.verdict])}<small>${esc(rec.reasons.join("；"))}</small></td><td class="v-${human?.decision ?? "pending"}">${esc(releaseText[human?.decision ?? "pending"])}${human?.note ? `<small>${esc(human.note)}</small>` : ""}</td></tr>`;
    })
    .join("");
  const matrix = run.tests
    .map((t) => {
      const cells = run.columns
        .map((col) => {
          const c = run.byKey.get(`${t.key}|${col.key}`);
          if (!c) return `<td class="na">—</td>`;
          const d = diffCell(run, c, input.baseline, input.baselineRun);
          const r = input.reviews[reviewKey(input.runId, c.key)];
          return `<td class="${c.pass ? "pass" : c.error ? "err" : "fail"}${d.state === "regressed" ? " reg" : ""}"><b>${c.pass ? "通过" : c.error ? "错误" : "失败"}</b>${d.state === "regressed" ? " · 退步" : d.state === "fixed" ? " · 修复" : ""}${r && r.decision !== "pending" ? ` · ${decisionText[r.decision]}` : ""}<small>${num(c.score, 2)} 分 · ${num(c.latency, 0, " ms")}</small></td>`;
        })
        .join("");
      return `<tr><th scope="row">${t.index + 1}. ${esc(testTitle(t, t.index))}</th>${cells}</tr>`;
    })
    .join("");
  const failures = run.cells
    .filter((c) => !c.pass)
    .slice(0, 400)
    .map((c) => {
      const t = run.tests.find((x) => x.index === c.test)!;
      const col = run.columns.find((x) => x.index === c.column)!;
      const r = input.reviews[reviewKey(input.runId, c.key)];
      const failed = c.components.filter((x) => !x.pass && !x.skipped);
      return `<article><h3>${t.index + 1}. ${esc(testTitle(t, t.index))} <span>${esc(col.prompt)} · ${esc(col.provider)}</span></h3><ul>${(failed.length ? failed : [{ type: "error", reason: c.reason }]).map((x) => `<li><code>${esc(x.type)}</code> ${esc(x.reason)}</li>`).join("")}</ul><pre>${esc(c.output.slice(0, 4000))}</pre>${r?.note ? `<p class="note">复核：${esc(decisionText[r.decision])} · ${esc(r.note)}</p>` : ""}</article>`;
    })
    .join("");
  const generated = new Date().toLocaleString("zh-CN");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.title)} · 评测报告</title><style>
body{font:14px/1.55 -apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:#20221d;background:#f6f5ef;margin:0;padding:32px}
main{max-width:1200px;margin:auto}h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 10px}
.meta{color:#66685f}table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d9d8cf}
th,td{border-bottom:1px solid #e6e5dd;padding:8px 10px;text-align:left;vertical-align:top}th small,td small{display:block;color:#73756b;font-weight:400;font-size:12px}
thead th{background:#eceae1;font-size:12px}.wrap{overflow-x:auto}td.pass{background:#eef5ea}td.fail{background:#fbecea}td.err{background:#f6eedc}td.reg{box-shadow:inset 3px 0 #b4442f}
.v-ship{color:#3d6b2f}.v-hold{color:#8a6216}.v-block{color:#a33b2b}.v-baseline{color:#555}article{background:#fff;border:1px solid #e0dfd6;padding:12px 16px;margin:10px 0}
article h3{font-size:14px;margin:0}article h3 span{color:#73756b;font-weight:400}pre{white-space:pre-wrap;background:#f3f2ec;padding:10px;font:12px/1.5 ui-monospace,Menlo,monospace;max-height:260px;overflow:auto}
code{background:#eceae1;padding:0 4px}.note{color:#3f4a63}</style></head><body><main>
<h1>${esc(input.title)}</h1><p class="meta">运行：${esc(input.runName)}${run.timestamp ? ` · ${esc(new Date(run.timestamp).toLocaleString("zh-CN"))}` : ""} · 对照：${esc(input.baselineName)} · 门槛：通过率 ≥ ${pct(input.gate.minPassRate)}，允许退步 ${input.gate.maxRegressions} 项 · 生成于 ${esc(generated)}</p>
<h2>逐项发布判断</h2><div class="wrap"><table><thead><tr><th>提示版本 · Provider</th><th>通过</th><th>对比基线</th><th>P50 耗时</th><th>成本</th><th>门槛建议</th><th>人工判断</th></tr></thead><tbody>${head}</tbody></table></div>
<h2>用例 × 提示版本矩阵</h2><div class="wrap"><table><thead><tr><th>用例</th>${run.columns.map((c) => `<th>${esc(c.prompt)}<small>${esc(c.provider)}</small></th>`).join("")}</tr></thead><tbody>${matrix}</tbody></table></div>
<h2>未通过明细（${run.cells.filter((c) => !c.pass).length}）</h2>${failures || "<p>全部通过。</p>"}
</main></body></html>`;
}
