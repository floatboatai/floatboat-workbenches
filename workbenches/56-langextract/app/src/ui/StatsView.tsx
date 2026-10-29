import { useMemo } from "react";
import { classStats, recordSpan, type EvidenceProject } from "../contracts/evidence";

const nf = new Intl.NumberFormat("zh-CN");
export function StatsView({
  data,
  colorOf,
  openClass,
  openDoc,
}: {
  data: EvidenceProject;
  colorOf: (cls: string) => string;
  openClass: (cls: string) => void;
  openDoc: (i: number) => void;
}) {
  const stats = useMemo(() => classStats(data), [data]);
  const totals = stats.reduce(
    (t, s) => ({
      total: t.total + s.total,
      pending: t.pending + s.pending,
      accepted: t.accepted + s.accepted,
      corrected: t.corrected + s.corrected,
      rejected: t.rejected + s.rejected,
      unaligned: t.unaligned + s.unaligned,
      manual: t.manual + s.manual,
    }),
    { total: 0, pending: 0, accepted: 0, corrected: 0, rejected: 0, unaligned: 0, manual: 0 },
  );
  const max = Math.max(1, ...stats.map((s) => s.total));
  return (
    <section className="stats-view">
      <header className="config-heading">
        <span className="eyebrow">BATCH LEDGER</span>
        <h2>类别统计</h2>
        <p>
          {data.documents.length} 份资料 · {nf.format(totals.total)} 条记录 · 已复核{" "}
          {nf.format(totals.total - totals.pending)} 条（
          {totals.total ? Math.round(((totals.total - totals.pending) / totals.total) * 100) : 0}%）· 未定位{" "}
          {nf.format(totals.unaligned)} 条 · 人工标注 {nf.format(totals.manual)} 条
        </p>
      </header>
      <div className="table-scroll">
        <table className="stats-table">
          <caption className="sr-only">按类别统计复核状态</caption>
          <thead>
            <tr>
              <th scope="col">类别</th>
              <th scope="col">分布</th>
              <th scope="col">记录</th>
              <th scope="col">待复核</th>
              <th scope="col">已接受</th>
              <th scope="col">已修订</th>
              <th scope="col">已驳回</th>
              <th scope="col">未定位</th>
              <th scope="col">资料数</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.name}>
                <th scope="row">
                  <button className="text-button class-link" onClick={() => openClass(s.name)} disabled={!s.total}>
                    <span className="swatch" style={{ background: colorOf(s.name) }} aria-hidden="true" />
                    {s.name}
                    {!s.defined && <span className="manual-tag">未定义</span>}
                  </button>
                </th>
                <td className="bar-cell">
                  <span className="stack" style={{ width: `${(s.total / max) * 100}%` }} aria-hidden="true">
                    <span className="seg accepted" style={{ flexGrow: s.accepted }} />
                    <span className="seg corrected" style={{ flexGrow: s.corrected }} />
                    <span className="seg pending" style={{ flexGrow: s.pending }} />
                    <span className="seg rejected" style={{ flexGrow: s.rejected }} />
                  </span>
                </td>
                <td>{s.total}</td>
                <td>{s.pending}</td>
                <td>{s.accepted}</td>
                <td>{s.corrected}</td>
                <td>{s.rejected}</td>
                <td className={s.unaligned ? "warn" : ""}>{s.unaligned}</td>
                <td>{s.documents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="legend-line" aria-hidden="true">
        <span className="seg-key accepted" />
        已接受 <span className="seg-key corrected" />
        已修订 <span className="seg-key pending" />
        待复核 <span className="seg-key rejected" />
        已驳回
      </p>
      <h3>逐份资料</h3>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">资料</th>
              <th scope="col">字符</th>
              <th scope="col">记录</th>
              <th scope="col">已复核</th>
              <th scope="col">未定位</th>
              <th scope="col">状态</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((d, i) => {
              const done = d.reviews.filter((r) => r.status !== "pending").length,
                lost = d.extractions.filter((_, k) => !recordSpan(d, k)).length;
              return (
                <tr key={d.id}>
                  <th scope="row">
                    <button className="text-button class-link" onClick={() => openDoc(i)}>
                      {d.id}
                    </button>
                  </th>
                  <td>{nf.format(Array.from(d.text).length)}</td>
                  <td>{d.extractions.length}</td>
                  <td>{done}</td>
                  <td className={lost ? "warn" : ""}>{lost}</td>
                  <td>{d.text !== d.originalText ? "原文已变更" : d.extractions.length && done === d.extractions.length ? "已复核完" : d.extractions.length ? "复核中" : "无记录"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
