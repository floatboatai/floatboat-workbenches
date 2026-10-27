import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  FolderOpen,
  Download,
  Upload,
  Plus,
  RotateCw,
  X,
} from "lucide-react";
import {
  seed,
  validate,
  restoreDraftData,
  fromCsv,
  toCsv,
  decodeCellDraft,
  columnName,
  MAX_IMPORT,
  type CellDraft,
} from "../contracts/workbook";
import { useProjects, download, RenderBoundary } from "./workspace";
import { SheetEditor, type EditorHandle } from "./SheetEditor";
import { isRecord } from "../contracts/project";
export function App() {
  const p = useProjects(seed, validate, "社区工作坊 · 秋季预算", {
    storageKey: "univer-workbook-v1",
    restoreDraftData,
  });
  const editor = useRef<EditorHandle | null>(null),
    file = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<"files" | "import" | null>(null),
    [exporting, setExporting] = useState(false);
  const [liveEdit, setLiveEdit] = useState(false),
    [liveDocument, setLiveDocument] = useState("");
  const recovered = decodeCellDraft(p.draft.cellDraft),
    isLive = liveEdit && liveDocument === p.documentKey;
  const source =
    typeof p.draft.importSource === "string" ? p.draft.importSource : "";
  const format = p.draft.importKind === "json" ? "json" : "csv";
  const importName =
    typeof p.draft.importName === "string" ? p.draft.importName : "导入工作簿";
  function updateDraft(value: CellDraft | null) {
    setLiveDocument(p.documentKey);
    setLiveEdit(value !== null);
    p.setDraft((d) => ({ ...d, cellDraft: value }));
  }
  async function move(action: () => Promise<boolean>) {
    try {
      if (editor.current) await editor.current.snapshot();
      return await action();
    } catch (error) {
      p.report(error);
      return false;
    }
  }
  async function exportFile(kind: "csv" | "json") {
    if (recovered && !isLive) {
      p.setError("请先应用或放弃恢复的单元格草稿，再导出。");
      return;
    }
    if (!editor.current) return;
    setExporting(true);
    p.setError("");
    try {
      const { workbook, sheetId } = await editor.current.snapshot();
      workbook.name = p.title;
      const content =
        kind === "csv"
          ? toCsv(workbook, sheetId)
          : JSON.stringify(workbook, null, 2);
      download(
        new Blob([content], {
          type: kind === "csv" ? "text/csv;charset=utf-8" : "application/json",
        }),
        p.title +
          (kind === "csv"
            ? "-" + workbook.sheets[sheetId]?.name + ".csv"
            : ".univer.json"),
      );
      p.setNotice(
        kind === "csv"
          ? "已导出当前工作表的计算值。文本公式已添加保护前缀。"
          : "已导出包含公式、格式与工作表的工作簿。",
      );
    } catch (e) {
      p.report(e);
    } finally {
      setExporting(false);
    }
  }
  function parseImportJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        "JSON 无法解析，请检查引号、逗号和括号。原始输入已保留。",
      );
    }
  }
  async function importBook() {
    try {
      p.setError("");
      const raw: unknown = format === "json" ? parseImportJson(source) : null;
      const model =
        format === "csv"
          ? fromCsv(source, importName)
          : validate(
              isRecord(raw) && "workbook" in raw ? raw : { workbook: raw },
            );
      if (
        await move(() =>
          p.replace(model, importName.trim() || model.workbook.name),
        )
      ) {
        setPanel(null);
        p.setNotice("已作为新工作簿导入，原工作簿仍在列表中。");
      }
    } catch (e) {
      p.report(e);
    }
  }
  async function readFile(selected: File | undefined) {
    if (!selected) return;
    try {
      if (selected.size > MAX_IMPORT)
        throw new Error("文件超过 850 KB，请减少内容。");
      const text = await selected.text();
      p.setDraft((d) => ({
        ...d,
        importSource: text,
        importKind: selected.name.endsWith(".csv") ? "csv" : "json",
        importName: selected.name
          .replace(/\.(univer\.)?(json|csv)$/i, "")
          .slice(0, 120),
      }));
      setPanel("import");
    } catch (e) {
      p.report(e);
    }
  }
  return (
    <main className="workbook-shell">
      <header className="filebar">
        <div className="brand">
          <FileSpreadsheet size={23} aria-hidden="true" />
          <span>
            Univer<span className="brand-sub">表格</span>
          </span>
        </div>
        <div className="document-heading">
          <label className="sr-only" htmlFor="book-title">
            工作簿名称
          </label>
          <input
            id="book-title"
            value={p.title}
            maxLength={120}
            onChange={(e) => p.setTitle(e.target.value)}
            autoComplete="off"
          />
          <p role="status" data-phase={p.autoState.phase}>
            {recovered ? "单元格草稿 · " : source ? "导入草稿 · " : ""}
            {p.autoState.message}
          </p>
        </div>
        <nav className="file-actions" aria-label="工作簿操作">
          <button
            aria-expanded={panel === "files"}
            onClick={() => setPanel(panel === "files" ? null : "files")}
          >
            <FolderOpen size={16} aria-hidden="true" />
            工作簿
          </button>
          <button
            onClick={async () => {
              if (await move(p.fresh)) setPanel(null);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            新建
          </button>
          <button
            aria-expanded={panel === "import"}
            onClick={() => setPanel(panel === "import" ? null : "import")}
          >
            <Upload size={16} aria-hidden="true" />
            导入
          </button>
          <button
            disabled={exporting || p.loading}
            onClick={() => void exportFile("csv")}
          >
            <Download size={16} aria-hidden="true" />
            CSV
          </button>
          <button
            disabled={exporting || p.loading}
            onClick={() => void exportFile("json")}
          >
            导出工作簿
          </button>
        </nav>
      </header>
      {panel === "files" && (
        <section className="file-panel" aria-label="工作簿列表">
          <div className="panel-heading">
            <h2>工作簿</h2>
            <button onClick={() => setPanel(null)} aria-label="关闭工作簿列表">
              <X size={16} />
            </button>
          </div>
          <div className="file-list">
            {p.items.length ? (
              p.items.map((item) => (
                <button
                  key={item.id}
                  onClick={async () => {
                    if (await move(() => p.open(item.id))) setPanel(null);
                  }}
                  aria-current={item.id === p.current?.id ? "page" : undefined}
                >
                  <FileSpreadsheet size={17} aria-hidden="true" />
                  <span>{item.title}</span>
                  <small>
                    {new Intl.DateTimeFormat("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(item.updatedAt))}
                  </small>
                </button>
              ))
            ) : (
              <p>编辑后，工作簿会自动出现在这里。</p>
            )}
          </div>
          <div className="panel-actions">
            <button onClick={() => void p.refresh().catch(p.report)}>
              刷新列表
            </button>
            <button onClick={p.exportDraft}>导出恢复草稿</button>
            {p.current && (
              <button onClick={() => void move(p.remove)}>
                删除当前工作簿
              </button>
            )}
          </div>
        </section>
      )}
      {panel === "import" && (
        <section className="import-panel" aria-label="导入工作簿">
          <div className="panel-heading">
            <h2>导入为新工作簿</h2>
            <button onClick={() => setPanel(null)} aria-label="关闭导入">
              <X size={16} />
            </button>
          </div>
          <div className="import-fields">
            <label>
              格式
              <select
                aria-label="格式"
                value={format}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, importKind: e.target.value }))
                }
              >
                <option value="csv">CSV（数据文本）</option>
                <option value="json">Univer JSON（含公式和格式）</option>
              </select>
            </label>
            <label>
              新工作簿名称
              <input
                value={importName}
                maxLength={120}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, importName: e.target.value }))
                }
              />
            </label>
            <button onClick={() => file.current?.click()}>选择文件</button>
            <input
              hidden
              ref={file}
              type="file"
              accept=".csv,.json"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <label className="source-label" htmlFor="import-source">
            文件内容
            <textarea
              id="import-source"
              aria-label="文件内容"
              value={source}
              spellCheck={false}
              onChange={(e) => {
                if (
                  new TextEncoder().encode(e.target.value).length > MAX_IMPORT
                ) {
                  p.setError("导入内容超过 850 KB。");
                  return;
                }
                p.setDraft((d) => ({ ...d, importSource: e.target.value }));
              }}
              placeholder="粘贴 CSV 或 Univer JSON…"
            />
          </label>
          <div className="panel-actions">
            <p>CSV 以 = 开头的内容按文本导入；JSON 保留公式。最多 850 KB。</p>
            <button className="primary" onClick={() => void importBook()}>
              创建新工作簿
            </button>
          </div>
        </section>
      )}
      {recovered && (
        <section className="draft-strip" aria-label="单元格草稿">
          <strong>
            {isLive ? "正在编辑" : "恢复的输入"} · {recovered.sheetName}!
            {columnName(recovered.column)}
            {recovered.row + 1}
          </strong>
          {isLive ? (
            <span>按 Enter 应用，Esc 放弃。未提交输入会单独保存。</span>
          ) : (
            <>
              <label className="sr-only" htmlFor="cell-draft">
                恢复的单元格输入
              </label>
              <input
                id="cell-draft"
                value={recovered.text}
                onChange={(e) =>
                  p.setDraft((d) => ({
                    ...d,
                    cellDraft: { ...recovered, text: e.target.value },
                  }))
                }
              />
              <button
                onClick={() => {
                  void editor.current?.apply(recovered).catch(p.report);
                }}
              >
                应用到单元格
              </button>
              <button
                onClick={() => p.setDraft((d) => ({ ...d, cellDraft: null }))}
              >
                放弃草稿
              </button>
            </>
          )}
        </section>
      )}
      {p.error && (
        <div className="feedback error" role="alert">
          <span>{p.error}</span>
          <button onClick={() => p.setError("")} aria-label="关闭错误">
            <X size={16} />
          </button>
        </div>
      )}
      {p.notice && (
        <div className="feedback" role="status">
          <span>{p.notice}</span>
          <button onClick={() => p.setNotice("")} aria-label="关闭提示">
            <X size={16} />
          </button>
        </div>
      )}
      {["offline", "conflict", "draft"].includes(p.autoState.phase) && (
        <div className="recovery-actions">
          <button onClick={() => void p.save()}>
            <RotateCw size={14} aria-hidden="true" />
            重试保存
          </button>
          <button onClick={p.exportDraft}>导出恢复草稿</button>
          {p.current && (
            <button onClick={() => void move(() => p.open(p.current!.id))}>
              打开服务器版本
            </button>
          )}
        </div>
      )}
      {p.loading ? (
        <div className="loading" role="status">
          正在打开工作簿…
        </div>
      ) : (
        <RenderBoundary key={p.documentKey}>
          <SheetEditor
            key={p.documentKey}
            initial={p.data}
            onChange={p.setData}
            onDraft={updateDraft}
            onReady={(h) => {
              editor.current = h;
            }}
            onError={p.report}
          />
        </RenderBoundary>
      )}
      <footer className="workbook-footer">
        <span>双击单元格编辑 · Enter 应用 · Esc 取消</span>
        <span>CSV 导出当前表的值 · 工作簿保留公式与格式</span>
      </footer>
    </main>
  );
}
