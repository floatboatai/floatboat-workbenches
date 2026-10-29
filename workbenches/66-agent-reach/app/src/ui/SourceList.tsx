// ABOUTME: 资料目录：按审阅状态筛选的来源列表，显示域名、渠道、摘录数与审阅状态。

import { sourceItem } from "../contracts/research.ts";
import { channelLabel } from "../contracts/channels.ts";
import type { Desk } from "./useResearchDesk.ts";

export const STATES = { unreviewed: "未核对", verified: "已核对", followup: "待跟进" } as const;
const FILTERS: Array<[string, string]> = [
  ["all", "全部"],
  ["unreviewed", "未核对"],
  ["followup", "待跟进"],
  ["verified", "已核对"],
];
const host = (url: string | null) => {
  if (!url) return "无链接";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function SourceList({ d }: { d: Desk }) {
  const { p } = d;
  const rows = p.data.sources.filter((s) => d.filter === "all" || s.status === d.filter);
  const count = (k: string) => (k === "all" ? p.data.sources.length : p.data.sources.filter((s) => s.status === k).length);
  return (
    <section className="library" aria-labelledby="library-title">
      <header>
        <h2 id="library-title">资料目录</h2>
        <span className="count">{p.data.sources.length} 条</span>
      </header>
      <div className="filters" role="group" aria-label="按审阅状态筛选">
        {FILTERS.map(([value, text]) => (
          <button
            key={value}
            aria-pressed={d.filter === value}
            onClick={() => d.setFilter(value)}
          >
            {text} <span>{count(value)}</span>
          </button>
        ))}
      </div>
      <ul className="source-list">
        {rows.map((s) => {
          const item = sourceItem(p.data, s),
            capture = p.data.captures.find((c) => c.id === s.captureId)!;
          return (
            <li key={s.id}>
              <button
                aria-current={p.data.selected === s.id ? "true" : undefined}
                onClick={() => d.select(s.id)}
              >
                <span className={`dot ${s.status}`} aria-hidden="true" />
                <span className="source-main">
                  <strong>{item.title ?? item.url ?? "未命名来源"}</strong>
                  <small>
                    {host(item.url)} · {channelLabel(capture.envelope.channel)}
                  </small>
                </span>
                <span className="source-meta">
                  <span>{STATES[s.status]}</span>
                  {s.clips.length ? <span className="clips">{s.clips.length} 摘录</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!rows.length ? (
        <p className="empty">
          {p.data.sources.length
            ? "当前筛选下没有来源。"
            : "资料夹还是空的。在上方粘贴网页链接、GitHub 仓库或 V2EX 主题后点「采集」，结果会先进入收件区。"}
        </p>
      ) : null}
    </section>
  );
}
