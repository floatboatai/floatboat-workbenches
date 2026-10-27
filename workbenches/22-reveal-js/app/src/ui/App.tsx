import { useEffect, useRef, useState } from "react";
import type { RevealApi } from "reveal.js";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  FolderOpen,
  Maximize2,
  Minimize2,
  Plus,
  Presentation,
  Grid2X2,
} from "lucide-react";
import { useProjects, Notice, download, request } from "./workspace";
import {
  seed,
  validateDeck,
  restoreDeck,
  type Deck,
  type Slide,
  parseSource,
  LIMITS,
  slideTitle,
  toSource,
  portableSource,
  importProject,
  exportProject,
} from "../contracts/deck.ts";
import { isRecord } from "../contracts/project.ts";
import { Stage } from "./Stage";
import { FileTools } from "./FileTools";
import { DeckSettings } from "./DeckSettings";
import { SlideEditor } from "./SlideEditor";

export function App() {
  const p = useProjects(seed, validateDeck, "把想法，讲给世界听", {
    storageKey: "reveal-desk-v1",
    restoreDraftData: restoreDeck,
  });
  return p.loading ? (
    <main className="loading" role="status">
      正在打开排练桌…
    </main>
  ) : (
    <Desk key={p.documentKey} p={p} />
  );
}
export type Projects = ReturnType<typeof useProjects<Deck>>;
function Desk({ p }: { p: Projects }) {
  const api = useRef<RevealApi | null>(null),
    playButton = useRef<HTMLButtonElement>(null),
    fileButton = useRef<HTMLButtonElement>(null);
  const [files, setFiles] = useState(false),
    [presenting, setPresenting] = useState(false),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (!presenting) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [presenting]);
  const selected = typeof p.draft.selected === "string" ? p.draft.selected : "";
  const index = Math.max(
      0,
      p.data.slides.findIndex((slide) => slide.id === selected),
    ),
    slide = p.data.slides[index];
  const sourceOpen = p.draft.sourceOpen === true;
  const hasDraft =
    typeof p.draft.source === "string" && p.draft.source !== toSource(p.data);
  const select = (n: number) => {
    const target = p.data.slides[n];
    if (target) p.setDraft((d) => ({ ...d, selected: target.id }));
  };
  const add = (copy = false) => {
    if (p.data.slides.length >= LIMITS.slides) {
      p.setError("最多 50 页，请先精简内容。");
      return;
    }
    const next: Slide = {
      id: crypto.randomUUID(),
      markdown: copy ? slide.markdown : "## 新的一页\n\n写下你想分享的观点。",
      notes: copy ? slide.notes : "",
    };
    p.setData((d) => ({
      ...d,
      slides: [
        ...d.slides.slice(0, index + 1),
        next,
        ...d.slides.slice(index + 1),
      ],
    }));
    p.setDraft((d) => ({ ...d, selected: next.id }));
  };
  const openSource = () => {
    try {
      const generated =
        typeof p.draft.source === "string"
          ? p.draft.source
          : portableSource(p.data);
      p.setDraft((d) => ({ ...d, source: generated, sourceOpen: true }));
    } catch (e) {
      p.report(e);
    }
  };
  const closePresentation = () => {
    setPresenting(false);
    requestAnimationFrame(() => playButton.current?.focus());
  };
  async function importFile(input: File) {
    p.setError("");
    try {
      if (input.size > 5000000) throw new Error("恢复文件不能超过 5 MB。");
      const raw = await input.text();
      let json: unknown = null;
      if (!/\.md$/i.test(input.name)) {
        try {
          json = JSON.parse(raw) as unknown;
        } catch {
          throw new Error(
            "文件不是有效的项目 JSON，请选择排练桌导出的项目或恢复文件。",
          );
        }
      }
      if (
        input.size > LIMITS.file &&
        !(isRecord(json) && isRecord(json.snapshot))
      )
        throw new Error("导入文件不能超过 400 KB。");
      const imported = /\.md$/i.test(input.name)
        ? {
            data: parseSource(raw),
            title: input.name.replace(/\.md$/i, "").slice(0, 120) || "导入演示",
            extra: {},
          }
        : importProject(json);
      if (await p.replace(imported.data, imported.title, imported.extra))
        p.setNotice("已导入为新演示，原演示仍保留。");
    } catch (e) {
      p.report(e);
    }
  }
  async function exportFile(kind: "project" | "markdown" | "html") {
    p.setError("");
    setExporting(true);
    try {
      const data = validateDeck(p.data),
        name = p.title.trim() || "未命名演示";
      let content: string, ext: string, mime: string;
      if (kind === "html") {
        const result = await request("/api/export/html", {
          method: "POST",
          body: JSON.stringify({ data, title: name }),
        });
        if (!isRecord(result) || typeof result.html !== "string")
          throw new Error("导出响应无效。");
        content = result.html;
        ext = "html";
        mime = "text/html";
      } else if (kind === "project") {
        content = exportProject(data, name);
        ext = "reveal.json";
        mime = "application/json";
      } else {
        content = portableSource(data);
        ext = "md";
        mime = "text/markdown";
      }
      download(
        new Blob([content], { type: mime + ";charset=utf-8" }),
        name.replace(/[\\/:*?"<>|]/g, "-") + "." + ext,
      );
      p.setNotice(
        kind === "html"
          ? "已导出离线演示网页。打开文件即可播放；文件中包含讲者备注。"
          : "已导出当前演示。",
      );
    } catch (e) {
      p.report(e);
    } finally {
      setExporting(false);
    }
  }
  return (
    <main className="desk">
      <a
        className="skip-link"
        href={sourceOpen ? "#deck-source" : "#slide-markdown"}
      >
        跳到讲稿编辑
      </a>
      <header className="app-bar">
        <div className="brand">
          <Presentation aria-hidden="true" size={22} />
          <h1>
            Reveal <span>排练桌</span>
          </h1>
        </div>
        <span className="autosave" role="status" data-phase={p.autoState.phase}>
          <i />
          {p.autoState.message}
          {hasDraft ? " · 另有待应用源稿" : ""}
        </span>
        <button
          ref={fileButton}
          aria-expanded={files}
          onClick={() => setFiles(!files)}
        >
          <FolderOpen aria-hidden="true" size={16} />
          演示文件
          <ChevronDown aria-hidden="true" size={14} />
        </button>
      </header>
      {files ? (
        <FileTools
          p={p}
          exporting={exporting}
          onExport={exportFile}
          onImport={importFile}
          onClose={() => {
            setFiles(false);
            fileButton.current?.focus();
          }}
        />
      ) : null}
      <section className="deck-toolbar" aria-label="演示操作">
        <div className="deck-name">
          <span className="eyebrow">演示文稿 / REHEARSAL</span>
          <input
            aria-label="演示名称"
            name="deck-title"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            onChange={(e) => p.setTitle(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <button onClick={openSource}>
            整套源稿{hasDraft ? <i className="draft-dot" /> : null}
          </button>
          <button disabled={exporting} onClick={() => void exportFile("html")}>
            <Download aria-hidden="true" size={16} />
            {exporting ? "正在导出…" : "离线网页"}
          </button>
          <button
            ref={playButton}
            className="primary"
            onClick={() => setPresenting(true)}
          >
            <Presentation aria-hidden="true" size={16} />
            开始放映
          </button>
        </div>
      </section>
      <Notice error={p.error} notice={p.notice} />
      <nav className="slide-strip" aria-label="幻灯片页序">
        {p.data.slides.map((row, n) => (
          <button
            key={row.id}
            aria-label={`第 ${n + 1} 页：${slideTitle(row)}`}
            aria-current={n === index ? "step" : undefined}
            onClick={() => select(n)}
          >
            <span className="slide-no">{String(n + 1).padStart(2, "0")}</span>
            <span className="slide-mini" data-theme={p.data.theme}>
              <b>{slideTitle(row)}</b>
              <i />
            </span>
            <span className="slide-caption">{slideTitle(row)}</span>
          </button>
        ))}
        <button
          className="strip-add"
          aria-label="添加幻灯片"
          disabled={p.data.slides.length >= LIMITS.slides}
          onClick={() => add()}
        >
          <Plus aria-hidden="true" size={24} />
          <span>新一页</span>
        </button>
      </nav>
      <div className="rehearsal-grid">
        <section className="stage-column" aria-label="排练与显示设置">
          <div className="section-heading">
            <span>
              <i className="live-dot" />
              实时舞台
            </span>
            <span>
              {p.data.ratio === "wide" ? "16:9" : "4:3"} ·{" "}
              {p.data.slides.length} 页
            </span>
          </div>
          <div
            className={`stage-container${presenting ? " presenting" : ""}`}
            role={presenting ? "dialog" : undefined}
            aria-modal={presenting ? true : undefined}
            aria-label={presenting ? "演示放映" : undefined}
            onKeyDown={(e) => {
              if (!presenting) return;
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                closePresentation();
              }
              if (e.key === "Tab") {
                const controls = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    'button,[tabindex="0"]',
                  ),
                ).filter(
                  (el) =>
                    el.getClientRects().length > 0 &&
                    el.tabIndex >= 0 &&
                    !el.hasAttribute("disabled"),
                );
                const first = controls[0],
                  last = controls.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            {presenting ? (
              <button className="exit-presentation" onClick={closePresentation}>
                <Minimize2 aria-hidden="true" size={16} />
                退出放映 <kbd>Esc</kbd>
              </button>
            ) : null}
            <div
              className="stage-frame"
              style={{
                aspectRatio: p.data.ratio === "wide" ? "16 / 9" : "4 / 3",
              }}
            >
              <Stage
                data={p.data}
                index={index}
                onIndex={select}
                api={api}
                presenting={presenting}
              />
            </div>
            <div className="playback">
              <div>
                <button aria-label="上一步" onClick={() => api.current?.prev()}>
                  <ArrowLeft aria-hidden="true" size={18} />
                </button>
                <span className="page-count">
                  {String(index + 1).padStart(2, "0")}{" "}
                  <small>
                    / {String(p.data.slides.length).padStart(2, "0")}
                  </small>
                </span>
                <button aria-label="下一步" onClick={() => api.current?.next()}>
                  <ArrowRight aria-hidden="true" size={18} />
                </button>
              </div>
              <span className="playback-tip">点击舞台 · 方向键排练</span>
              <div>
                <button
                  aria-label="幻灯片总览"
                  onClick={() => {
                    api.current?.toggleOverview();
                    api.current?.getRevealElement()?.focus();
                  }}
                >
                  <Grid2X2 aria-hidden="true" size={17} />
                </button>
                <button
                  aria-label="放大舞台"
                  onClick={() => setPresenting(true)}
                >
                  <Maximize2 aria-hidden="true" size={17} />
                </button>
              </div>
            </div>
          </div>
          <DeckSettings
            data={p.data}
            onChange={(change) => p.setData((d) => ({ ...d, ...change }))}
          />
        </section>
        <SlideEditor p={p} index={index} onCopy={() => add(true)} />
      </div>
      <footer className="desk-footer">
        <span>
          REVEAL.JS <b>6.0.2</b>
        </span>
        <span>文字成页，故事成形。</span>
        <span>HTML 与外链按文字展示</span>
      </footer>
    </main>
  );
}
