// ABOUTME: 文件条上的「字幕稿」与「导出」菜单：新建、示例、导入、最近字幕稿、删除；SRT/VTT/TXT/JSON/完整项目导出。
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { ClipboardPaste, Download, FileAudio, FilePlus2, FileText, FileUp, LifeBuoy, Trash2 } from "lucide-react";
import type { ProjectSummary } from "../contracts/project";
import type { ExportFormat } from "../contracts/subtitles";

function useDismiss(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const close = (focus: boolean) => {
      const el = ref.current;
      if (!el?.open) return;
      el.open = false;
      if (focus) el.querySelector("summary")?.focus();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        e.preventDefault();
        close(true);
      }
    };
    const pointer = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", pointer);
    };
  }, [ref]);
  return () => {
    if (ref.current) ref.current.open = false;
  };
}
function Item({ icon, children, onClick, disabled, current, hint }: { icon?: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; current?: boolean; hint?: string }) {
  return (
    <button type="button" className="menu-item" onClick={onClick} disabled={disabled} aria-current={current ? "true" : undefined}>
      {icon}
      <span className="menu-label">{children}</span>
      {hint ? <span className="menu-hint">{hint}</span> : null}
    </button>
  );
}
const ICON = { size: 15, strokeWidth: 1.8, "aria-hidden": true } as const;
const timeFormat = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const when = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : timeFormat.format(d);
};

export function FileMenu({
  items,
  currentId,
  busy,
  onBlank,
  onSample,
  onAudio,
  onSubtitles,
  onPaste,
  onOpen,
  onDelete,
}: {
  items: ProjectSummary[];
  currentId?: string;
  busy: boolean;
  onBlank: () => void;
  onSample: () => void;
  onAudio: () => void;
  onSubtitles: () => void;
  onPaste: () => void;
  onOpen: (id: string) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useDismiss(ref);
  const act = (fn: () => void) => () => {
    close();
    fn();
  };
  return (
    <details ref={ref} className="file-menu">
      <summary>字幕稿</summary>
      <div className="menu-body" role="group" aria-label="字幕稿">
        <Item icon={<FilePlus2 {...ICON} />} onClick={act(onBlank)} disabled={busy}>
          新建空白字幕稿
        </Item>
        <Item icon={<FileText {...ICON} />} onClick={act(onSample)} disabled={busy}>
          打开示例访谈
        </Item>
        <Item icon={<FileAudio {...ICON} />} onClick={act(onAudio)} disabled={busy} hint="≤200 MB">
          导入音频或视频…
        </Item>
        <Item icon={<FileUp {...ICON} />} onClick={act(onSubtitles)} disabled={busy} hint=".srt .vtt .json">
          导入字幕或项目…
        </Item>
        <Item icon={<ClipboardPaste {...ICON} />} onClick={act(onPaste)} disabled={busy}>
          粘贴字幕文本…
        </Item>
        <p className="menu-section">最近字幕稿</p>
        {items.length ? (
          <div className="menu-list">
            {items.map((item) => (
              <Item key={item.id} onClick={act(() => onOpen(item.id))} disabled={busy} current={item.id === currentId} hint={when(item.updatedAt)}>
                {item.title}
              </Item>
            ))}
          </div>
        ) : (
          <p className="menu-empty">还没有保存的字幕稿。编辑后会自动保存到这里。</p>
        )}
        <Item icon={<Trash2 {...ICON} />} onClick={act(onDelete)} disabled={busy || !currentId}>
          删除当前字幕稿…
        </Item>
      </div>
    </details>
  );
}

export function ExportMenu({
  disabled,
  speakers,
  times,
  onSpeakers,
  onTimes,
  onExport,
  onProject,
  onDraft,
}: {
  disabled: boolean;
  speakers: boolean;
  times: boolean;
  onSpeakers: (v: boolean) => void;
  onTimes: (v: boolean) => void;
  onExport: (format: ExportFormat) => void;
  onProject: () => void;
  onDraft: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useDismiss(ref);
  const act = (fn: () => void) => () => {
    close();
    fn();
  };
  return (
    <details ref={ref} className="file-menu export-menu">
      <summary>
        <Download {...ICON} />
        导出
      </summary>
      <div className="menu-body" role="group" aria-label="导出">
        <Item onClick={act(() => onExport("srt"))} disabled={disabled} hint="剪辑软件">
          SRT 字幕
        </Item>
        <Item onClick={act(() => onExport("vtt"))} disabled={disabled} hint="网页播放器">
          WebVTT 字幕
        </Item>
        <Item onClick={act(() => onExport("txt"))} disabled={disabled} hint="逐字稿">
          TXT 文本
        </Item>
        <Item onClick={act(() => onExport("json"))} disabled={disabled} hint="分段 + 逐词">
          JSON 分段
        </Item>
        <label className="menu-check">
          <input type="checkbox" checked={speakers} onChange={(e) => onSpeakers(e.target.checked)} />
          写入说话人
        </label>
        <label className="menu-check">
          <input type="checkbox" checked={times} onChange={(e) => onTimes(e.target.checked)} />
          TXT 每段带时间
        </label>
        <p className="menu-section">备份</p>
        <Item onClick={act(onProject)} hint="含音频">
          完整项目 .subtitle.json
        </Item>
        <Item icon={<LifeBuoy {...ICON} />} onClick={act(onDraft)}>
          导出恢复草稿
        </Item>
      </div>
    </details>
  );
}
