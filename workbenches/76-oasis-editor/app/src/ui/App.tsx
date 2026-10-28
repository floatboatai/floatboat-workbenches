import { normalizeDocxFonts } from "../contracts/docx-fonts";
import { packNative, unpackNative } from "../contracts/source-package";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  EditorDocument,
  OasisEditorClient,
  OasisCommandName,
} from "oasis-editor";
import {
  seed,
  validateDocument,
  restoreDocument,
  decodeRecovery,
} from "../contracts/document";
import { useWorkbenchState } from "./autosave-client";
import { NativeEditor } from "./NativeEditor";
import { blank, importNative } from "./engine";
import {
  fromBase64,
  storeOriginal,
  loadOriginal,
  preflight,
  imageCount,
  tableCount,
} from "./files";
import { download } from "./requests";
import {
  FileDialog,
  FormatBar,
  SideNote,
  PageIndex,
  type Panel,
} from "./DocumentChrome";
export function App() {
  const p = useWorkbenchState(seed, validateDocument, "春日社区阅读计划", {
    storageKey: "oasis-editor-v1",
    restoreDraftData: restoreDocument,
  });
  const live = useRef(p);
  live.current = p;
  const editor = useRef<OasisEditorClient | null>(null),
    version = useRef(0);
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
    if (panel !== "notes" && panel !== "pages") return;
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
      const candidate = validateDocument({
        ...seed,
        ...packNative(result.document),
      });
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
  }
  const key = p.documentKey;
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
      <header className="document-bar">
        <div className="file-anchor">
          <span className="wordmark" aria-hidden="true">
            oasis
          </span>
          <button
            className="file-trigger"
            aria-haspopup="dialog"
            aria-expanded={panel === "file" || panel === "info"}
            onClick={(event) => showPanel("file", event.currentTarget)}
          >
            文稿 <span aria-hidden="true">⌄</span>
          </button>
        </div>
        <div className="document-heading">
          <h1 className="sr-only">文稿编辑器</h1>
          <label className="sr-only" htmlFor="document-title">
            文稿名称
          </label>
          <input
            id="document-title"
            name="document-title"
            autoComplete="off"
            disabled={p.loading || switching}
            value={p.title}
            maxLength={120}
            onChange={(event) => {
              version.current++;
              p.setTitle(event.target.value);
            }}
            placeholder="未命名文稿…"
          />
          <span className={"save-state " + p.autoState.phase} role="status">
            {operation || p.autoState.message}
          </span>
        </div>
        <div className="document-output">
          <button
            className="notes-trigger"
            aria-haspopup="dialog"
            aria-expanded={panel === "notes"}
            onClick={(event) => showPanel("notes", event.currentTarget)}
          >
            笔记
            {p.data.notes && <span className="note-dot" aria-hidden="true" />}
          </button>
          <button
            className="pdf-action"
            disabled={locked || !ready}
            onClick={() => void exportFormat("pdf")}
          >
            PDF 校样 <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>
      <FormatBar disabled={locked || !ready} command={command} />
      {(p.error || p.notice) && (
        <div
          className={"message " + (p.error ? "error" : "")}
          role={p.error ? "alert" : "status"}
        >
          <span>{p.error || p.notice}</span>
          <button
            aria-label="关闭提示"
            onClick={() => {
              p.setError("");
              p.setNotice("");
            }}
          >
            ×
          </button>
        </div>
      )}
      <section className="writing-surface" id="paper" aria-label="文稿纸张">
        {!p.loading && (
          <NativeEditor
            key={key}
            document={mountedDocument}
            zoom={p.data.zoom}
            onChange={(doc) => changed(key, doc)}
            onReady={(client) => {
              if (live.current.documentKey === key) {
                editor.current = client;
                setReady(!!client);
                if (
                  client &&
                  window.innerWidth < 760 &&
                  live.current.data.zoom > 35
                )
                  live.current.setData((data) => ({ ...data, zoom: 35 }));
              }
            }}
            onError={p.report}
            onPages={setPages}
          />
        )}
      </section>
      <footer className="reading-bar">
        <button
          className="pages-trigger"
          aria-haspopup="dialog"
          aria-expanded={panel === "pages"}
          onClick={(event) => showPanel("pages", event.currentTarget)}
        >
          {pages} 页 <span aria-hidden="true">⌃</span>
        </button>
        <span className="reading-label">
          {imageCount(p.data.document) > 0
            ? `${imageCount(p.data.document)} 张图片`
            : ""}
        </span>
        <label>
          缩放{" "}
          <select
            aria-label="页面缩放"
            value={p.data.zoom}
            onChange={(event) => {
              version.current++;
              p.setData((data) => ({
                ...data,
                zoom: Number(event.target.value),
              }));
            }}
          >
            {[25, 35, 50, 65, 80, 100, 125, 150].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
      </footer>
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
