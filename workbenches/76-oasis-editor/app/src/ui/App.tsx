import { normalizeDocxFonts } from "../contracts/docx-fonts";
import { packNative, unpackNative } from "../contracts/source-package";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorDocument, OasisEditorClient, OasisCommandName } from "oasis-editor";
import { seed, validateDocument, validateImport, restoreDocument, decodeRecovery } from "../contracts/document";
import { useWorkbenchState } from "./autosave-client";
import { NativeEditor } from "./NativeEditor";
import { blank, importNative } from "./engine";
import { fromBase64, storeOriginal, loadOriginal, preflight, imageCount, tableCount } from "./files";
import { download } from "./requests";
import { FileDialog, SideNote, PageIndex, ReadingBar, type Panel } from "./DocumentChrome";
import { Ribbon, type RibbonTab } from "./Ribbon";
import { CommentsPanel } from "./ReviewTools";
import { useEditorSnapshot } from "./ribbon-kit";
import { useFitZoom } from "./fit-zoom";
import { useReview } from "./use-review";
import { DocumentBar, MessageBar } from "./DocumentBar";
import { insertImageFile } from "./images";
export function App() {
  const p = useWorkbenchState(seed, validateDocument, "城南社区共享书房改造项目建议书", {
    storageKey: "oasis-editor-v1",
    restoreDraftData: restoreDocument,
  });
  const live = useRef(p);
  live.current = p;
  const editor = useRef<OasisEditorClient | null>(null),
    version = useRef(0);
  const [client, setClient] = useState<OasisEditorClient | null>(null);
  const [snapshot, refreshSnapshot] = useEditorSnapshot(client);
  const [tab, setTab] = useState<RibbonTab>("home");
  const surface = useRef<HTMLElement>(null);
  const zoom = useFitZoom(surface, snapshot.page?.width ?? 794, p.data.zoom);
  const review = useReview({
    editor,
    documentKey: p.documentKey,
    refresh: refreshSnapshot,
    report: (e) => live.current.report(e),
    saveTrack: (enabled) =>
      live.current.setData((d) => ({ ...d, trackChanges: enabled })),
  });
  const [ready, setReady] = useState(false),
    [switching, setSwitching] = useState(false),
    [operation, setOperation] = useState(""),
    [pages, setPages] = useState(1),
    [panel, setPanel] = useState<Panel>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);
  function showPanel(next: Panel, trigger: HTMLElement) {
    panelTrigger.current = trigger;
    setPanel((value) => (value === next ? null : next));
  }
  function closePanel(restoreFocus = true) {
    setPanel(null);
    if (restoreFocus)
      requestAnimationFrame(() => panelTrigger.current?.focus());
  }
  useEffect(() => {
    if (panel !== "notes" && panel !== "pages" && panel !== "comments") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [panel]);
  const fileInput = useRef<HTMLInputElement>(null),
    recoveryInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    editor.current = null;
    setClient(null);
    setReady(false);
    version.current++;
  }, [p.documentKey]);
  const locked = p.loading || p.busy || switching || !!operation;
  async function transit(action: () => Promise<boolean>) {
    if (switching) return;
    setSwitching(true);
    editor.current?.ui.setReadOnly(true);
    try {
      await action();
    } catch (error) {
      live.current.report(error);
    } finally {
      setSwitching(false);
      editor.current?.ui.setReadOnly(false);
    }
  }
  function changed(key: string, doc: EditorDocument) {
    if (live.current.documentKey !== key) return;
    version.current++;
    try {
      const packed = packNative(doc);
      live.current.setData((d) => ({ ...d, ...packed }));
    } catch (e) {
      live.current.report(e);
    }
  }
  async function task(
    label: string,
    fn: (key: string, v: number) => Promise<void>,
  ) {
    if (operation) return;
    const key = p.documentKey,
      v = version.current;
    setOperation(label);
    p.setError("");
    try {
      await fn(key, v);
    } catch (e) {
      if (live.current.documentKey === key) p.report(e);
    } finally {
      setOperation("");
    }
  }
  function unchanged(key: string, v: number) {
    if (live.current.documentKey !== key || version.current !== v)
      throw Error("操作期间文档已变化，结果未覆盖当前内容，请重试。");
  }
  async function importFile(file: File) {
    await task("读取DOCX…", async (key, v) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const check = preflight(bytes);
      const result = await importNative(bytes, file.name);
      if (!result.document.sourcePackage)
        throw Error("原生编辑器未保留OOXML原件，导入已取消。");
      if (tableCount(result.document) < check.tableCount)
        throw Error("原生编辑器未能读取全部表格，本次未导入；请保留原文件。");
      if (imageCount(result.document) < check.imageCount)
        throw Error(
          "原生编辑器未能读取全部图片。为避免丢图，本次未导入；请保留原文件。",
        );
      unchanged(key, v);
      const warnings = [
        ...check.warnings,
        ...result.warnings,
        ...(result.document.sourcePackage.diagnostics ?? []).map(
          (d) => d.message,
        ),
      ];
      const candidate = validateImport({ ...seed, ...packNative(result.document) });
      const source = await storeOriginal(bytes, file.name, warnings);
      unchanged(key, v);
      if (
        await live.current.replace(
          { ...candidate, source },
          file.name.replace(/\.docx$/i, ""),
        )
      )
        live.current.setNotice(
          "已保存原件并导入为新文稿。可在“文稿 → 文档信息与原件”查看校样说明。",
        );
    });
  }
  async function exportFormat(format: "docx" | "pdf") {
    await task(
      format === "pdf" ? "生成PDF校样…" : "生成DOCX…",
      async (key, v) => {
        const c = editor.current;
        if (!c) throw Error("编辑器尚未就绪。");
        const result = await c.io.export({ format });
        if (!result.ok) throw Error(result.error.message);
        unchanged(key, v);
        const blob =
          format === "docx"
            ? new Blob(
                [
                  new Uint8Array(
                    normalizeDocxFonts(
                      new Uint8Array(await result.value.arrayBuffer()),
                    ),
                  ),
                ],
                {
                  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                },
              )
            : result.value.blob;
        unchanged(key, v);
        download(blob, (p.title || "未命名文稿") + "." + format);
        p.setNotice(
          format === "pdf"
            ? "PDF已导出。请核对分页、图像与表格。"
            : "DOCX已导出，含完整原生文档与保留的OOXML部件。",
        );
      },
    );
  }
  async function importRecovery(file: File) {
    await task("恢复完整工作稿…", async (key, v) => {
      if (file.size > 12 * 1024 * 1024) throw Error("恢复文件超过12MiB。");
      const r = decodeRecovery(JSON.parse(await file.text()));
      if (r.data.source) {
        const s = r.data.source;
        const raw = r.resources[s.hash];
        if (typeof raw !== "string")
          throw Error("恢复稿缺少原件资源，不能静默丢失原稿。");
        const source = await storeOriginal(fromBase64(raw), s.name, s.warnings);
        if (source.hash !== s.hash) throw Error("原件哈希不符。");
      }
      unchanged(key, v);
      if (await live.current.replace(r.data, r.title, r.extra))
        live.current.setNotice("恢复为独立新稿，原文档未被覆盖。");
    });
  }
  async function exportRecovery() {
    await p.exportDraft(async (cache) => {
      const sources = [
        cache.snapshot.data.source,
        cache.current?.data.source,
        cache.pending?.snapshot.data.source,
      ].filter(Boolean);
      const resources: Record<string, string> = {};
      for (const source of sources)
        if (source && !resources[source.hash])
          resources[source.hash] = await loadOriginal(source.hash);
      return { ...cache, format: "oasis-working-copy/v1", resources };
    });
  }
  function command(name: OasisCommandName, payload?: unknown) {
    try {
      editor.current?.commands.execute(name, payload);
      editor.current?.focus.focus();
    } catch (e) {
      p.report(e);
    }
    refreshSnapshot();
  }
  function startComment(trigger: HTMLElement | null) {
    if (!review.beginComment()) return;
    panelTrigger.current = trigger;
    setPanel("comments");
  }
  const key = p.documentKey;
  const images = useMemo(() => imageCount(p.data.document), [p.data.document]);
  const mountedDocument = useMemo(
    () => unpackNative(p.data.document, p.data.archive),
    [key],
  );
  function jump(page: number) {
    document
      .querySelectorAll(".native-host canvas")
      [page - 1]?.scrollIntoView({ block: "start", behavior: "auto" });
    closePanel();
  }
  function newDocument() {
    closePanel(false);
    void transit(() => p.replace({ ...seed, document: blank() }, "未命名文稿"));
  }
  function openDocument(id: string) {
    closePanel(false);
    void transit(() => p.open(id));
  }
  return (
    <main className="manuscript-app">
      <a
        className="skip-link"
        href="#paper"
        onClick={(event) => {
          event.preventDefault();
          editor.current?.focus.focus();
        }}
      >
        跳到正文
      </a>
      <DocumentBar
        title={p.title}
        titleDisabled={p.loading || switching}
        onTitle={(value) => {
          version.current++;
          p.setTitle(value);
        }}
        status={operation || p.autoState.message}
        phase={p.autoState.phase}
        panel={panel}
        showPanel={showPanel}
        hasNotes={!!p.data.notes}
        pdfDisabled={locked || !ready}
        onPdf={() => void exportFormat("pdf")}
      />
      <Ribbon
        client={client}
        snapshot={snapshot}
        tab={tab}
        setTab={setTab}
        disabled={locked || !ready}
        run={command}
        author={review.author}
        setAuthor={review.setAuthor}
        onTrackChange={review.setTrackChanges}
        onComment={() => startComment(document.activeElement as HTMLElement | null)}
        commentsOpen={panel === "comments"}
        toggleComments={(trigger) => showPanel("comments", trigger)}
        onImage={(file) => void task("处理图片…", async () => {
          const note = await insertImageFile(file);
          if (note) live.current.setNotice(note);
        })}
      />
      <MessageBar
        error={p.error}
        notice={p.notice}
        dismiss={() => {
          p.setError("");
          p.setNotice("");
        }}
      />
      <section
        ref={surface}
        className="writing-surface"
        id="paper"
        aria-label="文稿纸张"
      >
        {!p.loading && (
          <NativeEditor
            key={key}
            document={mountedDocument}
            zoom={zoom.effective}
            onChange={(doc) => changed(key, doc)}
            onReady={(next) => {
              if (live.current.documentKey === key) {
                editor.current = next;
                if (next)
                  review.applySavedTrack(next, !!live.current.data.trackChanges);
                setClient(next);
                setReady(!!next);
              }
            }}
            onError={p.report}
            onPages={setPages}
          />
        )}
      </section>
      <ReadingBar
        pages={pages}
        images={images}
        pagesOpen={panel === "pages"}
        onPages={(trigger) => showPanel("pages", trigger)}
        zoom={p.data.zoom}
        fit={zoom.clamped ? zoom.effective : null}
        onZoom={(value) => {
          zoom.choose();
          if (value === null) return;
          version.current++;
          p.setData((data) => ({ ...data, zoom: value }));
        }}
      />
      <CommentsPanel
        open={panel === "comments"}
        close={() => {
          review.setComposing(null);
          closePanel();
        }}
        client={client}
        version={snapshot.commentsKey}
        composing={review.composing}
        setComposing={review.setComposing}
        onAdd={review.addComment}
        onUpdate={review.updateComment}
      />
      <SideNote
        open={panel === "notes"}
        close={() => closePanel()}
        notes={p.data.notes}
        disabled={p.loading || switching}
        onChange={(notes) => {
          version.current++;
          p.setData((data) => ({ ...data, notes }));
        }}
      />
      <PageIndex
        open={panel === "pages"}
        pages={pages}
        close={() => closePanel()}
        jump={jump}
      />
      <FileDialog
        panel={panel}
        close={() => closePanel()}
        items={p.items}
        currentId={p.current?.id}
        locked={locked}
        ready={ready}
        title={p.title}
        source={p.data.source}
        onNew={newDocument}
        onOpen={openDocument}
        onImport={() => fileInput.current?.click()}
        onExport={() => {
          closePanel();
          void exportFormat("docx");
        }}
        onInfo={() => setPanel("info")}
        onRecoveryDownload={() => void exportRecovery()}
        onRecoveryImport={() => recoveryInput.current?.click()}
        onRetry={() => {
          closePanel();
          void p.save();
        }}
        onRemove={() => {
          closePanel(false);
          void transit(() => p.remove());
        }}
        onOriginal={() =>
          void task("取回原件…", async () =>
            download(
              new Blob([
                new Uint8Array(
                  fromBase64(await loadOriginal(p.data.source!.hash)),
                ),
              ]),
              p.data.source!.name,
            ),
          )
        }
      >
        <input
          hidden
          ref={fileInput}
          type="file"
          accept=".docx"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              closePanel(false);
              void importFile(file);
            }
          }}
        />
        <input
          hidden
          ref={recoveryInput}
          type="file"
          accept=".json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              closePanel(false);
              void importRecovery(file);
            }
          }}
        />
      </FileDialog>
    </main>
  );
}
