import { AutoStatus, AutoFeedback } from "./AutosaveStatus";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import {
  ArrowUpRight,
  Download,
  FileText,
  Focus,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  seed,
  validateMindmap,
  restoreMindmapDraft,
} from "../contracts/mindmap";
import {
  download,
  Notice,
  ProjectPicker,
  RenderBoundary,
  useProjects,
} from "./workspace";
const Mindmap = lazy(() =>
  import("./Mindmap").then((module) => ({ default: module.Mindmap })),
);
export function Studio() {
  const p = useProjects(seed, validateMindmap, "未命名脑图", {
    storageKey: "markmap",
    restoreDraftData: restoreMindmapDraft,
  });
  const svg = useRef<SVGSVGElement | null>(null),
    file = useRef<HTMLInputElement | null>(null);
  const [fit, setFit] = useState(0),
    [ai, setAi] = useState(false);
  const [pane, setPane] = useState<"outline" | "map">("map");
  const [outlineOpen, setOutlineOpen] = useState(true);
  const prompt = typeof p.draft.prompt === "string" ? p.draft.prompt : "";
  const setPrompt = (value: string) =>
    p.setDraft((previous) => ({ ...previous, prompt: value }));
  const [rendered, setRendered] = useState<string | null>(null);
  const disabled = p.busy || p.aiBusy;
  const renderError = useCallback(
    (error: unknown) =>
      p.setError(
        error instanceof Error
          ? error.message
          : "脑图渲染失败，请修改内容后重试。",
      ),
    [p.setError],
  );
  const filename = () => p.title.trim().replace(/[\\/:*?"<>|]/g, "_") || "脑图";
  function exportSvg() {
    if (!svg.current || rendered !== p.data.markdown || !p.data.markdown.trim())
      return;
    const bounds = svg.current.querySelector("g")?.getBBox();
    if (!bounds || !bounds.width || !bounds.height) {
      p.setError("脑图仍在布局，请稍后导出。");
      return;
    }
    const clone = svg.current.cloneNode(true) as SVGSVGElement;
    const padding = 30,
      width = Math.ceil(bounds.width + padding * 2),
      height = Math.ceil(bounds.height + padding * 2);
    clone.querySelector("g")?.removeAttribute("transform");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute(
      "viewBox",
      `${bounds.x - padding} ${bounds.y - padding} ${width} ${height}`,
    );
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.color = "#342f29";
    clone.style.background = "#fffdfa";
    download(
      new Blob([new XMLSerializer().serializeToString(clone)], {
        type: "image/svg+xml",
      }),
      filename() + ".svg",
    );
  }
  async function importMarkdown(input: File) {
    try {
      if (input.size > 180000)
        throw new Error("文件过大，请控制在 50,000 字符以内。");
      const data = validateMindmap({ markdown: await input.text() });
      await p.replace(
        data,
        input.name.replace(/\.(md|markdown|txt)$/i, "").slice(0, 120) ||
          "导入脑图",
      );
    } catch (error) {
      p.report(error);
    }
  }
  return (
    <main className={`notebook ${outlineOpen ? "" : "outline-collapsed"}`}>
      <a href="#outline" className="skip-link">
        跳到大纲编辑
      </a>
      <header className="masthead">
        <div className="wordmark">
          <span className="brand-symbol">M</span>
          <div>
            <h1>思路图谱</h1>
          </div>
        </div>
        <div className="project-actions">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={disabled}
            onOpen={(id) => void p.open(id)}
          />
          <button onClick={p.fresh} disabled={disabled}>
            <Plus aria-hidden="true" size={16} />
            新建
          </button>
          <button onClick={() => file.current?.click()} disabled={disabled}>
            <Upload aria-hidden="true" size={16} />
            导入
          </button>
        </div>
      </header>
      <div className="document-bar">
        <div>
          <label className="sr-only" htmlFor="title">
            项目名称
          </label>
          <input
            id="title"
            name="title"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            onChange={(e) => p.setTitle(e.target.value)}
          />
          <AutoStatus state={p.autoState} loading={p.loading} />
        </div>
        <div className="tools">
          <button onClick={() => void p.save()} disabled={disabled}>
            <Save aria-hidden="true" size={16} />
            立即保存
          </button>
          <button
            onClick={() => {
              setOutlineOpen((value) => !value);
              setFit((value) => value + 1);
            }}
            aria-expanded={outlineOpen}
            aria-label={outlineOpen ? "收起大纲" : "展开大纲"}
          >
            {outlineOpen ? (
              <PanelLeftClose size={16} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={16} aria-hidden="true" />
            )}
            大纲
          </button>
          <button onClick={() => setAi((value) => !value)} aria-expanded={ai}>
            <Sparkles aria-hidden="true" size={16} />
            整理提纲
          </button>
          <button
            onClick={() =>
              download(
                new Blob([p.data.markdown], { type: "text/markdown" }),
                filename() + ".md",
              )
            }
          >
            <FileText aria-hidden="true" size={16} />
            Markdown
          </button>
          <button
            onClick={exportSvg}
            disabled={rendered !== p.data.markdown || !p.data.markdown.trim()}
          >
            <Download aria-hidden="true" size={16} />
            SVG
          </button>
          <button
            className="icon-button"
            onClick={() => void p.remove()}
            disabled={disabled || !p.current}
            aria-label="删除脑图"
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
      <Notice error={p.error} notice={p.notice} />
      <AutoFeedback
        state={p.autoState}
        onRetry={() => void p.save()}
        onExport={p.exportDraft}
        onReload={p.current ? () => void p.open(p.current!.id) : undefined}
      />
      {ai ? (
        <section className="ai-panel">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void p.generate(prompt);
            }}
          >
            <label htmlFor="prompt">贴入材料，或描述你想梳理的主题</label>
            <textarea
              id="prompt"
              name="prompt"
              autoComplete="off"
              maxLength={12000}
              required
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：把这段会议记录整理成目标、结论和后续行动…"
            />
            <button className="primary" disabled={disabled}>
              {p.aiBusy ? "正在整理…" : "生成提纲"}
              <ArrowUpRight aria-hidden="true" size={15} />
            </button>
          </form>
          {p.suggestion ? (
            <div className="suggestion">
              <h2>生成稿</h2>
              <pre>{p.suggestion.markdown}</pre>
              <button className="primary" onClick={p.applySuggestion}>
                采用到大纲
              </button>
              <button onClick={p.discardSuggestion}>放弃建议</button>
              <p>采用后可继续编辑，修改会自动保存。</p>
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="mobile-tabs" role="group" aria-label="切换视图">
        <button
          aria-pressed={pane === "outline"}
          onClick={() => {
            setOutlineOpen(true);
            setPane("outline");
          }}
        >
          编辑大纲
        </button>
        <button aria-pressed={pane === "map"} onClick={() => setPane("map")}>
          查看脑图
        </button>
      </div>
      <div className={`split-view show-${pane}`}>
        <section className="outline-pane">
          <div className="pane-heading">
            <h2>Markdown 大纲</h2>
            <span>{p.data.markdown.length.toLocaleString()} 字符</span>
          </div>
          <label className="sr-only" htmlFor="outline">
            Markdown 大纲
          </label>
          <textarea
            id="outline"
            name="markdown"
            autoComplete="off"
            spellCheck={false}
            value={p.data.markdown}
            maxLength={50000}
            onChange={(event) => p.setData({ markdown: event.target.value })}
          />
          <p className="hint">
            用 # 写主题，## 写分支，- 写要点。支持折叠节点与缩放。
          </p>
        </section>
        <section className="map-pane">
          <div className="pane-heading">
            <h2>思路图谱</h2>
            <button
              onClick={() => setFit((value) => value + 1)}
              aria-label="适应脑图"
            >
              <Focus aria-hidden="true" size={16} />
              适应视图
            </button>
          </div>
          <RenderBoundary>
            <Suspense
              fallback={
                <p role="status" className="render-loading">
                  正在铺开思路…
                </p>
              }
            >
              <Mindmap
                markdown={p.data.markdown}
                svgRef={svg}
                fitSignal={fit}
                onError={renderError}
                onRendered={setRendered}
              />
            </Suspense>
          </RenderBoundary>
        </section>
      </div>
      <input
        ref={file}
        type="file"
        className="sr-only"
        aria-label="导入 Markdown 文件"
        accept=".md,.markdown,.txt"
        onChange={(event) => {
          const input = event.target.files?.[0];
          event.target.value = "";
          if (input) void importMarkdown(input);
        }}
      />
    </main>
  );
}
