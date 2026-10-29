import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ReviewPane } from "./ReviewPane.tsx";
import { ContentsPane, SOURCE_LABEL } from "./ContentsPane.tsx";
import { DocumentMenu } from "./DocumentMenu.tsx";
import { PdfPage, type Mark } from "./PdfPage.tsx";
import { useReader } from "./useReader.ts";
import { Notice, download } from "./workspace.tsx";
import { blobRequest } from "./files.ts";
import { activeStructure, type OutlineChoice } from "../contracts/reader.ts";
import { PageJump, StageState, ZOOMS, chapterAt, pathTo } from "./StageParts.tsx";

export function App() {
  const desk = useReader(),
    { project, index, mutable, operation, status, pdf, pdfState } = desk;
  const data = project.data,
    doc = data.document;
  const [tab, setTab] = useState<"contents" | "read" | "review">("read"),
    [menu, setMenu] = useState(false),
    [width, setWidth] = useState(0),
    [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null),
    [picked, setPicked] = useState("");
  const menuButton = useRef<HTMLButtonElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenu(false), []);
  // First open with no saved reading: show the bundled report so the reader has real content.
  const firstRun = useRef(false);
  useEffect(() => {
    if (firstRun.current || project.loading) return;
    firstRun.current = true;
    if (
      !project.items.length &&
      !project.current &&
      !project.data.document &&
      !Object.keys(project.draft).length
    )
      void desk.sample("report");
  }, [project.loading]);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(0, Math.floor(entry.contentRect.width) - 40)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const choice: OutlineChoice =
    data.outline !== "document" && index?.outlines?.some((o) => o.source === data.outline)
      ? data.outline
      : "document";
  const tree = useMemo(
    () => (index ? activeStructure(index, choice) : null),
    [index, choice],
  );
  // The chapter the reader picked wins while its range still holds the page (sections can share a page).
  const trail = useMemo(() => {
    if (!tree) return [];
    const chosen = picked ? pathTo(tree.structure, picked) : [];
    const last = chosen[chosen.length - 1];
    return last && data.page >= last.start_index && data.page <= last.end_index
      ? chosen
      : chapterAt(tree.structure, data.page);
  }, [tree, data.page, picked]);
  const setPage = (page: number) => {
    setSelection(null);
    project.setData((d) => ({ ...d, page }));
  };
  const goTo = (page: number, quote?: string) => {
    setPage(page);
    if (quote) desk.setFocus(page, quote);
    setTab("read");
  };
  const marks = useMemo<Mark[]>(() => {
    const list: Mark[] = data.notes
      .filter((n) => n.page === data.page && n.quote.trim())
      .map((n) => ({ quote: n.quote, kind: "note" }));
    for (const a of desk.answers)
      for (const c of a.citations)
        if (c.page === data.page) list.push({ quote: c.quote, kind: "cite" });
    if (desk.focus?.page === data.page) list.push({ quote: desk.focus.quote, kind: "focus" });
    return list;
  }, [data.notes, data.page, desk.answers, desk.focus]);
  const onSelectText = useCallback((text: string, rect: DOMRect | null) => {
    const host = stage.current;
    if (!text || !rect || !host) {
      setSelection(null);
      return;
    }
    const box = host.getBoundingClientRect();
    setSelection({
      text,
      x: Math.min(box.width - 120, Math.max(8, rect.left - box.left + rect.width / 2 - 50)),
      y: rect.bottom - box.top + host.scrollTop + 6,
    });
  }, []);
  const excerpt = (text?: string) => {
    if (!doc) return;
    const quote =
      text ??
      (index?.pages[data.page - 1]?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const id = desk.addNote(data.page, quote);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    if (id) {
      setTab("review");
      requestAnimationFrame(() => document.getElementById(`note-${id}`)?.focus());
    }
  };
  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!doc || e.target !== e.currentTarget) return;
    if (e.key === "ArrowLeft" && data.page > 1) setPage(data.page - 1);
    if (e.key === "ArrowRight" && data.page < doc.pages) setPage(data.page + 1);
  };
  const rawJson =
    typeof project.draft.inputJson === "string"
      ? project.draft.inputJson
      : JSON.stringify(data, null, 2);
  const phase = project.autoState.phase;
  return (
    <div className="reader-app">
      <a className="skip" href="#page-stage">
        跳到原页
      </a>
      <header className="filebar">
        <h1 className="sr-only">页间 · PageIndex 长报告阅读台</h1>
        <span className="brand-mark" aria-hidden="true">
          页
        </span>
        <input
          className="doc-title"
          aria-label="阅读档案名称"
          name="projectTitle"
          autoComplete="off"
          maxLength={120}
          value={project.title}
          disabled={!mutable}
          onChange={(e) => project.setTitle(e.target.value)}
        />
        <button
          ref={menuButton}
          className="menu-button"
          aria-haspopup="dialog"
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          文档 ▾
        </button>
        <DocumentMenu
          open={menu}
          close={closeMenu}
          trigger={menuButton}
          locked={!mutable}
          items={project.items}
          currentId={project.current?.id}
          document={doc}
          hasIndex={!!index}
          conflict={phase === "conflict" && !!project.current}
          rawJson={rawJson}
          onRawJson={(value) => project.setDraft((d) => ({ ...d, inputJson: value }))}
          onApplyJson={(next) => {
            project.setData(next);
            project.setDraft((d) => {
              const copy = { ...d };
              delete copy.inputJson;
              return copy;
            });
            project.setNotice("已应用档案 JSON。");
          }}
          onOpenPdf={() => desk.file.current?.click()}
          onSample={(key) => void desk.sample(key)}
          onOpenProject={(id) => void desk.openProject(id)}
          onNew={() => void desk.newProject()}
          onExportProject={() => void desk.exportProject()}
          onExportReview={desk.exportReview}
          onExportIndex={() =>
            index &&
            download(
              new Blob(
                [
                  JSON.stringify(
                    {
                      ...index.index,
                      ...(tree && choice !== "document"
                        ? { toc_source: choice, doc_description: tree.description, structure: tree.structure }
                        : {}),
                    },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              ),
              "pageindex-structure.json",
            )
          }
          onDownloadPdf={() =>
            doc &&
            void blobRequest(`/api/documents/${doc.id}/pdf`)
              .then((b) => download(b, doc.name))
              .catch(project.report)
          }
          onImport={() => desk.portable.current?.click()}
          onExportDraft={project.exportDraft}
          onRetrySave={() => void project.save()}
          onServerVersion={() => project.current && void desk.openProject(project.current.id)}
        />
        <span className={`save-state ${phase}`} role="status" title={project.autoState.message}>
          <span className="dot" aria-hidden="true" />
          <span className="save-text">{operation || project.autoState.message}</span>
        </span>
        <span className="health" aria-label="连接状态">
          <span className={status.model ? "pill on" : "pill"} title={status.model ? "模型已连接" : "模型未连接"}>
            模型
          </span>
          <span
            className={status.service?.available ? "pill on" : "pill"}
            title={status.service?.available ? status.service.message : "PageIndex服务未连接（可选）"}
          >
            PageIndex
          </span>
        </span>
        <input
          ref={desk.file}
          hidden
          type="file"
          accept="application/pdf,.pdf"
          aria-label="打开PDF文件"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) void desk.loadPdf(f);
          }}
        />
        <input
          ref={desk.portable}
          hidden
          type="file"
          accept="application/json,.json"
          aria-label="导入阅读档案"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) void desk.importProject(f);
          }}
        />
        <input
          ref={desk.recoveryFile}
          hidden
          type="file"
          accept="application/pdf,.pdf"
          aria-label="补齐原PDF"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) void desk.loadPdf(f, true);
          }}
        />
      </header>
      <Notice error={project.error} notice={project.notice} />
      <nav className="mobile-tabs" aria-label="阅读工作区">
        {(
          [
            ["contents", "目录"],
            ["read", "原页"],
            ["review", `审阅${data.notes.length ? ` ${data.notes.length}` : ""}`],
          ] as const
        ).map(([key, label]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>
      <main className="desk" data-tab={tab}>
        <ContentsPane
          index={index}
          structure={tree?.structure ?? []}
          choice={choice}
          page={data.page}
          query={typeof project.draft.search === "string" ? project.draft.search : ""}
          disabled={!mutable}
          status={status}
          job={desk.job}
          onChoice={(next) => project.setData((d) => ({ ...d, outline: next }))}
          trail={trail.map((n) => n.node_id)}
          onSelect={(node) => {
            setPicked(node.node_id);
            goTo(node.start_index);
          }}
          onQuery={(q) => project.setDraft((d) => ({ ...d, search: q }))}
          onHit={(page, quote) => goTo(page, quote)}
          onRecheck={() => void desk.refreshStatus()}
          onBuild={(mode) => void desk.buildOutline(mode)}
        />
        <section className="reading" aria-label="原页">
          {doc ? (
            <div className="page-tools">
              <div className="pager">
                <button
                  aria-label="上一页"
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                >
                  ‹
                </button>
                <PageJump page={data.page} pages={doc.pages} onGo={setPage} />
                <button
                  aria-label="下一页"
                  disabled={data.page >= doc.pages}
                  onClick={() => setPage(data.page + 1)}
                >
                  ›
                </button>
              </div>
              <span className="trail" title={trail.map((n) => n.title).join(" › ")}>
                {trail.length ? trail[trail.length - 1].title : doc.name}
              </span>
              <label className="zoom">
                <span className="sr-only">缩放</span>
                <select
                  name="zoom"
                  value={data.zoom}
                  onChange={(e) => project.setData((d) => ({ ...d, zoom: Number(e.target.value) }))}
                >
                  {ZOOMS.map((z) => (
                    <option key={z} value={z}>
                      {z ? `${z}%` : "适合宽度"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="solid"
                disabled={!mutable || pdfState !== "ready"}
                onClick={() => excerpt(selection?.text)}
              >
                {selection ? "摘录所选" : "摘录本页"}
              </button>
            </div>
          ) : null}
          <div
            id="page-stage"
            ref={stage}
            className="stage"
            tabIndex={doc ? 0 : -1}
            aria-label={doc ? `原页，第${data.page}页，共${doc.pages}页。左右方向键翻页` : "阅读区"}
            onKeyDown={onStageKey}
            onScroll={() => selection && setSelection(null)}
          >
            {doc && pdf && pdfState === "ready" ? (
              <>
                <PdfPage
                  pdf={pdf}
                  page={data.page}
                  width={Math.min(width, 980)}
                  zoom={data.zoom}
                  marks={marks}
                  focusKey={desk.focus?.key ?? 0}
                  onSelectText={onSelectText}
                />
                {selection ? (
                  <button
                    className="float-excerpt"
                    style={{ left: selection.x, top: selection.y }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => excerpt(selection.text)}
                  >
                    摘录所选
                  </button>
                ) : null}
                <p className="page-foot">
                  {index?.pages[data.page - 1]?.text.trim()
                    ? `第 ${data.page} 页 · ${tree ? SOURCE_LABEL[tree.source] ?? tree.source : ""}`
                    : `第 ${data.page} 页 · 此页没有可提取文字`}
                </p>
              </>
            ) : (
              <StageState
                doc={doc}
                state={pdfState}
                message={desk.pdfMessage}
                busy={doc ? "" : project.loading ? operation || "正在恢复上次阅读…" : operation}
                mutable={mutable}
                onRepair={() => desk.recoveryFile.current?.click()}
                onOpen={() => desk.file.current?.click()}
                onSample={() => void desk.sample("report")}
              />
            )}
          </div>
        </section>
        <ReviewPane desk={desk} goTo={goTo} />
      </main>
    </div>
  );
}
