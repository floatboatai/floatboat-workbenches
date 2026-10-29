// ABOUTME: 文稿菜单：新建/示例/最近文稿/导入（资料文件、项目、Presenton JSON 粘贴）/导出（项目、大纲、PPTX、PDF）/删除。
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { BRIEF_ACCEPT, briefFromFile } from "../contracts/brief-import";
import { EXAMPLE_TITLE, exampleDeck, outlineMarkdown } from "../contracts/deck";
import { blank } from "../contracts/model";
import type { Doc } from "./App";
import { buildPdfFile, buildPptx, buildProjectJson, importProjectText, safeFileName } from "./export";
import { download } from "./requests";

export function useExports(doc: Doc) {
  const [busy, setBusy] = useState("");
  async function run(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    doc.setError("");
    try {
      await fn();
    } catch (e) {
      doc.report(e);
    } finally {
      setBusy("");
    }
  }
  return {
    busy,
    pptx: () =>
      run("pptx", async () => {
        download(await buildPptx(doc.data, doc.title), safeFileName(doc.title, "pptx"));
        doc.setNotice(`已导出 PPTX（${doc.data.slides.length} 页，含原生图表与演讲备注）。`);
      }),
    pdf: () =>
      run("pdf", async () => {
        download(await buildPdfFile(doc.data, doc.title), safeFileName(doc.title, "pdf"));
        doc.setNotice(`已导出 PDF（${doc.data.slides.length} 页）。`);
      }),
    project: () =>
      run("project", async () => {
        download(await buildProjectJson(doc.data, doc.title, doc.draft), safeFileName(doc.title, "presenton.json"));
      }),
    markdown: () =>
      run("markdown", async () => {
        download(new Blob([outlineMarkdown(doc.title, doc.data)], { type: "text/markdown;charset=utf-8" }), safeFileName(doc.title, "md"));
      }),
  };
}

export function FileMenu({ doc }: { doc: Doc; onOpened: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const ex = useExports(doc);
  const raw = typeof doc.draft.importText === "string" ? doc.draft.importText : "";
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const away = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const act = (fn: () => unknown) => () => {
    setOpen(false);
    void fn();
  };
  async function importFile(f: File) {
    doc.setError("");
    try {
      if (/\.json$/i.test(f.name)) {
        const parsed = await importProjectText(await f.text());
        if (await doc.replace(parsed.deck, parsed.title, parsed.extra)) doc.setNotice(`已导入为新文稿「${parsed.title}」，原文稿保持不变。`);
        return;
      }
      const source = await briefFromFile(f.name, new Uint8Array(await f.arrayBuffer()));
      const title = f.name.replace(/\.[^.]+$/, "").slice(0, 120) || "导入的资料";
      if (await doc.replace({ ...structuredClone(blank), brief: { ...blank.brief, source } }, title, { step: "brief" }))
        doc.setNotice(`已从「${f.name}」新建文稿，资料共 ${source.length.toLocaleString()} 字。下一步：生成大纲。`);
    } catch (e) {
      doc.report(e);
    }
  }
  async function importRaw() {
    try {
      const parsed = await importProjectText(raw);
      const ok = await doc.replace(parsed.deck, parsed.title, parsed.extra);
      if (ok) {
        dialog.current?.close();
        doc.setNotice(`已导入为新文稿「${parsed.title}」。`);
      }
    } catch (e) {
      doc.report(e);
    }
  }
  return (
    <div className="file-menu">
      <button ref={button} type="button" className="menu-button" aria-expanded={open} aria-controls="file-menu-panel" onClick={() => setOpen((o) => !o)}>
        <FileText size={16} aria-hidden="true" />
        文稿
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <input ref={file} type="file" hidden accept={`${BRIEF_ACCEPT},.json,application/json`} onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void importFile(f);
      }} />
      {open && (
        <div
          ref={panel}
          id="file-menu-panel"
          className="menu-panel"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <div className="menu-group">
            <button type="button" onClick={act(() => doc.replace(structuredClone(blank), "未命名演示文稿", { step: "brief" }))}>
              新建空白文稿
            </button>
            <button type="button" onClick={act(() => doc.replace(exampleDeck(), EXAMPLE_TITLE))}>
              用示例资料新建
            </button>
            <button type="button" onClick={act(() => file.current?.click())}>
              导入文件…<small>资料 .md .txt .docx .html .csv · 项目 .json</small>
            </button>
            <button type="button" onClick={act(() => dialog.current?.showModal())}>
              粘贴 JSON 导入…<small>项目、恢复副本或 Presenton 响应</small>
            </button>
          </div>
          <div className="menu-group">
            <button type="button" disabled={!!ex.busy} onClick={act(ex.pptx)}>
              导出 PPTX
            </button>
            <button type="button" disabled={!!ex.busy} onClick={act(ex.pdf)}>
              导出 PDF
            </button>
            <button type="button" onClick={act(ex.project)}>
              导出项目（.json，含图片）
            </button>
            <button type="button" onClick={act(ex.markdown)}>
              导出大纲（.md）
            </button>
          </div>
          <div className="menu-group recent">
            <p className="menu-label">最近文稿</p>
            {doc.items.length === 0 && <p className="menu-empty">还没有保存过的文稿。</p>}
            {doc.items.slice(0, 12).map((item) => (
              <button key={item.id} type="button" aria-current={item.id === doc.current?.id ? "true" : undefined} onClick={act(() => doc.open(item.id))}>
                <span className="recent-title">{item.title}</span>
                <small>{item.id.startsWith("local:") ? "本机恢复" : new Date(item.updatedAt).toLocaleString()}</small>
              </button>
            ))}
          </div>
          <div className="menu-group">
            <button type="button" className="danger" disabled={!doc.current || doc.busy} onClick={act(() => doc.remove())}>
              删除此文稿…
            </button>
          </div>
        </div>
      )}
      <dialog ref={dialog} className="import-dialog" aria-labelledby="import-title">
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            void importRaw();
          }}
        >
          <h2 id="import-title">粘贴 JSON 导入</h2>
          <p>本工作台的项目文件、自动保存的恢复副本，或 Presenton 返回的任务 / 演示文稿 JSON。导入总是新建文稿；未完成的内容会随草稿保存。</p>
          <label className="sr-only" htmlFor="import-text">
            待导入内容
          </label>
          <textarea id="import-text" spellCheck={false} rows={14} value={raw} maxLength={1_800_000} onChange={(e) => doc.setDraft((d) => ({ ...d, importText: e.target.value }))} />
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => dialog.current?.close()}>
              取消
            </button>
            <button type="submit" className="primary" disabled={!raw.trim()}>
              导入为新文稿
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
