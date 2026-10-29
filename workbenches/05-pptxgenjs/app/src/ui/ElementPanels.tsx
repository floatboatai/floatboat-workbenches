// ABOUTME: 各类元素的检查器面板：文字格式、图片、表格网格、图表类型与数据表、形状。
import { useId } from "react";
import { ImageUp, Minus, PenLine, Plus } from "lucide-react";
import {
  CHART_TYPES,
  LIMITS,
  SHAPE_KINDS,
  isNumberCell,
  type ChartElement,
  type ImageElement,
  type ShapeElement,
  type SlideElement,
  type TableElement,
  type TextElement,
  type Theme,
} from "../contracts/domain";
import { ColorSelect, Field, NumberField, Segmented, Toggle } from "./InspectorFields";
import { useMedia } from "./media-client";

const CHART_LABEL: Record<ChartElement["chart"], string> = { bar: "柱形", line: "折线", area: "面积", pie: "饼图", doughnut: "环形" };
const SHAPE_LABEL: Record<ShapeElement["shape"], string> = {
  rect: "矩形",
  roundRect: "圆角矩形",
  ellipse: "椭圆",
  triangle: "三角形",
  rightArrow: "右箭头",
  line: "直线",
};

type Patch<T extends SlideElement> = (update: (el: SlideElement) => SlideElement, key?: string) => void;
function typed<T extends SlideElement>(onElement: Patch<T>, el: T) {
  return <K extends keyof T>(key: K, value: T[K], historyKey?: string) =>
    onElement((current) => (current.type === el.type ? ({ ...current, [key]: value } as SlideElement) : current), historyKey ?? `${el.id}:${String(key)}`);
}

export function TextPanel({ el, theme, onElement, onEditText }: { el: TextElement; theme: Theme; onElement: Patch<TextElement>; onEditText: () => void }) {
  const set = typed(onElement, el);
  const allBullets = el.paragraphs.every((p) => p.bullet);
  return (
    <section className="panel-section" aria-label="文字">
      <h3>文字</h3>
      <button type="button" className="wide-action" onClick={onEditText}>
        <PenLine size={14} aria-hidden="true" />
        编辑文字（双击舞台上的文本也可以）
      </button>
      <div className="grid-2">
        <Field label="字体">
          <select name="font-role" value={el.font} onChange={(event) => set("font", event.target.value as TextElement["font"])}>
            <option value="head">标题字体 · {theme.headFont || "未设置"}</option>
            <option value="body">正文字体 · {theme.bodyFont || "未设置"}</option>
          </select>
        </Field>
        <NumberField label="字号" unit="pt" value={el.size} min={6} max={160} onChange={(v) => set("size", v)} />
      </div>
      <ColorSelect label="颜色" value={el.color} theme={theme} onChange={(v) => v && set("color", v)} />
      <div className="button-row" role="group" aria-label="字形">
        <button type="button" aria-pressed={el.bold} onClick={() => set("bold", !el.bold)}>
          <b>粗</b>
        </button>
        <button type="button" aria-pressed={el.italic} onClick={() => set("italic", !el.italic)}>
          <i>斜</i>
        </button>
        <button
          type="button"
          aria-pressed={allBullets}
          onClick={() =>
            onElement(
              (current) =>
                current.type === "text" ? { ...current, paragraphs: current.paragraphs.map((p) => ({ ...p, bullet: allBullets ? undefined : true })) } : current,
              `${el.id}:bullets`,
            )
          }
        >
          • 项目符号
        </button>
      </div>
      <Segmented
        label="水平对齐"
        value={el.align}
        options={[
          { value: "left", label: "左" },
          { value: "center", label: "中" },
          { value: "right", label: "右" },
        ]}
        onChange={(v) => set("align", v)}
      />
      <Segmented
        label="垂直对齐"
        value={el.valign}
        options={[
          { value: "top", label: "顶" },
          { value: "middle", label: "中" },
          { value: "bottom", label: "底" },
        ]}
        onChange={(v) => set("valign", v)}
      />
      <div className="grid-2">
        <NumberField label="行距" unit="倍" value={el.lineSpacing} step={0.05} min={0.7} max={3} onChange={(v) => set("lineSpacing", v)} />
        <NumberField label="段后" unit="pt" value={el.spaceAfter} min={0} max={72} onChange={(v) => set("spaceAfter", v)} />
      </div>
      <ColorSelect label="文本框填充" value={el.fill} theme={theme} allowNone onChange={(v) => set("fill", v)} />
    </section>
  );
}

export function ImagePanel({ el, onElement, onReplace }: { el: ImageElement; onElement: Patch<ImageElement>; onReplace: () => void }) {
  const set = typed(onElement, el);
  const { record } = useMedia(el.mediaId);
  return (
    <section className="panel-section" aria-label="图片">
      <h3>图片</h3>
      <button type="button" className="wide-action" onClick={onReplace}>
        <ImageUp size={14} aria-hidden="true" />
        {el.mediaId ? "替换图片…" : "选择图片…"}
      </button>
      {record ? (
        <p className="panel-note">
          {record.width}×{record.height} px · {Math.round(record.bytes / 1024)} KB · {record.mime.replace("image/", "").toUpperCase()}
        </p>
      ) : null}
      <Segmented
        label="适配"
        value={el.fit}
        options={[
          { value: "cover", label: "填满（裁切）" },
          { value: "contain", label: "完整显示" },
        ]}
        onChange={(v) => set("fit", v)}
      />
      <Field label="替换文字（无障碍）" wide>
        <textarea name="alt" rows={2} maxLength={300} value={el.alt} onChange={(event) => set("alt", event.target.value)} placeholder="描述图片内容…" />
      </Field>
    </section>
  );
}

export function TablePanel({ el, onElement }: { el: TableElement; onElement: Patch<TableElement> }) {
  const set = typed(onElement, el);
  const id = useId();
  const rows = el.rows.length,
    cols = el.rows[0].length;
  const setRows = (next: string[][], key: string) => set("rows", next, key);
  return (
    <section className="panel-section" aria-label="表格">
      <h3>表格</h3>
      <div className="button-row">
        <Toggle label="标题行" checked={el.header} onChange={(v) => set("header", v)} />
        <Toggle label="镶边行" checked={el.banded} onChange={(v) => set("banded", v)} />
      </div>
      <NumberField label="字号" unit="pt" value={el.size} min={6} max={40} onChange={(v) => set("size", v)} />
      <div className="sheet" role="grid" aria-label="表格内容" aria-rowcount={rows} aria-colcount={cols}>
        {el.rows.map((row, ri) => (
          <div className="sheet-row" role="row" key={ri} style={{ gridTemplateColumns: `repeat(${cols}, minmax(64px, 1fr))` }}>
            {row.map((cell, ci) => (
              <input
                key={ci}
                role="gridcell"
                id={`${id}-${ri}-${ci}`}
                data-table-cell={`${ri}-${ci}`}
                name={`cell-${ri}-${ci}`}
                autoComplete="off"
                aria-label={`第 ${ri + 1} 行第 ${ci + 1} 列`}
                className={el.header && ri === 0 ? "is-head" : undefined}
                value={cell}
                maxLength={LIMITS.cellText}
                onChange={(event) =>
                  setRows(
                    el.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? event.target.value : c)) : r)),
                    `${el.id}:cell:${ri}:${ci}`,
                  )
                }
                onKeyDown={(event) => {
                  const move = event.key === "Enter" ? [1, 0] : null;
                  if (move) {
                    event.preventDefault();
                    document.getElementById(`${id}-${Math.min(rows - 1, ri + move[0])}-${ci}`)?.focus();
                  }
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="button-row">
        <button type="button" disabled={rows >= LIMITS.tableRows} onClick={() => setRows([...el.rows, Array(cols).fill("")], "rows")}>
          <Plus size={14} aria-hidden="true" />行
        </button>
        <button type="button" disabled={rows <= 1} onClick={() => setRows(el.rows.slice(0, -1), "rows")}>
          <Minus size={14} aria-hidden="true" />行
        </button>
        <button type="button" disabled={cols >= LIMITS.tableCols} onClick={() => setRows(el.rows.map((r) => [...r, ""]), "cols")}>
          <Plus size={14} aria-hidden="true" />列
        </button>
        <button type="button" disabled={cols <= 1} onClick={() => setRows(el.rows.map((r) => r.slice(0, -1)), "cols")}>
          <Minus size={14} aria-hidden="true" />列
        </button>
      </div>
    </section>
  );
}

export function ChartPanel({ el, onElement }: { el: ChartElement; onElement: Patch<ChartElement> }) {
  const set = typed(onElement, el);
  const id = useId();
  const round = el.chart === "pie" || el.chart === "doughnut";
  const update = (fn: (c: ChartElement) => Partial<ChartElement>, key: string) =>
    onElement((current) => (current.type === "chart" ? { ...current, ...fn(current) } : current), key);
  const invalid = el.series.flatMap((s) => s.values).filter((v) => !isNumberCell(v)).length;
  return (
    <section className="panel-section" aria-label="图表">
      <h3>图表</h3>
      <Segmented label="类型" value={el.chart} options={CHART_TYPES.map((t) => ({ value: t, label: CHART_LABEL[t] }))} onChange={(v) => set("chart", v)} />
      <Field label="图表标题" wide>
        <input name="chart-title" autoComplete="off" maxLength={120} value={el.title} onChange={(event) => set("title", event.target.value)} placeholder="可留空…" />
      </Field>
      <div className="button-row">
        <Toggle label="图例" checked={el.legend} onChange={(v) => set("legend", v)} />
        <Toggle label={round ? "百分比标签" : "数据标签"} checked={el.labels} onChange={(v) => set("labels", v)} />
      </div>
      <h4 className="sheet-title">
        数据表{round ? <small>（饼图/环形图只使用第一个系列）</small> : null}
      </h4>
      {invalid ? (
        <p className="field-error" role="alert">
          有 {invalid} 个单元格不是数字；已作为草稿保存，修正后才会写入正式文稿与导出。
        </p>
      ) : null}
      <div className="sheet chart-sheet" role="grid" aria-label="图表数据表" data-chart-sheet>
        <div className="sheet-row" role="row" style={{ gridTemplateColumns: `88px repeat(${el.series.length}, minmax(64px, 1fr))` }}>
          <span className="sheet-corner" role="columnheader">
            分类 \ 系列
          </span>
          {el.series.map((s, si) => (
            <input
              key={si}
              role="columnheader"
              name={`series-${si}`}
              autoComplete="off"
              aria-label={`系列 ${si + 1} 名称`}
              className="is-head"
              value={s.name}
              maxLength={60}
              onChange={(event) =>
                update((c) => ({ series: c.series.map((x, i) => (i === si ? { ...x, name: event.target.value } : x)) }), `${el.id}:series:${si}`)
              }
            />
          ))}
        </div>
        {el.categories.map((cat, ci) => (
          <div className="sheet-row" role="row" key={ci} style={{ gridTemplateColumns: `88px repeat(${el.series.length}, minmax(64px, 1fr))` }}>
            <input
              role="rowheader"
              name={`category-${ci}`}
              autoComplete="off"
              aria-label={`分类 ${ci + 1}`}
              className="is-head"
              value={cat}
              maxLength={60}
              onChange={(event) => update((c) => ({ categories: c.categories.map((x, i) => (i === ci ? event.target.value : x)) }), `${el.id}:cat:${ci}`)}
            />
            {el.series.map((s, si) => (
              <input
                key={si}
                role="gridcell"
                id={`${id}-${ci}-${si}`}
                name={`value-${ci}-${si}`}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`${cat || `分类 ${ci + 1}`} · ${s.name || `系列 ${si + 1}`}`}
                aria-invalid={!isNumberCell(s.values[ci])}
                className="num"
                value={s.values[ci]}
                maxLength={32}
                onChange={(event) =>
                  update(
                    (c) => ({ series: c.series.map((x, i) => (i === si ? { ...x, values: x.values.map((v, j) => (j === ci ? event.target.value : v)) } : x)) }),
                    `${el.id}:v:${ci}:${si}`,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    document.getElementById(`${id}-${Math.min(el.categories.length - 1, ci + 1)}-${si}`)?.focus();
                  }
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="button-row">
        <button
          type="button"
          disabled={el.categories.length >= LIMITS.chartCategories}
          onClick={() =>
            update((c) => ({ categories: [...c.categories, `分类 ${c.categories.length + 1}`], series: c.series.map((s) => ({ ...s, values: [...s.values, "0"] })) }), "cats")
          }
        >
          <Plus size={14} aria-hidden="true" />分类
        </button>
        <button
          type="button"
          disabled={el.categories.length <= 1}
          onClick={() => update((c) => ({ categories: c.categories.slice(0, -1), series: c.series.map((s) => ({ ...s, values: s.values.slice(0, -1) })) }), "cats")}
        >
          <Minus size={14} aria-hidden="true" />分类
        </button>
        <button
          type="button"
          disabled={el.series.length >= LIMITS.chartSeries}
          onClick={() => update((c) => ({ series: [...c.series, { name: `系列 ${c.series.length + 1}`, values: c.categories.map(() => "0") }] }), "series")}
        >
          <Plus size={14} aria-hidden="true" />系列
        </button>
        <button type="button" disabled={el.series.length <= 1} onClick={() => update((c) => ({ series: c.series.slice(0, -1) }), "series")}>
          <Minus size={14} aria-hidden="true" />系列
        </button>
      </div>
    </section>
  );
}

export function ShapePanel({ el, theme, onElement }: { el: ShapeElement; theme: Theme; onElement: Patch<ShapeElement> }) {
  const set = typed(onElement, el);
  return (
    <section className="panel-section" aria-label="形状">
      <h3>形状</h3>
      <Field label="类型">
        <select name="shape-kind" value={el.shape} onChange={(event) => set("shape", event.target.value as ShapeElement["shape"])}>
          {SHAPE_KINDS.map((k) => (
            <option key={k} value={k}>
              {SHAPE_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      {el.shape !== "line" ? <ColorSelect label="填充" value={el.fill} theme={theme} allowNone onChange={(v) => set("fill", v)} /> : null}
      <ColorSelect label="线条" value={el.line} theme={theme} allowNone={el.shape !== "line"} onChange={(v) => set("line", v)} />
      <NumberField label="线宽" unit="pt" value={el.lineWidth} step={0.25} min={0} max={20} onChange={(v) => set("lineWidth", v)} />
      {el.shape !== "line" ? (
        <>
          <Field label="形状内文字" wide>
            <textarea name="shape-text" data-shape-text rows={2} maxLength={1000} value={el.text} onChange={(event) => set("text", event.target.value)} />
          </Field>
          <div className="grid-2">
            <ColorSelect label="文字颜色" value={el.textColor} theme={theme} onChange={(v) => v && set("textColor", v)} />
            <NumberField label="字号" unit="pt" value={el.size} min={6} max={120} onChange={(v) => set("size", v)} />
          </div>
        </>
      ) : null}
    </section>
  );
}

