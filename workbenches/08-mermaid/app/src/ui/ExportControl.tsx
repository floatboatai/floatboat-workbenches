// ABOUTME: 预览工具条上的导出按钮与弹层：PNG（倍率/透明/剪贴板）、SVG、源码与 Markdown 代码块。
import { useEffect, useRef, useState } from "react";
import { safeFileName } from "../contracts/mermaid-source";
import { ExportPanel, type Scale } from "./Dialogs";
import { renderPng, standaloneSvg, type Rendered } from "./engine";
import type { Failure } from "./useRender";
import { download } from "./workspace";

export function downloadSource(source: string, name: string) {
  download(
    new Blob([source.endsWith("\n") ? source : source + "\n"], {
      type: "text/plain;charset=utf-8",
    }),
    safeFileName(name, "mmd"),
  );
}

export function ExportControl({
  rendered,
  ready,
  failure,
  source,
  name,
  draft,
  setDraft,
  notify,
  fail,
}: {
  rendered: Rendered | null;
  ready: boolean;
  failure: Failure | null;
  source: string;
  name: string;
  draft: Record<string, unknown>;
  setDraft: (
    update: (old: Record<string, unknown>) => Record<string, unknown>,
  ) => void;
  notify: (message: string) => void;
  fail: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const scale: Scale =
    draft.exportScale === 2 || draft.exportScale === 4 ? draft.exportScale : 1;
  const transparent = draft.exportTransparent === true;
  const reason = failure
    ? failure.line
      ? `第 ${failure.line} 行有语法错误，修复后才能导出图片。`
      : "当前源码无法绘制，修复后才能导出图片。"
    : "正在绘制最新图形…";

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        setOpen(false);
        button.current?.focus();
      } else if (
        event.target instanceof Node &&
        !box.current?.contains(event.target) &&
        !button.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  async function png(copy: boolean) {
    if (!rendered || !ready) return;
    setBusy(true);
    try {
      if (copy) {
        let used: number = scale;
        const blob = renderPng(rendered, scale, transparent).then((out) => {
          used = out.scale;
          return out.blob;
        });
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        notify(`已复制 ${used}× PNG 到剪贴板。`);
      } else {
        const out = await renderPng(rendered, scale, transparent);
        download(
          out.blob,
          safeFileName(name, "png").replace(
            /\.png$/,
            out.scale === 1 ? ".png" : `@${out.scale}x.png`,
          ),
        );
        notify(
          `已导出 PNG（${out.width}×${out.height}${out.scale < scale ? `，尺寸过大已降为 ${out.scale}×` : ""}）。`,
        );
      }
    } catch (error) {
      fail(
        copy
          ? "浏览器拒绝写入剪贴板。请先点击页面后重试，或改用下载 PNG。"
          : error instanceof Error
            ? error.message
            : "PNG 导出失败。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify(`已复制${label}。`);
    } catch {
      fail("浏览器拒绝写入剪贴板，请改用下载。");
    }
  }

  return (
    <div className="export-anchor">
      <button
        ref={button}
        type="button"
        className="primary"
        aria-expanded={open}
        aria-controls="export-panel"
        onClick={() => setOpen((value) => !value)}
      >
        导出
      </button>
      {open ? (
        <div
          id="export-panel"
          ref={box}
          className="export-popover"
          role="region"
          aria-label="导出"
        >
          <ExportPanel
            ready={ready}
            reason={reason}
            busy={busy}
            scale={scale}
            transparent={transparent}
            onScale={(value) =>
              setDraft((old) => ({ ...old, exportScale: value }))
            }
            onTransparent={(value) =>
              setDraft((old) => ({ ...old, exportTransparent: value }))
            }
            onPng={() => void png(false)}
            onCopyPng={() => void png(true)}
            onSvg={() => {
              if (!rendered || !ready) return;
              download(
                new Blob([standaloneSvg(rendered, transparent)], {
                  type: "image/svg+xml",
                }),
                safeFileName(name, "svg"),
              );
              notify("已导出 SVG。");
            }}
            onCopySvg={() => {
              if (rendered && ready)
                void copyText(
                  standaloneSvg(rendered, transparent),
                  " SVG 代码",
                );
            }}
            onSource={() => downloadSource(source, name)}
            onCopyMarkdown={() =>
              void copyText(
                "```mermaid\n" + source.trim() + "\n```\n",
                " Markdown 代码块",
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}
