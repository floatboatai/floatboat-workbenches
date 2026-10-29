// ABOUTME: 图表舞台上的导出弹层：SVG、PNG（倍率/剪贴板）、规格 JSON（下载/复制）、编译后的 Vega 规格与项目包。
import { useEffect, useRef, useState, type RefObject } from "react";
import type { ChartHandle } from "./Chart";
import { pngOf, svgOf } from "./engine";
import { download } from "./workspace";

export function safeFileName(name: string, extension: string): string {
  const base =
    name
      .normalize("NFC")
      .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+/, "")
      .slice(0, 80) || "chart";
  return `${base}.${extension}`;
}
export type Scale = 1 | 2 | 3;

export function ExportControl({
  chart,
  ready,
  reason,
  name,
  specText,
  scale,
  onScale,
  onBundle,
  notify,
  fail,
}: {
  chart: RefObject<ChartHandle | null>;
  ready: boolean;
  reason: string;
  name: string;
  specText: string;
  scale: Scale;
  onScale: (scale: Scale) => void;
  onBundle: () => void;
  notify: (message: string) => void;
  fail: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        setOpen(false);
        button.current?.focus();
      } else if (event.target instanceof Node && !box.current?.contains(event.target) && !button.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  const view = () => {
    const current = chart.current?.view();
    if (!current || !ready) throw new Error(reason);
    return current;
  };
  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      fail(error instanceof Error ? error.message : "导出失败。");
    } finally {
      setBusy(false);
    }
  }
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`已复制${label}。`);
    } catch {
      fail("浏览器拒绝写入剪贴板，请改用下载。");
    }
  };

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
        <div id="export-panel" ref={box} className="export-popover" role="region" aria-label="导出">
          <section>
            <h3>图片</h3>
            {!ready ? <p className="export-reason">{reason}</p> : null}
            <div className="scale-row" role="radiogroup" aria-label="PNG 倍率">
              {([1, 2, 3] as const).map((value) => (
                <label key={value}>
                  <input type="radio" name="png-scale" checked={scale === value} onChange={() => onScale(value)} />
                  {value}×
                </label>
              ))}
            </div>
            <div className="export-actions">
              <button
                type="button"
                className="primary"
                disabled={!ready || busy}
                onClick={() =>
                  void run(async () => {
                    const out = await pngOf(view(), scale);
                    download(out.blob, safeFileName(name, "png").replace(/\.png$/, out.scale === 1 ? ".png" : `@${out.scale}x.png`));
                    notify(`已导出 PNG（${out.width}×${out.height}${out.scale < scale ? `，尺寸过大已降为 ${out.scale}×` : ""}）。`);
                  })
                }
              >
                下载 PNG
              </button>
              <button
                type="button"
                disabled={!ready || busy}
                onClick={() =>
                  void run(async () => {
                    const current = view();
                    try {
                      await navigator.clipboard.write([
                        new ClipboardItem({ "image/png": pngOf(current, scale).then((out) => out.blob) }),
                      ]);
                      notify(`已复制 ${scale}× PNG 到剪贴板。`);
                    } catch {
                      throw new Error("浏览器拒绝写入剪贴板。请先点击页面后重试，或改用下载 PNG。");
                    }
                  })
                }
              >
                复制 PNG
              </button>
              <button
                type="button"
                disabled={!ready || busy}
                onClick={() =>
                  void run(async () => {
                    download(new Blob([await svgOf(view())], { type: "image/svg+xml" }), safeFileName(name, "svg"));
                    notify("已导出 SVG。");
                  })
                }
              >
                下载 SVG
              </button>
            </div>
          </section>
          <section>
            <h3>规格与项目</h3>
            <div className="export-actions">
              <button type="button" onClick={() => void copy(specText, "规格 JSON")}>
                复制规格
              </button>
              <button
                type="button"
                onClick={() => {
                  download(new Blob([specText.endsWith("\n") ? specText : specText + "\n"], { type: "application/json" }), safeFileName(name, "vl.json"));
                  notify("已下载规格。");
                }}
              >
                下载 .vl.json
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => {
                  const vega = chart.current?.vega();
                  if (!vega) return;
                  download(new Blob([JSON.stringify(vega, null, 2) + "\n"], { type: "application/json" }), safeFileName(name, "vg.json"));
                  notify("已下载编译后的 Vega 规格（含当前画布尺寸与数据）。");
                }}
              >
                编译后的 Vega
              </button>
              <button type="button" onClick={onBundle}>
                项目包（含数据）
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
