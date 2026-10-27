import { AutoStatus, AutoFeedback } from "./AutosaveStatus";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  FolderOpen,
  Plus,
  Save,
  Trash2,
  Ruler,
  RotateCw,
} from "lucide-react";
import {
  decodeResult,
  importProject,
  seed,
  validateDrawing,
  restoreDrawingDraft,
  type Drawing,
  type DrawingResult,
  type Template,
} from "../contracts/drawing";
import {
  download,
  Notice,
  ProjectPicker,
  request,
  useProjects,
} from "./workspace";
const templates: { id: Template; name: string; caption: string }[] = [
  { id: "panel", name: "四孔面板", caption: "圆角外形 · 安装孔" },
  { id: "perforated", name: "阵列孔板", caption: "居中阵列 · 等间距" },
  { id: "frame", name: "框形刀模", caption: "外轮廓 · 内开口" },
];
export function Studio() {
  const p = useProjects(seed, validateDrawing, "安装面板 01", {
      storageKey: "makerjs",
      restoreDraftData: restoreDrawingDraft,
    }),
    file = useRef<HTMLInputElement>(null);
  const [rendered, setRendered] = useState<{
      signature: string;
      result: DrawingResult;
    } | null>(null),
    [renderError, setRenderError] = useState(""),
    [retry, setRetry] = useState(0),
    [importing, setImporting] = useState(false);
  const signature = JSON.stringify(p.data);
  let validation = "";
  try {
    validateDrawing(p.data);
  } catch (error) {
    validation = error instanceof Error ? error.message : "参数无效。";
  }
  const locked = p.busy || importing,
    ready = !validation && !renderError && rendered?.signature === signature;
  useEffect(() => {
    if (validation) return;
    let active = true;
    const timer = setTimeout(() => {
      setRenderError("");
      void request("/api/render", { method: "POST", body: signature })
        .then(decodeResult)
        .then((result) => {
          if (active) setRendered({ signature, result });
        })
        .catch((error) => {
          if (active)
            setRenderError(
              error instanceof Error ? error.message : "图纸生成失败。",
            );
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [signature, validation, retry]);
  const update = (key: keyof Omit<Drawing, "template">, value: number) =>
    p.setData({ ...p.data, [key]: value });
  const field = (
    key: keyof Omit<Drawing, "template">,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="dimension" key={key}>
      <span>{label}</span>
      <div>
        <input
          name={key}
          type="number"
          inputMode="decimal"
          autoComplete="off"
          min={min}
          max={max}
          step={step}
          value={p.data[key]}
          onChange={(event) => update(key, Number(event.target.value))}
        />
        <small>{["rows", "columns"].includes(key) ? "个" : "mm"}</small>
      </div>
    </label>
  );
  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget,
      chosen = input.files?.[0];
    input.value = "";
    if (!chosen) return;
    setImporting(true);
    try {
      if (chosen.size > 100000) throw new Error("项目文件不能超过 100 KB。");
      const decoded = importProject(JSON.parse(await chosen.text()));
      await p.replace(decoded.data, decoded.title);
      p.setError("");
    } catch (error) {
      p.report(error);
    } finally {
      setImporting(false);
    }
  }
  function exportGeometry(type: "svg" | "dxf") {
    if (!ready || !rendered) return;
    download(
      new Blob([rendered.result[type]], {
        type: type === "svg" ? "image/svg+xml" : "application/dxf",
      }),
      safeName + "." + type,
    );
  }
  const safeName = p.title.replace(/[\\/:*?"<>|]/g, "_") || "drawing";
  return (
    <main className="drawing-studio">
      <a className="skip-link" href="#parameters">
        跳到图纸参数
      </a>
      <header className="studio-bar">
        <div className="brand">
          <Ruler aria-hidden="true" />
          <div>
            <strong>制图工房</strong>
            <span>PARAMETRIC DRAWING</span>
          </div>
        </div>
        <div className="file-actions">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={locked}
            onOpen={(id) => void p.open(id)}
          />
          <button disabled={locked} onClick={p.fresh}>
            <Plus size={15} aria-hidden="true" />
            新建
          </button>
          <button
            disabled={locked || !!validation}
            onClick={() => void p.save()}
          >
            <Save size={15} aria-hidden="true" />
            {p.busy ? "保存中…" : "立即保存"}
          </button>
        </div>
      </header>
      <div className="project-line">
        <label>
          图纸名称
          <input
            name="title"
            autoComplete="off"
            maxLength={120}
            value={p.title}
            disabled={locked}
            onChange={(event) => p.setTitle(event.target.value)}
          />
        </label>
        <AutoStatus state={p.autoState} loading={p.loading} />
        <div className="project-tools">
          <button onClick={() => file.current?.click()} disabled={locked}>
            <FolderOpen size={15} aria-hidden="true" />
            导入 JSON
          </button>
          <input
            className="sr-only"
            ref={file}
            type="file"
            accept=".json,application/json"
            aria-label="导入图纸项目"
            onChange={(event) => void readFile(event)}
          />
          <button
            disabled={!!validation || locked}
            onClick={() =>
              download(
                new Blob(
                  [
                    JSON.stringify(
                      { schemaVersion: 1, title: p.title, parameters: p.data },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
                safeName + ".json",
              )
            }
          >
            导出项目
          </button>
          <button
            className="danger"
            aria-label="删除图纸"
            disabled={locked || !p.current}
            onClick={() => void p.remove()}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <Notice error={p.error} notice={p.notice} />
      <AutoFeedback
        state={p.autoState}
        onRetry={() => void p.save()}
        onExport={p.exportDraft}
        onReload={p.current ? () => void p.open(p.current!.id) : undefined}
      />
      <div className="work-area">
        <section className="parameters" id="parameters">
          <h1>
            图纸参数 <span>01</span>
          </h1>
          <div className="template-list" aria-label="图纸模板">
            {templates.map((template) => (
              <button
                key={template.id}
                className={p.data.template === template.id ? "selected" : ""}
                aria-pressed={p.data.template === template.id}
                disabled={locked}
                onClick={() => {
                  if (template.id === p.data.template) return;
                  if (p.dirty && !confirm("切换模板会重置参数，确定继续吗？"))
                    return;
                  p.setData({ ...seed, template: template.id });
                }}
              >
                <strong>{template.name}</strong>
                <span>{template.caption}</span>
              </button>
            ))}
          </div>
          <fieldset disabled={locked}>
            <legend>外形尺寸</legend>
            {field("width", "外形宽度 W", 20, 1000, 0.1)}
            {field("height", "外形高度 H", 20, 1000, 0.1)}
            {field("radius", "圆角半径 R", 0, 250, 0.1)}
          </fieldset>
          <fieldset disabled={locked}>
            <legend>
              {p.data.template === "frame" ? "内部开口" : "孔位设置"}
            </legend>
            {p.data.template === "frame" ? (
              field("wall", "框宽", 1, 400, 0.1)
            ) : (
              <>
                {field("diameter", "孔径 Ø", 1, 100, 0.1)}
                {p.data.template === "panel" ? (
                  field("inset", "孔中心距边", 1, 400, 0.1)
                ) : (
                  <>
                    {field("columns", "横向列数", 1, 12)}
                    {field("rows", "纵向行数", 1, 12)}
                    {field("pitchX", "横向孔距", 2, 400, 0.1)}
                    {field("pitchY", "纵向孔距", 2, 400, 0.1)}
                  </>
                )}
              </>
            )}
          </fieldset>
          {validation ? (
            <p className="validation" role="alert">
              {validation}
            </p>
          ) : null}
          <p className="parameter-note">
            所有尺寸均以毫米计。孔阵列居中，孔边至少保留 1
            mm。图纸不包含刀径补偿。
          </p>
        </section>
        <section className="drawing-area" aria-label="图纸预览">
          <div className="sheet-toolbar">
            <div>
              <strong>
                {
                  templates.find((template) => template.id === p.data.template)
                    ?.name
                }
              </strong>
              <span>正投影视图 · mm</span>
            </div>
            <span className="render-status" role="status">
              {validation
                ? "参数待修正"
                : renderError
                  ? "生成失败"
                  : ready
                    ? "预览已更新"
                    : "生成图纸…"}
            </span>
          </div>
          <div className="drawing-grid">
            {renderError ? (
              <div className="render-failure" role="alert">
                <p>{renderError}</p>
                <button onClick={() => setRetry((value) => value + 1)}>
                  <RotateCw size={15} aria-hidden="true" />
                  重新生成
                </button>
              </div>
            ) : validation ? (
              <p className="drawing-placeholder">修正左侧参数后查看图纸。</p>
            ) : rendered ? (
              <figure
                className={ready ? "drawing-sheet" : "drawing-sheet pending"}
              >
                <div
                  className="drawing-svg"
                  role="img"
                  aria-label={`${rendered.result.width}乘${rendered.result.height}毫米图纸，${rendered.result.holes}个孔`}
                  dangerouslySetInnerHTML={{ __html: rendered.result.svg }}
                />
                <figcaption>
                  <span>W {rendered.result.width} mm</span>
                  <span>H {rendered.result.height} mm</span>
                  <span>比例随视窗调整</span>
                </figcaption>
              </figure>
            ) : (
              <p className="drawing-placeholder">正在生成图纸…</p>
            )}
          </div>
          <div className="drawing-footer">
            <dl>
              <div>
                <dt>图纸外形</dt>
                <dd>
                  {ready ? `${p.data.width} × ${p.data.height}` : "—"}{" "}
                  <small>mm</small>
                </dd>
              </div>
              <div>
                <dt>孔数</dt>
                <dd>{ready ? rendered?.result.holes : "—"}</dd>
              </div>
              <div>
                <dt>切割路径总长</dt>
                <dd>
                  {ready ? rendered?.result.cutLength.toFixed(2) : "—"}{" "}
                  <small>mm</small>
                </dd>
              </div>
            </dl>
            <div className="export-actions">
              <button disabled={!ready} onClick={() => exportGeometry("svg")}>
                <Download size={16} aria-hidden="true" />
                导出 SVG
              </button>
              <button
                className="primary"
                disabled={!ready}
                onClick={() => exportGeometry("dxf")}
              >
                <Download size={16} aria-hidden="true" />
                导出 DXF
              </button>
            </div>
          </div>
          <p className="output-note">
            导出只包含切割轮廓。进入加工软件后请核对单位、尺寸与工艺参数。
          </p>
        </section>
      </div>
    </main>
  );
}
