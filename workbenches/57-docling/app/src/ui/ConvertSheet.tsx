// ABOUTME: 转换面板：选择原文件、本地解析或 Docling Serve（状态/启动方式/重新检查紧贴提交按钮）、官方选项与任务跟踪、导入已有结构。
import { useEffect, useRef, useState, type RefObject } from "react";
import { FileUp, RefreshCw, X } from "lucide-react";
import { defaultOptions, extension, OCR_PRESETS, SERVE_FORMATS, type Job, type ServeOptions } from "../contracts/jobs.ts";
import { formatOf } from "../contracts/convert/index.ts";
import type { Example } from "../contracts/examples.ts";
import { LOCAL_FORMATS } from "./convert.ts";
export interface Health {
  configured: boolean;
  reachable: boolean;
  defaulted: boolean;
  base: string;
  version: string;
  message: string;
  checkedAt: number;
}
const states: Record<string, string> = {
  preparing: "读取原文件",
  submitting: "提交中",
  uncertain: "提交待核对",
  pending: "排队中",
  running: "转换中",
  success: "可打开",
  failure: "失败",
  paused: "已暂停跟踪",
};
const START = `uv venv .local/docling-serve --python 3.12
uv pip install --python .local/docling-serve/bin/python 'docling-serve==1.38.2'
.local/docling-serve/bin/docling-serve run --host 127.0.0.1 --port 5001`;
const size = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
export function ConvertSheet({
  open,
  close,
  trigger,
  busy,
  progress,
  file,
  onFile,
  engine,
  onEngine,
  options,
  onOptions,
  health,
  checking,
  onRecheck,
  onConvert,
  jobs,
  taskId,
  onTaskId,
  onJob,
  examples,
  onExample,
  onImport,
  raw,
  onRaw,
  onImportRaw,
}: {
  open: boolean;
  close: () => void;
  trigger: RefObject<HTMLElement | null>;
  busy: boolean;
  progress: string;
  file: File | null;
  onFile: (f: File | null) => void;
  engine: "local" | "serve";
  onEngine: (e: "local" | "serve") => void;
  options: ServeOptions;
  onOptions: (o: ServeOptions) => void;
  health: Health;
  checking: boolean;
  onRecheck: () => void;
  onConvert: () => void;
  jobs: Job[];
  taskId: string;
  onTaskId: (v: string) => void;
  onJob: (job: Job, action: "refresh" | "pause" | "resume" | "attach" | "open") => void;
  examples: Example[];
  onExample: (e: Example) => void;
  onImport: (f: File) => void;
  raw: string;
  onRaw: (v: string) => void;
  onImportRaw: () => void;
}) {
  const panel = useRef<HTMLElement>(null),
    input = useRef<HTMLInputElement>(null),
    importInput = useRef<HTMLInputElement>(null),
    [drag, setDrag] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const controls = [...(panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
        ) ?? [])].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (first && last && (event.shiftKey
          ? document.activeElement === first || !panel.current?.contains(document.activeElement)
          : document.activeElement === last || !panel.current?.contains(document.activeElement))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        close();
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, close, trigger]);
  if (!open) return null;
  const format = file ? formatOf(file.name) : null;
  const localOk = !file || ["pdf", "docx", "html", "md"].includes(format!);
  const serveOk = !file || !!SERVE_FORMATS[extension(file.name)];
  const set = <K extends keyof ServeOptions>(k: K, v: ServeOptions[K]) => onOptions({ ...options, [k]: v });
  const serveReady = health.reachable;
  const action = !file
    ? { label: "选择文件…", run: () => input.current?.click(), primary: true }
    : engine === "serve" && !serveReady
      ? { label: checking ? "正在检查…" : "重新检查服务", run: onRecheck, primary: false }
      : { label: busy ? progress || "正在处理…" : engine === "local" ? "本地转换为新文档" : "提交到 Docling Serve", run: onConvert, primary: true };
  const pending = jobs.filter((j) => j.state !== "success" && j.state !== "failure").length;
  return (
    <>
      <div className="sheet-backdrop" onClick={() => { close(); trigger.current?.focus(); }} />
      <section ref={panel} className="sheet" role="dialog" aria-modal="true" aria-labelledby="convert-title">
        <header className="sheet-head">
          <h2 id="convert-title">转换文档</h2>
          <button type="button" className="icon quiet" aria-label="关闭转换面板" onClick={() => { close(); trigger.current?.focus(); }}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="sheet-body">
          <div
            className={"dropzone" + (drag ? " drag" : "")}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0] ?? null); }}
          >
            <FileUp size={22} aria-hidden="true" />
            {file ? (
              <p>
                <strong>{file.name}</strong> · {size(file.size)}
              </p>
            ) : (
              <p>拖入或选择 PDF、Word、HTML、Markdown；连接 Docling Serve 后还可转换 PowerPoint、Excel、图片等。</p>
            )}
            <button type="button" onClick={() => input.current?.click()} disabled={busy}>
              {file ? "换一个文件" : "选择文件…"}
            </button>
            <input ref={input} className="sr-only" type="file" tabIndex={-1} aria-label="选择要转换的文件" onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </div>
          <fieldset className="engines">
            <legend>转换方式</legend>
            <label className={"engine" + (engine === "local" ? " on" : "")}>
              <input type="radio" name="engine" checked={engine === "local"} onChange={() => onEngine("local")} />
              <span>
                <strong>本地解析</strong>
                <small>在本页完成，无需服务。PDF 用 pdf.js 读取文字层与版面（不做 OCR）；Word 读取样式、编号与合并单元格。</small>
                {!localOk ? <small className="warn">此格式需使用 Docling Serve。</small> : null}
              </span>
            </label>
            <label className={"engine" + (engine === "serve" ? " on" : "")}>
              <input type="radio" name="engine" checked={engine === "serve"} onChange={() => onEngine("serve")} />
              <span>
                <strong>Docling Serve</strong>
                <small>官方版面模型、TableFormer 表格结构与 OCR，适合扫描件与复杂版式。</small>
                <span className={"service-line" + (serveReady ? " ok" : "")} role="status">
                  <i aria-hidden="true" />
                  {health.message}
                  {health.checkedAt ? <time> · {new Date(health.checkedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 检查</time> : null}
                </span>
                {!serveOk ? <small className="warn">Docling Serve 不支持此扩展名。</small> : null}
              </span>
            </label>
          </fieldset>
          {engine === "serve" ? (
            <div className="serve-detail">
              <div className="service-actions">
                <button type="button" onClick={onRecheck} disabled={checking}>
                  <RefreshCw size={14} aria-hidden="true" />
                  {checking ? "正在检查…" : "重新检查"}
                </button>
                <span className="hint">{health.base ? "地址 " + health.base + (health.defaulted ? "（默认本机地址）" : "（DOCLING_SERVE_URL）") : ""}</span>
              </div>
              {!serveReady ? (
                <details className="start-guide" open>
                  <summary>启动方式</summary>
                  <p>在工作台目录用 Python 3.12 安装并启动官方服务（首次会下载版面与 OCR 模型）：</p>
                  <pre><code>{START}</code></pre>
                  <button type="button" className="quiet" onClick={() => { void navigator.clipboard?.writeText(START).then(() => setCopied(true)).catch(() => setCopied(false)); }}>
                    {copied ? "已复制" : "复制命令"}
                  </button>
                  <p className="hint">服务在其他地址时，用 <code>DOCLING_SERVE_URL=http://主机:端口</code> 启动工作台；启用认证时设置 <code>DOCLING_SERVE_API_KEY</code>。密钥只放在服务端环境，不在页面填写。启动后点“重新检查”。</p>
                </details>
              ) : null}
              <fieldset className="options">
                <legend>转换选项</legend>
                <label className="check"><input type="checkbox" checked={options.do_ocr} onChange={(e) => set("do_ocr", e.target.checked)} />OCR 识别图像文字</label>
                <label className="check"><input type="checkbox" checked={options.force_ocr} disabled={!options.do_ocr} onChange={(e) => set("force_ocr", e.target.checked)} />强制整页 OCR（替换文字层）</label>
                <label>OCR 引擎
                  <select value={options.ocr_preset} onChange={(e) => set("ocr_preset", e.target.value as ServeOptions["ocr_preset"])}>
                    {OCR_PRESETS.map((x) => <option key={x} value={x}>{x === "auto" ? "自动" : x}</option>)}
                  </select>
                </label>
                <label>OCR 语言
                  <input value={options.ocr_lang.join(", ")} name="ocrLang" placeholder="引擎默认，例如 zh-Hans, en…" autoComplete="off" spellCheck={false} onChange={(e) => onOptions({ ...options, ocr_lang: e.target.value.split(/[,\s，]+/).filter(Boolean) })} />
                </label>
                <label className="check"><input type="checkbox" checked={options.do_table_structure} onChange={(e) => set("do_table_structure", e.target.checked)} />识别表格结构</label>
                <label>表格模式
                  <select value={options.table_mode} disabled={!options.do_table_structure} onChange={(e) => set("table_mode", e.target.value as ServeOptions["table_mode"])}>
                    <option value="accurate">精确（accurate）</option>
                    <option value="fast">快速（fast）</option>
                  </select>
                </label>
                <label className="check"><input type="checkbox" checked={options.table_cell_matching} disabled={!options.do_table_structure} onChange={(e) => set("table_cell_matching", e.target.checked)} />单元格回贴 PDF 文字</label>
                <label>PDF 后端
                  <select value={options.pdf_backend} onChange={(e) => set("pdf_backend", e.target.value as ServeOptions["pdf_backend"])}>
                    <option value="docling_parse">docling-parse</option>
                    <option value="pypdfium2">pypdfium2</option>
                  </select>
                </label>
                <span className="range">
                  <label>起始页<input name="pageFrom" autoComplete="off" inputMode="numeric" value={options.page_from ?? ""} onChange={(e) => set("page_from", e.target.value ? Number(e.target.value) : null)} /></label>
                  <label>结束页<input name="pageTo" autoComplete="off" inputMode="numeric" value={options.page_to ?? ""} onChange={(e) => set("page_to", e.target.value ? Number(e.target.value) : null)} /></label>
                </span>
                <label className="check"><input type="checkbox" checked={options.do_pdf_heading_hierarchy} onChange={(e) => set("do_pdf_heading_hierarchy", e.target.checked)} />推断 PDF 标题层级</label>
                <label className="check"><input type="checkbox" checked={options.do_code_enrichment} onChange={(e) => set("do_code_enrichment", e.target.checked)} />代码块识别</label>
                <label className="check"><input type="checkbox" checked={options.do_formula_enrichment} onChange={(e) => set("do_formula_enrichment", e.target.checked)} />公式识别（LaTeX）</label>
                <label className="check"><input type="checkbox" checked={options.do_picture_classification} onChange={(e) => set("do_picture_classification", e.target.checked)} />图片分类</label>
                <label>单文档超时（秒）
                  <input name="documentTimeout" autoComplete="off" inputMode="numeric" value={options.document_timeout ?? ""} placeholder="服务默认…" onChange={(e) => set("document_timeout", e.target.value ? Number(e.target.value) : null)} />
                </label>
                <button type="button" className="quiet" onClick={() => onOptions(defaultOptions)}>恢复默认选项</button>
              </fieldset>
            </div>
          ) : null}
          <div className="convert-actions">
            <button
              type="button"
              className={action.primary ? "primary" : ""}
              disabled={busy || checking || (!!file && action.primary && (engine === "local" ? !localOk : !serveOk))}
              onClick={action.run}
            >
              {action.label}
            </button>
            {!file ? <span className="hint">先选择文件。</span> : engine === "serve" && !serveReady ? <span className="hint">或改选“本地解析”立即转换。</span> : <span className="hint">结果作为新文档打开，现有校订不受影响。</span>}
          </div>
          {busy && progress ? <p className="progress-line" role="status">{progress}</p> : null}
          {jobs.length ? (
            <section className="jobs" aria-label="Docling Serve 任务">
              <h3>Docling Serve 任务{pending ? ` · ${pending} 个进行中` : ""}</h3>
              <ul>
                {jobs.slice(0, 12).map((j) => (
                  <li key={j.id} className={"job " + j.state}>
                    <span className="job-name">{j.filename}</span>
                    <span className="job-state">{states[j.state]}</span>
                    <span className="job-message">{j.message}</span>
                    <span className="job-ids">任务 {j.taskId ?? "尚未取得"}</span>
                    <span className="job-actions">
                      {["pending", "running"].includes(j.state) ? <button type="button" onClick={() => onJob(j, "pause")}>暂停跟踪</button> : null}
                      {j.state === "paused" ? <button type="button" onClick={() => onJob(j, "resume")}>恢复跟踪</button> : null}
                      {!["success", "failure", "uncertain"].includes(j.state) ? <button type="button" onClick={() => onJob(j, "refresh")}>刷新</button> : null}
                      {j.state === "success" ? <button type="button" className="primary" onClick={() => onJob(j, "open")}>作为新文档打开</button> : null}
                    </span>
                    {j.state === "uncertain" ? (
                      <span className="attach">
                        <label>
                          服务日志中的任务 ID
                          <input name="taskId" value={taskId} autoComplete="off" spellCheck={false} onChange={(e) => onTaskId(e.target.value)} />
                        </label>
                        <button type="button" disabled={!taskId.trim()} onClick={() => onJob(j, "attach")}>关联已有任务</button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="imports" aria-label="示例与导入">
            <h3>示例文档</h3>
            <div className="example-list">
              {examples.map((e) => (
                <button type="button" key={e.key} disabled={busy} onClick={() => onExample(e)}>
                  <strong>{e.title}</strong>
                  <small>
                    {e.document.source.format.toUpperCase()} · {e.document.pages ? e.document.pages + " 页 · " : ""}
                    {e.document.items} 个结构项
                  </small>
                </button>
              ))}
            </div>
            <h3>导入已有结构</h3>
            <div className="import-row">
              <button type="button" disabled={busy} onClick={() => importInput.current?.click()}>
                DoclingDocument JSON / 校对包…
              </button>
              <input ref={importInput} className="sr-only" type="file" tabIndex={-1} aria-label="导入 DoclingDocument JSON 或校对包" accept=".json,.zip,application/json,application/zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
              <span className="hint">每次导入都新建文档。</span>
            </div>
            <details className="raw-json" open={!!raw}>
              <summary>粘贴 JSON</summary>
              <label htmlFor="raw-json">未应用的内容也会自动保存</label>
              <textarea id="raw-json" spellCheck={false} autoComplete="off" value={raw} onChange={(e) => onRaw(e.target.value)} />
              <button type="button" disabled={!raw.trim() || busy} onClick={onImportRaw}>校验并导入为新文档</button>
            </details>
          </section>
          <p className="hint formats">本地解析接受 {LOCAL_FORMATS.replaceAll(",", " ")}；文件上限 64 MB。</p>
        </div>
      </section>
    </>
  );
}
