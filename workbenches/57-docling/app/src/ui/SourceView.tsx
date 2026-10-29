// ABOUTME: 原文对照（Word/HTML/Markdown）：按原文件顺序重读原文片段，与结构项双向定位；原页几何不可用时代替原页框选。
import { useEffect, useMemo, useRef, useState } from "react";
import { allItems, type Document } from "../contracts/docling.ts";
import { alignSegments, convertLocal, type Segment } from "../contracts/convert/index.ts";
import type { SourceRef } from "../contracts/review.ts";
import { loadSource } from "./library.ts";
const normal = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const kinds: Record<Segment["kind"], string> = {
  title: "标题",
  heading: "章节",
  text: "段落",
  list: "列表",
  table: "表格",
  picture: "图片",
  code: "代码",
  furniture: "页眉页脚",
  caption: "题注",
};
export function SourceView({
  source,
  doc,
  active,
  onSelect,
}: {
  source: SourceRef;
  doc: Document;
  active: string;
  onSelect: (ref: string) => void;
}) {
  const [segments, setSegments] = useState<Segment[] | null>(null),
    [error, setError] = useState("");
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    setSegments(null);
    setError("");
    loadSource(source.id)
      .then((bytes) => {
        if (disposed) return;
        if (source.format !== "docx" && source.format !== "html" && source.format !== "md")
          throw new Error("此格式没有可对照的原文片段。");
        const local = convertLocal(source.format, bytes, source.name).segments;
        const byRef = new Map(allItems(doc).map((x) => [x.self_ref, x]));
        // Same reader, same text: keep direct refs; otherwise (e.g. Docling Serve output) align by text.
        const direct = local.every((s) => {
          const item = s.ref ? byRef.get(s.ref) : undefined;
          if (!s.ref) return true;
          if (!item) return false;
          const text = item.data ? item.data.table_cells.map((c) => c.text).join("") : String(item.text ?? "");
          return normal(text) === normal(s.rows ? s.rows.flat().join("") : s.text.replace(/^(•|\d+\.)\s/, ""));
        });
        setSegments(direct ? local : alignSegments(local, doc));
      })
      .catch((e: unknown) => {
        if (!disposed) setError(e instanceof Error ? e.message : "原文件暂时不可用。");
      });
    return () => {
      disposed = true;
    };
  }, [source.id, source.format, source.name, doc]);
  useEffect(() => {
    const el = host.current?.querySelector<HTMLElement>(`[data-ref="${CSS.escape(active)}"]`);
    if (!el || !host.current) return;
    const a = el.getBoundingClientRect(),
      b = host.current.getBoundingClientRect();
    if (a.top < b.top + 30 || a.bottom > b.bottom - 30)
      el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active, segments]);
  const linked = useMemo(() => segments?.filter((s) => s.ref).length ?? 0, [segments]);
  return (
    <div className="page-view">
      <div className="view-tools" role="toolbar" aria-label="原文工具">
        <span className="page-count">
          原文 · {source.name}
        </span>
        {segments ? (
          <span className="hint">
            {linked}/{segments.length} 段已对齐
          </span>
        ) : null}
      </div>
      <div ref={host} className="page-scroll">
        {error ? (
          <div className="page-missing" role="alert">
            <p>{error}</p>
          </div>
        ) : !segments ? (
          <p className="page-loading" role="status">正在读取原文…</p>
        ) : (
          <article className={"source-sheet " + source.format} aria-label="原文片段">
            {segments.map((s, i) => (
              <button
                key={i}
                type="button"
                data-ref={s.ref ?? undefined}
                className={"segment " + s.kind + (s.ref && s.ref === active ? " on" : "") + (s.ref ? "" : " unlinked")}
                disabled={!s.ref}
                onClick={() => s.ref && onSelect(s.ref)}
                aria-pressed={s.ref ? s.ref === active : undefined}
              >
                <span className="segment-meta">
                  {kinds[s.kind]}
                  {s.lines ? ` · 第 ${s.lines[0]}${s.lines[1] > s.lines[0] ? "–" + s.lines[1] : ""} 行` : ""}
                </span>
                {s.rows ? (
                  <span className="segment-table">
                    {s.rows.slice(0, 40).map((row, r) => (
                      <span key={r}>
                        {row.map((c, k) => (
                          <span key={k}>
                            {c}
                          </span>
                        ))}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="segment-text">{s.text}</span>
                )}
              </button>
            ))}
          </article>
        )}
      </div>
    </div>
  );
}
