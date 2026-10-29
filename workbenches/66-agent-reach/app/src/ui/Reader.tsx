// ABOUTME: 原文阅读：来源头部、摘录选中文字、审阅状态、保留的采集正文与来源判断笔记。

import { ExternalLink, Quote, Trash2, FileJson } from "lucide-react";
import { channelLabel } from "../contracts/channels.ts";
import { STATES } from "./SourceList.tsx";
import type { Desk } from "./useResearchDesk.ts";
import type { Clip } from "../contracts/research.ts";
import { memo, type ReactNode } from "react";

/** Source text with each saved excerpt highlighted at its first occurrence. */
const Marked = memo(function Marked({ text, clips }: { text: string; clips: Clip[] }) {
  const ranges = clips
    .map((c) => ({ id: c.id, start: text.indexOf(c.text), length: c.text.length }))
    .filter((r) => r.start >= 0)
    .sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    if (r.start > pos) out.push(text.slice(pos, r.start));
    out.push(
      <mark key={r.id} id={"mark-" + r.id}>
        {text.slice(r.start, r.start + r.length)}
      </mark>,
    );
    pos = r.start + r.length;
  }
  out.push(text.slice(pos));
  return <>{out}</>;
});

const timeFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" });
const published = (v: string | null) => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(t)) : v;
};

export function Reader({ d }: { d: Desk }) {
  const { selected, item, capture } = d;
  if (!selected || !item || !capture)
    return (
      <section className="reader empty-reader" aria-label="原文阅读">
        <Quote size={26} aria-hidden="true" />
        <h2>选一条来源开始阅读</h2>
        <p>收藏的来源保留采集时的原文。选中正文中的句子即可摘录为证据，摘录与你的判断分开保存。</p>
      </section>
    );
  const truncated = typeof item.raw === "object" && item.raw !== null && (item.raw as Record<string, unknown>).truncated === true;
  return (
    <article className="reader" aria-labelledby="reader-title">
      <header className="reader-head">
        <p className="kicker">
          {channelLabel(capture.envelope.channel)} / {capture.envelope.backend ?? "原生结果"} · 采集于{" "}
          {timeFormat.format(new Date(capture.at))}
        </p>
        <h2 id="reader-title">{item.title ?? item.url ?? "未命名来源"}</h2>
        <p className="byline">
          {[item.author, published(item.published_at)].filter(Boolean).join(" · ") || "未提供作者与日期"}
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              打开原链接
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null}
        </p>
      </header>
      <div className="reader-tools" role="toolbar" aria-label="来源操作">
        <button
          className="primary"
          onMouseDown={(e) => e.preventDefault()}
          onClick={d.quoteSelection}
        >
          <Quote size={14} aria-hidden="true" />
          摘录选中文字
        </button>
        <div className="segmented status" role="group" aria-label="审阅状态">
          {(Object.keys(STATES) as Array<keyof typeof STATES>).map((k) => (
            <button
              key={k}
                            aria-pressed={selected.status === k}
              className={k}
              onClick={() => d.updateSource({ status: k })}
            >
              {STATES[k]}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button className="icon" aria-label="导出这条来源的原生结果" title="导出原生结果" onClick={() => d.exportNative(capture)}>
          <FileJson size={15} aria-hidden="true" />
        </button>
        <button className="icon danger" aria-label="移除这条来源" title="移除来源" onClick={d.removeSource}>
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
      <pre className="source-body" ref={d.body} tabIndex={0} aria-label="来源正文">
        {item.text ? <Marked text={item.text} clips={selected.clips} /> : "该条目没有提供正文，可打开原链接查看。"}
      </pre>
      {truncated ? <p className="muted note-line">正文较长，已保留前 80,000 字符；完整内容请打开原链接。</p> : null}
      <label className="source-note">
        <span>对这条来源的判断</span>
        <textarea
          id="source-note"
          name="sourceNote"
          maxLength={5000}
          placeholder="可靠性、适用范围、与其它来源是否一致、还要核对什么…"
          value={selected.note}
          onChange={(e) => d.updateSource({ note: e.target.value })}
        />
      </label>
    </article>
  );
}
