import { useState } from "react";
import type { useObservation } from "./useObservation.ts";
import type { analyze } from "../contracts/observation.ts";
type Report = ReturnType<typeof analyze>;
export function ObservationBand({
  report,
  rangeLabel,
}: {
  report: Report;
  rangeLabel: string;
}) {
  return (
    <>
      <section className="observation-band" aria-label="当前范围统计">
        <div className="scope-stamp">
          <small>{rangeLabel}</small>
          <strong>
            {report.logs.length}
            <span>观测请求</span>
          </strong>
        </div>
        <div className="metrics">
          <p>
            <strong>{report.ai.length}</strong>
            <span>AI UA声明请求</span>
          </p>
          <p>
            <strong>{report.errors}</strong>
            <span>HTTP错误</span>
          </p>
          <p>
            <strong>
              {report.pages.length
                ? `${report.visited} / ${report.pages.length}`
                : "—"}
            </strong>
            <span>清单页面观察到AI访问</span>
          </p>
          <p>
            <strong>{report.referrals.length}</strong>
            <span>AI引荐声明请求</span>
          </p>
        </div>
        <div className="activity">
          <small>按统计时区的请求分布</small>
          {report.daily.length ? (
            <svg
              viewBox="0 0 300 48"
              role="img"
              aria-label={report.daily
                .map((d) => `${d.day} ${d.count}次`)
                .join("，")}
            >
              {report.daily.map((d, i) => {
                const w = 280 / report.daily.length,
                  h =
                    (d.count / Math.max(...report.daily.map((x) => x.count))) *
                    38;
                return (
                  <g key={d.day}>
                    <rect
                      x={10 + i * w}
                      y={44 - h}
                      width={Math.max(2, w - 4)}
                      height={h}
                      fill="currentColor"
                    />
                    <title>
                      {d.day}：{d.count} 次
                    </title>
                  </g>
                );
              })}
            </svg>
          ) : (
            <p>没有匹配的请求</p>
          )}
        </div>
      </section>
      <p className="evidence-caption">
        UA和引荐来源是日志中的声明，未进行IP/DNS身份验证。观察到访问不等于被收录、训练或答案引用。
      </p>
    </>
  );
}
export function Ledger({
  desk,
  report,
}: {
  desk: ReturnType<typeof useObservation>;
  report: Report;
}) {
  const { p } = desk;
  const [page, setPage] = useState(1);
  const rows = report
    ? desk.view === "coverage"
      ? report.pages
      : desk.view === "referrals"
        ? report.referrals
        : report.logs
    : [];
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * 25;
  return (
    <section id="ledger" className="ledger">
      <div className="ledger-toolbar">
        <nav aria-label="观察视图">
          {[
            ["coverage", "内容覆盖"],
            ["requests", "请求账本"],
            ["referrals", "AI引荐"],
          ].map(([view, label]) => (
            <button
              key={view}
              aria-pressed={desk.view === view}
              onClick={() => {
                desk.setView(view);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div>
          <button onClick={desk.exportCsv}>导出当前 CSV</button>
          <button onClick={desk.exportReport}>导出审阅报告</button>
        </div>
      </div>
      <div className="table-scroll">
        {desk.view === "coverage" ? (
          <table>
            <thead>
              <tr>
                <th>页面 / 内容</th>
                <th>优先级</th>
                <th>AI UA请求</th>
                <th>HTTP错误</th>
                <th>最近观察</th>
                <th>处理状态</th>
              </tr>
            </thead>
            <tbody>
              {report.pages.slice(start, start + 25).map((r) => (
                <tr key={r.path} className={r.hits ? "" : "not-observed"}>
                  <td>
                    <button
                      className="path-link"
                      onClick={() => desk.setSelected(r.path)}
                    >
                      {r.path}
                    </button>
                    <small>{r.title}</small>
                  </td>
                  <td>
                    <span
                      className={r.priority === "high" ? "priority" : "muted"}
                    >
                      {r.priority === "high" ? "重要" : "普通"}
                    </span>
                  </td>
                  <td>
                    <strong>{r.hits}</strong>
                    {!r.hits ? <small>未观察到</small> : null}
                  </td>
                  <td className={r.errors ? "bad" : ""}>{r.errors}</td>
                  <td>
                    {r.last
                      ? new Intl.DateTimeFormat("zh-CN", {
                          timeZone: p.data.timezone,
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(r.last))
                      : "—"}
                  </td>
                  <td>
                    {r.note?.state === "done"
                      ? "已处理"
                      : r.note?.state === "doing"
                        ? "处理中"
                        : "待核对"}
                    <small>{r.note?.owner ?? ""}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>路径</th>
                <th>HTTP</th>
                <th>
                  {desk.view === "referrals" ? "AI引荐声明" : "UA声明来源"}
                </th>
                <th>用途</th>
                <th>响应字节</th>
              </tr>
            </thead>
            <tbody>
              {(desk.view === "referrals" ? report.referrals : report.logs)
                .slice(start, start + 25)
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      {new Intl.DateTimeFormat("zh-CN", {
                        timeZone: p.data.timezone,
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(r.time))}
                    </td>
                    <td>
                      <button
                        className="path-link"
                        onClick={() => desk.setSelected(r.path)}
                      >
                        {r.path}
                      </button>
                      <small>{r.method}</small>
                    </td>
                    <td>
                      <span className={r.status >= 400 ? "http bad" : "http"}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {desk.view === "referrals" ? r.referral : r.bot.name}
                      <small>{r.bot.vendor || "未识别"}</small>
                    </td>
                    <td>{r.bot.type}</td>
                    <td>{new Intl.NumberFormat("zh-CN").format(r.bytes)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
      {!rows.length ? (
        <div className="empty">
          {desk.view === "coverage"
            ? "尚无内容清单。导入站点地图或页面列表后，才能核对覆盖。"
            : "当前范围没有观察记录。调整筛选或导入日志。"}
        </div>
      ) : null}
      <div className="pager">
        <span>
          {rows.length} 条 · 第 {currentPage} / {pages} 页
        </span>
        <div>
          <button
            aria-label="上一页"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ←
          </button>
          <button
            aria-label="下一页"
            disabled={currentPage >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
