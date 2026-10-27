import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import type { Template } from "@pdfme/common";
import {
  seed,
  validatePdf,
  pdfInput,
  type PdfProject,
} from "../contracts/domain";
import {
  download,
  Notice,
  ProjectPicker,
  RenderBoundary,
  useProjects,
} from "./workspace";
import { loadFont } from "./fonts";
import { loadPdfEngine } from "./browser-engine";
const DesignerPane = lazy(() =>
  import("./DesignerPane").then((module) => ({ default: module.DesignerPane })),
);
export function PdfApp() {
  const p = useProjects<PdfProject>(seed, validatePdf, "项目报价单");
  const [mode, setMode] = useState<"fill" | "design">("fill"),
    [exporting, setExporting] = useState(false),
    [epoch, setEpoch] = useState(0),
    [copies, setCopies] = useState(1),
    [previewPage, setPreviewPage] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const snapshot = useMemo(
    () => structuredClone(p.data.template),
    [p.current?.id, epoch, mode],
  );
  const onChange = useCallback(
    (template: Template) => {
      try {
        const checked = validatePdf({ template, values: {} }).template;
        p.setData((data) => ({ ...data, template: checked }));
      } catch (error) {
        p.report(error);
      }
    },
    [p.setData, p.report],
  );
  const fields = p.data.template.schemas
    .flat()
    .filter((field) => field.type === "text" && !field.readOnly);
  const base = p.data.template.basePdf;
  const size =
    typeof base === "object" && "width" in base
      ? base
      : { width: 210, height: 297 };
  const pageIndex = Math.min(previewPage, p.data.template.schemas.length - 1);
  function fresh() {
    if (p.fresh()) setEpoch((value) => value + 1);
  }
  async function exportPdf() {
    setExporting(true);
    p.setError("");
    try {
      const [engine, font] = await Promise.all([loadPdfEngine(), loadFont()]);
      const document = validatePdf(p.data);
      const inputs = Array.from({ length: copies }, () => ({
        ...pdfInput(document),
      }));
      const bytes = await engine.generate({
        template: document.template,
        inputs,
        plugins: { text: engine.text, rectangle: engine.rectangle },
        options: { font },
      });
      download(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        `${p.title || "单据"}.pdf`,
      );
    } catch (error) {
      p.report(error);
    } finally {
      setExporting(false);
    }
  }
  async function importJson(input: File) {
    p.setError("");
    try {
      if (input.size > 900000) throw new Error("模板文件超过 900 KB。");
      const next = validatePdf(JSON.parse(await input.text()));
      if (p.dirty && !confirm("导入会替换当前未保存内容，是否继续？")) return;
      p.setData(next);
      setEpoch((value) => value + 1);
    } catch (error) {
      p.report(error);
    }
  }
  return (
    <main className="paper-app">
      <a className="skip" href="#paper-main">
        跳到模板内容
      </a>
      <header className="paper-header">
        <div className="paper-brand">
          <span aria-hidden="true">P</span>
          <div>
            <p>DOCUMENT STUDIO</p>
            <h1>纸张工坊</h1>
          </div>
        </div>
        <div className="project-controls">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={p.busy || exporting}
            onOpen={(id) => void p.open(id)}
          />
          <button onClick={fresh} disabled={p.busy}>
            新建模板
          </button>
          <button
            onClick={() => void p.remove()}
            disabled={!p.current || p.busy}
          >
            删除
          </button>
        </div>
      </header>
      <section className="document-bar">
        <label>
          <span className="sr-only">模板名称</span>
          <input
            aria-label="模板名称"
            name="templateTitle"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            onChange={(event) => p.setTitle(event.target.value)}
          />
        </label>
        <span className="save-state" role="status">
          {p.busy ? "保存中…" : p.dirty ? "有未保存修改" : "内容已就绪"}
        </span>
        <div className="document-actions">
          <button onClick={() => void p.save()} disabled={p.busy || exporting}>
            保存模板
          </button>
          <button onClick={() => file.current?.click()} disabled={p.busy}>
            导入 JSON
          </button>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(p.data, null, 2)], {
                  type: "application/json",
                }),
                `${p.title}.json`,
              )
            }
          >
            导出 JSON
          </button>
          <button
            className="primary"
            onClick={() => void exportPdf()}
            disabled={exporting || p.busy}
          >
            {exporting ? "正在生成…" : "生成 PDF"}
          </button>
        </div>
      </section>
      <Notice error={p.error} notice={p.notice} />
      <div className="mode-bar">
        <div
          role="tablist"
          aria-label="工作模式"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "fill"
                : event.key === "End"
                  ? "design"
                  : mode === "fill"
                    ? "design"
                    : "fill";
            setMode(next);
            event.currentTarget
              .querySelectorAll("button")
              [next === "fill" ? 0 : 1]?.focus();
          }}
        >
          <button
            role="tab"
            id="fill-tab"
            aria-controls="paper-main"
            tabIndex={mode === "fill" ? 0 : -1}
            aria-selected={mode === "fill"}
            onClick={() => setMode("fill")}
          >
            填写字段
          </button>
          <button
            role="tab"
            id="design-tab"
            aria-controls="paper-main"
            tabIndex={mode === "design" ? 0 : -1}
            aria-selected={mode === "design"}
            onClick={() => setMode("design")}
          >
            设计版式
          </button>
        </div>
        <p>
          {p.data.template.schemas.length} 页模板 · {fields.length} 个可填写字段
        </p>
      </div>
      <section
        id="paper-main"
        role="tabpanel"
        aria-labelledby={mode === "fill" ? "fill-tab" : "design-tab"}
        tabIndex={-1}
      >
        {mode === "design" ? (
          <RenderBoundary key={`${p.current?.id}-${epoch}`}>
            <Suspense
              fallback={<p className="engine-state">正在加载设计器…</p>}
            >
              <DesignerPane initial={snapshot} onChange={onChange} />
            </Suspense>
          </RenderBoundary>
        ) : (
          <div className="fill-layout">
            <aside className="field-panel">
              <p className="eyebrow">填写一次，保持版式</p>
              <h2>内容与数据</h2>
              <p className="hint">
                修改字段内容，或切换到设计版式调整位置与样式。
              </p>
              {fields.map((field) => (
                <label key={field.name} className="field">
                  <span>{field.name}</span>
                  <textarea
                    aria-label={`字段 ${field.name}`}
                    name={field.name}
                    autoComplete="off"
                    rows={2}
                    value={p.data.values[field.name] ?? field.content ?? ""}
                    maxLength={5000}
                    onChange={(event) =>
                      p.setData((data) => ({
                        ...data,
                        values: {
                          ...data.values,
                          [field.name]: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              ))}
              <label className="copy-count">
                <span>生成份数</span>
                <input
                  aria-label="生成份数"
                  type="number"
                  min={1}
                  max={20}
                  value={copies}
                  onChange={(event) =>
                    setCopies(
                      Math.min(
                        20,
                        Math.max(1, Number(event.target.value) || 1),
                      ),
                    )
                  }
                />
              </label>
            </aside>
            <div className="paper-desk">
              <div className="page-caption">
                <span>
                  {size.width} × {size.height} mm · 版式预览
                </span>
                <label>
                  预览页{" "}
                  <select
                    aria-label="预览页"
                    value={pageIndex}
                    onChange={(event) =>
                      setPreviewPage(Number(event.target.value))
                    }
                  >
                    {p.data.template.schemas.map((_, index) => (
                      <option key={index} value={index}>
                        第 {index + 1} 页
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div
                className="paper-page"
                style={{
                  aspectRatio: `${size.width}/${size.height}`,
                }}
              >
                {p.data.template.schemas[pageIndex].map((field) =>
                  field.type === "text" ? (
                    <div
                      key={field.name}
                      className="preview-text"
                      style={{
                        left: `${(field.position.x / size.width) * 100}%`,
                        top: `${(field.position.y / size.height) * 100}%`,
                        width: `${(field.width / size.width) * 100}%`,
                        height: `${(field.height / size.height) * 100}%`,
                        fontSize: `${(((Number(field.fontSize) || 14) * 0.352778) / size.width) * 100}cqw`,
                        color: String(field.fontColor || "#26313B"),
                        textAlign:
                          field.alignment === "center"
                            ? "center"
                            : field.alignment === "right"
                              ? "right"
                              : "left",
                        alignContent:
                          field.verticalAlignment === "middle"
                            ? "center"
                            : field.verticalAlignment === "bottom"
                              ? "end"
                              : "start",
                        lineHeight: Number(field.lineHeight) || 1.2,
                      }}
                    >
                      {field.readOnly
                        ? field.content
                        : (p.data.values[field.name] ?? field.content)}
                    </div>
                  ) : (
                    <div
                      key={field.name}
                      className="preview-rule"
                      style={{
                        left: `${(field.position.x / size.width) * 100}%`,
                        top: `${(field.position.y / size.height) * 100}%`,
                        width: `${(field.width / size.width) * 100}%`,
                        height: `${(field.height / size.height) * 100}%`,
                        background: String(field.color || "transparent"),
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      <input
        className="sr-only"
        ref={file}
        type="file"
        accept="application/json,.json"
        aria-label="导入模板文件"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (selected) void importJson(selected);
        }}
      />
    </main>
  );
}
