import { useRef } from "react";
import { FilePlus2, Upload, Trash2, X, Download } from "lucide-react";
import { ProjectPicker } from "./workspace";
import { seed } from "../contracts/deck.ts";
import type { Projects } from "./App";
export function FileTools({
  p,
  exporting,
  onExport,
  onImport,
  onClose,
}: {
  p: Projects;
  exporting: boolean;
  onExport: (kind: "project" | "markdown" | "html") => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onClose: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <section className="files" aria-label="演示文件">
      <div className="files-main">
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={p.busy}
          onOpen={(id) => void p.open(id)}
        />
        <button
          onClick={() =>
            void p.replace(
              {
                ...seed,
                slides: [
                  {
                    id: crypto.randomUUID(),
                    markdown: "# 新的分享",
                    notes: "",
                  },
                ],
              },
              "未命名演示",
            )
          }
          disabled={p.busy}
        >
          <FilePlus2 aria-hidden="true" size={16} />
          新建
        </button>
        <button onClick={() => file.current?.click()} disabled={p.busy}>
          <Upload aria-hidden="true" size={16} />
          导入
        </button>
        <input
          ref={file}
          aria-label="导入演示文件"
          className="sr-only"
          type="file"
          accept=".md,.json"
          onChange={(e) => {
            const input = e.target.files?.[0];
            if (input) void onImport(input);
            e.target.value = "";
          }}
        />
        <button onClick={() => void p.remove()} disabled={p.busy || !p.current}>
          <Trash2 aria-hidden="true" size={16} />
          删除演示
        </button>
        <button
          className="icon-button"
          aria-label="关闭文件面板"
          onClick={() => {
            onClose();
          }}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      <div className="file-exports">
        <span>带走你的演示</span>
        <button onClick={() => void onExport("project")} disabled={exporting}>
          <Download aria-hidden="true" size={15} />
          项目备份
        </button>
        <button onClick={() => void onExport("markdown")} disabled={exporting}>
          Markdown
        </button>
        <button onClick={p.exportDraft}>恢复文件</button>
        <button onClick={() => void p.save()} disabled={p.busy}>
          立即重试保存
        </button>
        {p.current && p.autoState.phase === "conflict" ? (
          <button onClick={() => void p.open(p.current!.id)}>
            打开服务器版本
          </button>
        ) : null}
      </div>
      <p>
        导入 .md 或项目 .json（400 KB
        以内）会新建演示。项目备份保留全部设置；恢复文件包含待应用源稿。HTML
        用于播放，PDF / PPTX 暂不提供。
      </p>
    </section>
  );
}
