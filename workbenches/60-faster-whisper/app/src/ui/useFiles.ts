// ABOUTME: 字幕稿的文件生命周期：导入音频/字幕/完整项目/粘贴文本为新稿，导出字幕与含音频的完整项目。
import { useState, type RefObject } from "react";
import { download } from "./workspace";
import { emptyTranscript, restoreTranscript, transcriptDraft } from "../contracts/transcript";
import { exportMime, exportSubtitles, importSubtitles, type ExportFormat } from "../contracts/subtitles";
import { isRecord } from "../contracts/project";
import { audioBytes, base64, sourceFor, unbase64, upload } from "./media";
import type { ChangeData, Desk } from "./desk";

export function useFiles(p: Desk, changeData: ChangeData, epoch: RefObject<string>, after: { audio: () => void; paste: () => void }) {
  const [uploading, setUploading] = useState("");
  const d = transcriptDraft(p.draft);
  async function importAudio(file: File) {
    const key = p.documentKey;
    setUploading("0%");
    p.setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()),
        src = await sourceFor(file, bytes);
      await upload(bytes, src, (n) => setUploading(`${n}%`));
      if (epoch.current !== key) return;
      if (!p.data.source && !p.data.cues.length) {
        changeData((t) => ({ ...t, source: src }));
        if (p.title === "未命名字幕稿") p.setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "未命名字幕稿");
        p.setNotice("音频已保存。可以回听、手动打轴，或在右侧开始转写。");
      } else {
        const ok = await p.replace(
          { ...emptyTranscript, source: src, language: p.data.language, options: p.data.options },
          file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "新的字幕稿",
        );
        if (ok) p.setNotice("已为这段音频新建字幕稿，原字幕稿保留在“字幕稿”菜单中。");
      }
      after.audio();
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      setUploading("");
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 300 * 1024 * 1024) throw new Error("文件过大。");
      const text = await file.text();
      if (/\.subtitle\.json$/i.test(file.name) || text.includes('"floatboat-subtitles"')) {
        const raw: unknown = JSON.parse(text);
        if (isRecord(raw) && raw.format === "floatboat-subtitles") {
          if (raw.version !== 1) throw new Error("不支持的字幕剪辑室项目版本。");
          const restored = restoreTranscript(raw.data);
          if (restored.source) {
            if (typeof raw.audioBase64 !== "string") throw new Error("项目缺少音频原件。");
            setUploading("0%");
            await upload(unbase64(raw.audioBase64), restored.source, (n) => setUploading(`${n}%`));
          }
          if (await p.replace(restored, typeof raw.title === "string" ? raw.title.slice(0, 120) : "导入的字幕稿", { ...transcriptDraft(raw.draft) }))
            p.setNotice("已导入为新字幕稿。");
          return;
        }
      }
      const imported = importSubtitles(text, file.name);
      if (
        await p.replace(
          { ...emptyTranscript, source: p.data.source, language: p.data.language, options: p.data.options, ...imported, origin: `导入 · ${file.name}`.slice(0, 240) },
          file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "导入的字幕稿",
        )
      )
        p.setNotice(`已导入 ${imported.cues.length} 句为新字幕稿${p.data.source ? "，沿用当前音频" : ""}。`);
    } catch (e) {
      p.report(e);
    } finally {
      setUploading("");
    }
  }
  async function applyPaste() {
    try {
      const imported = importSubtitles(d.importText, "pasted.srt");
      if (await p.replace({ ...emptyTranscript, source: p.data.source, language: p.data.language, options: p.data.options, ...imported, origin: "粘贴字幕" }, "粘贴的字幕"))
        after.paste();
    } catch (e) {
      p.report(e);
    }
  }
  function exportFile(format: ExportFormat) {
    try {
      download(new Blob([exportSubtitles(p.data, format, { speakers: d.exportSpeakers, times: d.exportTimes })], { type: exportMime[format] }), `${p.title}.${format}`);
    } catch (e) {
      p.report(e);
    }
  }
  async function exportProject() {
    try {
      const value = restoreTranscript(p.data),
        bytes = value.source ? await audioBytes(value.source.id) : null;
      download(
        new Blob([JSON.stringify({ format: "floatboat-subtitles", version: 1, title: p.title, data: value, draft: transcriptDraft(p.draft), ...(bytes ? { audioBase64: base64(bytes) } : {}) })], { type: "application/json" }),
        `${p.title}.subtitle.json`,
      );
      p.setNotice("已导出完整项目，包含原音频、说话人与编辑草稿。");
    } catch (e) {
      p.report(e);
    }
  }

  return { uploading, importAudio, importFile, applyPaste, exportFile, exportProject };
}
