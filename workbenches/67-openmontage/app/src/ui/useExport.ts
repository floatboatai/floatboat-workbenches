// ABOUTME: 本机导出流程：编码、保存到成片架（失败时直接下载），进度、取消与文档切换保护。
import { useRef, useState } from "react";
import type { OutputRecord, Timeline } from "../contracts/timeline";
import { exportTimeline, ExportCancelled, type ExportOptions } from "./engine/export";
import type { Player } from "./engine/player";
import { uploadBlob } from "./media";
import { download } from "./requests";

type Hooks = {
  player: Player;
  epoch: { current: string };
  snapshot: () => { timeline: Timeline; title: string };
  addOutput: (r: OutputRecord) => void;
  notify: (message: string) => void;
};
const stamp = () => {
  const d = new Date(), pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`;
};

export function useExport({ player, epoch, snapshot, addOutput, notify }: Hooks) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ ratio: number; message: string } | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  async function run(options: ExportOptions) {
    const key = epoch.current, { timeline, title } = snapshot();
    const controller = new AbortController();
    abort.current = controller;
    setExporting(true);
    setError("");
    setProgress({ ratio: 0, message: "准备中…" });
    player.pause();
    try {
      const result = await exportTimeline(timeline, options, (pr) => setProgress({ ratio: pr.ratio, message: pr.message }), controller.signal);
      const name = `${title || "影片"} · ${stamp()}.${result.extension}`;
      try {
        const stored = await uploadBlob(result.blob, result.mime, (r) => setProgress({ ratio: 1, message: `正在保存到成片架 ${Math.round(r * 100)}%` }));
        const record: OutputRecord = { id: stored.id, name, mime: result.mime, bytes: result.blob.size, duration: Math.round(result.seconds * 1000) / 1000, width: options.width, height: options.height, createdAt: new Date().toISOString(), engine: "browser" };
        if (key === epoch.current) {
          addOutput(record);
          notify(`成片已导出：${name}（${result.video.toUpperCase()}${result.audio ? " + " + result.audio.toUpperCase() : "，无声"}），在成片架下载。`);
        } else download(result.blob, name);
      } catch (e) {
        // 成片架保存失败时直接交付文件，不丢掉已编码的结果。
        download(result.blob, name);
        setError("成片已直接下载，但未能保存到成片架：" + (e instanceof Error ? e.message : ""));
      }
    } catch (e) {
      if (e instanceof ExportCancelled) notify("已取消导出。");
      else setError(e instanceof Error ? e.message : "导出失败。");
    } finally {
      abort.current = null;
      setExporting(false);
      setProgress(null);
    }
  }
  return { exporting, progress, error, run, cancel: () => abort.current?.abort() };
}
