import { useRef } from "react";
import { Download, FilePlus2, Upload, FileDown } from "lucide-react";
import { Dialog } from "./Dialog.tsx";
import { RecoveryHistory } from "./RecoveryHistory.tsx";
import type { Desk } from "./useTutorDesk.ts";

const when = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
function updated(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? when.format(time) : "";
}

/** Course library: the file lifecycle lives here, away from the workbook. */
export function CourseShelf({
  d,
  open,
  close,
}: {
  d: Desk;
  open: boolean;
  close: () => void;
}) {
  const { p, mutable } = d;
  const file = useRef<HTMLInputElement>(null);
  async function run(task: () => Promise<boolean>) {
    if (await task()) close();
  }
  return (
    <Dialog open={open} close={close} title="课程书架" eyebrow="COURSES" className="shelf">
      <div className="shelf-actions">
        <button
          disabled={!mutable}
          onClick={() => {
            void run(() => p.fresh());
          }}
        >
          <FilePlus2 size={16} aria-hidden="true" />
          新课程
        </button>
        <button disabled={!mutable} onClick={() => file.current?.click()}>
          <Upload size={16} aria-hidden="true" />
          导入课程
        </button>
        <button onClick={d.exportCourse}>
          <Download size={16} aria-hidden="true" />
          导出本课程
        </button>
        <button onClick={p.exportDraft}>
          <FileDown size={16} aria-hidden="true" />
          导出工作稿
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="导入课程或恢复工作稿"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void run(() => d.importCourse(f));
          }}
        />
      </div>
      <p className="shelf-note">
        导入的课程或工作稿总是成为新课程，原课程保持不变。题库文件请在“题库”中导入。
      </p>
      <nav className="course-books" aria-label="最近课程">
        {!p.items.some((item) => item.id === p.current?.id) ? (
          <button className="book" aria-current="page" onClick={close}>
            <strong>{p.title || "未命名课程"}</strong>
            <small>正在学习 · {p.autoState.message}</small>
          </button>
        ) : null}
        {p.items.length ? (
          p.items.map((item) => {
            const currentBook = item.id === p.current?.id;
            return (
              <button
                key={item.id}
                className="book"
                disabled={!mutable}
                aria-current={currentBook ? "page" : undefined}
                onClick={() => {
                  if (currentBook) close();
                  else void run(() => p.open(item.id));
                }}
              >
                <strong>{item.title || "未命名课程"}</strong>
                <small>
                  {item.id.startsWith("local:")
                    ? "本机未确认副本"
                    : currentBook
                      ? "正在学习"
                      : updated(item.updatedAt)}
                </small>
              </button>
            );
          })
        ) : (
          <p className="empty">其他课程会在自动保存后出现在这里。</p>
        )}
      </nav>
      <RecoveryHistory history={p.draft.importHistory} onExport={d.exportCourse} />
    </Dialog>
  );
}
