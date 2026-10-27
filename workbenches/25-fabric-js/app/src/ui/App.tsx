import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  Download,
  FilePlus2,
  Layers3,
  MousePointer2,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { isRecord } from "../contracts/project";
import {
  FONTS,
  parseProject,
  templates,
  validatePoster,
  type PosterObject,
} from "../contracts/poster";
import { useWorkbenchState } from "./autosave-client";
import { download } from "./requests";
import { Notice, ProjectPicker, RenderBoundary } from "./workspace";
import { Artboard } from "./Artboard";
import type { PosterEngine } from "./engine";
import { objectNames } from "./messages";

const seed = templates[0].create();
const numeric = [
  "x",
  "y",
  "width",
  "height",
  "scaleX",
  "scaleY",
  "angle",
  "opacity",
  "strokeWidth",
  "fontSize",
  "radius",
] as const;
const labelMap = {
  x: "X 坐标",
  y: "Y 坐标",
  width: "宽度",
  height: "高度",
  scaleX: "水平缩放",
  scaleY: "垂直缩放",
  angle: "旋转角度",
  opacity: "不透明度",
  strokeWidth: "描边宽度",
  fontSize: "字号",
  radius: "圆角",
};
function rawFields(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
function numericValue(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label}尚未填写。`);
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${label}需要数值。`);
  return result;
}

export function App() {
  const p = useWorkbenchState(seed, validatePoster, "周末植物市集", {
    storageKey: "fabric-poster-v1",
  });
  const engine = useRef<PosterEngine | null>(null),
    file = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [zoom, setZoom] = useState("fit"),
    [scale, setScale] = useState(1),
    [history, setHistory] = useState([false, false]),
    [panel, setPanel] = useState<"templates" | "import" | null>(null);
  const item = p.data.objects.find((value) => value.id === selected);
  const propertyKey = item ? "object:" + item.id : "";
  const fields = rawFields(p.draft[propertyKey]),
    board = rawFields(p.draft.artboard);
  const source =
    typeof p.draft.importSource === "string" ? p.draft.importSource : "";
  const value = (key: keyof PosterObject) =>
    fields[key] ?? String(item?.[key] ?? "");
  const changeField = (key: string, value: string) =>
    p.setDraft((previous) => ({
      ...previous,
      [propertyKey]: { ...rawFields(previous[propertyKey]), [key]: value },
    }));
  const clearDraft = (key: string) =>
    p.setDraft((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  function applyObject() {
    if (!item) return;
    try {
      const patch: Partial<PosterObject> = {};
      for (const key of numeric)
        if (key in fields)
          patch[key] = numericValue(fields[key], labelMap[key]);
      for (const key of [
        "fill",
        "stroke",
        "text",
        "fontFamily",
        "fontWeight",
        "textAlign",
      ] as const)
        if (key in fields) Object.assign(patch, { [key]: fields[key] });
      engine.current?.update(item.id, patch);
      clearDraft(propertyKey);
      p.setError("");
    } catch (error) {
      p.report(error);
    }
  }
  function applyBoard() {
    try {
      engine.current?.resize(
        numericValue(board.width ?? String(p.data.width), "画板宽度"),
        numericValue(board.height ?? String(p.data.height), "画板高度"),
        board.background ?? p.data.background,
      );
      clearDraft("artboard");
      p.setError("");
    } catch (error) {
      p.report(error);
    }
  }
  function setImportSource(value: string) {
    if (new TextEncoder().encode(value).length > 550_000) {
      p.report(new Error("导入内容不能超过 550 KB。"));
      return;
    }
    p.setDraft((previous) => ({ ...previous, importSource: value }));
  }
  async function importSource() {
    try {
      const data = parseProject(source);
      if (await p.replace(data, "导入的海报")) {
        setPanel(null);
        setSelected(null);
        setZoom("fit");
        p.setNotice("已作为新项目导入。");
      }
    } catch (error) {
      p.report(error);
    }
  }
  async function fromFile(input: HTMLInputElement) {
    const picked = input.files?.[0];
    input.value = "";
    if (!picked) return;
    try {
      if (picked.size > 550_000) throw new Error("项目文件不能超过 550 KB。");
      const raw = await picked.text();
      p.setDraft((previous) => ({ ...previous, importSource: raw }));
      setPanel("import");
      p.setError("");
    } catch (error) {
      p.report(error);
    }
  }
  async function newTemplate(index: number) {
    const template = templates[index];
    if (await p.replace(template.create(), template.name)) {
      setPanel(null);
      setSelected(null);
      setZoom("fit");
    }
  }
  async function exportFile(kind: "png" | "svg" | "json") {
    try {
      const current = validatePoster(p.data),
        name = (p.title.trim() || "海报").replace(/[<>:"/\\|?*]/g, "-");
      if (kind === "json")
        download(
          new Blob([JSON.stringify(current, null, 2)], {
            type: "application/json",
          }),
          name + ".poster.json",
        );
      else if (kind === "svg" && engine.current)
        download(
          new Blob([engine.current.svg()], { type: "image/svg+xml" }),
          name + ".svg",
        );
      else if (kind === "png" && engine.current) {
        download(await engine.current.png(), name + ".png");
      }
      p.setNotice(kind.toUpperCase() + " 已导出。");
    } catch (error) {
      p.report(error);
    }
  }
  if (p.loading)
    return (
      <main className="loading" role="status">
        正在打开排版台…
      </main>
    );
  return (
    <RenderBoundary>
      <main className="studio">
        <a href="#inspector" className="skip-link">
          跳到属性与图层
        </a>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              f
            </span>
            <div>
              <h1>海报排版台</h1>
              <span>FABRIC STUDIO</span>
            </div>
          </div>
          <div className="document">
            <input
              aria-label="项目名称"
              value={p.title}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => p.setTitle(event.target.value)}
            />
            <span className={"save-status " + p.autoState.phase} role="status">
              {p.autoState.phase === "saved" && Object.keys(p.draft).length
                ? "已自动保存 · 含待应用草稿"
                : p.autoState.message}
            </span>
          </div>
          <div className="file-actions">
            <button
              onClick={() =>
                setPanel(panel === "templates" ? null : "templates")
              }
              aria-expanded={panel === "templates"}
            >
              <FilePlus2 size={16} aria-hidden="true" />
              新建
            </button>
            <button
              onClick={() => setPanel(panel === "import" ? null : "import")}
              aria-expanded={panel === "import"}
            >
              <Upload size={16} aria-hidden="true" />
              导入
            </button>
            <details className="export-menu">
              <summary>
                <Download size={16} aria-hidden="true" />
                导出
              </summary>
              <div>
                <button onClick={() => void exportFile("png")}>PNG 图片</button>
                <button onClick={() => void exportFile("svg")}>
                  SVG 矢量图
                </button>
                <button onClick={() => void exportFile("json")}>
                  项目 JSON
                </button>
                <button onClick={p.exportDraft}>工作副本（含草稿）</button>
              </div>
            </details>
          </div>
        </header>
        <div className="file-strip">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={p.busy}
            onOpen={(id) => void p.open(id)}
          />
          <button
            className="text-button"
            onClick={() => void p.refresh().catch(p.report)}
          >
            刷新目录
          </button>
          <button className="text-button" onClick={() => void p.save()}>
            立即保存 / 重试
          </button>
          <button
            className="text-button delete-project"
            disabled={!p.current || p.busy}
            onClick={() => void p.remove()}
          >
            删除项目
          </button>
        </div>
        <Notice error={p.error} notice={p.notice} />
        {(p.autoState.phase === "conflict" ||
          p.autoState.phase === "offline") && (
          <div className="recovery" role="alert">
            <span>
              {p.autoState.phase === "conflict"
                ? "另一窗口已有更新。先保留工作副本，再选择服务端版本。"
                : "当前内容将在连接恢复后重试。"}
            </span>
            <button onClick={p.exportDraft}>导出恢复副本</button>
            {p.current && (
              <button onClick={() => void p.open(p.current!.id)}>
                打开服务端版本
              </button>
            )}
          </div>
        )}
        {panel === "templates" && (
          <section className="drawer" aria-label="新建海报">
            <div className="drawer-heading">
              <h2>从一张版式开始</h2>
              <button aria-label="关闭模板" onClick={() => setPanel(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="templates">
              {templates.map((template, index) => (
                <button
                  key={template.id}
                  className={"template " + template.id}
                  disabled={p.busy}
                  onClick={() => void newTemplate(index)}
                >
                  <span className="template-preview" aria-hidden="true">
                    {index === 0 ? "Aa" : index === 1 ? "◉" : "＋"}
                  </span>
                  <span>
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                </button>
              ))}
            </div>
            <p>每次选择都会创建一个新项目。</p>
          </section>
        )}
        {panel === "import" && (
          <section className="drawer import-panel" aria-label="导入项目">
            <div className="drawer-heading">
              <h2>导入海报项目</h2>
              <button aria-label="关闭导入" onClick={() => setPanel(null)}>
                <X size={18} />
              </button>
            </div>
            <p>
              打开本工作台导出的项目
              JSON。导入后会保留原项目，并创建一个新项目。
            </p>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="选择项目文件"
              onChange={(event) => void fromFile(event.target)}
            />
            <button onClick={() => file.current?.click()}>
              选择 JSON 文件
            </button>
            <label className="import-source">
              项目内容
              <textarea
                value={source}
                maxLength={550000}
                spellCheck={false}
                onChange={(event) => setImportSource(event.target.value)}
              />
            </label>
            <div className="row">
              <button
                className="primary"
                onClick={() => void importSource()}
                disabled={p.busy || !source}
              >
                导入为新项目
              </button>
              <button onClick={() => clearDraft("importSource")}>
                清除输入
              </button>
            </div>
          </section>
        )}
        <div className="workarea">
          <nav className="tools" aria-label="画板工具">
            <button
              title="选取"
              aria-label="选取"
              onClick={() => engine.current?.clear()}
            >
              <MousePointer2 />
            </button>
            <span />
            <button
              title="添加文字"
              aria-label="添加文字"
              onClick={() => engine.current?.add("text")}
            >
              <Type />
            </button>
            <button
              title="添加矩形"
              aria-label="添加矩形"
              onClick={() => engine.current?.add("rect")}
            >
              <Square />
            </button>
            <button
              title="添加椭圆"
              aria-label="添加椭圆"
              onClick={() => engine.current?.add("ellipse")}
            >
              <Circle />
            </button>
            <span />
            <button
              title="撤销"
              aria-label="撤销"
              disabled={!history[0]}
              onClick={() => engine.current?.undo(-1)}
            >
              <Undo2 />
            </button>
            <button
              title="重做"
              aria-label="重做"
              disabled={!history[1]}
              onClick={() => engine.current?.undo(1)}
            >
              <Redo2 />
            </button>
          </nav>
          <section className="canvas-column" aria-label="排版工作区">
            <div className="canvas-top">
              <span>
                <b>画板 01</b>
                <i>
                  {p.data.width} × {p.data.height} px
                </i>
              </span>
              <label>
                缩放
                <select
                  value={zoom}
                  onChange={(event) => setZoom(event.target.value)}
                >
                  <option value="fit">适合 · {Math.round(scale * 100)}%</option>
                  <option value="0.25">25%</option>
                  <option value="0.5">50%</option>
                  <option value="1">100%</option>
                </select>
              </label>
            </div>
            <div className="ruler" aria-hidden="true">
              <span>0</span>
              <span>{Math.round(p.data.width * 0.25)}</span>
              <span>{Math.round(p.data.width * 0.5)}</span>
              <span>{Math.round(p.data.width * 0.75)}</span>
              <span>{p.data.width}</span>
            </div>
            <Artboard
              key={p.documentKey}
              initial={p.data}
              data={p.data}
              zoom={zoom}
              onChange={p.setData}
              onSelection={setSelected}
              onError={p.report}
              onReady={(instance) => {
                engine.current = instance;
              }}
              onScale={setScale}
              onHistory={(undo, redo) => setHistory([undo, redo])}
            />
            <footer className="canvas-footer">
              <span>
                {p.data.objects.length} 个对象 ·{" "}
                {item ? objectNames[item.type] + "已选中" : "选择对象开始排版"}
              </span>
              <span>双击改字 · 拖动调整 · 手柄旋转</span>
            </footer>
          </section>
          <aside className="inspector" id="inspector" tabIndex={-1}>
            <div className="inspector-title">
              <h2>{item ? "对象属性" : "画板设置"}</h2>
              <span>{item ? objectNames[item.type] : "PX"}</span>
            </div>
            {item ? (
              <section className="properties" key={item.id}>
                <div className="object-actions">
                  <button
                    aria-label="复制对象"
                    title="复制对象"
                    onClick={() => engine.current?.duplicate()}
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    aria-label="上移一层"
                    title="上移一层"
                    onClick={() => engine.current?.reorder(1)}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    aria-label="下移一层"
                    title="下移一层"
                    onClick={() => engine.current?.reorder(-1)}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    aria-label="删除对象"
                    title="删除对象"
                    onClick={() => {
                      engine.current?.remove();
                      clearDraft(propertyKey);
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                  {item.type === "text" && (
                    <button
                      className="edit-text"
                      onClick={() => engine.current?.editText()}
                    >
                      画板改字
                    </button>
                  )}
                </div>
                <div className="geometry">
                  <span>位置与变换</span>
                  <output>
                    {Math.round(item.width * item.scaleX)} ×{" "}
                    {Math.round(item.height * item.scaleY)} px
                  </output>
                </div>
                <div className="field-grid">
                  {(
                    [
                      "x",
                      "y",
                      "width",
                      "height",
                      "scaleX",
                      "scaleY",
                      "angle",
                      "opacity",
                    ] as const
                  ).map((key) => (
                    <label key={key}>
                      {labelMap[key]}
                      <input
                        aria-label={labelMap[key]}
                        inputMode="decimal"
                        autoComplete="off"
                        value={value(key)}
                        readOnly={key === "height" && item.type === "text"}
                        onChange={(event) =>
                          changeField(key, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="field-grid paint">
                  <label>
                    填充
                    <input
                      aria-label="填充"
                      type="color"
                      value={value("fill")}
                      onChange={(event) =>
                        changeField("fill", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    描边
                    <input
                      aria-label="描边"
                      type="color"
                      value={value("stroke")}
                      onChange={(event) =>
                        changeField("stroke", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    描边宽度
                    <input
                      aria-label="描边宽度"
                      inputMode="decimal"
                      value={value("strokeWidth")}
                      onChange={(event) =>
                        changeField("strokeWidth", event.target.value)
                      }
                    />
                  </label>
                  {item.type === "rect" && (
                    <label>
                      圆角
                      <input
                        aria-label="圆角"
                        inputMode="decimal"
                        value={value("radius")}
                        onChange={(event) =>
                          changeField("radius", event.target.value)
                        }
                      />
                    </label>
                  )}
                </div>
                {item.type === "text" && (
                  <div className="text-properties">
                    <label>
                      文字内容
                      <textarea
                        aria-label="文字内容"
                        maxLength={8000}
                        value={value("text")}
                        onChange={(event) =>
                          changeField("text", event.target.value)
                        }
                      />
                    </label>
                    <div className="field-grid">
                      <label>
                        字号
                        <input
                          aria-label="字号"
                          inputMode="decimal"
                          value={value("fontSize")}
                          onChange={(event) =>
                            changeField("fontSize", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        字体
                        <select
                          aria-label="字体"
                          value={value("fontFamily")}
                          onChange={(event) =>
                            changeField("fontFamily", event.target.value)
                          }
                        >
                          {FONTS.map((font) => (
                            <option key={font}>{font}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        字重
                        <select
                          value={value("fontWeight")}
                          onChange={(event) =>
                            changeField("fontWeight", event.target.value)
                          }
                        >
                          <option value="normal">常规</option>
                          <option value="bold">粗体</option>
                        </select>
                      </label>
                      <label>
                        对齐
                        <select
                          value={value("textAlign")}
                          onChange={(event) =>
                            changeField("textAlign", event.target.value)
                          }
                        >
                          <option value="left">居左</option>
                          <option value="center">居中</option>
                          <option value="right">居右</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}
                {Object.keys(fields).length > 0 && (
                  <p className="draft-note">
                    属性草稿待应用；画板保留当前效果。
                  </p>
                )}
                <div className="row apply">
                  <button
                    className="primary"
                    disabled={!Object.keys(fields).length}
                    onClick={applyObject}
                  >
                    应用属性
                  </button>
                  <button
                    disabled={!Object.keys(fields).length}
                    onClick={() => clearDraft(propertyKey)}
                  >
                    还原输入
                  </button>
                </div>
              </section>
            ) : (
              <section className="properties">
                <p className="hint">
                  固定尺寸，精确排版。选择对象可调整其位置、颜色与文字。
                </p>
                <label>
                  常用尺寸
                  <select
                    aria-label="常用尺寸"
                    value=""
                    onChange={(event) => {
                      const [width, height] = event.target.value.split("x");
                      p.setDraft((previous) => ({
                        ...previous,
                        artboard: {
                          ...rawFields(previous.artboard),
                          width,
                          height,
                        },
                      }));
                    }}
                  >
                    <option value="">选择预设…</option>
                    <option value="800x1000">竖版海报 · 800 × 1000</option>
                    <option value="1080x1080">社交方图 · 1080 × 1080</option>
                    <option value="1200x675">横版封面 · 1200 × 675</option>
                    <option value="1240x1754">A4 比例 · 1240 × 1754</option>
                  </select>
                </label>
                <div className="field-grid">
                  {(["width", "height"] as const).map((key) => (
                    <label key={key}>
                      {key === "width" ? "画板宽度" : "画板高度"}
                      <input
                        aria-label={key === "width" ? "画板宽度" : "画板高度"}
                        inputMode="numeric"
                        value={board[key] ?? String(p.data[key])}
                        onChange={(event) =>
                          p.setDraft((previous) => ({
                            ...previous,
                            artboard: {
                              ...rawFields(previous.artboard),
                              [key]: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                  <label>
                    纸张颜色
                    <input
                      aria-label="纸张颜色"
                      type="color"
                      value={board.background ?? p.data.background}
                      onChange={(event) =>
                        p.setDraft((previous) => ({
                          ...previous,
                          artboard: {
                            ...rawFields(previous.artboard),
                            background: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <p className="hint">调整画板不会缩放对象。</p>
                <div className="row apply">
                  <button
                    className="primary"
                    disabled={!Object.keys(board).length}
                    onClick={applyBoard}
                  >
                    应用画板
                  </button>
                  <button
                    disabled={!Object.keys(board).length}
                    onClick={() => clearDraft("artboard")}
                  >
                    还原
                  </button>
                </div>
              </section>
            )}
            <section className="layers">
              <div className="layer-heading">
                <h2>
                  <Layers3 size={16} aria-hidden="true" />
                  图层
                </h2>
                <span>上层在前</span>
              </div>
              {p.data.objects.length === 0 ? (
                <p className="empty-hint">画板还是空的。添加文字或形状开始。</p>
              ) : (
                <ol>
                  {[...p.data.objects].reverse().map((object) => (
                    <li key={object.id}>
                      <button
                        className={selected === object.id ? "selected" : ""}
                        aria-pressed={selected === object.id}
                        onClick={() => engine.current?.select(object.id)}
                      >
                        <span className="layer-icon" aria-hidden="true">
                          {object.type === "text"
                            ? "T"
                            : object.type === "rect"
                              ? "▢"
                              : "○"}
                        </span>
                        <span>
                          {object.type === "text"
                            ? object.text || "空白文字"
                            : objectNames[object.type]}
                        </span>
                        <small
                          style={{ background: object.fill }}
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <button
              className="board-button"
              onClick={() => engine.current?.clear()}
            >
              返回画板设置
            </button>
          </aside>
        </div>
      </main>
    </RenderBoundary>
  );
}
