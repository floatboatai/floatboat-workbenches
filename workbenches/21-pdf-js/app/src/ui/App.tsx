import { useEffect, useRef, useState, useMemo } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Plus,
  FolderOpen,
  FileText,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  CHUNK_BYTES,
  MAX_PDF_BYTES,
  seed,
  validateProject,
  sourceValue,
  decodePortable,
  encodePortable,
  findPages,
  type PdfProject,
  type PdfSource,
} from "../contracts/pdf";
import {
  useProjects,
  ProjectPicker,
  Notice,
  download,
  request,
} from "./workspace";
import { getPageConnection } from "./connection";
import { loadPdf, inspectPdf, pdfError } from "./engine";
import { PdfPage } from "./PdfPage";
const OPTIONS = { storageKey: "pdf-js-reading-room-v1" };
async function getBytes(path: string) {
  const page = await getPageConnection();
  const response = await page.fetch(path);
  if (!response.ok) throw new Error("PDF 原文件不可用，请重新导入便携项目。");
  return new Uint8Array(await response.arrayBuffer());
}
async function hash(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
async function upload(
  bytes: Uint8Array,
  name: string,
  pages: number,
): Promise<PdfSource> {
  const source = { id: await hash(bytes), name, bytes: bytes.length, pages };
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    let binary = "";
    for (const byte of bytes.subarray(offset, offset + CHUNK_BYTES))
      binary += String.fromCharCode(byte);
    await request(`/api/pdfs/${source.id}/chunks/${offset / CHUNK_BYTES}`, {
      method: "PUT",
      body: JSON.stringify({ base64: btoa(binary) }),
    });
  }
  return sourceValue(
    await request("/api/pdfs", {
      method: "POST",
      body: JSON.stringify(source),
    }),
  );
}
export function App() {
  const p = useProjects(seed, validateProject, "未命名阅读项目", OPTIONS);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [loadError, setLoadError] = useState(""),
    [loadingPdf, setLoadingPdf] = useState(false),
    [texts, setTexts] = useState<string[]>([]),
    [indexing, setIndexing] = useState(false),
    [indexError, setIndexError] = useState(""),
    [importing, setImporting] = useState(false),
    [exporting, setExporting] = useState(false),
    [review, setReview] = useState(true),
    [readerWidth, setReaderWidth] = useState(650),
    [reload, setReload] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const source = p.data.source,
    query = typeof p.draft.query === "string" ? p.draft.query : "",
    pageInput =
      typeof p.draft.pageInput === "string"
        ? p.draft.pageInput
        : String(p.data.page);
  const noteLimit = Math.min(
    12000,
    120000 -
      Object.entries(p.data.notes).reduce(
        (sum, [page, note]) =>
          sum + (page === String(p.data.page) ? 0 : note.length),
        0,
      ),
  );
  const results = useMemo(() => findPages(texts, query), [texts, query]);
  useEffect(() => {
    document.title = "PDF 阅读室";
    document.documentElement.lang = "zh-CN";
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver((entries) =>
      setReaderWidth(
        Math.max(200, Math.min(760, entries[0].contentRect.width - 64)),
      ),
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [review, !!source]);
  useEffect(() => {
    setPdf(null);
    setTexts([]);
    setLoadError("");
    setIndexError("");
    setLoadingPdf(!!source);
    setIndexing(false);
    if (!source) return;
    let disposed = false;
    let task: ReturnType<typeof loadPdf> | undefined;
    void (async () => {
      const bytes = await getBytes(`/api/pdfs/${source.id}`);
      if (disposed) return;
      task = loadPdf(bytes);
      const doc = await task.promise;
      if (disposed) return;
      if (doc.numPages !== source.pages)
        throw new Error("PDF 页数与项目不一致，请重新导入。");
      setPdf(doc);
      setLoadingPdf(false);
      setIndexing(true);
      const next: string[] = [];
      try {
        for (let i = 1; i <= doc.numPages; i++) {
          if (disposed) return;
          const text = await (await doc.getPage(i)).getTextContent();
          next.push(
            text.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ")
              .slice(0, 200000),
          );
        }
        if (!disposed) setTexts(next);
      } catch {
        if (!disposed) setIndexError("部分页面无法提取文字，仍可逐页阅读。");
      } finally {
        if (!disposed) setIndexing(false);
      }
    })().catch((e) => {
      if (!disposed) {
        setLoadError(pdfError(e).message);
        setLoadingPdf(false);
      }
    });
    return () => {
      disposed = true;
      void task?.destroy();
    };
  }, [source?.id, p.documentKey, reload]);
  function go(page: number) {
    const next = Math.max(1, Math.min(source?.pages ?? 1, page));
    p.setData((data) => ({ ...data, page: next }));
    p.setDraft((draft) => {
      const nextDraft = { ...draft };
      delete nextDraft.pageInput;
      return nextDraft;
    });
    stage.current?.scrollTo({ top: 0, left: 0 });
  }
  async function openPdf(file: File) {
    setImporting(true);
    p.setError("");
    try {
      if (file.size > MAX_PDF_BYTES) throw new Error("PDF 不能超过 12 MB。");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pages = await inspectPdf(bytes);
      const source = await upload(bytes, file.name.slice(0, 180), pages);
      if (
        await p.replace(
          { ...seed, source },
          file.name.replace(/\.pdf$/i, "").slice(0, 120) || "PDF 阅读项目",
        )
      )
        p.setNotice("已新建阅读项目。");
    } catch (e) {
      p.report(pdfError(e));
    } finally {
      setImporting(false);
    }
  }
  async function sample() {
    setImporting(true);
    p.setError("");
    try {
      const bytes = await getBytes("/api/sample");
      const source = await upload(
        bytes,
        "Field Notes — Waterside.pdf",
        await inspectPdf(bytes),
      );
      await p.replace(
        {
          ...seed,
          source,
          notes: {
            "1": "核对河岸步道的观察记录。\n\n下次现场复核：\n• 南侧入口的步行连续性\n• 林荫座椅与午后遮阴\n• 雨后低洼区域的排水",
          },
        },
        "河岸步道 · 现场观察",
      );
    } catch (e) {
      p.report(e);
    } finally {
      setImporting(false);
    }
  }
  async function importProject(file: File) {
    setImporting(true);
    p.setError("");
    try {
      if (file.size > MAX_PDF_BYTES + 600000)
        throw new Error("便携项目超过容量。");
      const bundle = decodePortable(new Uint8Array(await file.arrayBuffer()));
      if ((await hash(bundle.pdf)) !== bundle.data.source?.id)
        throw new Error("项目中的 PDF 校验失败。");
      const pages = await inspectPdf(bundle.pdf);
      if (pages !== bundle.data.source.pages)
        throw new Error("项目中的 PDF 页数不匹配。");
      const source = await upload(bundle.pdf, bundle.data.source.name, pages);
      if (await p.replace({ ...bundle.data, source }, bundle.title))
        p.setNotice("便携项目已导入为新项目。");
    } catch (e) {
      p.report(pdfError(e));
    } finally {
      setImporting(false);
    }
  }
  async function exportFile(portable: boolean) {
    if (!source) return;
    setExporting(true);
    p.setError("");
    try {
      const bytes = await getBytes(`/api/pdfs/${source.id}`);
      if ((await hash(bytes)) !== source.id)
        throw new Error("原文件校验失败，导出已停止。");
      const data = portable ? encodePortable(p.title, p.data, bytes) : bytes;
      download(
        new Blob([data.slice().buffer], {
          type: portable ? "application/octet-stream" : "application/pdf",
        }),
        portable ? `${p.title || "阅读项目"}.pdfreview` : source.name,
      );
    } catch (e) {
      p.report(e);
    } finally {
      setExporting(false);
    }
  }
  const locked = p.busy || p.loading || importing;
  return (
    <div className="reading-room">
      <a className="skip" href="#reader">
        跳到文档
      </a>
      <header className="filebar">
        <div className="brand">
          <BookOpen size={21} aria-hidden="true" />
          <h1>
            阅读室 <span>PDF</span>
          </h1>
        </div>
        <div className="title-group">
          <label className="sr-only" htmlFor="project-title">
            项目名称
          </label>
          <input
            id="project-title"
            name="project-title"
            autoComplete="off"
            maxLength={120}
            value={p.title}
            onChange={(e) => p.setTitle(e.target.value)}
          />
          <span className={`save-state ${p.autoState.phase}`} role="status">
            {p.autoState.message}
          </span>
        </div>
        <div className="file-actions">
          <button onClick={() => fileInput.current?.click()} disabled={locked}>
            <FileUp size={16} aria-hidden="true" />
            打开 PDF
          </button>
          <details className="file-menu">
            <summary>
              <FolderOpen size={16} aria-hidden="true" />
              项目
            </summary>
            <div className="menu-content">
              <ProjectPicker
                items={p.items}
                id={p.current?.id}
                disabled={locked}
                onOpen={(id) => void p.open(id)}
              />
              <button disabled={locked} onClick={() => void p.fresh()}>
                <Plus size={15} aria-hidden="true" />
                新建空白项目
              </button>
              <button
                disabled={locked}
                onClick={() => projectInput.current?.click()}
              >
                导入便携项目
              </button>
              <button
                disabled={!source || exporting}
                onClick={() => void exportFile(true)}
              >
                导出便携项目
              </button>
              <button
                disabled={!source || exporting}
                onClick={() => void exportFile(false)}
              >
                下载原 PDF
              </button>
              <button onClick={() => p.exportDraft()}>导出恢复草稿</button>
              <button onClick={() => void p.save()}>立即保存 / 重试</button>
              {p.current && (
                <button onClick={() => void p.open(p.current!.id)}>
                  打开服务器版本
                </button>
              )}
              {p.current && (
                <button
                  className="danger"
                  disabled={locked}
                  onClick={() => void p.remove()}
                >
                  删除当前项目
                </button>
              )}
            </div>
          </details>
          <button
            className="export-button"
            disabled={!source || exporting}
            onClick={() => void exportFile(true)}
          >
            <Download size={16} aria-hidden="true" />
            导出项目
          </button>
        </div>
      </header>
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        aria-label="选择 PDF 文件"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void openPdf(file);
        }}
      />
      <input
        ref={projectInput}
        type="file"
        accept=".pdfreview"
        className="hidden"
        aria-label="选择便携项目"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importProject(file);
        }}
      />
      <Notice error={p.error} notice={p.notice} />
      {importing && (
        <div className="notice" role="status">
          正在检查并保存文档…
        </div>
      )}
      {p.autoState.phase === "conflict" && (
        <div className="conflict" role="alert">
          另一窗口已更新项目。
          <button onClick={() => p.exportDraft()}>导出本机草稿</button>
          <button onClick={() => p.current && void p.open(p.current.id)}>
            打开服务器版本
          </button>
        </div>
      )}
      <div className="readbar">
        <div className="searchbox">
          <Search size={16} aria-hidden="true" />
          <input
            name="search"
            aria-label="搜索 PDF 文字"
            placeholder="搜索文档…"
            value={query}
            maxLength={120}
            autoComplete="off"
            onChange={(e) =>
              p.setDraft((draft) => ({ ...draft, query: e.target.value }))
            }
          />
          {query && (
            <button
              aria-label="清除搜索"
              onClick={() => p.setDraft((draft) => ({ ...draft, query: "" }))}
            >
              ×
            </button>
          )}
        </div>
        <div className="page-controls">
          <button
            aria-label="上一页"
            disabled={!pdf || p.data.page <= 1}
            onClick={() => go(p.data.page - 1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(pageInput);
              if (Number.isInteger(n) && n >= 1 && n <= (source?.pages ?? 1))
                go(n);
              else p.setError("请输入文档范围内的页码。");
            }}
          >
            <input
              aria-label="跳转页码"
              name="page"
              inputMode="numeric"
              autoComplete="off"
              value={pageInput}
              maxLength={3}
              onChange={(e) =>
                p.setDraft((draft) => ({ ...draft, pageInput: e.target.value }))
              }
            />
            <span>/ {source?.pages ?? "—"}</span>
          </form>
          <button
            aria-label="下一页"
            disabled={!pdf || p.data.page >= (source?.pages ?? 1)}
            onClick={() => go(p.data.page + 1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <span className="separator" />
          <select
            aria-label="页面缩放"
            value={p.data.zoom}
            onChange={(e) =>
              p.setData((data) => ({ ...data, zoom: Number(e.target.value) }))
            }
          >
            {[
              [0, "适合宽度"],
              [0.5, "50%"],
              [0.75, "75%"],
              [1, "100%"],
              [1.25, "125%"],
              [1.5, "150%"],
              [2, "200%"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          className="review-toggle"
          aria-pressed={review}
          onClick={() => setReview(!review)}
        >
          {review ? (
            <PanelRightClose size={17} aria-hidden="true" />
          ) : (
            <PanelRightOpen size={17} aria-hidden="true" />
          )}
          页边笔记
        </button>
      </div>
      <div
        className={`desk ${review ? "with-review" : ""} ${query ? "searching" : ""}`}
      >
        <nav className="page-rail" aria-label={query ? "搜索结果" : "文档页面"}>
          <div className="rail-title">{query ? "搜索结果" : "页面"}</div>
          {query ? (
            <>
              <p className="search-status" role="status">
                {indexing
                  ? "正在提取文字…"
                  : indexError || `${results.length} 页匹配`}
              </p>
              {results.map((result) => (
                <button
                  className={`search-result ${p.data.page === result.page ? "active" : ""}`}
                  key={result.page}
                  onClick={() => go(result.page)}
                >
                  <b>
                    第 {result.page} 页 · {result.count} 处
                  </b>
                  <span>{result.excerpt}</span>
                </button>
              ))}
              {!indexing && !results.length && (
                <p className="search-status">
                  没有匹配文字。扫描图片不支持文字检索。
                </p>
              )}
            </>
          ) : pdf ? (
            Array.from({ length: pdf.numPages }, (_, i) => (
              <button
                key={i}
                className={`thumbnail ${p.data.page === i + 1 ? "active" : ""}`}
                aria-label={`前往第 ${i + 1} 页`}
                aria-current={p.data.page === i + 1 ? "page" : undefined}
                onClick={() => go(i + 1)}
              >
                <PdfPage pdf={pdf} page={i + 1} width={72} thumbnail />
                <span>
                  {String(i + 1).padStart(2, "0")}
                  {p.data.notes[String(i + 1)]?.trim() && (
                    <i aria-label="有笔记" />
                  )}
                </span>
              </button>
            ))
          ) : (
            <p className="rail-empty">—</p>
          )}
        </nav>
        <main id="reader" className="reader" ref={stage} tabIndex={-1}>
          {loadingPdf ? (
            <div className="empty" role="status">
              <BookOpen size={34} aria-hidden="true" />
              <h2>正在展开文档…</h2>
            </div>
          ) : loadError ? (
            <div className="empty" role="alert">
              <h2>无法打开文档</h2>
              <p>{loadError}</p>
              <button onClick={() => setReload((n) => n + 1)}>重新读取</button>
            </div>
          ) : pdf ? (
            <>
              <div className="page-caption">
                <span>{source?.name}</span>
                <span>第 {p.data.page} 页</span>
              </div>
              <div className="paper-wrap">
                <PdfPage
                  pdf={pdf}
                  page={p.data.page}
                  width={readerWidth}
                  zoom={p.data.zoom}
                />
              </div>
              <div className="page-foot">
                {String(p.data.page).padStart(2, "0")} <span>/</span>{" "}
                {String(pdf.numPages).padStart(2, "0")}
              </div>
            </>
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <FileText size={36} aria-hidden="true" />
              </div>
              <p className="eyebrow">一份文档，一处思考</p>
              <h2>打开文件，开始阅读</h2>
              <p>翻页、查找重点，把想法留在页边。</p>
              <button
                className="primary"
                disabled={locked}
                onClick={() => fileInput.current?.click()}
              >
                <FileUp size={17} aria-hidden="true" />
                选择 PDF
              </button>
              <button
                className="sample-button"
                disabled={locked}
                onClick={() => void sample()}
              >
                试读：河岸步道观察记录 →
              </button>
              <small>支持最多 12 MB、200 页的 PDF</small>
            </div>
          )}
        </main>
        {review && (
          <aside className="review-margin">
            <div className="margin-heading">
              <span className="eyebrow">阅读笔记</span>
              <span className="page-badge">
                P. {String(p.data.page).padStart(2, "0")}
              </span>
            </div>
            <h2>留在这一页的想法</h2>
            <p className="margin-intro">摘记、疑问，或下一步要核对的事。</p>
            <label htmlFor="page-note">第 {p.data.page} 页笔记</label>
            <textarea
              id="page-note"
              name="page-note"
              disabled={!source}
              maxLength={noteLimit}
              placeholder={
                source ? "写下你的观察…" : "打开 PDF 后，开始记笔记…"
              }
              value={p.data.notes[String(p.data.page)] ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                p.setData((data) => ({
                  ...data,
                  notes: { ...data.notes, [String(data.page)]: value },
                }));
              }}
            />
            <div className="note-meta">
              <span>随输入自动保存</span>
              <span>
                {(p.data.notes[String(p.data.page)] ?? "").length} / {noteLimit}
              </span>
            </div>
            <div className="notes-index">
              <h3>有笔记的页面</h3>
              {Object.entries(p.data.notes)
                .filter(([, note]) => note.trim())
                .map(([page, note]) => (
                  <button
                    className={Number(page) === p.data.page ? "active" : ""}
                    key={page}
                    onClick={() => go(Number(page))}
                  >
                    <span>{String(page).padStart(2, "0")}</span>
                    <span>{note.split("\n")[0]}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                ))}
              {!Object.values(p.data.notes).some((note) => note.trim()) && (
                <p>记录后会在这里留下索引。</p>
              )}
            </div>
            <p className="margin-footer">
              笔记与原文件分开保存。
              <br />
              导出项目，可一并带走。
            </p>
          </aside>
        )}
      </div>
      <footer className="statusbar">
        <span>
          {source
            ? `${source.pages} 页 · ${(source.bytes / 1024).toFixed(1)} KB`
            : "本地阅读"}
        </span>
        <span>
          {indexing ? "正在建立文字索引…" : indexError || "原文件保持不变"}
        </span>
        <span>PDF.js</span>
      </footer>
    </div>
  );
}
