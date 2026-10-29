// ABOUTME: 乐谱库菜单：导入原文件、打开示例、继续最近的审校、恢复草稿与删除当前审校。
import { useState } from "react";
import { FileMusic, FolderOpen } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";
import { SAMPLES, type Sample } from "../contracts/samples";
import { Menu } from "./Menu";

const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export function FileMenu({
  items,
  currentId,
  locked,
  conflict,
  onImport,
  onSample,
  onOpen,
  onOpenServer,
  onExportDraft,
  onDelete,
}: {
  items: ProjectSummary[];
  currentId?: string;
  locked: boolean;
  conflict: boolean;
  onImport: () => void;
  onSample: (sample: Sample) => void;
  onOpen: (id: string) => void;
  onOpenServer: () => void;
  onExportDraft: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Menu label="乐谱库" icon={<FolderOpen aria-hidden="true" size={16} />} className="file-menu">
      {(close) => (
        <div className="library">
          <div className="library-actions">
            <button
              type="button"
              className="primary"
              disabled={locked}
              onClick={() => {
                close();
                onImport();
              }}
            >
              <FileMusic aria-hidden="true" size={16} /> 导入 MusicXML / MXL…
            </button>
            <small>.musicxml · .xml · .mxl，最大 32 MB；导入另建一份审校，原件逐字节保留。</small>
          </div>
          <section aria-labelledby="library-samples">
            <h3 id="library-samples">示例乐谱</h3>
            <ul>
              {SAMPLES.map((sample) => (
                <li key={sample.key}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      close();
                      onSample(sample);
                    }}
                  >
                    <strong>{sample.label}</strong>
                    <small>{sample.note}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="library-recent">
            <h3 id="library-recent">最近的审校</h3>
            {items.length ? (
              <ul className="recent">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={item.id === currentId ? "true" : undefined}
                      disabled={locked || item.id === currentId}
                      onClick={() => {
                        close();
                        onOpen(item.id);
                      }}
                    >
                      <strong translate="no">{item.title}</strong>
                      <small>{item.id === currentId ? "当前" : when(item.updatedAt)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">还没有保存的审校。编辑后会自动保存到这里。</p>
            )}
          </section>
          <div className="library-footer">
            {conflict ? (
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenServer();
                }}
              >
                打开服务器版本
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                close();
                onExportDraft();
              }}
            >
              导出恢复草稿
            </button>
            {confirming ? (
              <span className="confirm">
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setConfirming(false);
                    close();
                    onDelete();
                  }}
                >
                  确认删除这份审校
                </button>
                <button type="button" onClick={() => setConfirming(false)}>
                  取消
                </button>
              </span>
            ) : (
              <button type="button" disabled={locked || !currentId} onClick={() => setConfirming(true)}>
                删除当前审校…
              </button>
            )}
          </div>
        </div>
      )}
    </Menu>
  );
}
