// ABOUTME: 写作台主界面：低存在感页头（文稿/导出菜单）、左侧目录、居中稿纸与按需写作助手；文件进出与自动保存在此编排。
import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { JSONContent } from "@tiptap/core";
import { ListTree, Sparkles, X } from "lucide-react";
import {
  blankDocument,
  outline,
  textStats,
  validateWriting,
  type WritingProject,
} from "../contracts/domain";
import { seed, seedTitle } from "../contracts/sample";
import {
  backupJson,
  importKind,
  MAX_IMPORT_BYTES,
  parseJsonImport,
  safeFileName,
  titleFromFileName,
} from "../contracts/files";
import { download, RenderBoundary, useProjects } from "./workspace";
import { DocumentMenu, ExportMenu } from "./DocumentMenus";
import { Outline, useActiveHeading } from "./Outline";
import { AssistantPanel } from "./AssistantPanel";
import type { EditorApi, EditorMessage } from "./RichEditor";
import { shortcut } from "./keys";

const RichEditor = lazy(() =>
  import("./RichEditor").then((module) => ({ default: module.RichEditor })),
);

const number = new Intl.NumberFormat("zh-CN");
const slashHint = `键入 / 插入块 · ${shortcut("Mod-k").label} 链接 · ${shortcut("Mod-s").label} 立即保存`;

export function WritingApp() {
  const p = useProjects<WritingProject>(seed, validateWriting, seedTitle, {
    storageKey: "tiptap",
  });
  const [epoch, setEpoch] = useState(0);
  const [assistant, setAssistant] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const editorApi = useRef<EditorApi | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const latest = useRef(p);
  latest.current = p;

  const prompt = typeof p.draft.prompt === "string" ? p.draft.prompt : "";
  const withContext = p.draft.withContext === true;
  const setPrompt = (value: string) => p.setDraft((draft) => ({ ...draft, prompt: value }));
  const setWithContext = (value: boolean) =>
    p.setDraft((draft) => ({ ...draft, withContext: value }));

  const initial = useMemo(
    () => structuredClone(p.data.content),
    // 仅在打开/导入/采用另一份文稿时重建编辑器；输入与自动保存不会改变这两个值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.loadEpoch, epoch],
  );
  const onChange = useCallback(
    (content: JSONContent) => latest.current.setData({ content }),
    [],
  );
  const onMessage = useCallback<EditorMessage>((kind, text) => {
    if (kind === "error") latest.current.setError(text);
    else latest.current.setNotice(text);
  }, []);

  const deferred = useDeferredValue(p.data.content);
  const stats = useMemo(() => textStats(deferred), [deferred]);
  const headings = useMemo(() => outline(deferred), [deferred]);
  const active = useActiveHeading(headings.length);
  const selectHeading = useCallback((index: number) => {
    setOutlineOpen(false);
    editorApi.current?.focusHeading(index);
  }, []);

  useEffect(() => {
    if (!p.notice) return;
    const timer = setTimeout(() => latest.current.setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [p.notice]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void latest.current.save();
      }
      if (event.key === "Escape") setOutlineOpen(false);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  const importFile = useCallback(async (file: File) => {
    const project = latest.current;
    project.setError("");
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error(`「${file.name}」超过 ${MAX_IMPORT_BYTES / 1024 / 1024} MB，无法导入。`);
      const kind = importKind(file.name, file.type);
      if (!kind) throw new Error("只能导入 Markdown（.md、.markdown、.txt）或写作台 JSON 文稿。");
      const source = await file.text();
      let title: string | null;
      let data: WritingProject;
      let notes: string[] = [];
      if (kind === "json") {
        let raw: unknown;
        try {
          raw = JSON.parse(source);
        } catch {
          throw new Error(`「${file.name}」不是有效的 JSON。`);
        }
        ({ title, data } = parseJsonImport(raw));
      } else {
        const { fromMarkdown } = await import("./render");
        ({ title, data, notes } = fromMarkdown(source, { extractTitle: true }));
      }
      const name = title ?? titleFromFileName(file.name);
      if (await project.replace(data, name))
        latest.current.setNotice(
          `已导入为新文稿「${name}」${notes.length ? `：${notes.join("；")}` : ""}。原文稿保持不变。`,
        );
    } catch (error) {
      latest.current.report(error);
    }
  }, []);
  const onImportFile = useCallback((file: File) => void importFile(file), [importFile]);

  async function exportAs(kind: "md" | "html" | "json") {
    p.setError("");
    setExporting(true);
    try {
      const data = validateWriting(p.data);
      const title = p.title.trim() || "未命名文稿";
      if (kind === "json") {
        download(new Blob([backupJson(title, data)], { type: "application/json" }), safeFileName(title, "json"));
        return;
      }
      const render = await import("./render");
      if (kind === "md")
        download(
          new Blob([render.toMarkdown(title, data.content)], { type: "text/markdown;charset=utf-8" }),
          safeFileName(title, "md"),
        );
      else
        download(
          new Blob([render.renderDocument(title, data)], { type: "text/html;charset=utf-8" }),
          safeFileName(title, "html"),
        );
    } catch (error) {
      p.report(error);
    } finally {
      setExporting(false);
    }
  }

  async function generate() {
    let context: string | undefined;
    if (withContext) {
      const render = await import("./render");
      context = render.markdownForPrompt(p.data.content);
    }
    await p.generate(prompt, context);
  }

  const phase = p.autoState.phase;
  const narrowOutline = outlineOpen ? "is-open" : "";
  return (
    <main
      className={`writing-app ${assistant ? "has-assistant" : ""}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (event.defaultPrevented) return;
        const file = Array.from(event.dataTransfer.files).find((item) => importKind(item.name, item.type));
        if (file) {
          event.preventDefault();
          void importFile(file);
        }
      }}
    >
      <a className="skip" href="#writing-main">
        跳到正文
      </a>
      <header className="writing-header">
        <h1 className="sr-only">写作台</h1>
        <a className="wordmark" href="#writing-main" translate="no">
          文<span> / </span>写作台
        </a>
        <DocumentMenu
          items={p.items}
          currentId={p.current?.id}
          busy={p.busy}
          onBlank={() => void p.replace(structuredClone(blankDocument), "未命名文稿")}
          onSample={() => void p.fresh()}
          onImport={() => importInput.current?.click()}
          onOpen={(id) => void p.open(id)}
          onDelete={() => void p.remove()}
        />
        <div className="writing-actions">
          <button
            type="button"
            className="outline-toggle"
            aria-expanded={outlineOpen}
            aria-controls="outline-rail"
            onClick={() => setOutlineOpen((value) => !value)}
          >
            <ListTree size={15} aria-hidden="true" />
            <span>目录</span>
          </button>
          <button
            type="button"
            className="assistant-toggle"
            aria-expanded={assistant}
            onClick={() => setAssistant((value) => !value)}
          >
            <Sparkles size={15} aria-hidden="true" />
            <span>写作助手</span>
          </button>
          <ExportMenu
            busy={p.busy || exporting}
            conflict={phase === "conflict" && Boolean(p.current)}
            onMarkdown={() => void exportAs("md")}
            onHtml={() => void exportAs("html")}
            onJson={() => void exportAs("json")}
            onDraft={p.exportDraft}
            onSave={() => void p.save()}
            onServerVersion={() => p.current && void p.open(p.current.id)}
          />
        </div>
      </header>
      {p.error ? (
        <div className="notice error" role="alert">
          <span>{p.error}</span>
          <button type="button" aria-label="关闭提示" title="关闭提示" onClick={() => p.setError("")}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : p.notice ? (
        <p className="notice" role="status">
          {p.notice}
        </p>
      ) : null}
      <div className="writing-layout">
        <nav id="outline-rail" className={`outline-rail ${narrowOutline}`} aria-label="文稿目录">
          <p className="rail-title">目录</p>
          <Outline items={headings} active={active} onSelect={selectHeading} />
        </nav>
        <section className="manuscript" id="writing-main" tabIndex={-1} aria-label="稿纸">
          <div className="manuscript-top">
            <span className="save-state" role="status" data-autosave-phase={phase}>
              <span className="save-dot" aria-hidden="true" />
              {p.autoState.message}
              {phase === "offline" ? (
                <button type="button" className="inline-retry" onClick={() => void p.save()} disabled={p.busy}>
                  重试
                </button>
              ) : null}
            </span>
            <span className="manuscript-count">{number.format(stats.words)} 字</span>
          </div>
          <label className="sr-only" htmlFor="writing-title">
            文档标题
          </label>
          <input
            disabled={p.loading || p.busy}
            id="writing-title"
            name="documentTitle"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            placeholder="文稿标题…"
            onChange={(event) => p.setTitle(event.target.value)}
          />
          <RenderBoundary key={`${p.documentKey}-${epoch}`}>
            <Suspense fallback={<p className="editor-loading" role="status">正在准备编辑器…</p>}>
              <RichEditor
                initial={initial}
                onChange={onChange}
                disabled={p.loading || p.busy}
                apiRef={editorApi}
                onMessage={onMessage}
                onImportFile={onImportFile}
              />
            </Suspense>
          </RenderBoundary>
          <footer className="manuscript-footer">
            <span>
              {number.format(stats.words)} 字 · {number.format(stats.characters)} 字符
              {stats.minutes ? ` · 约 ${stats.minutes} 分钟读完` : ""}
            </span>
            <span className="footer-hint">{slashHint}</span>
          </footer>
        </section>
        {assistant ? (
          <AssistantPanel
            onClose={() => setAssistant(false)}
            prompt={prompt}
            setPrompt={setPrompt}
            withContext={withContext}
            setWithContext={setWithContext}
            busy={p.aiBusy}
            suggestion={p.suggestion}
            onGenerate={() => void generate()}
            onReplace={() => {
              if (confirm("用候选稿替换全部正文吗？当前正文会被覆盖且不能撤销；如需保留，请先导出，或改用「插入到光标处」。")) {
                p.applySuggestion();
                setEpoch((value) => value + 1);
              }
            }}
            onInsert={() => {
              const content = p.suggestion?.content.content ?? [];
              if (!content.length) return;
              editorApi.current?.insertContent(content);
              p.discardSuggestion();
              p.setNotice("已把候选稿插入到光标处，可用撤销（⌘/Ctrl+Z）还原。");
            }}
            onDiscard={p.discardSuggestion}
          />
        ) : null}
      </div>
      <input
        ref={importInput}
        className="sr-only"
        type="file"
        tabIndex={-1}
        aria-label="导入 Markdown 或 JSON 文稿"
        accept=".md,.markdown,.mdown,.txt,.json,text/markdown,text/plain,application/json"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (selected) void importFile(selected);
        }}
      />
    </main>
  );
}
