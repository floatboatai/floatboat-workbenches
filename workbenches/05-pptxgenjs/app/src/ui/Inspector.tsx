// ABOUTME: 上下文检查器：元素（位置、文字格式、图片、表格网格、图表数据表、形状）、页面版式与主题品牌设置。
import { useId } from "react";
import { ColorSelect, Field, NumberField, Segmented, Toggle } from "./InspectorFields";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Plus,
  Minus,
  PenLine,
  ImageUp,
  EyeOff,
} from "lucide-react";
import {
  CHART_TYPES,
  COLOR_ROLES,
  LAYOUT_IDS,
  LIMITS,
  SHAPE_KINDS,
  SLIDE_SIZES,
  isNumberCell,
  type Aspect,
  type ChartElement,
  type ColorRef,
  type Deck,
  type ImageElement,
  type LayoutId,
  type ShapeElement,
  type Slide,
  type SlideElement,
  type TableElement,
  type TextElement,
  type Theme,
} from "../contracts/domain";
import { COLOR_LABELS, FONT_CHOICES, LAYOUTS, THEME_PRESETS, resolveColor } from "../contracts/layouts";
import { useMedia } from "./media-client";
import { elementLabel } from "./Stage";
import { ChartPanel, ImagePanel, ShapePanel, TablePanel, TextPanel } from "./ElementPanels";

export type InspectorTab = "element" | "slide" | "theme";
export interface InspectorProps {
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  deck: Deck;
  slide: Slide;
  slideIndex: number;
  element: SlideElement | null;
  onElement: (update: (el: SlideElement) => SlideElement, key?: string) => void;
  onSlide: (update: (slide: Slide) => Slide, key?: string) => void;
  onTheme: (update: (theme: Theme) => Theme, key?: string) => void;
  onLayout: (layout: LayoutId) => void;
  onArrange: (mode: "forward" | "backward" | "front" | "back") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditText: () => void;
  onReplaceImage: () => void;
  onSelectElement: (id: string) => void;
}

export function Inspector(props: InspectorProps) {
  const { tab, setTab, element } = props;
  const active = tab === "element" && !element ? "slide" : tab;
  return (
    <aside className="inspector" aria-label="检查器">
      <div className="inspector-tabs" role="tablist" aria-label="检查器分类">
        {(
          [
            ["element", "元素"],
            ["slide", "页面"],
            ["theme", "主题"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={active === id}
            aria-controls={`panel-${id}`}
            disabled={id === "element" && !element}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="inspector-body" role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {active === "element" && element ? <ElementPanel {...props} element={element} /> : null}
        {active === "slide" ? <SlidePanel {...props} /> : null}
        {active === "theme" ? <ThemePanel theme={props.deck.theme} onTheme={props.onTheme} /> : null}
      </div>
    </aside>
  );
}

function ElementPanel(props: InspectorProps & { element: SlideElement }) {
  const { element: el, deck, onElement } = props;
  const theme = deck.theme;
  const size = SLIDE_SIZES[theme.aspect];
  const toCm = (pct: number, axis: "x" | "y") => Math.round((pct / 100) * (axis === "x" ? size.w : size.h) * 2.54 * 100) / 100;
  const fromCm = (cm: number, axis: "x" | "y") => (cm / 2.54 / (axis === "x" ? size.w : size.h)) * 100;
  const set = <K extends keyof SlideElement>(key: K, value: SlideElement[K], historyKey?: string) =>
    onElement((current) => ({ ...current, [key]: value }) as SlideElement, historyKey ?? `${el.id}:${String(key)}`);
  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{elementLabel(el)}</h2>
        {el.slot ? <p className="panel-note">版式占位 · {LAYOUTS[props.slide.layout].label}</p> : null}
      </header>
      <section className="panel-section" aria-label="位置与尺寸">
        <h3>位置与尺寸</h3>
        <div className="grid-4">
          <NumberField label="X" unit="cm" value={toCm(el.x, "x")} step={0.1} onChange={(v) => set("x", Math.round(fromCm(v, "x") * 100) / 100)} />
          <NumberField label="Y" unit="cm" value={toCm(el.y, "y")} step={0.1} onChange={(v) => set("y", Math.round(fromCm(v, "y") * 100) / 100)} />
          <NumberField label="宽" unit="cm" value={toCm(el.w, "x")} step={0.1} min={0} onChange={(v) => set("w", Math.round(fromCm(v, "x") * 100) / 100)} />
          <NumberField label="高" unit="cm" value={toCm(el.h, "y")} step={0.1} min={0} onChange={(v) => set("h", Math.round(fromCm(v, "y") * 100) / 100)} />
        </div>
        <div className="button-row" role="group" aria-label="层级与操作">
          <button type="button" onClick={() => props.onArrange("front")} title="置于顶层 ⇧⌘]">
            <ArrowUpToLine size={14} aria-hidden="true" />
            顶层
          </button>
          <button type="button" onClick={() => props.onArrange("forward")} title="上移一层 ⌘]">
            <ChevronUp size={14} aria-hidden="true" />
            上移
          </button>
          <button type="button" onClick={() => props.onArrange("backward")} title="下移一层 ⌘[">
            <ChevronDown size={14} aria-hidden="true" />
            下移
          </button>
          <button type="button" onClick={() => props.onArrange("back")} title="置于底层 ⇧⌘[">
            <ArrowDownToLine size={14} aria-hidden="true" />
            底层
          </button>
          <button type="button" onClick={props.onDuplicate} title="复制 ⌘D">
            <Copy size={14} aria-hidden="true" />
            复制
          </button>
          <button type="button" className="danger" onClick={props.onDelete} title="删除 Delete">
            <Trash2 size={14} aria-hidden="true" />
            删除
          </button>
        </div>
      </section>
      {el.type === "text" ? <TextPanel el={el} theme={theme} onElement={onElement} onEditText={props.onEditText} /> : null}
      {el.type === "image" ? <ImagePanel el={el} onElement={onElement} onReplace={props.onReplaceImage} /> : null}
      {el.type === "table" ? <TablePanel el={el} onElement={onElement} /> : null}
      {el.type === "chart" ? <ChartPanel el={el} onElement={onElement} /> : null}
      {el.type === "shape" ? <ShapePanel el={el} theme={theme} onElement={onElement} /> : null}
    </div>
  );
}

function SlidePanel(props: InspectorProps) {
  const { slide, slideIndex, onLayout, onSlide } = props;
  return (
    <div className="panel">
      <header className="panel-head">
        <h2>第 {slideIndex + 1} 页</h2>
        <p className="panel-note">{LAYOUTS[slide.layout].label} 母版</p>
      </header>
      <section className="panel-section" aria-label="版式">
        <h3>版式（幻灯片母版）</h3>
        <div className="layout-grid" role="radiogroup" aria-label="版式">
          {LAYOUT_IDS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={slide.layout === id} title={LAYOUTS[id].hint} onClick={() => onLayout(id)}>
              <LayoutGlyph id={id} />
              <span>{LAYOUTS[id].label}</span>
            </button>
          ))}
        </div>
        <p className="panel-note">切换版式时，标题、正文等占位移动到新母版的位置；新母版没有的占位保留为自由元素。</p>
      </section>
      <section className="panel-section">
        <Toggle label="放映时隐藏此页" checked={slide.hidden} onChange={(v) => onSlide((s) => ({ ...s, hidden: v }), "hidden")} />
        {slide.hidden ? (
          <p className="panel-note">
            <EyeOff size={12} aria-hidden="true" /> PPTX 中标记为隐藏幻灯片
          </p>
        ) : null}
      </section>
      <section className="panel-section" aria-label="元素列表">
        <h3>元素（从底层到顶层）</h3>
        <ol className="layer-list">
          {slide.elements.map((el) => (
            <li key={el.id}>
              <button type="button" aria-current={props.element?.id === el.id} onClick={() => props.onSelectElement(el.id)}>
                {elementLabel(el)}
              </button>
            </li>
          ))}
          {slide.elements.length === 0 ? <li className="panel-note">此页还没有元素，用舞台上方的插入工具添加。</li> : null}
        </ol>
      </section>
    </div>
  );
}

export function LayoutGlyph({ id }: { id: LayoutId }) {
  const layout = LAYOUTS[id];
  return (
    <span className={`layout-glyph glyph-${layout.background}`} aria-hidden="true">
      {layout.decor
        .filter((d) => d.kind === "rect")
        .map((d, i) => (
          <i key={"d" + i} className={`g-decor g-${d.fill}`} style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${Math.max(d.h, 2)}%` }} />
        ))}
      {layout.slots.map((s) => {
        const b = s.make();
        return <i key={s.name} className={`g-slot g-${b.type}${s.name === "title" ? " g-title" : ""}`} style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }} />;
      })}
    </span>
  );
}

function ThemePanel({ theme, onTheme }: { theme: Theme; onTheme: InspectorProps["onTheme"] }) {
  const id = useId();
  return (
    <div className="panel">
      <header className="panel-head">
        <h2>主题</h2>
        <p className="panel-note">颜色与字体写入每个母版和元素；元素使用“颜色角色”，换主题会整体换色。</p>
      </header>
      <section className="panel-section" aria-label="预设">
        <h3>预设</h3>
        <div className="preset-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={theme.preset === preset.id}
              onClick={() => onTheme((t) => ({ ...structuredClone(preset.theme), aspect: t.aspect }), "preset")}
            >
              <span className="preset-swatch" style={{ background: "#" + preset.theme.colors.background }}>
                <i style={{ background: "#" + preset.theme.colors.accent }} />
                <i style={{ background: "#" + preset.theme.colors.accent2 }} />
                <i style={{ background: "#" + preset.theme.colors.text }} />
              </span>
              {preset.label}
            </button>
          ))}
        </div>
      </section>
      <section className="panel-section" aria-label="品牌颜色">
        <h3>品牌颜色</h3>
        <div className="color-grid">
          {COLOR_ROLES.map((role) => (
            <label key={role} className="color-input">
              <input
                type="color"
                name={`color-${role}`}
                value={"#" + theme.colors[role]}
                onChange={(event) => onTheme((t) => ({ ...t, preset: "custom", colors: { ...t.colors, [role]: event.target.value.slice(1).toUpperCase() } }), `color:${role}`)}
              />
              <span>
                {COLOR_LABELS[role]}
                <small>#{theme.colors[role]}</small>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="panel-section" aria-label="字体">
        <h3>字体</h3>
        {(
          [
            ["headFont", "标题字体"],
            ["bodyFont", "正文字体"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label} wide>
            <input
              name={key}
              list={`${id}-fonts`}
              autoComplete="off"
              maxLength={LIMITS.font}
              value={theme[key]}
              aria-invalid={!theme[key].trim()}
              onChange={(event) => onTheme((t) => ({ ...t, preset: "custom", [key]: event.target.value }), `font:${key}`)}
            />
          </Field>
        ))}
        <datalist id={`${id}-fonts`}>
          {FONT_CHOICES.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <p className="panel-note">PPTX 不嵌入字体：接收方电脑没有该字体时，演示软件会用替代字体显示。</p>
      </section>
      <section className="panel-section" aria-label="画面比例">
        <Segmented<Aspect>
          label="画面比例"
          value={theme.aspect}
          options={[
            { value: "16:9", label: "16:9 宽屏" },
            { value: "16:10", label: "16:10" },
            { value: "4:3", label: "4:3 标准" },
          ]}
          onChange={(v) => onTheme((t) => ({ ...t, aspect: v }), "aspect")}
        />
        <p className="panel-note">
          {SLIDE_SIZES[theme.aspect].w.toFixed(2)} × {SLIDE_SIZES[theme.aspect].h} 英寸；元素按比例保留位置。
        </p>
      </section>
    </div>
  );
}
