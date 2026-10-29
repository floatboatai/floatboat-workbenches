// ABOUTME: 演示编排室主界面：文稿菜单 + 缩略轨 + 舞台（插入工具、备注）+ 上下文检查器；导出 PPTX 是主操作。
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ChevronDown,
  Download,
  FileJson,
  FilePlus2,
  FolderOpen,
  Image as ImageIcon,
  Play,
  Redo2,
  Save,
  Shapes,
  Sparkles,
  Table2,
  BarChart3,
  Type,
  Undo2,
  Trash2,
  LifeBuoy,
  Presentation,
} from "lucide-react";
import {
  LIMITS,
  restoreDeckDraft,
  textBox,
  validateDeck,
  moveSlide,
  type Deck,
  type LayoutId,
  type ShapeElement,
  type Slide,
  type SlideElement,
  type Theme,
  SLIDE_SIZES,
} from "../contracts/domain";
import { seed } from "../contracts/seed";
import { LAYOUTS, applyLayout, newId, newSlide } from "../contracts/layouts";
import { isAppInfo, type AppInfo } from "../contracts/app";
import { download, Notice, RenderBoundary, request, useProjects } from "./workspace";
import { useHistory } from "./history";
import { Stage } from "./Stage";
import { Rail } from "./Rail";
import { Inspector, type InspectorTab } from "./Inspector";
import { Slideshow } from "./Slideshow";
import { AiPanel } from "./AiPanel";
import { duplicateElement, insertElement, patchElement, removeElement, reorderElement } from "./geometry";
import { uploadImage } from "./media-client";
import { ShapeIcon } from "./ShapeIcon";
import { DeckMenu } from "./DeckMenu";
import { buildPptx, buildProjectJson, readProjectFile, safeFileName } from "./export-deck";

const SHAPE_MENU: { kind: ShapeElement["shape"]; label: string }[] = [
  { kind: "rect", label: "矩形" },
  { kind: "roundRect", label: "圆角矩形" },
  { kind: "ellipse", label: "椭圆" },
  { kind: "triangle", label: "三角形" },
  { kind: "rightArrow", label: "右箭头" },
  { kind: "line", label: "直线" },
];
function blankDeck(theme: Theme): Deck {
  const first = newSlide("title");
  return { version: 2, theme: structuredClone(theme), slides: [first] };
}
function isEditable(target: EventTarget | null) {
  const node = target as HTMLElement | null;
  return !!node && (node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName));
}

export function DeckApp() {
  return (
    <RenderBoundary>
      <DeckWorkbench />
    </RenderBoundary>
  );
}

function DeckWorkbench() {
  const p = useProjects(seed, validateDeck, "华东区门店 Q3 运营复盘", { storageKey: "pptxgenjs", restoreDraftData: restoreDeckDraft });
  const deck = p.data;
  const history = useHistory<Deck>(p.setData, p.documentKey);
  const commit = history.commit;
  const [slideId, setSlideId] = useState<string>(deck.slides[0].id);
  const [elementId, setElementId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>("slide");
  const [menu, setMenu] = useState(false);
  const [shapeMenu, setShapeMenu] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [showing, setShowing] = useState(false);
  const [exporting, setExporting] = useState("");
  const [platform, setPlatform] = useState<AppInfo["platform"] | "checking" | "error">("checking");
  const [checking, setChecking] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const shapeButton = useRef<HTMLButtonElement>(null);
  const showButton = useRef<HTMLButtonElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const imageTarget = useRef<string | null>(null);
  const clipboard = useRef<SlideElement | null>(null);

  const slideIndex = Math.max(0, deck.slides.findIndex((s) => s.id === slideId));
  const slide = deck.slides[slideIndex];
  const element = slide.elements.find((el) => el.id === elementId) ?? null;

  useEffect(() => {
    setSlideId(p.data.slides[0].id);
    setElementId(null);
    setEditingId(null);
    setTab("slide");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.documentKey]);
  useEffect(() => {
    if (!deck.slides.some((s) => s.id === slideId)) setSlideId(deck.slides[Math.min(slideIndex, deck.slides.length - 1)].id);
  }, [deck.slides, slideId, slideIndex]);

  const checkPlatform = useCallback(async () => {
    setChecking(true);
    try {
      const value = await request("/api/app");
      setPlatform(isAppInfo(value) ? value.platform : "error");
    } catch {
      setPlatform("error");
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void checkPlatform();
  }, [checkPlatform]);

  useEffect(() => {
    if (!menu && !shapeMenu) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menu && !menuRef.current?.contains(target) && !menuButton.current?.contains(target)) setMenu(false);
      if (shapeMenu && !shapeButton.current?.parentElement?.contains(target)) setShapeMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu, shapeMenu]);

  const updateSlide = useCallback(
    (id: string, update: (s: Slide) => Slide, key?: string) =>
      commit((d) => {
        let changed = false;
        const slides = d.slides.map((s) => {
          if (s.id !== id) return s;
          const next = update(s);
          if (next !== s) changed = true;
          return next;
        });
        return changed ? { ...d, slides } : d;
      }, key),
    [commit],
  );
  const onSlide = useCallback((update: (s: Slide) => Slide, key?: string) => updateSlide(slideId, update, key), [updateSlide, slideId]);

  function select(id: string | null) {
    setElementId(id);
    if (id) setTab("element");
    else if (tab === "element") setTab("slide");
  }
  function selectSlide(index: number) {
    const target = deck.slides[index];
    if (!target) return;
    setSlideId(target.id);
    setElementId(null);
    setEditingId(null);
    if (tab === "element") setTab("slide");
  }
  function addElement(el: SlideElement) {
    if (slide.elements.length >= LIMITS.elements) {
      p.setError(`每页最多 ${LIMITS.elements} 个元素。`);
      return;
    }
    onSlide((s) => insertElement(s, el));
    setElementId(el.id);
    setTab("element");
    return el.id;
  }
  function insert(kind: "text" | "table" | "chart") {
    if (kind === "text") {
      const id = addElement(textBox(newId("text"), 30, 40, 40, 12, [{ runs: [{ text: "双击编辑文字" }] }], { size: 20 }));
      if (id) setEditingId(id);
    } else if (kind === "table")
      addElement({
        id: newId("table"),
        type: "table",
        x: 10,
        y: 30,
        w: 80,
        h: 36,
        rows: [
          ["项目", "负责人", "截止"],
          ["", "", ""],
          ["", "", ""],
        ],
        header: true,
        banded: true,
        size: 14,
      });
    else
      addElement({
        id: newId("chart"),
        type: "chart",
        x: 12,
        y: 26,
        w: 76,
        h: 64,
        chart: "bar",
        title: "",
        categories: ["一月", "二月", "三月", "四月"],
        series: [
          { name: "实际", values: ["32", "41", "38", "47"] },
          { name: "目标", values: ["35", "38", "40", "45"] },
        ],
        legend: true,
        labels: true,
      });
  }
  function insertShape(kind: ShapeElement["shape"]) {
    setShapeMenu(false);
    addElement({
      id: newId("shape"),
      type: "shape",
      shape: kind,
      x: kind === "line" ? 30 : 38,
      y: kind === "line" ? 50 : 36,
      w: kind === "line" ? 40 : 24,
      h: kind === "line" ? 0 : 28,
      fill: kind === "line" ? null : "accent",
      line: kind === "line" ? "text" : null,
      lineWidth: kind === "line" ? 2 : 0,
      text: "",
      textColor: "background",
      size: 16,
    });
  }
  function pickImage(targetId: string | null) {
    imageTarget.current = targetId;
    imageInput.current?.click();
  }
  async function placeImage(file: File, targetId: string | null) {
    try {
      p.setNotice("正在处理图片…");
      const media = await uploadImage(file);
      const size = SLIDE_SIZES[deck.theme.aspect];
      const target = targetId ? slide.elements.find((el) => el.id === targetId && el.type === "image") : undefined;
      if (target) {
        onSlide((s) => patchElement(s, target.id, (el) => (el.type === "image" ? { ...el, mediaId: media.id, alt: el.alt || file.name.replace(/\.[^.]+$/, "") } : el)));
        setElementId(target.id);
      } else {
        const w = 40;
        const h = Math.min(80, (w * size.w * media.height) / (size.h * media.width));
        addElement({ id: newId("image"), type: "image", x: 30, y: Math.max(5, 50 - h / 2), w, h, mediaId: media.id, fit: "contain", alt: file.name.replace(/\.[^.]+$/, "") });
      }
      p.setNotice(`已插入图片 ${media.width}×${media.height}${media.note ? "（" + media.note + "）" : ""}。`);
    } catch (error) {
      p.setNotice("");
      p.report(error);
    }
  }
  function onLayout(layout: LayoutId) {
    onSlide((s) => (s.layout === layout ? s : applyLayout(s, layout)), "layout");
    setElementId(null);
  }
  function addSlide(layout: LayoutId) {
    if (deck.slides.length >= LIMITS.slides) {
      p.setError(`最多 ${LIMITS.slides} 页。`);
      return;
    }
    const created = newSlide(layout);
    commit((d) => {
      const slides = [...d.slides];
      slides.splice(slideIndex + 1, 0, created);
      return { ...d, slides };
    });
    setSlideId(created.id);
    setElementId(null);
    setTab("slide");
  }
  function duplicateSlide() {
    if (deck.slides.length >= LIMITS.slides) return;
    const copy: Slide = { ...structuredClone(slide), id: newId("slide") };
    commit((d) => {
      const slides = [...d.slides];
      slides.splice(slideIndex + 1, 0, copy);
      return { ...d, slides };
    });
    setSlideId(copy.id);
  }
  function deleteSlide() {
    if (deck.slides.length <= 1) return;
    const next = deck.slides[slideIndex + 1] ?? deck.slides[slideIndex - 1];
    commit((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== slide.id) }));
    setSlideId(next.id);
    setElementId(null);
    p.setNotice(`已删除第 ${slideIndex + 1} 页，可用撤销恢复。`);
  }
  function focusStage() {
    requestAnimationFrame(() => document.getElementById("deck-stage")?.focus({ preventScroll: true }));
  }
  function deleteElement() {
    if (!element) return;
    onSlide((s) => removeElement(s, element.id));
    setElementId(null);
    setEditingId(null);
    setTab("slide");
    focusStage();
  }
  function duplicate() {
    if (!element) return;
    let created = "";
    onSlide((s) => {
      const result = duplicateElement(s, element.id);
      created = result.id;
      return result.slide;
    });
    if (created) setElementId(created);
  }
  function arrange(mode: "forward" | "backward" | "front" | "back") {
    if (element) onSlide((s) => reorderElement(s, element.id, mode), `z:${element.id}`);
  }
  function activate(el: SlideElement) {
    setElementId(el.id);
    setTab("element");
    if (el.type === "image") pickImage(el.id);
    else
      requestAnimationFrame(() => {
        const selector = el.type === "chart" ? "[data-chart-sheet] input.num" : el.type === "table" ? "[data-table-cell]" : "[data-shape-text]";
        document.querySelector<HTMLElement>(`.inspector ${selector}`)?.focus();
      });
  }

  async function exportPptx() {
    setExporting("正在生成 PPTX…");
    p.setError("");
    try {
      try {
        validateDeck(deck);
      } catch (error) {
        throw new Error(`还有未完成的内容，暂不能导出：${error instanceof Error ? error.message : ""}`);
      }
      const blob = await buildPptx(deck, p.title);
      download(blob, safeFileName(p.title, "pptx"));
      p.setNotice(`已导出 ${safeFileName(p.title, "pptx")}（${deck.slides.length} 页，${Math.round(blob.size / 1024)} KB）。`);
    } catch (error) {
      p.report(error);
    } finally {
      setExporting("");
    }
  }
  async function exportJson() {
    try {
      download(await buildProjectJson(deck, p.title), safeFileName(p.title, "json"));
    } catch (error) {
      p.report(error);
    }
  }
  async function importFile(file: File) {
    try {
      p.setNotice("正在导入…");
      const result = await readProjectFile(file);
      if (await p.replace(result.deck, result.title)) {
        p.setNotice(`已导入为新文稿「${result.title}」${result.note ? "（" + result.note + "）" : ""}。`);
      } else p.setNotice("");
    } catch (error) {
      p.setNotice("");
      p.report(error);
    }
  }

  function onKeyDown(event: ReactKeyboardEvent) {
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === "s") {
      event.preventDefault();
      void p.save();
      return;
    }
    if (showing || isEditable(event.target)) return;
    if (mod && key === "z") {
      event.preventDefault();
      if (event.shiftKey) history.redo();
      else history.undo();
      return;
    }
    if (mod && key === "y") {
      event.preventDefault();
      history.redo();
      return;
    }
    if (event.key === "Escape") {
      if (menu || shapeMenu || aiOpen) {
        setMenu(false);
        setShapeMenu(false);
        return;
      }
      select(null);
      return;
    }
    if (!element) {
      if (mod && key === "v" && clipboard.current) {
        event.preventDefault();
        addElement({ ...structuredClone(clipboard.current), id: newId(clipboard.current.type) });
      }
      return;
    }
    if (mod && key === "d") {
      event.preventDefault();
      duplicate();
    } else if (mod && key === "c") {
      const { slot: _slot, ...copy } = structuredClone(element);
      clipboard.current = copy as SlideElement;
    } else if (mod && key === "v" && clipboard.current) {
      event.preventDefault();
      addElement({ ...structuredClone(clipboard.current), id: newId(clipboard.current.type), x: clipboard.current.x + 2, y: clipboard.current.y + 2 });
    } else if (mod && (event.key === "]" || event.key === "[")) {
      event.preventDefault();
      arrange(event.key === "]" ? (event.shiftKey ? "front" : "forward") : event.shiftKey ? "back" : "backward");
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteElement();
    } else if (event.key === "Enter" && element.type === "text") {
      event.preventDefault();
      setEditingId(element.id);
    } else if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const step = event.shiftKey ? 5 : 0.5;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      onSlide((s) => patchElement(s, element.id, (el) => ({ ...el, x: Math.round((el.x + dx) * 100) / 100, y: Math.round((el.y + dy) * 100) / 100 })), `nudge:${element.id}`);
    }
  }

  const phase = p.autoState.phase;
  const prompt = typeof p.draft.prompt === "string" ? p.draft.prompt : "";

  return (
    <main className="deck-app" onKeyDown={onKeyDown}>
      <a className="skip" href="#deck-stage">
        跳到舞台
      </a>
      <header className="topbar">
        <div className="deck-menu-wrap">
          <button
            ref={menuButton}
            type="button"
            className="menu-button"
            aria-haspopup="true"
            aria-expanded={menu}
            onClick={() => {
              setMenu((v) => !v);
              if (!menu) void p.refresh();
            }}
          >
            <Presentation size={16} aria-hidden="true" />
            <span>文稿</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {menu ? (
            <DeckMenu
              menuRef={menuRef}
              items={p.items}
              currentId={p.current?.id}
              busy={p.busy}
              onClose={(restoreFocus) => {
                setMenu(false);
                if (restoreFocus) menuButton.current?.focus();
              }}
              actions={{
                newBlank: () => void p.replace(blankDeck(deck.theme), "未命名演示文稿"),
                newSample: () => void p.fresh(),
                importJson: () => importInput.current?.click(),
                exportJson: () => void exportJson(),
                save: () => void p.save(),
                exportDraft: p.exportDraft,
                open: (id) => void p.open(id),
                remove: () => void p.remove(),
              }}
            />
          ) : null}
        </div>
        <input
          className="deck-title"
          aria-label="文稿名称"
          name="deckTitle"
          autoComplete="off"
          value={p.title}
          maxLength={120}
          disabled={p.loading}
          onChange={(event) => p.setTitle(event.target.value)}
        />
        <span className="save-state" role="status" data-autosave-phase={phase} title={p.autoState.savedAt ? `上次保存 ${new Date(p.autoState.savedAt).toLocaleString("zh-CN")}` : undefined}>
          {p.autoState.message}
        </span>
        {phase === "offline" || phase === "conflict" ? (
          <span className="recovery">
            <button type="button" onClick={p.exportDraft}>
              导出恢复草稿
            </button>
            {phase === "conflict" && p.current ? (
              <button type="button" onClick={() => void p.open(p.current!.id)}>
                打开服务器版本
              </button>
            ) : null}
          </span>
        ) : null}
        <div className="topbar-actions">
          <button type="button" className="icon-button" aria-label="撤销" title="撤销 ⌘Z" disabled={!history.canUndo} onClick={history.undo}>
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" aria-label="重做" title="重做 ⇧⌘Z" disabled={!history.canRedo} onClick={history.redo}>
            <Redo2 size={16} aria-hidden="true" />
          </button>
          <button ref={showButton} type="button" className="ghost" onClick={() => setShowing(true)}>
            <Play size={15} aria-hidden="true" />
            <span className="hide-narrow">放映</span>
          </button>
          <button type="button" className="ghost" aria-expanded={aiOpen} onClick={() => setAiOpen((v) => !v)}>
            <Sparkles size={15} aria-hidden="true" />
            <span className="hide-narrow">AI 大纲</span>
          </button>
          <button type="button" className="primary" disabled={!!exporting || p.loading} onClick={() => void exportPptx()}>
            <Download size={15} aria-hidden="true" />
            <span>{exporting || "导出 PPTX"}</span>
          </button>
        </div>
      </header>
      <Notice error={p.error} notice={p.notice} onDismiss={() => (p.error ? p.setError("") : p.setNotice(""))} />
      {aiOpen ? (
        <AiPanel
          platform={platform}
          checking={checking}
          onRecheck={() => void checkPlatform()}
          prompt={prompt}
          setPrompt={(value) => p.setDraft((extra) => ({ ...extra, prompt: value }))}
          busy={p.aiBusy}
          error={p.aiError}
          suggestion={p.suggestion}
          deck={deck}
          onGenerate={() => void p.generate(prompt)}
          onApply={() => {
            if (!confirm("采用候选大纲并替换当前所有页面吗？可以用撤销恢复。")) return;
            p.applySuggestion((next) => commit(() => next));
            setElementId(null);
          }}
          onDiscard={p.discardSuggestion}
          onClose={() => setAiOpen(false)}
        />
      ) : null}
      <div className="workspace" inert={p.loading || p.busy}>
        <Rail
          slides={deck.slides}
          theme={deck.theme}
          current={slideIndex}
          onSelect={selectSlide}
          onMove={(from, to) => {
            commit((d) => moveSlide(d, from, to));
            setSlideId(deck.slides[from].id);
          }}
          onAdd={addSlide}
          onDuplicate={duplicateSlide}
          onDelete={() => {
            if (confirm(`删除第 ${slideIndex + 1} 页？可以用撤销恢复。`)) deleteSlide();
          }}
        />
        <section
          className="stage-column"
          id="deck-stage"
          tabIndex={-1}
          aria-label={`舞台：第 ${slideIndex + 1} 页，共 ${deck.slides.length} 页`}
          onDragOver={(event) => {
            if ([...event.dataTransfer.items].some((item) => item.kind === "file")) event.preventDefault();
          }}
          onDrop={(event) => {
            const file = [...event.dataTransfer.files].find((f) => f.type.startsWith("image/"));
            if (!file) return;
            event.preventDefault();
            void placeImage(file, element?.type === "image" ? element.id : null);
          }}
        >
          <div className="insert-bar" role="toolbar" aria-label="插入">
            <span className="insert-label">插入</span>
            <button type="button" onClick={() => insert("text")}>
              <Type size={15} aria-hidden="true" />
              文本
            </button>
            <button type="button" onClick={() => pickImage(element?.type === "image" && !element.mediaId ? element.id : null)}>
              <ImageIcon size={15} aria-hidden="true" />
              图片
            </button>
            <button type="button" onClick={() => insert("table")}>
              <Table2 size={15} aria-hidden="true" />
              表格
            </button>
            <button type="button" onClick={() => insert("chart")}>
              <BarChart3 size={15} aria-hidden="true" />
              图表
            </button>
            <div className="shape-wrap">
              <button ref={shapeButton} type="button" aria-haspopup="true" aria-expanded={shapeMenu} onClick={() => setShapeMenu((v) => !v)}>
                <Shapes size={15} aria-hidden="true" />
                形状
                <ChevronDown size={12} aria-hidden="true" />
              </button>
              {shapeMenu ? (
                <div
                  className="shape-menu"
                  role="group"
                  aria-label="选择形状"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setShapeMenu(false);
                      shapeButton.current?.focus();
                    }
                  }}
                >
                  {SHAPE_MENU.map((s, i) => (
                    <button key={s.kind} type="button" autoFocus={i === 0} onClick={() => insertShape(s.kind)}>
                      <ShapeIcon kind={s.kind} />
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <span className="insert-meta">
              第 {slideIndex + 1} / {deck.slides.length} 页 · {LAYOUTS[slide.layout].label}
              {slide.hidden ? " · 已隐藏" : ""}
            </span>
          </div>
          <Stage
            slide={slide}
            theme={deck.theme}
            number={slideIndex + 1}
            selectedId={elementId}
            editingId={editingId}
            onSelect={(id) => {
              select(id);
              if (!id) focusStage();
            }}
            onEdit={(id) => {
              setEditingId(id);
              if (!id) focusStage();
            }}
            onSlide={onSlide}
            onActivate={activate}
          />
          <label className="notes">
            <span>演讲备注</span>
            <textarea
              name="slideNotes"
              autoComplete="off"
              rows={3}
              maxLength={LIMITS.notes}
              value={slide.notes}
              placeholder="写下这一页要讲的话，导出后在演示者视图中可见…"
              onChange={(event) => {
                const value = event.target.value;
                onSlide((s) => ({ ...s, notes: value }), `notes:${slide.id}`);
              }}
            />
          </label>
        </section>
        <Inspector
          tab={tab}
          setTab={setTab}
          deck={deck}
          slide={slide}
          slideIndex={slideIndex}
          element={element}
          onElement={(update, key) => element && onSlide((s) => patchElement(s, element.id, update), key)}
          onSlide={onSlide}
          onTheme={(update, key) => commit((d) => ({ ...d, theme: update(d.theme) }), key)}
          onLayout={onLayout}
          onArrange={arrange}
          onDuplicate={duplicate}
          onDelete={deleteElement}
          onEditText={() => element && setEditingId(element.id)}
          onReplaceImage={() => element && pickImage(element.id)}
          onSelectElement={(id) => select(id)}
        />
      </div>
      {showing ? (
        <Slideshow
          deck={deck}
          start={slideIndex}
          onExit={() => {
            setShowing(false);
            requestAnimationFrame(() => showButton.current?.focus());
          }}
        />
      ) : null}
      <input
        ref={importInput}
        className="sr-only"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        aria-label="导入项目 JSON 文件"
        accept=".json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
      <input
        ref={imageInput}
        className="sr-only"
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        aria-label="选择图片文件"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void placeImage(file, imageTarget.current);
        }}
      />
    </main>
  );
}
