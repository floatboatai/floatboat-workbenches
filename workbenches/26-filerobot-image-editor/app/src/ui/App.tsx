import { useRef, useState } from "react";
import type { getCurrentImgDataFunction } from "react-filerobot-image-editor";
import {
  Aperture,
  Upload,
  Download,
  FolderOpen,
  FilePlus2,
  PackageOpen,
  Ellipsis,
  Trash2,
} from "lucide-react";
import { useWorkbenchState } from "./autosave-client";
import { checkedBlob, verifyDecodedImage } from "./binary";
import { request, download } from "./requests";
import {
  seed,
  validateProject,
  restoreProject,
  sourceValue,
  portableValue,
  MAX_IMAGE_BYTES,
  dimensions,
  type PhotoProject,
} from "../contracts/editor";
import { isRecord } from "../contracts/project";
import { PhotoEditor } from "./PhotoEditor";
import { RenderBoundary } from "./workspace";
const demoUrl = new URL("./assets/still-life.jpg", import.meta.url).href;
function fileBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("文件读取失败。"));
    r.readAsDataURL(file);
  });
}
export function App() {
  const p = useWorkbenchState(seed, validateProject, "未命名照片", {
    storageKey: "filerobot-image-editor-v1",
    restoreDraftData: restoreProject,
  });
  const fileRef = useRef<HTMLInputElement>(null),
    projectRef = useRef<HTMLInputElement>(null),
    exportRef = useRef<getCurrentImgDataFunction | null>(null);
  const [processing, setProcessing] = useState(false),
    [details, setDetails] = useState(false),
    [format, setFormat] = useState("png");
  async function importImage(file: File) {
    p.setError("");
    setProcessing(true);
    try {
      if (file.size > MAX_IMAGE_BYTES)
        throw new Error("请选择小于 1 MB 的 PNG 或 JPEG 原图。");
      await verifyDecodedImage(file);
      const source = sourceValue(
        await request("/api/images", {
          method: "POST",
          body: JSON.stringify({
            name: file.name,
            base64: await fileBase64(file),
          }),
        }),
      );
      await p.replace({ ...seed, source }, file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      p.report(e);
    } finally {
      setProcessing(false);
    }
  }
  async function loadDemo() {
    try {
      const blob = await checkedBlob(demoUrl);
      await importImage(
        new File([blob], "静物 · 秋日工作桌.jpg", { type: "image/jpeg" }),
      );
    } catch (e) {
      p.report(e);
    }
  }
  async function exportProject() {
    setProcessing(true);
    p.setError("");
    try {
      const original = p.data.source
        ? await fileBase64(
            await checkedBlob("/api/images/" + p.data.source.id, p.data.source),
          )
        : "";
      download(
        new Blob(
          [
            JSON.stringify({
              format: "filerobot-workbench",
              version: 1,
              title: p.title,
              project: p.data,
              draft: p.draft,
              original,
            }),
          ],
          { type: "application/json" },
        ),
        (p.title.trim() || "图片工程") + ".fie.json",
      );
      p.setNotice("工程已导出，包含原图和编辑状态。");
    } catch (e) {
      p.report(e);
    } finally {
      setProcessing(false);
    }
  }
  async function importProject(file: File) {
    setProcessing(true);
    p.setError("");
    try {
      if (file.size > 2_000_000) throw new Error("工程文件不得超过 2 MB。");
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw new Error("工程 JSON 无法读取，请选择完整的 .fie.json 文件。");
      }
      const item = portableValue(raw);
      let next: PhotoProject = item.project;
      if (next.source) {
        await verifyDecodedImage(
          new Blob(
            [Uint8Array.from(atob(item.original), (c) => c.charCodeAt(0))],
            { type: next.source.mime },
          ),
        );
        const source = sourceValue(
          await request("/api/images", {
            method: "POST",
            body: JSON.stringify({
              name: next.source.name,
              base64: item.original,
            }),
          }),
        );
        if (source.id !== next.source.id)
          throw new Error("工程原图校验失败，未导入。");
        next = { ...next, source };
      }
      if (await p.replace(next, item.title, item.draft))
        p.setNotice("已作为新工程导入。");
    } catch (e) {
      p.report(e);
    } finally {
      setProcessing(false);
    }
  }
  function exportImage() {
    p.setError("");
    try {
      validateProject(p.data);
      if (!exportRef.current) throw new Error("图片仍在载入，请稍候重试。");
      window.dispatchEvent(
        new CustomEvent("fie-save-edited-text-content", {
          detail: { avoidEditingCancel: true },
        }),
      );
      setTimeout(() => {
        try {
          if (!exportRef.current) return;
          const { imageData } = exportRef.current(
            {
              name: p.title.trim() || "照片",
              extension: format,
              quality: 0.92,
            },
            1,
          );
          const canvas = imageData.imageCanvas;
          if (!canvas) throw new Error("图片导出失败。");
          dimensions(canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                p.report(new Error("图片编码失败。"));
                return;
              }
              download(blob, (p.title.trim() || "照片") + "." + format);
              p.setNotice(
                `已导出 ${canvas.width} × ${canvas.height} ${format.toUpperCase()} 图片。`,
              );
            },
            format === "jpeg" ? "image/jpeg" : "image/png",
            0.92,
          );
        } catch (e) {
          p.report(e);
        }
      }, 30);
    } catch (e) {
      p.report(e);
    }
  }
  const draftText =
    isRecord(p.draft.nativeInput) &&
    typeof p.draft.nativeInput.value === "string"
      ? p.draft.nativeInput.value
      : "";
  const hasNativeDraft = isRecord(p.draft.nativeAnnotation);
  return (
    <div className="studio">
      <a className="skip" href="#workspace">
        跳到编辑画布
      </a>
      <header className="filebar">
        <div className="brand">
          <Aperture size={25} />
          <div>
            <strong>图片工作室</strong>
            <span>FILEROBOT / PHOTO LAB</span>
          </div>
        </div>
        <div className="document-title">
          <input
            aria-label="工程名称"
            name="project-title"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            onChange={(e) => p.setTitle(e.target.value)}
          />
          <span role="status" className={"save-state " + p.autoState.phase}>
            {p.autoState.message}
            {hasNativeDraft ? " · 文字输入已保留" : ""}
          </span>
        </div>
        <div className="top-actions">
          <button onClick={() => setDetails((v) => !v)} aria-expanded={details}>
            <FolderOpen size={16} />
            工程
          </button>
          <button
            disabled={processing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} />
            导入图片
          </button>
          <button
            className="primary"
            disabled={!p.data.source || processing}
            onClick={exportImage}
          >
            <Download size={16} />
            导出图片
          </button>
        </div>
      </header>
      <input
        ref={fileRef}
        aria-label="选择原图"
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importImage(file);
          e.target.value = "";
        }}
      />
      <input
        ref={projectRef}
        aria-label="选择便携工程"
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importProject(file);
          e.target.value = "";
        }}
      />
      {details ? (
        <section className="project-panel" aria-label="工程管理">
          <label>
            打开工程
            <select
              aria-label="打开已保存项目"
              value={p.current?.id ?? ""}
              onChange={(e) => {
                if (e.target.value) void p.open(e.target.value);
              }}
              disabled={p.busy}
            >
              <option value="">当前草稿</option>
              {p.items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void p.fresh()} disabled={p.busy}>
            <FilePlus2 size={16} />
            新建
          </button>
          <button
            onClick={() => projectRef.current?.click()}
            disabled={processing}
          >
            <PackageOpen size={16} />
            导入工程
          </button>
          <button onClick={() => void exportProject()} disabled={processing}>
            <Download size={16} />
            导出工程
          </button>
          <button
            onClick={() => void p.remove()}
            disabled={!p.current || p.busy}
          >
            <Trash2 size={16} />
            删除工程
          </button>
          <label className="format">
            图片格式
            <select
              aria-label="导出图片格式"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG · 92%</option>
            </select>
          </label>
          <label className="notes">
            编辑备注
            <textarea
              name="notes"
              value={p.data.notes}
              maxLength={20000}
              placeholder="记录用途、构图或下一步调整…"
              onChange={(e) => p.setData({ ...p.data, notes: e.target.value })}
            />
          </label>
          {draftText ? (
            <p className="raw-input">最近输入：{draftText.slice(0, 160)}</p>
          ) : null}
        </section>
      ) : null}
      {p.error ? (
        <div className="feedback error" role="alert">
          {p.error}
        </div>
      ) : p.notice ? (
        <div className="feedback" role="status">
          {p.notice}
        </div>
      ) : null}
      {p.autoState.phase === "conflict" ||
      p.autoState.phase === "offline" ||
      p.autoState.phase === "draft" ? (
        <div className="recovery">
          <span>
            {p.autoState.phase === "conflict"
              ? "此工程在另一窗口更新。请先导出工作副本，再打开服务端版本。"
              : "输入已保留，可继续完善或导出工作副本。"}
          </span>
          <button onClick={() => void exportProject()}>导出工作副本</button>
          <button onClick={() => void p.save()}>重试保存</button>
          {p.current ? (
            <button onClick={() => void p.open(p.current!.id)}>
              打开服务端版本
            </button>
          ) : null}
        </div>
      ) : null}
      <main id="workspace">
        {p.loading ? (
          <div className="empty">
            <Aperture />
            <h1>正在恢复照片工程…</h1>
          </div>
        ) : p.data.source ? (
          <RenderBoundary key={p.documentKey}>
            <PhotoEditor
              key={p.documentKey}
              project={p.data}
              draft={p.draft}
              onDesign={(design) => p.setData((data) => ({ ...data, design }))}
              onDraft={(extra) => p.setDraft((d) => ({ ...d, ...extra }))}
              onError={p.report}
              exportRef={exportRef}
            />
          </RenderBoundary>
        ) : (
          <section className="empty">
            <div className="empty-frame">
              <Aperture size={54} />
            </div>
            <p className="eyebrow">让每一张图片恰到好处</p>
            <h1>从一张原图开始</h1>
            <p>
              裁剪构图、调整光色、加上标注。
              <br />
              编辑会自动保存，下次打开继续。
            </p>
            <div>
              <button
                className="primary"
                onClick={() => fileRef.current?.click()}
                disabled={processing}
              >
                <Upload size={16} />
                选择本地图片
              </button>
              <button onClick={() => void loadDemo()} disabled={processing}>
                打开静物示例
              </button>
            </div>
            <small>PNG / JPEG · 最大 1 MB · 1600 万像素</small>
          </section>
        )}
      </main>
      <footer className="statusbar">
        <span>
          {p.data.source
            ? `${p.data.source.name} · ${p.data.source.width} × ${p.data.source.height} px`
            : "原图与编辑步骤分别保留"}
        </span>
        <span>
          {processing
            ? "正在处理…"
            : p.data.source
              ? "原图已保留 · 编辑自动保存"
              : "本地图片编辑"}
          <button
            className="more"
            aria-label="工程与备注"
            onClick={() => setDetails((v) => !v)}
          >
            <Ellipsis size={18} />
          </button>
        </span>
      </footer>
    </div>
  );
}
