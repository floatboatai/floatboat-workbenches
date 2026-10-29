// ABOUTME: 成稿页右侧检查器：版式切换、按版式显示的字段（标题、要点、左右栏、关键数字、图表数据表、图片与插画）、整套主题与“按大纲重置此页”。
import { useRef, useState } from "react";
import { ImageUp, Minus, Plus, RotateCcw } from "lucide-react";
import { slideFromItem } from "../contracts/generate";
import { ARTS, CHART_TYPES, LAYOUTS, LAYOUT_LABELS, LIMITS, THEMES, type ArtId, type Chart, type LayoutId, type Slide } from "../contracts/model";
import { layoutFields, type Field } from "../shared/geometry";
import { artMarks } from "../shared/marks";
import { THEME_DEFS, fontStack } from "../shared/themes";
import type { Doc } from "./App";
import { ConfirmBar } from "./ConfirmBar";
import { uploadImage } from "./media-client";
import { toLines } from "./OutlineStep";
import { MarksSvg } from "./SlideView";

const ART_NAMES: Record<ArtId, string> = { canopy: "树荫", route: "路线", blocks: "街区", hills: "山水", rings: "圆环", growth: "增长" };
const CHART_NAMES = { bar: "柱形", line: "折线", pie: "饼图", doughnut: "环形" };
const LABELS: Partial<Record<LayoutId, Partial<Record<Field, string>>>> = {
  cover: { subtitle: "副标题", bullets: "署名 / 日期（每行一条）" },
  section: { subtitle: "章节编号或引导语", bullets: "说明" },
  agenda: { bullets: "目录条目（每行一条）" },
  timeline: { bullets: "时间节点（每行“时间：事项”）" },
  chart: { subtitle: "结论（图表上方）", bullets: "旁注要点" },
  quote: { title: "引语", subtitle: "出处" },
  closing: { bullets: "行动 / 请求（每行一条）", subtitle: "联系方式或落款" },
  comparison: { bullets: "左栏要点", bullets2: "右栏要点" },
};

function ChartEditor({ chart, onChange }: { chart: Chart; onChange: (c: Chart) => void }) {
  const set = (patch: Partial<Chart>) => onChange({ ...chart, ...patch });
  const round = chart.type === "pie" || chart.type === "doughnut";
  const series = round ? chart.series.slice(0, 1) : chart.series;
  return (
    <div className="chart-editor" id="field-chart" tabIndex={-1}>
      <div className="segmented small" role="radiogroup" aria-label="图表类型">
        {CHART_TYPES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={chart.type === t} className={chart.type === t ? "on" : ""} onClick={() => set({ type: t })}>
            {CHART_NAMES[t]}
          </button>
        ))}
      </div>
      <label className="inline">
        单位
        <input value={chart.unit} maxLength={20} placeholder="如 % 或 万元" onChange={(e) => set({ unit: e.target.value })} />
      </label>
      <div className="grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              <th scope="col">分类</th>
              {series.map((s, si) => (
                <th key={si} scope="col">
                  <input aria-label={`系列 ${si + 1} 名称`} value={s.name} maxLength={120} placeholder={`系列 ${si + 1}`} onChange={(e) => set({ series: chart.series.map((x, i) => (i === si ? { ...x, name: e.target.value } : x)) })} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.categories.map((c, ci) => (
              <tr key={ci}>
                <th scope="row">
                  <input aria-label={`分类 ${ci + 1}`} value={c} maxLength={120} onChange={(e) => set({ categories: chart.categories.map((x, i) => (i === ci ? e.target.value : x)) })} />
                </th>
                {series.map((s, si) => (
                  <td key={si}>
                    <input
                      aria-label={`${c || `分类 ${ci + 1}`} · ${s.name || `系列 ${si + 1}`}`}
                      inputMode="decimal"
                      value={s.values[ci] ?? ""}
                      maxLength={40}
                      className={s.values[ci] && !Number.isFinite(Number(s.values[ci].replace(/,/g, ""))) ? "invalid" : ""}
                      onChange={(e) => set({ series: chart.series.map((x, i) => (i === si ? { ...x, values: x.values.map((v, k) => (k === ci ? e.target.value : v)) } : x)) })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-tools">
        <button type="button" className="small" disabled={chart.categories.length >= LIMITS.chartCategories} onClick={() => set({ categories: [...chart.categories, ""], series: chart.series.map((s) => ({ ...s, values: [...s.values, ""] })) })}>
          <Plus size={13} aria-hidden="true" />
          分类
        </button>
        <button type="button" className="small" disabled={chart.categories.length <= 1} onClick={() => set({ categories: chart.categories.slice(0, -1), series: chart.series.map((s) => ({ ...s, values: s.values.slice(0, -1) })) })}>
          <Minus size={13} aria-hidden="true" />
          分类
        </button>
        {!round && (
          <>
            <button type="button" className="small" disabled={chart.series.length >= LIMITS.chartSeries} onClick={() => set({ series: [...chart.series, { name: "", values: chart.categories.map(() => "") }] })}>
              <Plus size={13} aria-hidden="true" />
              系列
            </button>
            <button type="button" className="small" disabled={chart.series.length <= 1} onClick={() => set({ series: chart.series.slice(0, -1) })}>
              <Minus size={13} aria-hidden="true" />
              系列
            </button>
          </>
        )}
      </div>
      <p className="hint">PPTX 中是原生图表，可在 PowerPoint 里继续改数据。</p>
    </div>
  );
}

export function Inspector({ doc, slide, update, focusField, onLayout }: { doc: Doc; slide: Slide; update: (p: Partial<Slide>) => void; focusField: Field | null; onLayout: (l: LayoutId) => void }) {
  const fields = layoutFields(slide.layout);
  const label = (f: Field, fallback: string) => LABELS[slide.layout]?.[f] ?? fallback;
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [reset, setReset] = useState(false);
  const theme = THEME_DEFS[doc.data.theme];
  const source = doc.data.outline.find((o) => o.id === slide.outlineId);
  const cls = (f: Field) => (focusField === f ? "field focused" : "field");
  async function upload(f: File) {
    setUploading(true);
    try {
      const m = await uploadImage(f);
      update({ image: { kind: "media", id: m.id, alt: slide.image?.alt || f.name.replace(/\.[^.]+$/, "") } });
      if (m.note) doc.setNotice(`图片${m.note}。`);
    } catch (e) {
      doc.report(e);
    } finally {
      setUploading(false);
    }
  }
  return (
    <aside className="inspector" aria-label="页面检查器">
      <section>
        <h2>版式</h2>
        <div className="layout-grid" role="radiogroup" aria-label="版式">
          {LAYOUTS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={slide.layout === l} className={slide.layout === l ? "on" : ""} onClick={() => onLayout(l)}>
              {LAYOUT_LABELS[l]}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>内容</h2>
        {fields.includes("title") && (
          <label className={cls("title")}>
            {label("title", "标题")}
            <textarea id="field-title" rows={2} value={slide.title} maxLength={LIMITS.title} onChange={(e) => update({ title: e.target.value })} />
          </label>
        )}
        {fields.includes("subtitle") && (
          <label className={cls("subtitle")}>
            {label("subtitle", "副标题")}
            <textarea id="field-subtitle" rows={2} value={slide.subtitle} maxLength={LIMITS.title} onChange={(e) => update({ subtitle: e.target.value })} />
          </label>
        )}
        {fields.includes("columnTitles") && (
          <div className={cls("columnTitles")}>
            <span className="field-label">栏目标题</span>
            <div className="row">
              <input id="field-columnTitles" aria-label="左栏标题" value={slide.columnTitles[0]} maxLength={120} onChange={(e) => update({ columnTitles: [e.target.value, slide.columnTitles[1]] })} />
              <input aria-label="右栏标题" value={slide.columnTitles[1]} maxLength={120} onChange={(e) => update({ columnTitles: [slide.columnTitles[0], e.target.value] })} />
            </div>
          </div>
        )}
        {fields.includes("bullets") && (
          <label className={cls("bullets")}>
            {label("bullets", "要点（每行一条）")}
            <textarea id="field-bullets" rows={Math.min(10, Math.max(3, slide.bullets.length + 1))} value={slide.bullets.join("\n")} onChange={(e) => update({ bullets: toLines(e.target.value) })} />
          </label>
        )}
        {fields.includes("bullets2") && (
          <label className={cls("bullets2")}>
            {label("bullets2", "右栏要点")}
            <textarea id="field-bullets2" rows={Math.min(10, Math.max(3, slide.bullets2.length + 1))} value={slide.bullets2.join("\n")} onChange={(e) => update({ bullets2: toLines(e.target.value) })} />
          </label>
        )}
        {fields.includes("stats") && (
          <div className={cls("stats")}>
            <span className="field-label">关键数字</span>
            {slide.stats.map((s, i) => (
              <div key={i} className="stat-row">
                <input id={i === 0 ? "field-stats" : undefined} aria-label={`数字 ${i + 1}`} value={s.value} maxLength={40} placeholder="94%" onChange={(e) => update({ stats: slide.stats.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) })} />
                <input aria-label={`说明 ${i + 1}`} value={s.label} maxLength={200} placeholder="说明" onChange={(e) => update({ stats: slide.stats.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
                <button type="button" className="ghost icon" aria-label={`删除数字 ${i + 1}`} onClick={() => update({ stats: slide.stats.filter((_, k) => k !== i) })}>
                  <Minus size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" className="small" disabled={slide.stats.length >= LIMITS.stats} onClick={() => update({ stats: [...slide.stats, { value: "", label: "" }] })}>
              <Plus size={13} aria-hidden="true" />
              添加数字
            </button>
          </div>
        )}
        {fields.includes("chart") && slide.chart && (
          <div className={cls("chart")}>
            <span className="field-label">图表</span>
            <ChartEditor chart={slide.chart} onChange={(chart) => update({ chart })} />
          </div>
        )}
        {fields.includes("image") && (
          <div className={cls("image")}>
            <span className="field-label">图片</span>
            <div className="art-grid" id="field-image" tabIndex={-1}>
              {ARTS.map((a) => (
                <button key={a} type="button" aria-pressed={slide.image?.kind === "art" && slide.image.art === a} className={slide.image?.kind === "art" && slide.image.art === a ? "on" : ""} onClick={() => update({ image: { kind: "art", art: a, alt: slide.image?.alt ?? "" } })}>
                  <MarksSvg marks={artMarks(a, 1.6, 1.2, theme)} w={1.6} h={1.2} font={fontStack(false)} />
                  <span>{ART_NAMES[a]}</span>
                </button>
              ))}
            </div>
            <div className="row-tools">
              <button type="button" className="small" disabled={uploading} onClick={() => file.current?.click()}>
                <ImageUp size={13} aria-hidden="true" />
                {uploading ? "正在处理…" : "用自己的图片"}
              </button>
              {slide.image && (
                <button type="button" className="small ghost" onClick={() => update({ image: null })}>
                  不用图片
                </button>
              )}
            </div>
            <input ref={file} type="file" hidden accept="image/*" onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }} />
            {slide.image && (
              <label className="inline">
                替代文字
                <input value={slide.image.alt} maxLength={300} onChange={(e) => update({ image: { ...slide.image!, alt: e.target.value } })} />
              </label>
            )}
          </div>
        )}
        {source && (
          <div className="reset">
            {reset ? (
              <ConfirmBar
                message="用大纲中对应的条目重新生成这一页？本页的修改会被替换。"
                confirmLabel="重置此页"
                onConfirm={() => {
                  const fresh = slideFromItem(source, doc.data.outline.indexOf(source));
                  update({ ...fresh, id: slide.id, image: slide.image ?? fresh.image });
                  setReset(false);
                }}
                onCancel={() => setReset(false)}
              />
            ) : (
              <button type="button" className="ghost small" onClick={() => setReset(true)}>
                <RotateCcw size={13} aria-hidden="true" />
                按大纲重置此页
              </button>
            )}
          </div>
        )}
      </section>
      <section>
        <h2>整套主题</h2>
        <div className="theme-grid" role="radiogroup" aria-label="主题">
          {THEMES.map((t) => {
            const d = THEME_DEFS[t];
            return (
              <button key={t} type="button" role="radio" aria-checked={doc.data.theme === t} className={doc.data.theme === t ? "on" : ""} onClick={() => doc.setData((x) => ({ ...x, theme: t }))}>
                <span className="swatch" style={{ background: `#${d.bg}`, borderColor: `#${d.line}` }}>
                  <i style={{ background: `#${d.accent}` }} />
                  <i style={{ background: `#${d.accent2}` }} />
                  <i style={{ background: `#${d.ink}` }} />
                </span>
                {d.name}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
