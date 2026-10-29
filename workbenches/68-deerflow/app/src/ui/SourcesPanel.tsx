// ABOUTME: 来源证据栏：编号、出处、要点与核验；报告中的引用点击后定位并展开对应来源。
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { citationsIn, originLabels, safeUrl, type Source } from "../contracts/research";
import type { Desk } from "./useDesk";

type Filter = "all" | "cited" | "pending";

function SourceCard({ d, s, cited, stepTitle, focused }: { d: Desk; s: Source; cited: boolean; stepTitle: string; focused: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const { mutable } = d;
  const url = safeUrl(s.url);
  useEffect(() => {
    if (!focused) return;
    setOpen(true);
    ref.current?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    ref.current?.querySelector<HTMLElement>(".source-toggle")?.focus({ preventScroll: true });
  }, [focused]);
  let host = "";
  try {
    host = url ? new URL(url).hostname : "";
  } catch {
    host = "";
  }
  return (
    <li ref={ref} id={"source-" + s.cite} className={"source-card" + (focused ? " focused" : "") + (s.checked ? " checked" : "")}>
      <div className="source-top">
        <span className="cite-no">[{s.cite}]</span>
        <button className="source-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <strong>{s.title || "未命名来源"}</strong>
          <small>
            {originLabels[s.origin] ?? s.origin}
            {host ? " · " + host : ""}
            {stepTitle ? " · " + stepTitle : ""}
            {cited ? " · 已引用" : ""}
          </small>
        </button>
        <label className="check">
          <input type="checkbox" aria-label={`已核验 [${s.cite}]`} checked={s.checked} disabled={!mutable || !url} onChange={(e) => d.updateSource(s.id, { checked: e.target.checked })} />
          <span>{s.checked ? "已核验" : "核验"}</span>
        </label>
      </div>
      {!open && (s.note || s.excerpt) ? <p className="source-excerpt">{s.note || s.excerpt}</p> : null}
      {open ? (
        <div className="source-body">
          <label>
            <span>名称</span>
            <input name={"sourceTitle-" + s.cite} autoComplete="off" value={s.title} maxLength={300} disabled={!mutable} onChange={(e) => d.updateSource(s.id, { title: e.target.value })} />
          </label>
          <label>
            <span>网址</span>
            <div className="row">
              <input name={"sourceUrl-" + s.cite} type="url" autoComplete="off" spellCheck={false} value={s.url} disabled={!mutable} onChange={(e) => d.updateSource(s.id, { url: e.target.value })} />
              {url ? (
                <a className="icon" href={url} target="_blank" rel="noreferrer noopener" aria-label={`打开来源 [${s.cite}]`}>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </label>
          {!url ? <p className="step-error">请填写 http(s) 网址后才能核验。</p> : null}
          {s.excerpt ? (
            <blockquote>
              <span className="sr-only">要点：</span>
              {s.excerpt}
            </blockquote>
          ) : null}
          {s.text && s.text !== s.excerpt ? (
            <details>
              <summary>读取的正文（{s.text.length} 字）</summary>
              <pre>{s.text}</pre>
            </details>
          ) : null}
          <label>
            <span>核验备注</span>
            <textarea
              name={"sourceNote-" + s.cite}
              rows={2}
              maxLength={5000}
              placeholder="这条来源支持哪条结论、有何限制…"
              value={s.note}
              disabled={!mutable}
              onChange={(e) => d.updateSource(s.id, { note: e.target.value })}
            />
          </label>
          <div className="row">
            {s.fetchedAt ? <small className="muted">读取于 {new Date(s.fetchedAt).toLocaleString("zh-CN")}</small> : null}
            <button className="icon danger" aria-label={`移除来源 [${s.cite}]`} disabled={!mutable} onClick={() => d.removeSource(s.id)}>
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function SourcesPanel({ d }: { d: Desk }) {
  const data = d.p.data;
  const [filter, setFilter] = useState<Filter>("all");
  const cited = new Set(citationsIn(data.report));
  const focus = d.focusCite;
  useEffect(() => {
    if (focus) setFilter("all");
  }, [focus]);
  const list = [...data.sources]
    .sort((a, b) => a.cite - b.cite)
    .filter((s) => (filter === "cited" ? cited.has(s.cite) : filter === "pending" ? !s.checked : true));
  const checked = data.sources.filter((s) => s.checked).length;
  return (
    <aside className="sources-panel" aria-labelledby="sources-title">
      <header>
        <div>
          <h2 id="sources-title">来源</h2>
          <small>
            {data.sources.length} 项 · 已核验 {checked} · 被引用 {cited.size}
          </small>
        </div>
        <button className="icon" aria-label="手动添加来源" disabled={!d.mutable} onClick={() => d.addSource()}>
          <Plus size={15} aria-hidden="true" />
        </button>
      </header>
      <div className="segmented small" role="group" aria-label="来源筛选">
        {(
          [
            ["all", "全部"],
            ["cited", "被引用"],
            ["pending", "待核验"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      {list.length ? (
        <ol className="source-list">
          {list.map((s) => (
            <SourceCard
              key={s.id}
              d={d}
              s={s}
              cited={cited.has(s.cite)}
              stepTitle={data.plan.steps.find((x) => x.id === s.stepId)?.title ?? ""}
              focused={focus && focus.n === s.cite ? focus.at : 0}
            />
          ))}
        </ol>
      ) : (
        <p className="empty">{data.sources.length ? "没有符合筛选的来源。" : "执行检索后，来源会按编号出现在这里；也可以手动添加。"}</p>
      )}
    </aside>
  );
}
