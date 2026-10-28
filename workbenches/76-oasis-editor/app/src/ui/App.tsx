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
    [panel, setPanel] = useState(() => window.innerWidth > 760);
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
          "已保存原件并导入为新文稿。请在右侧查看校样说明。",
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
  return (
    <main className="manuscript-app">
      <header className="masthead">
        <a className="brand" href="#paper">
          O<span>OASIS / 文稿室</span>
        </a>
        <div className="title-area">
          <label className="sr-only" htmlFor="document-title">
            文稿名称
          </label>
          <input
            id="document-title"
            disabled={p.loading || switching}
            value={p.title}
            maxLength={120}
            onChange={(e) => {
              version.current++;
              p.setTitle(e.target.value);
            }}
            placeholder="未命名文稿"
          />
          <span className={"save-state " + p.autoState.phase} role="status">
            {operation || p.autoState.message}
          </span>
        </div>
        <div className="file-actions">
          <button disabled={locked} onClick={() => fileInput.current?.click()}>
            导入 DOCX
          </button>
          <button
            disabled={locked || !ready}
            onClick={() => void exportFormat("docx")}
          >
            导出 DOCX
          </button>
          <button
            className="primary"
            disabled={locked || !ready}
            onClick={() => void exportFormat("pdf")}
          >
            PDF 校样 ↗
          </button>
        </div>
      </header>
      <nav className="mobile-documents" aria-label="移动端文稿柜">
        <select
          aria-label="移动端打开文稿"
          value={p.current?.id ?? ""}
          disabled={locked}
          onChange={(event) => {
            if (event.target.value)
              void transit(() => p.open(event.target.value));
          }}
        >
          <option value="">当前工作稿</option>
          {p.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <button
          disabled={locked}
          onClick={() =>
            void transit(() =>
              p.replace({ ...seed, document: blank() }, "未命名文稿"),
            )
          }
        >
          ＋ 新建文稿
        </button>
      </nav>
      <nav className="editing-bar" aria-label="文稿排版">
        <div className="tools">
          <button
            title="撤销"
            aria-label="撤销"
            disabled={!ready || locked}
            onClick={() => command("undo")}
          >
            ↶
          </button>
          <button
            title="重做"
            aria-label="重做"
            disabled={!ready || locked}
            onClick={() => command("redo")}
          >
            ↷
          </button>
          <span className="divider" />
          <button
            className="bold"
            disabled={!ready || locked}
            onClick={() => command("bold")}
          >
            加粗
          </button>
          <button disabled={!ready || locked} onClick={() => command("italic")}>
            斜体
          </button>
          <button
            disabled={!ready || locked}
            onClick={() => command("underline")}
          >
            下划线
          </button>
          <label>
            字号{" "}
            <select
              aria-label="字号"
              defaultValue="12"
              disabled={!ready || locked}
              onChange={(e) => command("setFontSize", Number(e.target.value))}
            >
              {[10, 12, 14, 16, 20, 24, 32].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            disabled={!ready || locked}
            onClick={() => command("alignLeft")}
          >
            左对齐
          </button>
          <button
            disabled={!ready || locked}
            onClick={() => command("alignCenter")}
          >
            居中
          </button>
          <button
            disabled={!ready || locked}
            onClick={() => command("bulletList")}
          >
            项目符号
          </button>
          <button
            disabled={!ready || locked}
            onClick={() => command("insertTable", { rows: 3, columns: 3 })}
          >
            插入表格
          </button>
          <button
            disabled={!ready || locked}
            onClick={() => command("pageBreak")}
          >
            分页
          </button>
        </div>
        <button
          className="panel-toggle"
          aria-expanded={panel}
          onClick={() => setPanel(!panel)}
        >
          校样笔记 {panel ? "−" : "+"}
        </button>
      </nav>
      {(p.error || p.notice) && (
        <div
          className={"message " + (p.error ? "error" : "")}
          role={p.error ? "alert" : "status"}
        >
          {p.error || p.notice}
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
      <div className={"desk " + (panel ? "" : "notes-hidden")}>
        <aside className="pages-panel">
          <div className="sidebar-caption">文稿柜</div>
          <label className="sr-only" htmlFor="saved-document">
            打开已保存文稿
          </label>
          <select
            id="saved-document"
            value={p.current?.id ?? ""}
            disabled={locked}
            onChange={(e) =>
              e.target.value && void transit(() => p.open(e.target.value))
            }
          >
            <option value="">当前工作稿</option>
            {p.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
          <button
            className="new-document"
            disabled={locked}
            onClick={() =>
              void transit(() =>
                p.replace({ ...seed, document: blank() }, "未命名文稿"),
              )
            }
          >
            ＋ 新建文稿
          </button>
          <div className="page-heading">
            <span>纸张导航</span>
            <span>{pages} 页</span>
          </div>
          <div className="page-thumbnails">
            {Array.from({ length: Math.min(pages, 50) }, (_, i) => (
              <button
                aria-label={"跳到第" + (i + 1) + "页"}
                key={i}
                onClick={() =>
                  document
                    .querySelectorAll(".native-host canvas")
                    [i]?.scrollIntoView({ block: "start", behavior: "auto" })
                }
              >
                <div className="mini-paper">
                  <span>OASIS</span>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <b>{String(i + 1).padStart(2, "0")}</b>
                </div>
                <small>第 {i + 1} 页</small>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            文稿随输入自动保存
            <br />
            原件与校样分开保留
          </div>
        </aside>
        <section className="paper-column" id="paper">
          <div className="paper-caption">
            <span>编辑工作稿</span>
            <label>
              缩放{" "}
              <select
                aria-label="页面缩放"
                value={p.data.zoom}
                onChange={(e) => {
                  version.current++;
                  p.setData((d) => ({ ...d, zoom: Number(e.target.value) }));
                }}
              >
                {[25, 35, 50, 65, 80, 100, 125, 150].map((n) => (
                  <option key={n} value={n}>
                    {n}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!p.loading && (
            <NativeEditor
              key={key}
              document={mountedDocument}
              zoom={p.data.zoom}
              onChange={(doc) => changed(key, doc)}
              onReady={(c) => {
                if (live.current.documentKey === key) {
                  editor.current = c;
                  setReady(!!c);
                  if (
                    c &&
                    window.innerWidth < 760 &&
                    live.current.data.zoom > 35
                  )
                    live.current.setData((d) => ({ ...d, zoom: 35 }));
                }
              }}
              onError={p.report}
              onPages={setPages}
            />
          )}
        </section>
        {panel && (
          <aside className="proof-panel">
            <div className="sidebar-caption">校样台</div>
            <h2>
              让每一页
              <br />
              都读得顺畅。
            </h2>
            <label htmlFor="proof-notes">编辑笔记</label>
            <textarea
              id="proof-notes"
              disabled={p.loading || switching}
              placeholder="记下待核对的人名、日期或段落…"
              value={p.data.notes}
              maxLength={20000}
              onChange={(e) => {
                version.current++;
                p.setData((d) => ({ ...d, notes: e.target.value }));
              }}
            />
            <section className="proof-details">
              <h3>字体与保真</h3>
              <p>
                本地纸张与 PDF 使用 Workbench Sans SC。DOCX 保留原字体名称；在
                Word 中可能重新分页。DOCX 的东亚文字需要本机安装 Workbench Sans
                SC 或可用中文字体；PDF 已嵌入字库。
              </p>
              <p>
                <a href="/api/fonts/WorkbenchSansSC-Regular.ttf" download>
                  下载常规字体
                </a>{" "}
                ·{" "}
                <a href="/api/fonts/WorkbenchSansSC-Bold.ttf" download>
                  下载粗体
                </a>
              </p>
              <p>
                支持正文、常用格式、表格和嵌入图片。复杂版式请对照原件核对。
              </p>
              {p.data.source && (
                <>
                  <h3>原始文件</h3>
                  <p className="source-name">{p.data.source.name}</p>
                  <button
                    disabled={locked}
                    onClick={() =>
                      void task("取回原件…", async () =>
                        download(
                          new Blob([
                            new Uint8Array(
                              fromBase64(
                                await loadOriginal(p.data.source!.hash),
                              ),
                            ),
                          ]),
                          p.data.source!.name,
                        ),
                      )
                    }
                  >
                    下载未修改原件 ↓
                  </button>
                  {p.data.source.warnings.map((w, i) => (
                    <p key={i} className="source-warning">
                      {w}
                    </p>
                  ))}
                </>
              )}
            </section>
            <section className="recovery-actions">
              <h3>完整工作稿</h3>
              <p>包含原生文档、原始 OOXML、图片、笔记和未完成输入。</p>
              <button onClick={() => void exportRecovery()}>下载恢复稿</button>
              <button
                disabled={locked}
                onClick={() => recoveryInput.current?.click()}
              >
                从恢复稿新建
              </button>
              <button disabled={locked} onClick={() => void p.save()}>
                立即重试保存
              </button>
              {p.current && (
                <button
                  className="delete"
                  disabled={locked}
                  onClick={() => void transit(() => p.remove())}
                >
                  删除此文稿
                </button>
              )}
            </section>
          </aside>
        )}
      </div>
      <footer className="desk-footer">
        <span>OASIS EDITOR · 0.8</span>
        <span>
          {ready ? "原生 Canvas 排版" : "准备编辑器"} ·{" "}
          {imageCount(p.data.document)} 张图片
        </span>
        <span>本机工作稿 · 自动保存</span>
      </footer>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".docx"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }}
      />
      <input
        hidden
        ref={recoveryInput}
        type="file"
        accept=".json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importRecovery(f);
        }}
      />
    </main>
  );
}
