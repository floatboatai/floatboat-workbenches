// ABOUTME: 右侧检查器：节点详情（类型、社区、来源、摘要、按关系分组的邻居、路径起终点、审阅笔记）与原文定位视图。

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FileText, ArrowLeftRight, Flag, MapPin } from "lucide-react";
import { colorOf } from "../contracts/analysis.ts";
import { communityOf, field, KIND_NAMES, label, lineOf, nodeKind, RELATION_NAMES, type Link } from "../contracts/graph.ts";
import { loadText } from "./data.ts";
import type { Desk } from "./useGraphDesk.ts";

export function Inspector({ d }: { d: Desk }) {
  const { inspect, setInspect } = d;
  return (
    <aside className="inspector" aria-label="对象检查器">
      <div className="seg" role="tablist" aria-label="检查器">
        <button role="tab" aria-selected={inspect.tab === "detail"} onClick={() => setInspect((s) => ({ ...s, tab: "detail" }))}>
          详情
        </button>
        <button role="tab" aria-selected={inspect.tab === "source"} disabled={!inspect.file} onClick={() => setInspect((s) => ({ ...s, tab: "source" }))}>
          原文{inspect.file ? ` · ${inspect.file.split("/").pop()}` : ""}
        </button>
      </div>
      {inspect.tab === "source" && inspect.file ? <SourceView d={d} /> : <Detail d={d} />}
    </aside>
  );
}

function Detail({ d }: { d: Desk }) {
  const n = d.selected;
  const groups = useMemo(() => {
    if (!n) return [];
    const out = new Map<string, { link: Link; other: string; outgoing: boolean }[]>();
    for (const l of d.shown.links) {
      if (l.source !== n.id && l.target !== n.id) continue;
      const outgoing = l.source === n.id;
      const key = `${outgoing ? "→" : "←"}${String(l.relation ?? "related")}`;
      out.set(key, [...(out.get(key) ?? []), { link: l, other: outgoing ? l.target : l.source, outgoing }]);
    }
    return [...out.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [n, d.shown]);
  if (!n)
    return (
      <div className="detail-empty">
        <p>在地图上点选节点，或在左侧社区、搜索结果中选择，查看它的来源、关系与笔记。</p>
        {d.orphanNotes.length ? <OrphanNotes d={d} /> : null}
      </div>
    );
  const kind = nodeKind(n);
  const c = communityOf(n);
  const file = field(n, "source_file");
  const lines = lineOf(n);
  const inCorpus = d.p.data.corpus.some((f) => f.path === file);
  return (
    <div className="detail">
      <div className="object-title">
        <span className="kind-tag">{KIND_NAMES[kind] ?? kind}</span>
        <h2>{label(n)}</h2>
        <button className="community-chip" onClick={() => c !== null && d.soloCommunity(c)} disabled={c === null}>
          <span className="swatch" style={{ background: colorOf(c) }} aria-hidden="true" />
          {d.communityName(c)}
        </button>
      </div>
      {field(n, "summary") ? <p className="summary">{field(n, "summary")}</p> : null}
      <dl className="facts">
        <dt>来源</dt>
        <dd>
          {file ? (
            <button className="link" disabled={!inCorpus} onClick={() => d.openSource(n)} title={inCorpus ? "打开原文并定位" : "资料集中没有这份原文"}>
              <FileText size={13} aria-hidden="true" />
              <code>
                {file}
                {lines ? `:${lines[0]}${lines[1] > lines[0] ? `–${lines[1]}` : ""}` : ""}
              </code>
            </button>
          ) : (
            "外部或导入对象"
          )}
        </dd>
        <dt>编号</dt>
        <dd>
          <code>{n.id}</code>
        </dd>
        {field(n, "_origin") ? (
          <>
            <dt>抽取</dt>
            <dd>{field(n, "_origin")}</dd>
          </>
        ) : null}
      </dl>
      <div className="path-buttons">
        <button onClick={() => d.p.setData((x) => ({ ...x, from: n.id }))} aria-pressed={d.p.data.from === n.id}>
          <MapPin size={13} aria-hidden="true" />
          设为起点
        </button>
        <button onClick={() => d.p.setData((x) => ({ ...x, to: n.id }))} aria-pressed={d.p.data.to === n.id}>
          <Flag size={13} aria-hidden="true" />
          设为终点
        </button>
      </div>
      <label className="note-label">
        审阅笔记
        <textarea
          id="node-note"
          name="note"
          maxLength={8000}
          rows={4}
          value={d.p.data.notes[n.id] ?? ""}
          placeholder="记录这个对象的职责、疑问和下一步…"
          onChange={(e) => {
            const value = e.target.value;
            d.p.setData((x) => ({ ...x, notes: { ...x.notes, [n.id]: value } }));
          }}
        />
      </label>
      <div className="relations">
        <h3>
          关系 <b>{groups.reduce((s, g) => s + g[1].length, 0)}</b>
        </h3>
        {groups.map(([key, items]) => (
          <section key={key}>
            <h4>
              {key.startsWith("→") ? "" : "被"}
              {RELATION_NAMES[key.slice(1)] ?? key.slice(1)} <small>{items.length}</small>
            </h4>
            <ul>
              {items.slice(0, 60).map(({ link, other }, i) => {
                const o = d.byId.get(other);
                return (
                  <li key={i}>
                    <button onClick={() => d.select(other)}>
                      <span className="swatch" style={{ background: colorOf(communityOf(o)) }} aria-hidden="true" />
                      <span className="rel-label">{label(o)}</span>
                      <small className={`conf ${String(link.confidence ?? "EXTRACTED").toLowerCase()}`}>
                        {link.confidence === "INFERRED" ? "推断" : link.confidence === "AMBIGUOUS" ? "存疑" : "原文"}
                        {link.weight && Number(link.weight) > 1 ? ` ×${link.weight}` : ""}
                      </small>
                    </button>
                    {field(link, "source_location") && field(link, "source_file") && d.p.data.corpus.some((f) => f.path === field(link, "source_file")) ? (
                      <button
                        className="icon"
                        aria-label={`查看这条关系在 ${field(link, "source_file")} 的位置`}
                        onClick={() => d.openFileAt(field(link, "source_file"), Number(field(link, "source_location").slice(1)) || 1)}
                      >
                        <ArrowLeftRight size={12} aria-hidden="true" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {d.orphanNotes.length ? <OrphanNotes d={d} /> : null}
    </div>
  );
}

function OrphanNotes({ d }: { d: Desk }) {
  return (
    <details className="orphans">
      <summary>{d.orphanNotes.length} 条笔记的节点已不在当前图谱</summary>
      <ul>
        {d.orphanNotes.map((id) => (
          <li key={id}>
            <code>{id}</code>
            <p>{d.p.data.notes[id]}</p>
            <button
              onClick={() =>
                d.p.setData((x) => {
                  const notes = { ...x.notes };
                  delete notes[id];
                  return { ...x, notes };
                })
              }
            >
              删除这条笔记
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

const SourceLines = memo(function SourceLines({ text, line, end, marks }: { text: string; line: number; end: number; marks: string[] }) {
  const lines = useMemo(() => text.replace(/\r\n?/g, "\n").split("\n"), [text]);
  const re = useMemo(() => {
    const parts = marks.filter((m) => m.length >= 2).map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return parts.length ? new RegExp(`(${parts.join("|")})`, "g") : null;
  }, [marks]);
  const shown = lines.length > 20000 ? lines.slice(Math.max(0, line - 5000), line + 5000) : lines;
  const offset = lines.length > 20000 ? Math.max(0, line - 5000) : 0;
  return (
    <ol className="source-lines" start={offset + 1} style={{ counterReset: `ln ${offset}` }}>
      {shown.map((t, i) => {
        const n = offset + i + 1;
        const on = n >= line && n <= end;
        return (
          <li key={n} id={`src-line-${n}`} className={on ? "hit" : undefined} aria-current={n === line ? "location" : undefined}>
            <span>{re && on ? t.split(re).map((part, k) => (k % 2 ? <mark key={k}>{part}</mark> : part)) : t || " "}</span>
          </li>
        );
      })}
    </ol>
  );
});

function SourceView({ d }: { d: Desk }) {
  const { file, line, end } = d.inspect;
  const entry = d.p.data.corpus.find((f) => f.path === file);
  const [state, setState] = useState<{ hash: string; text: string | null; error: string }>({ hash: "", text: null, error: "" });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!entry) return;
    let live = true;
    setState((s) => (s.hash === entry.hash ? s : { hash: entry.hash, text: null, error: "" }));
    loadText(entry.hash).then(
      (text) => live && setState({ hash: entry.hash, text, error: "" }),
      (e) => live && setState({ hash: entry.hash, text: null, error: e instanceof Error ? e.message : "原文读取失败" }),
    );
    return () => {
      live = false;
    };
  }, [entry?.hash]);
  useEffect(() => {
    if (state.text === null) return;
    const el = box.current?.querySelector(`#src-line-${line}`);
    if (el instanceof HTMLElement) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  }, [state.text, line, file]);
  const n = d.selected;
  const marks = n ? [label(n).replace(/^\./, "").replace(/\(\)$/, "")] : [];
  // 当前文件中定义的节点，方便在原文与图谱之间来回
  const defined = useMemo(
    () => d.shown.nodes.filter((x) => field(x, "source_file") === file && nodeKind(x) !== "file").slice(0, 200),
    [d.shown, file],
  );
  if (!entry) return <p className="muted pad">资料集中没有 {file}。</p>;
  return (
    <div className="source-view">
      <div className="source-head">
        <code title={file}>{file}</code>
        <small>
          {entry.lines} 行 · {entry.language}
          {line > 1 ? ` · 第 ${line}${end > line ? `–${end}` : ""} 行` : ""}
        </small>
      </div>
      {defined.length ? (
        <label className="jump">
          <span className="sr-only">跳到本文件中的节点</span>
          <select
            name="jump"
            value=""
            onChange={(e) => {
              const target = d.byId.get(e.target.value);
              if (target) {
                d.select(target.id);
                d.openSource(target);
              }
            }}
          >
            <option value="">本文件中的 {defined.length} 个节点…</option>
            {defined.map((x) => (
              <option key={x.id} value={x.id}>
                {field(x, "source_location").replace(/^L/, "").padStart(4, " ")} · {label(x)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="source-scroll" ref={box} tabIndex={0} aria-label={`${file} 原文`}>
        {state.error ? (
          <p role="alert" className="pad">
            {state.error}
          </p>
        ) : state.text === null ? (
          <p className="muted pad" role="status">
            正在读取原文…
          </p>
        ) : (
          <SourceLines text={state.text} line={line} end={end} marks={marks} />
        )}
      </div>
    </div>
  );
}
