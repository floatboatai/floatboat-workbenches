import { forwardRef, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";
import { examples, exampleTopics, type Example } from "../contracts/examples";

export type BookPage = "examples" | "mine" | "files";
interface Props {
  page: BookPage;
  setPage(page: BookPage): void;
  open: boolean;
  locked: boolean;
  items: ProjectSummary[];
  currentId?: string;
  currentExample: string;
  onClose(): void;
  onExample(example: Example): void;
  onBlank(): void;
  onOpen(id: string): void;
  onImport(file: File): void;
  onExportProject(): void;
  onExportRecovery(): void;
  onRetrySave(): void;
  onDelete(): void;
}
const pages: [BookPage, string][] = [
  ["examples", "示例库"],
  ["mine", "我的实验"],
  ["files", "导入与导出"],
];
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** File lifecycle and the example gallery live in one on-demand dialog. */
export const ExperimentBook = forwardRef<HTMLDialogElement, Props>(function ExperimentBook(props, ref) {
  const [topic, setTopic] = useState("全部");
  const shown = useMemo(() => (topic === "全部" ? examples : examples.filter((e) => e.topic === topic)), [topic]);
  return (
    <dialog ref={ref} className="book" aria-labelledby="book-title" onClose={props.onClose}>
      <header className="book-head">
        <h2 id="book-title">实验</h2>
        <div className="book-tabs" role="tablist" aria-label="实验菜单">
          {pages.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={props.page === id} onClick={() => props.setPage(id)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="icon" aria-label="关闭" onClick={() => (ref as { current: HTMLDialogElement | null }).current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {props.open && props.page === "examples" ? (
        <section className="book-body" aria-label="示例库">
          <p className="book-lead">打开示例会新建一个实验，当前实验保持不变。上游示例来自 Ray Optics Simulation 画廊（Apache-2.0），保留原作者署名。</p>
          <div className="topic-filter" role="group" aria-label="按主题筛选">
            {["全部", ...exampleTopics].map((t) => (
              <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)}>
                {t}
              </button>
            ))}
          </div>
          <ul className="example-grid">
            {shown.map((e) => (
              <li key={e.id} className={e.id === props.currentExample ? "current" : ""}>
                <span className="topic">{e.topic}</span>
                <h3>{e.title}</h3>
                <p>{e.summary}</p>
                <p className="credit">
                  {e.origin === "upstream" ? (
                    <>
                      上游画廊 · {e.contributors.join("、")} · Apache-2.0
                    </>
                  ) : (
                    "本工作台示例"
                  )}
                </p>
                <button type="button" className="primary" disabled={props.locked} onClick={() => props.onExample(e)}>
                  打开为新实验
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.open && props.page === "mine" ? (
        <section className="book-body" aria-label="我的实验">
          <div className="row">
            <button type="button" className="primary" disabled={props.locked} onClick={props.onBlank}>
              新建空白光学平台
            </button>
          </div>
          {props.items.length ? (
            <ul className="saved-list">
              {props.items.map((item) => (
                <li key={item.id} aria-current={item.id === props.currentId ? "true" : undefined}>
                  <button type="button" disabled={props.locked || item.id === props.currentId} onClick={() => props.onOpen(item.id)}>
                    <span>{item.title}</span>
                    <small>{item.id.startsWith("local:") ? "本机恢复项 · 尚未确认保存" : when(item.updatedAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">还没有已保存的实验。修改当前实验后会自动保存到这里。</p>
          )}
        </section>
      ) : null}
      {props.open && props.page === "files" ? (
        <section className="book-body files" aria-label="导入与导出">
          <div className="file-card">
            <h3>导入</h3>
            <p>上游 Ray Optics 场景 JSON（version 1–5，旧版本自动升级）、本工作台完整工程或恢复稿。导入总是创建新实验。</p>
            <label className={"file-button primary" + (props.locked ? " disabled" : "")}>
              选择 JSON 文件…
              <input
                type="file"
                accept=".json,application/json"
                disabled={props.locked}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) props.onImport(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="file-card">
            <h3>导出</h3>
            <p>完整工程含场景、记录、质量设置与未完成输入；恢复稿用于保存失败或冲突时带走全部内容。场景 JSON 与 PNG 在平台工具条。</p>
            <div className="row">
              <button type="button" disabled={props.locked} onClick={props.onExportProject}>
                完整工程
              </button>
              <button type="button" onClick={props.onExportRecovery}>
                恢复稿
              </button>
              <button type="button" disabled={props.locked} onClick={props.onRetrySave}>
                立即保存
              </button>
            </div>
          </div>
          {props.currentId ? (
            <div className="file-card">
              <h3>删除</h3>
              <p>删除当前实验及其保存记录。</p>
              <button type="button" className="danger" disabled={props.locked} onClick={props.onDelete}>
                删除当前实验
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </dialog>
  );
});
