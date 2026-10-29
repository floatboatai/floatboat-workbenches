// ABOUTME: 第 2 步「大纲」：逐页卡片（版式、标题、要点、左右栏、备注）可排序增删，右侧对照资料原文与生成说明；“生成幻灯片”为主操作，旁边是可选 Presenton 通道。
import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { parseBrief, sectionText } from "../contracts/brief";
import { slidesFromOutline } from "../contracts/generate";
import { LAYOUTS, LAYOUT_LABELS, LIMITS, newId, type LayoutId, type OutlineItem } from "../contracts/model";
import { isRecord } from "../contracts/project";
import type { Doc, Step } from "./App";
import { ConfirmBar } from "./ConfirmBar";
import { PresentonChip } from "./PresentonPanel";

export const toLines = (text: string) =>
  text
    .split("\n")
    .slice(0, LIMITS.points)
    .map((l) => l.slice(0, LIMITS.point));

function candidate(doc: Doc): { items: OutlineItem[]; model: string } | null {
  const c = doc.draft.modelCandidate;
  return isRecord(c) && Array.isArray(c.items) ? { items: c.items as OutlineItem[], model: typeof c.model === "string" ? c.model : "" } : null;
}

export function OutlineStep({ doc, go }: { doc: Doc; go: (s: Step) => void }) {
  const outline = doc.data.outline;
  const active = typeof doc.draft.activeItem === "string" && outline.some((o) => o.id === doc.draft.activeItem) ? doc.draft.activeItem : outline[0]?.id ?? "";
  const select = (id: string) => doc.setDraft((d) => ({ ...d, activeItem: id }));
  const [confirm, setConfirm] = useState<"" | "slides" | "candidate">("");
  const parsed = useMemo(() => parseBrief(doc.data.brief.source), [doc.data.brief.source]);
  const current = outline.find((o) => o.id === active);
  const excerpt = useMemo(() => {
    if (current?.layout === "cover" || current?.layout === "agenda")
      return [doc.data.brief.objective && `目标：${doc.data.brief.objective}`, doc.data.brief.audience && `听众：${doc.data.brief.audience}`, current.layout === "agenda" ? `章节：${parsed.sections.map((s) => s.title).join("、")}` : ""].filter(Boolean).join("\n");
    if (!current?.sourceRef) return "";
    const s = parsed.sections.find((x) => x.title === current.sourceRef);
    return s ? sectionText(s) : current.sourceRef === parsed.title ? parsed.intro.map((b) => ("text" in b ? b.text : "")).join("\n") : "";
  }, [current?.sourceRef, current?.layout, parsed, doc.data.brief.objective, doc.data.brief.audience]);
  const log = Array.isArray(doc.draft.generationLog) ? (doc.draft.generationLog as { section: string; note: string }[]) : [];
  const model = candidate(doc);
  const edit = (id: string, patch: Partial<OutlineItem>) => doc.setData((d) => ({ ...d, outline: d.outline.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  function move(i: number, by: number) {
    const to = i + by;
    if (to < 0 || to >= outline.length) return;
    doc.setData((d) => {
      const next = [...d.outline];
      [next[i], next[to]] = [next[to], next[i]];
      return { ...d, outline: next };
    });
  }
  function insert(after: number, copy?: OutlineItem) {
    if (outline.length >= LIMITS.slides) return doc.setError(`最多 ${LIMITS.slides} 页。`);
    const item: OutlineItem = copy
      ? { ...structuredClone(copy), id: newId("o") }
      : { id: newId("o"), layout: "bullets", title: "", points: [""], points2: [], columnTitles: ["", ""], chart: null, notes: "", sourceRef: "" };
    doc.setData((d) => ({ ...d, outline: [...d.outline.slice(0, after + 1), item, ...d.outline.slice(after + 1)] }));
    select(item.id);
  }
  function remove(i: number) {
    const id = outline[i].id;
    doc.setData((d) => ({ ...d, outline: d.outline.filter((o) => o.id !== id) }));
    doc.setNotice(`已删除第 ${i + 1} 页大纲。`);
  }
  function buildSlides() {
    if (!outline.length) return doc.setError("大纲为空，先在资料页生成或添加一页。");
    const slides = slidesFromOutline(outline, doc.data.brief);
    doc.setData((d) => ({ ...d, slides }));
    doc.setDraft((d) => ({ ...d, step: "deck", activeSlide: slides[0]?.id ?? "" }));
    doc.setNotice(`已按大纲生成 ${slides.length} 页幻灯片。可逐页修改，再导出 PPTX 或 PDF。`);
    setConfirm("");
    go("deck");
  }
  function adopt() {
    if (!model) return;
    doc.setData((d) => ({ ...d, outline: model.items }));
    doc.setDraft((d) => {
      const next = { ...d, activeItem: model.items[0]?.id ?? "", generationLog: [{ section: "Floatboat 模型", note: `${model.model || "模型"}起草 ${model.items.length} 页` }] };
      delete (next as Record<string, unknown>).modelCandidate;
      return next;
    });
    setConfirm("");
  }
  const discard = () =>
    doc.setDraft((d) => {
      const next = { ...d };
      delete next.modelCandidate;
      return next;
    });

  return (
    <div className="outline-step">
      <div className="step-bar">
        <div>
          <h1>大纲</h1>
          <p className="hint">{outline.length ? `${outline.length} 页 · 每页一个观点。改版式、改措辞、调顺序，再生成幻灯片。` : "还没有大纲。"}</p>
        </div>
        <div className="step-actions">
          <button type="button" className="ghost" onClick={() => go("brief")}>
            回到资料
          </button>
          <PresentonChip doc={doc} />
          {confirm === "slides" ? (
            <ConfirmBar message={`重新生成会替换现有 ${doc.data.slides.length} 页幻灯片及其上的修改。需要保留可先从文稿菜单导出项目。`} confirmLabel="替换并生成" onConfirm={buildSlides} onCancel={() => setConfirm("")} />
          ) : (
            <button type="button" className="primary" disabled={!outline.length} onClick={() => (doc.data.slides.length ? setConfirm("slides") : buildSlides())}>
              生成幻灯片
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {model && (
        <section className="candidate" aria-label="模型起草的大纲">
          <div>
            <strong>Floatboat 模型起草了 {model.items.length} 页大纲</strong>
            {model.model && <span className="chip">{model.model}</span>}
            <ol>
              {model.items.slice(0, 16).map((o) => (
                <li key={o.id}>
                  <span className="chip">{LAYOUT_LABELS[o.layout]}</span> {o.title}
                </li>
              ))}
            </ol>
          </div>
          {confirm === "candidate" ? (
            <ConfirmBar message={`用模型大纲替换当前 ${outline.length} 页大纲？`} confirmLabel="替换" onConfirm={adopt} onCancel={() => setConfirm("")} />
          ) : (
            <div className="candidate-actions">
              <button type="button" className="primary" onClick={() => (outline.length ? setConfirm("candidate") : adopt())}>
                采用这份大纲
              </button>
              <button type="button" className="ghost" onClick={discard}>
                放弃
              </button>
            </div>
          )}
        </section>
      )}
      <div className="outline-body">
        <ol className="outline-list">
          {outline.map((o, i) => (
            <li key={o.id} className={o.id === active ? "outline-card active" : "outline-card"} onFocusCapture={() => o.id !== active && select(o.id)} onClick={() => o.id !== active && select(o.id)}>
              <div className="card-head">
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <label className="layout-pick">
                  <span className="sr-only">第 {i + 1} 页版式</span>
                  <select value={o.layout} onChange={(e) => edit(o.id, { layout: e.target.value as LayoutId })}>
                    {LAYOUTS.map((l) => (
                      <option key={l} value={l}>
                        {LAYOUT_LABELS[l]}
                      </option>
                    ))}
                  </select>
                </label>
                {o.sourceRef && <span className="source-ref" title="对应资料章节">{o.sourceRef}</span>}
                <span className="card-tools">
                  <button type="button" className="ghost icon" aria-label={`上移第 ${i + 1} 页`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={15} aria-hidden="true" />
                  </button>
                  <button type="button" className="ghost icon" aria-label={`下移第 ${i + 1} 页`} disabled={i === outline.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                  <button type="button" className="ghost icon" aria-label={`复制第 ${i + 1} 页`} onClick={() => insert(i, o)}>
                    <Copy size={15} aria-hidden="true" />
                  </button>
                  <button type="button" className="ghost icon danger" aria-label={`删除第 ${i + 1} 页`} onClick={() => remove(i)}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <label className="sr-only" htmlFor={`title-${o.id}`}>
                第 {i + 1} 页标题
              </label>
              <input id={`title-${o.id}`} className="card-title" value={o.title} maxLength={LIMITS.title} placeholder="这一页想说什么？" onChange={(e) => edit(o.id, { title: e.target.value })} />
              {o.layout === "comparison" ? (
                <div className="two-col">
                  {[0, 1].map((c) => (
                    <div key={c}>
                      <input
                        aria-label={`第 ${i + 1} 页${c ? "右" : "左"}栏标题`}
                        value={o.columnTitles[c]}
                        maxLength={120}
                        placeholder={c ? "右栏标题" : "左栏标题"}
                        onChange={(e) => edit(o.id, { columnTitles: c ? [o.columnTitles[0], e.target.value] : [e.target.value, o.columnTitles[1]] })}
                      />
                      <textarea
                        aria-label={`第 ${i + 1} 页${c ? "右" : "左"}栏要点（每行一条）`}
                        rows={Math.max(3, (c ? o.points2 : o.points).length)}
                        value={(c ? o.points2 : o.points).join("\n")}
                        onChange={(e) => edit(o.id, c ? { points2: toLines(e.target.value) } : { points: toLines(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <textarea
                  aria-label={`第 ${i + 1} 页要点（每行一条）`}
                  className="card-points"
                  rows={Math.max(2, o.points.length)}
                  value={o.points.join("\n")}
                  placeholder={o.layout === "timeline" ? "时间：事项（每行一条）" : o.layout === "stats" ? "以数字开头的要点，每行一条" : o.layout === "quote" ? "第一行引语，第二行出处" : "每行一条要点"}
                  onChange={(e) => edit(o.id, { points: toLines(e.target.value) })}
                />
              )}
              {o.chart && (
                <p className="chart-note">
                  图表数据：{o.chart.categories.length} 个分类 × {o.chart.series.length} 个系列{o.chart.unit ? `（${o.chart.unit}）` : ""}，生成后可在成稿页编辑。
                </p>
              )}
              <details className="notes">
                <summary>演讲备注{o.notes ? `（${o.notes.length} 字）` : ""}</summary>
                <textarea aria-label={`第 ${i + 1} 页演讲备注`} rows={4} value={o.notes} maxLength={LIMITS.notes} onChange={(e) => edit(o.id, { notes: e.target.value })} />
              </details>
              <button type="button" className="insert" onClick={() => insert(i)} aria-label={`在第 ${i + 1} 页后插入一页`}>
                <Plus size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        {!outline.length && (
          <div className="empty">
            <p>还没有大纲。回到资料页按“生成大纲”，或从空白开始。</p>
            <button type="button" onClick={() => insert(-1)}>
              <Plus size={15} aria-hidden="true" />
              添加第一页
            </button>
          </div>
        )}
        <aside className="outline-side" aria-label="资料对照">
          <section>
            <h2>资料原文</h2>
            {excerpt ? (
              <>
                <p className="ref-title">{current?.layout === "cover" || current?.layout === "agenda" ? "简报设定" : current?.sourceRef}</p>
                <div className="excerpt">{excerpt}</div>
              </>
            ) : (
              <p className="hint">{current ? "这一页没有对应的资料章节。" : "选择一页查看它引用的资料。"}</p>
            )}
          </section>
          {log.length > 0 && (
            <section>
              <h2>生成说明</h2>
              <ul className="log">
                {log.map((l, i) => (
                  <li key={i}>
                    <b>{l.section}</b>
                    <span>{l.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
