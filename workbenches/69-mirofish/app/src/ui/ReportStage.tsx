// ABOUTME: 报告阶段：按运行生成规则报告、可选模型深化、Markdown 编辑与预览，导出 MD 与含图表的 HTML。
import { useState } from "react";
import { FileText, Sparkles, RefreshCw, Download } from "lucide-react";
import { Markdown } from "./Markdown";
import { download } from "./requests";
import { safeName, type Studio } from "./useStudio";

export function ReportStage({ st }: { st: Studio }) {
  const { p, s, mutable, activeRun, result } = st;
  const [confirm, setConfirm] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("preview");
  const r = s.report;
  const stale = Boolean(r.markdown && activeRun && r.runId !== activeRun.id);
  const generate = () => (r.markdown && r.source !== "rule" && !confirm ? setConfirm(true) : (setConfirm(false), st.ruleReport()));
  async function exportHtml() {
    if (stale) return p.setError("报告与当前运行不一致，请切回报告对应的运行，或按当前运行重新生成报告。");
    if (!result) return p.setError("结果尚未载入，无法嵌入图表。");
    try {
      const [{ renderToStaticMarkup }, charts] = await Promise.all([import("react-dom/server"), import("./charts")]);
      const body = renderToStaticMarkup(
        <article>
          <Markdown source={r.markdown} />
          <h2>附图</h2>
          <figure>
            <charts.ShareChart result={result} />
            <figcaption>舆情构成（支持/中立/反对占比，圆点为事件）</figcaption>
          </figure>
          <figure>
            <charts.MeanChart result={result} />
            <figcaption>平均立场（±标准差）与极化指数</figcaption>
          </figure>
          <figure>
            <charts.GroupChart result={result} />
            <figcaption>各类型平均立场</figcaption>
          </figure>
          <figure>
            <charts.Heatmap result={result} />
            <figcaption>智能体立场热力条</figcaption>
          </figure>
        </article>,
      );
      const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(p.title)}</title><style>body{font:15px/1.7 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#20292c;max-width:860px;margin:40px auto;padding:0 20px}h1{font-size:26px}h2{margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:4px 8px;text-align:left}blockquote{color:#555;border-left:3px solid #2b7a84;margin:0;padding:2px 12px;background:#f5f3ec}svg{width:100%;height:auto}figure{margin:20px 0}figcaption{color:#6c6a62;font-size:13px}code{background:#f0ede4;padding:0 4px}</style></head><body>${body}</body></html>`;
      download(new Blob([html], { type: "text/html" }), safeName(p.title) + "-报告.html");
    } catch (e) {
      p.report(e);
    }
  }
  return (
    <div className="report-layout">
      <section className="panel report-tools">
        <h2>报告</h2>
        <p className="muted">
          {activeRun ? `当前运行：${activeRun.label}` : "还没有运行。"}
          {r.markdown ? ` · 报告${r.source === "host" ? "由模型深化" : r.source === "rule" ? "按规则生成" : "已人工编辑"}${r.updatedAt ? "，" + new Date(r.updatedAt).toLocaleString("zh-CN", { hour12: false }) : ""}` : ""}
        </p>
        {stale ? <p className="warn">报告基于另一次运行，重新生成以对应当前运行。</p> : null}
        {confirm ? (
          <div className="confirm" role="group" aria-label="确认覆盖报告">
            <p>当前报告有人工或模型修改，重新生成会覆盖。可先导出备份。</p>
            <div className="row">
              <button className="primary" onClick={generate}>
                覆盖并生成
              </button>
              <button onClick={() => setConfirm(false)}>取消</button>
            </div>
          </div>
        ) : (
          <button className="primary" disabled={!mutable || !result} onClick={generate}>
            <FileText size={16} aria-hidden="true" />
            {r.markdown ? "按当前运行重新生成" : "按推演结果生成报告"}
          </button>
        )}
        {!result && activeRun ? <p className="muted">{st.resultError && st.resultError !== "loading" ? st.resultError : "正在载入运行结果…"}</p> : null}
        <div className="tool-block host">
          <h3>
            <Sparkles size={15} aria-hidden="true" />
            模型深化（可选）
          </h3>
          <p className="muted">把规则报告与逐轮指标发给 Floatboat 模型，补充原因分析与建议；数字以规则报告为准，确认后才替换。</p>
          <p className={"status-line " + (st.model.available ? "ok" : "off")} role="status">
            {st.model.available ? `模型可用：${st.model.model}` : "未连接 Floatboat：启动并登录客户端后重新检查。规则报告照常可用。"}
          </p>
          <div className="row">
            <button disabled={!mutable || !st.model.available || !r.markdown || !result || stale} onClick={() => void st.hostReport()}>
              用模型深化
            </button>
            <button className="ghost" onClick={() => void st.checkModel()}>
              <RefreshCw size={14} aria-hidden="true" />
              重新检查
            </button>
          </div>
        </div>
        {st.reportSuggestion ? (
          <div className="tool-block suggestion" role="region" aria-label="模型报告建议">
            <h3>模型稿 · {st.reportSuggestion.model}</h3>
            <div className="suggestion-preview">
              <Markdown source={st.reportSuggestion.markdown} />
            </div>
            <div className="row">
              <button className="primary" onClick={st.applyReport}>
                采用模型稿
              </button>
              <button onClick={() => st.discard("reportSuggestion")}>放弃</button>
            </div>
          </div>
        ) : null}
        <h3>导出</h3>
        <div className="col">
          <button disabled={!r.markdown} onClick={() => download(new Blob([r.markdown], { type: "text/markdown" }), safeName(p.title) + "-报告.md")}>
            <Download size={14} aria-hidden="true" />
            Markdown
          </button>
          <button disabled={!r.markdown || !result || stale} onClick={() => void exportHtml()}>
            <Download size={14} aria-hidden="true" />
            HTML（含图表）
          </button>
        </div>
        <label>
          研究者备注
          <textarea rows={4} value={s.notes} maxLength={20000} disabled={!mutable} onChange={(e) => p.setData((d) => ({ ...d, notes: e.target.value }))} />
        </label>
      </section>
      <section className="panel report-paper">
        <div className="tabs" role="tablist" aria-label="报告视图">
          <button role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")}>
            预览
          </button>
          <button role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")}>
            编辑 Markdown
          </button>
        </div>
        {!r.markdown ? (
          <div className="empty-state">
            <h2>还没有报告</h2>
            <p>完成推演后，按结果生成包含结论、转折、群体分化、关键角色、代表言论与局限的报告，再按需修改。</p>
          </div>
        ) : view === "edit" ? (
          <textarea aria-label="报告 Markdown" className="report-text" value={r.markdown} disabled={!mutable} spellCheck={false} onChange={(e) => p.setData((d) => ({ ...d, report: { ...d.report, markdown: e.target.value, source: "manual", updatedAt: new Date().toISOString() } }))} />
        ) : (
          <article className="paper">
            <Markdown source={r.markdown} />
          </article>
        )}
      </section>
    </div>
  );
}
const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
