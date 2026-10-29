// ABOUTME: “文档”菜单：打开、示例、最近阅读、导出与恢复，集中阅读档案的文件生命周期。
import { useEffect, useRef, useState, type RefObject } from "react";
import type { ProjectSummary } from "../contracts/project.ts";
import { readerValue, type DocumentRef, type ReaderData } from "../contracts/reader.ts";

const when = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export function DocumentMenu({
  open,
  close,
  trigger,
  locked,
  items,
  currentId,
  document,
  hasIndex,
  conflict,
  rawJson,
  onRawJson,
  onApplyJson,
  onOpenPdf,
  onSample,
  onOpenProject,
  onNew,
  onExportProject,
  onExportReview,
  onExportIndex,
  onDownloadPdf,
  onImport,
  onExportDraft,
  onRetrySave,
  onServerVersion,
}: {
  open: boolean;
  close: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
  locked: boolean;
  items: ProjectSummary[];
  currentId?: string;
  document: DocumentRef | null;
  hasIndex: boolean;
  conflict: boolean;
  rawJson: string;
  onRawJson: (value: string) => void;
  onApplyJson: (value: ReaderData) => void;
  onOpenPdf: () => void;
  onSample: (key: "report" | "handbook") => void;
  onOpenProject: (id: string) => void;
  onNew: () => void;
  onExportProject: () => void;
  onExportReview: () => void;
  onExportIndex: () => void;
  onDownloadPdf: () => void;
  onImport: () => void;
  onExportDraft: () => void;
  onRetrySave: () => void;
  onServerVersion: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null),
    [jsonError, setJsonError] = useState("");
  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>("button:not(:disabled)");
    first?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        trigger.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        panel.current &&
        !panel.current.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        close();
    };
    listen(key, outside);
    return () => unlisten(key, outside);
  }, [open, close, trigger]);
  if (!open) return null;
  const act = (fn: () => void) => () => {
    close();
    trigger.current?.focus();
    fn();
  };
  return (
    <div
      ref={panel}
      className="doc-menu"
      role="dialog"
      aria-modal="false"
      aria-label="文档"
    >
      <section>
        <h2>打开</h2>
        <button disabled={locked} onClick={act(onOpenPdf)}>
          打开 PDF…<small>本机文件，最大64MiB / 1000页</small>
        </button>
        <button disabled={locked} onClick={act(() => onSample("report"))}>
          示例：社区图书馆年度报告<small>11页 · 带PDF书签</small>
        </button>
        <button disabled={locked} onClick={act(() => onSample("handbook"))}>
          示例：工坊操作手册<small>3页 · 简短手册</small>
        </button>
        <button disabled={locked} onClick={act(onNew)}>
          新的空白阅读
        </button>
      </section>
      <section>
        <h2>最近阅读</h2>
        {items.length ? (
          <ul className="recent">
            {items.slice(0, 12).map((item) => (
              <li key={item.id}>
                <button
                  disabled={locked || item.id === currentId}
                  aria-current={item.id === currentId ? "true" : undefined}
                  onClick={act(() => onOpenProject(item.id))}
                >
                  <span>{item.title}</span>
                  <small>
                    {item.id === currentId
                      ? "正在阅读"
                      : item.id.startsWith("local:")
                        ? "本机未确认草稿"
                        : item.id.startsWith("draft:")
                          ? "服务器草稿"
                          : when.format(new Date(item.updatedAt))}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">尚无保存的阅读档案。</p>
        )}
      </section>
      <section>
        <h2>导出</h2>
        <button disabled={locked || !document} onClick={act(onExportReview)}>
          审阅 Markdown<small>摘录、意见与已核对回答</small>
        </button>
        <button disabled={locked} onClick={act(onExportProject)}>
          阅读档案 .json<small>含原PDF、摘录、回答与章节树</small>
        </button>
        <button disabled={locked || !hasIndex} onClick={act(onExportIndex)}>
          章节索引 JSON<small>PageIndex结构格式</small>
        </button>
        <button disabled={locked || !document} onClick={act(onDownloadPdf)}>
          原 PDF
        </button>
      </section>
      <section>
        <h2>导入与恢复</h2>
        <button disabled={locked} onClick={act(onImport)}>
          导入阅读档案或恢复稿…<small>总是创建新档案</small>
        </button>
        <button onClick={act(onExportDraft)}>导出恢复草稿</button>
        <button onClick={act(onRetrySave)}>立即重试保存</button>
        {conflict ? (
          <button disabled={locked} onClick={act(onServerVersion)}>
            打开服务器版本
          </button>
        ) : null}
        <details className="json-draft">
          <summary>档案 JSON 草稿</summary>
          <label htmlFor="project-json">未应用的内容也会自动保存</label>
          <textarea
            id="project-json"
            name="projectJson"
            spellCheck={false}
            autoComplete="off"
            value={rawJson}
            maxLength={600000}
            onChange={(e) => {
              setJsonError("");
              onRawJson(e.target.value);
            }}
          />
          {jsonError ? (
            <p className="field-error" role="alert">
              {jsonError}
            </p>
          ) : null}
          <button
            disabled={locked}
            onClick={() => {
              try {
                const next = readerValue(JSON.parse(rawJson));
                if (next.document?.id !== document?.id)
                  throw new Error("JSON草稿不能替换原PDF，请通过“打开 PDF”换文档。");
                onApplyJson(next);
              } catch (e) {
                setJsonError(e instanceof Error ? e.message : "JSON无效。");
              }
            }}
          >
            应用 JSON
          </button>
        </details>
      </section>
    </div>
  );
}
function listen(
  key: (event: KeyboardEvent) => void,
  outside: (event: PointerEvent) => void,
) {
  window.addEventListener("keydown", key);
  window.addEventListener("pointerdown", outside);
}
function unlisten(
  key: (event: KeyboardEvent) => void,
  outside: (event: PointerEvent) => void,
) {
  window.removeEventListener("keydown", key);
  window.removeEventListener("pointerdown", outside);
}
