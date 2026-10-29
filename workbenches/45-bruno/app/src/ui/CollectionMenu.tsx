import { useEffect, useRef } from "react";
import type { ProjectSummary } from "../contracts/project";
import { Modal } from "./Modal";

const when = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function CollectionMenu({
  open,
  onClose,
  title,
  setTitle,
  items,
  currentId,
  locked,
  phase,
  message,
  onBlank,
  onSample,
  onOpen,
  onImportFiles,
  onExportZip,
  onExportRequest,
  onExportProject,
  onExportDraft,
  onSave,
  onServerVersion,
  onRemove,
  canExportRequest,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  setTitle: (t: string) => void;
  items: ProjectSummary[];
  currentId?: string;
  locked: boolean;
  phase: string;
  message: string;
  onBlank: () => void;
  onSample: () => void;
  onOpen: (id: string) => void;
  onImportFiles: (files: FileList | null) => void;
  onExportZip: () => void;
  onExportRequest: () => void;
  onExportProject: () => void;
  onExportDraft: () => void;
  onSave: () => void;
  onServerVersion: () => void;
  onRemove: () => void;
  canExportRequest: boolean;
}) {
  const folder = useRef<HTMLInputElement>(null);
  useEffect(() => {
    folder.current?.setAttribute("webkitdirectory", "");
  });
  return (
    <Modal open={open} onClose={onClose} title="集合" eyebrow="BRUNO" className="menu-dialog">
      <div className="menu-grid">
        <section aria-labelledby="menu-current">
          <h3 id="menu-current">当前集合</h3>
          <label>
            名称
            <input maxLength={120} value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <p className={"save-line " + phase} role="status">
            {message}
          </p>
          <div className="menu-actions">
            <button disabled={locked} onClick={onSave}>
              立即保存
            </button>
            {phase === "conflict" && currentId ? (
              <button disabled={locked} onClick={onServerVersion}>
                打开服务器版本
              </button>
            ) : null}
            {currentId ? (
              <button className="danger" disabled={locked} onClick={onRemove}>
                删除此集合
              </button>
            ) : null}
          </div>
        </section>
        <section aria-labelledby="menu-new">
          <h3 id="menu-new">新建与打开</h3>
          <div className="menu-actions">
            <button disabled={locked} onClick={onBlank}>
              新建空白集合
            </button>
            <button disabled={locked} onClick={onSample}>
              打开示例集合
            </button>
          </div>
          {items.length ? (
            <ul className="recent" aria-label="已保存集合">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    disabled={locked}
                    aria-current={item.id === currentId ? "true" : undefined}
                    onClick={() => onOpen(item.id)}
                  >
                    <span>{item.title}</span>
                    <small>{item.updatedAt ? when.format(new Date(item.updatedAt)) : ""}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">还没有其他已保存的集合。</p>
          )}
        </section>
        <section aria-labelledby="menu-import">
          <h3 id="menu-import">导入（创建新副本）</h3>
          <div className="menu-actions">
            <label className={"file-button" + (locked ? " disabled" : "")}>
              .bru / ZIP / 工程 JSON
              <input
                type="file"
                multiple
                accept=".bru,.json,.zip"
                disabled={locked}
                onChange={(e) => {
                  onImportFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <label className={"file-button" + (locked ? " disabled" : "")}>
              集合文件夹
              <input
                ref={folder}
                type="file"
                multiple
                disabled={locked}
                onChange={(e) => {
                  onImportFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="hint">
            支持 Bruno 集合文件夹（含 environments/、collection.bru、folder.bru）、其 ZIP 压缩包、单个 .bru 与本工作台的工程/恢复 JSON。
          </p>
        </section>
        <section aria-labelledby="menu-export">
          <h3 id="menu-export">导出</h3>
          <div className="menu-actions">
            <button onClick={onExportZip}>原生集合 ZIP</button>
            <button disabled={!canExportRequest} onClick={onExportRequest}>
              当前请求 .bru
            </button>
            <button onClick={onExportProject}>完整工程 JSON</button>
            <button onClick={onExportDraft}>恢复稿</button>
          </div>
          <p className="hint">ZIP 可直接用 Bruno 打开；秘密变量的值不会导出。完整工程额外包含响应历史与未完成的编辑。</p>
        </section>
      </div>
    </Modal>
  );
}
