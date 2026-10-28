import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Type,
  Square,
  ImagePlus,
  Layers,
  FolderOpen,
  Download,
  Plus,
  PanelRightClose,
} from "lucide-react";
import {
  seed,
  validateBoard,
  restoreBoard,
  parseProjectText,
  assertProjectBytes,
  serializeProject,
  assertItemCapacity,
  appendItem,
  makeItem,
  sourceValue,
  type Item,
} from "../contracts/board";
import { isRecord } from "../contracts/project";
import {
  useProjects,
  ProjectPicker,
  Notice,
  download,
  request,
} from "./workspace";
import { Canvas, type CanvasHandle } from "./Canvas";
const labels = { rect: "矩形", text: "文字", arrow: "箭头", image: "图片" };
const numeric = [
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "strokeWidth",
] as const;
const names = {
  x: "X 坐标",
  y: "Y 坐标",
  width: "宽度",
  height: "高度",
  rotation: "旋转角度",
  strokeWidth: "描边宽度",
};
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}
export function App() {
  const p = useProjects(seed, validateBoard, "包装校样 · 春日茶礼", {
    storageKey: "konva-v1",
    restoreDraftData: restoreBoard,
  });
  const [files, setFiles] = useState(false),
    [inspector, setInspector] = useState(true),
    [selected, setSelected] = useState(""),
    [transitioning, setTransitioning] = useState(false),
    [assetBusy, setAssetBusy] = useState(false);
  const transitionRef = useRef(false),
    activeKey = useRef(p.documentKey),
    canvas = useRef<CanvasHandle | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    imageInput = useRef<HTMLInputElement>(null);
  activeKey.current = p.documentKey;
  useEffect(() => setAssetBusy(false), [p.documentKey]);
  let renderable = true;
  try {
    validateBoard(p.data);
  } catch {
    renderable = false;
  }
  const item = p.data.items.find((i) => i.id === selected),
    locked = transitioning || p.loading || p.busy;
  const drafts = isRecord(p.draft.properties) ? p.draft.properties : {};
  const candidate = item ? drafts[item.id] : null;
  const fields: Record<string, unknown> = isRecord(candidate) ? candidate : {};
  const raw = typeof p.draft.json === "string" ? p.draft.json : "";
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    try {
      if (await action()) setSelected("");
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  function change(next: Item) {
    if (transitionRef.current) return;
    p.setData((b) => ({
      ...b,
      items: b.items.map((i) => (i.id === next.id ? next : i)),
    }));
  }
  function add(kind: Item["kind"]) {
    if (transitionRef.current) return;
    const next = makeItem(kind, p.data.items.length % 8);
    try {
      p.setData((b) => appendItem(b, next));
      p.setError("");
      setSelected(next.id);
      setInspector(true);
    } catch (e) {
      p.report(e);
    }
  }
  function field(key: string, value: string) {
    if (!item || transitionRef.current) return;
    const id = item.id;
    p.setDraft((d) => ({
      ...d,
      properties: {
        ...(isRecord(d.properties) ? d.properties : {}),
        [id]: { ...fields, [key]: value },
      },
    }));
  }
  function apply() {
    if (!item) return;
    try {
      const next = { ...item };
      for (const key of numeric) {
        if (typeof fields[key] === "string") {
          if (
            !String(fields[key]).trim() ||
            !Number.isFinite(Number(fields[key]))
          )
            throw new Error(names[key] + "需要数字，输入已作为草稿保留。");
          next[key] = Number(fields[key]);
        }
      }
      for (const key of ["text", "fill", "stroke"] as const) {
        if (typeof fields[key] === "string") next[key] = fields[key];
      }
      validateBoard({
        ...p.data,
        items: p.data.items.map((i) => (i.id === item.id ? next : i)),
      });
      change(next);
      p.setDraft((d) => {
        const properties = { ...(isRecord(d.properties) ? d.properties : {}) };
        delete properties[item.id];
        return { ...d, properties };
      });
      p.setNotice("对象属性已应用。");
      p.setError("");
    } catch (e) {
      p.report(e);
    }
  }
  async function attach(file: File) {
    if (transitionRef.current || p.loading || p.busy) return;
    const key = p.documentKey;
    try {
      p.setData((b) => {
        assertItemCapacity(b);
        return b;
      });
      setAssetBusy(true);
      if (file.size > 750000) throw new Error("每张原图最多 750 KB。");
      const source = sourceValue(
        await request("/api/originals", {
          method: "POST",
          body: JSON.stringify({
            name: file.name,
            base64: await readFile(file),
          }),
        }),
      );
      if (activeKey.current !== key || transitionRef.current) return;
      const next = {
        ...makeItem("image"),
        source,
        width: Math.min(500, source.width),
        height: (source.height * Math.min(500, source.width)) / source.width,
      };
      p.setData((b) => appendItem(b, next));
      p.setError("");
      setSelected(next.id);
      p.setNotice("原图已加入画板并保存。");
    } catch (e) {
      if (activeKey.current === key) p.report(e);
    } finally {
      if (activeKey.current === key) setAssetBusy(false);
    }
  }
  async function importFile(file: File) {
    await transition(async () => {
      assertProjectBytes(file.size);
      const value = parseProjectText(await file.text());
      for (const raw of value.originals) {
        if (!isRecord(raw)) throw new Error("工程原图格式无效");
        const source = sourceValue(
          await request("/api/originals", {
            method: "POST",
            body: JSON.stringify(raw),
          }),
        );
        if (raw.id !== source.id) throw new Error("工程原图校验不一致。");
      }
      return p.replace(value.data, value.title, value.extra);
    });
  }
  async function exportProject() {
    const key = p.documentKey,
      snapshot = {
        title: p.title,
        data: structuredClone(p.data),
        extra: structuredClone(p.draft),
      };
    setAssetBusy(true);
    try {
      const sources = [
        ...new Map(
          snapshot.data.items.flatMap((i) =>
            i.source ? [[i.source.id, i.source] as const] : [],
          ),
        ).values(),
      ];
      const originals = await Promise.all(
        sources.map(async (src) => {
          const raw = await request("/api/originals/" + src.id);
          if (!isRecord(raw) || typeof raw.base64 !== "string")
            throw new Error("原图缺失，请重新附加原图后导出完整工程。");
          return { ...src, base64: raw.base64 };
        }),
      );
      if (activeKey.current !== key || transitionRef.current) return;
      download(
        new Blob(
          [
            serializeProject({
              format: "konva-annotation/v1",
              ...snapshot,
              originals,
            }),
          ],
          { type: "application/json" },
        ),
        "annotation-board.json",
      );
      p.setNotice("工程已导出，包含原图与未应用输入。");
    } catch (e) {
      if (activeKey.current === key) p.report(e);
    } finally {
      if (activeKey.current === key) setAssetBusy(false);
    }
  }
  async function png() {
    const key = p.documentKey;
    try {
      const blob = await canvas.current?.png();
      if (blob && activeKey.current === key && !transitionRef.current)
        download(blob, "annotation.png");
    } catch (e) {
      if (activeKey.current === key) p.report(e);
    }
  }
  function order(delta: number) {
    if (!item) return;
    p.setData((b) => {
      const items = [...b.items],
        at = items.findIndex((i) => i.id === item.id),
        to = Math.max(0, Math.min(items.length - 1, at + delta));
      items.splice(at, 1);
      items.splice(to, 0, item);
      return { ...b, items };
    });
  }
  return (
    <div className="app-shell">
      <a className="skip" href="#workspace">
        跳到画板
      </a>
      <header>
        <button
          aria-label="文件与工程"
          aria-expanded={files}
          onClick={() => setFiles(!files)}
        >
          <FolderOpen size={18} />
        </button>
        <div className="brand">
          K<span>标注画板</span>
        </div>
        <input
          className="title"
          aria-label="画板名称"
          value={p.title}
          maxLength={120}
          disabled={locked}
          onChange={(e) => {
            if (!transitionRef.current) p.setTitle(e.target.value);
          }}
          autoComplete="off"
        />
        <span className={"save " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <button onClick={() => void png()} disabled={locked || assetBusy}>
          <Download size={16} />
          PNG
        </button>
      </header>
      <Notice error={p.error} notice={p.notice} />
      {files && (
        <section className="file-panel" aria-label="文件管理">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={locked}
            onOpen={(id) => void transition(() => p.open(id))}
          />
          <button
            disabled={locked}
            onClick={() => void transition(() => p.fresh())}
          >
            新建画板
          </button>
          <button disabled={locked} onClick={() => fileInput.current?.click()}>
            导入工程 / 恢复稿
          </button>
          <button
            disabled={locked || assetBusy}
            onClick={() => void exportProject()}
          >
            导出完整工程
          </button>
          <button onClick={p.exportDraft}>导出恢复稿</button>
          <button onClick={() => void p.save()} disabled={locked}>
            重试保存
          </button>
          {p.current && (
            <button
              disabled={locked}
              onClick={() => void transition(() => p.open(p.current!.id))}
            >
              打开服务器版本
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = "";
            }}
          />
          <details>
            <summary>工程 JSON 草稿</summary>
            <textarea
              aria-label="工程 JSON 草稿"
              value={raw}
              disabled={locked}
              spellCheck={false}
              onChange={(e) =>
                p.setDraft((d) => ({ ...d, json: e.target.value }))
              }
              placeholder="粘贴画板数据 JSON…"
            />
            <button
              disabled={locked}
              onClick={() => {
                try {
                  p.setData(validateBoard(JSON.parse(raw)));
                  p.setNotice("画板 JSON 已应用。");
                } catch (e) {
                  p.report(e);
                }
              }}
            >
              应用 JSON
            </button>
            <button
              disabled={locked}
              onClick={() =>
                p.setDraft((d) => ({
                  ...d,
                  json: JSON.stringify(p.data, null, 2),
                }))
              }
            >
              载入当前数据
            </button>
          </details>
        </section>
      )}
      <nav className="toolbar" aria-label="绘图工具">
        <button disabled={locked} onClick={() => add("rect")}>
          <Square size={18} />
          矩形框
        </button>
        <button disabled={locked} onClick={() => add("text")}>
          <Type size={18} />
          文字
        </button>
        <button disabled={locked} onClick={() => add("arrow")}>
          <ArrowUpRight size={18} />
          箭头
        </button>
        <button
          disabled={locked || assetBusy}
          onClick={() => imageInput.current?.click()}
        >
          <ImagePlus size={18} />
          {assetBusy ? "读取中…" : "添加原图"}
        </button>
        <input
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void attach(file);
            e.target.value = "";
          }}
        />
        <span className="tool-hint">选择对象 · 拖动 · 调整控制点</span>
        <button
          aria-label="图层与属性"
          aria-expanded={inspector}
          onClick={() => setInspector(!inspector)}
        >
          <Layers size={18} />
        </button>
      </nav>
      <main
        id="workspace"
        className={inspector ? "workspace" : "workspace wide"}
      >
        <section className="desk" aria-label="画板">
          <div className="paper-meta">
            <span>ANNOTATION / {p.data.items.length} 个对象</span>
            <span>
              {p.data.width} × {p.data.height} px
            </span>
          </div>
          {renderable ? (
            <Canvas
              key={p.documentKey}
              board={p.data}
              selected={selected}
              disabled={locked}
              onSelect={(id) => {
                setSelected(id);
                setInspector(true);
              }}
              onChange={change}
              handle={canvas}
              onError={p.report}
            />
          ) : (
            <p role="alert">
              画板属性尚未有效。请在工程 JSON 中修正；原始工作稿已保留。
            </p>
          )}
          <p className="canvas-caption">原图与标注各自保留，可随时调整。</p>
        </section>
        {inspector && (
          <aside>
            <div className="aside-heading">
              <h2>{item ? labels[item.kind] + "属性" : "对象与图层"}</h2>
              <button aria-label="收起属性" onClick={() => setInspector(false)}>
                <PanelRightClose size={17} />
              </button>
            </div>
            {item ? (
              <fieldset disabled={locked}>
                <div className="property-grid">
                  {numeric.map((key) => (
                    <label key={key}>
                      {names[key]}
                      <input
                        aria-label={names[key]}
                        inputMode="decimal"
                        value={
                          typeof fields[key] === "string"
                            ? fields[key]
                            : String(item[key])
                        }
                        onChange={(e) => field(key, e.target.value)}
                        autoComplete="off"
                      />
                    </label>
                  ))}
                </div>
                {item.kind === "text" && (
                  <label>
                    标注文字
                    <textarea
                      aria-label="标注文字"
                      value={
                        typeof fields.text === "string"
                          ? fields.text
                          : item.text
                      }
                      onChange={(e) => field("text", e.target.value)}
                    />
                  </label>
                )}
                <div className="property-grid">
                  {(["fill", "stroke"] as const).map((key) => (
                    <label key={key}>
                      {key === "fill" ? "填充颜色" : "描边颜色"}
                      <input
                        aria-label={key === "fill" ? "填充颜色" : "描边颜色"}
                        value={
                          typeof fields[key] === "string"
                            ? fields[key]
                            : item[key]
                        }
                        onChange={(e) => field(key, e.target.value)}
                        autoComplete="off"
                      />
                    </label>
                  ))}
                </div>
                <button className="primary" onClick={apply}>
                  应用属性{Object.keys(fields).length ? " · 有草稿" : ""}
                </button>
                <div className="row">
                  <button onClick={() => order(1)}>上移一层</button>
                  <button onClick={() => order(-1)}>下移一层</button>
                  <button
                    onClick={() => {
                      if (confirm("删除这个对象？")) {
                        p.setData((b) => ({
                          ...b,
                          items: b.items.filter((i) => i.id !== item.id),
                        }));
                        setSelected("");
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </fieldset>
            ) : (
              <p className="muted">
                点选画板对象或下方图层，调整位置、大小与文字。
              </p>
            )}
            <h3>
              图层 <span>{p.data.items.length}</span>
            </h3>
            <div className="layers">
              {[...p.data.items].reverse().map((i, index) => (
                <button
                  className={selected === i.id ? "selected" : ""}
                  key={i.id}
                  onClick={() => setSelected(i.id)}
                >
                  <span
                    className="layer-dot"
                    style={{ background: i.stroke }}
                  />
                  <span>{i.text || i.source?.name || labels[i.kind]}</span>
                  <small>{p.data.items.length - index}</small>
                </button>
              ))}
            </div>
            {!p.data.items.length && (
              <button onClick={() => add("text")}>
                <Plus size={16} />
                放置第一条标注
              </button>
            )}
          </aside>
        )}
      </main>
      <footer>
        <span>KONVA / 校样工作空间</span>
        <span>PNG 保留画板像素 · JSON 包含可编辑对象与原图</span>
      </footer>
    </div>
  );
}
