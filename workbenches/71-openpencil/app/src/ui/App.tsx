import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Square,
  Type,
  Circle,
  Copy,
  Trash2,
  Download,
  Upload,
  Layers,
  MousePointer2,
  Undo2,
} from "lucide-react";
import {
  useProjects,
  ProjectPicker,
  Notice,
  request,
  download,
} from "./workspace";
import {
  designValue,
  viewValue,
  propertyValue,
  type Layer,
  type View,
} from "../contracts/design";
import { isRecord } from "../contracts/project";
import initial from "../contracts/seed.json";
const seed = designValue(initial);
const asText = (x: unknown, fallback = "") =>
  typeof x === "string" ? x : fallback;
function properties(layer: Layer) {
  return {
    name: layer.name,
    x: String(layer.x),
    y: String(layer.y),
    width: String(layer.width),
    height: String(layer.height),
    text: layer.text,
    color: layer.color,
    visible: layer.visible,
  };
}
export function App() {
  const p = useProjects(seed, designValue, "Fieldnotes / 会员卡", {
    storageKey: "openpencil-native-v1",
  });
  const [view, setView] = useState<View | null>(null),
    [loading, setLoading] = useState(false),
    [actionBusy, setActionBusy] = useState(false),
    [error, setError] = useState(""),
    [panel, setPanel] = useState("canvas"),
    [jsonOpen, setJsonOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    epoch = useRef(p.documentKey),
    liveFile = useRef(p.data.file),
    requestSeq = useRef(0);
  epoch.current = p.documentKey;
  liveFile.current = p.data.file;
  const pageId = asText(p.draft.pageId),
    selectedId = asText(p.draft.selectedId);
  useEffect(() => {
    if (p.loading) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError("");
    request("/api/preview", {
      method: "POST",
      body: JSON.stringify({ file: p.data.file, pageId }),
    })
      .then((raw) => {
        if (seq === requestSeq.current) setView(viewValue(raw));
      })
      .catch((e) => {
        if (seq === requestSeq.current) {
          setView(null);
          setError(e instanceof Error ? e.message : "读取失败");
        }
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
    return () => {
      requestSeq.current++;
    };
  }, [p.data.file, pageId, p.loading, p.documentKey]);
  const selected = view?.layers.find((x) => x.id === selectedId) ?? null;
  const allProps = isRecord(p.draft.properties) ? p.draft.properties : {};
  const candidate = selected ? allProps[selected.id] : undefined;
  const stored = isRecord(candidate) ? candidate : null;
  const values = selected
    ? { ...properties(selected), ...(stored ?? {}) }
    : null;
  const [transitioning, setTransitioning] = useState(false);
  const transitionRef = useRef(false);
  async function transition(action: () => Promise<unknown>) {
    if (transitionRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    try {
      await action();
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  const mutable = !p.loading && !p.busy && !transitioning && !actionBusy;
  function choose(id: string) {
    p.setDraft((d) => ({ ...d, selectedId: id }));
  }
  function editProp(key: string, value: unknown) {
    if (!selected) return;
    const id = selected.id;
    p.setDraft((d) => ({
      ...d,
      properties: {
        ...(isRecord(d.properties) ? d.properties : {}),
        [id]: {
          ...properties(selected),
          ...(isRecord(d.properties) && isRecord(d.properties[id])
            ? d.properties[id]
            : {}),
          [key]: value,
        },
      },
    }));
  }
  async function act(action: Record<string, unknown>, clearId?: string) {
    const original = p.data.file,
      key = epoch.current,
      propsSnapshot = clearId ? JSON.stringify(allProps[clearId]) : "";
    setActionBusy(true);
    setError("");
    try {
      const raw = await request("/api/edit", {
        method: "POST",
        body: JSON.stringify({ file: original, pageId, action }),
      });
      if (!isRecord(raw) || typeof raw.file !== "string")
        throw new Error("编辑响应无效。");
      const next = designValue({ file: raw.file, notes: p.data.notes });
      const nextView = viewValue(raw.view);
      if (key !== epoch.current || liveFile.current !== original) return;
      p.setData((d) => ({ ...d, file: next.file }));
      setView(nextView);
      if (clearId)
        p.setDraft((d) => {
          const map = isRecord(d.properties) ? { ...d.properties } : {};
          if (JSON.stringify(map[clearId]) === propsSnapshot)
            delete map[clearId];
          return { ...d, properties: map };
        });
    } catch (e) {
      if (key === epoch.current)
        setError(e instanceof Error ? e.message : "编辑失败，草稿已保留。");
    } finally {
      setActionBusy(false);
    }
  }
  async function importFile(file: File) {
    const key = epoch.current;
    try {
      if (file.size > 1300000) throw new Error("文件过大，请拆分设计。");
      let data,
        extra: Record<string, unknown> = {},
        title = file.name.replace(/\.[^.]+$/, "");
      if (file.name.toLowerCase().endsWith(".fig")) {
        if (file.size > 600000) throw new Error("FIG文件最多600KB。");
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const n of bytes) binary += String.fromCharCode(n);
        data = designValue({ file: btoa(binary), notes: "" });
        await request("/api/preview", {
          method: "POST",
          body: JSON.stringify({ file: data.file }),
        });
      } else {
        const raw: unknown = JSON.parse(await file.text());
        if (!isRecord(raw)) throw new Error("项目JSON无效。");
        const source = isRecord(raw.snapshot) ? raw.snapshot : raw;
        data = designValue(source.data);
        extra = isRecord(source.extra) ? source.extra : {};
        if (typeof source.title === "string") title = source.title;
      }
      await request("/api/preview", {
        method: "POST",
        body: JSON.stringify({ file: data.file }),
      });
      if (key === epoch.current) await p.replace(data, title, extra);
    } catch (e) {
      p.report(e);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function exportNative() {
    const bytes = Uint8Array.from(atob(p.data.file), (x) => x.charCodeAt(0));
    download(
      new Blob([bytes], { type: "application/octet-stream" }),
      p.title + ".fig",
    );
  }
  const json = asText(
    p.draft.json,
    JSON.stringify(
      { title: p.title, data: p.data, extra: { ...p.draft, json: undefined } },
      null,
      2,
    ),
  );
  async function applyJson() {
    const key = epoch.current;
    try {
      const raw: unknown = JSON.parse(json);
      if (!isRecord(raw)) throw new Error("JSON应为项目对象。");
      const source = isRecord(raw.snapshot) ? raw.snapshot : raw;
      const data = designValue(source.data);
      await request("/api/preview", {
        method: "POST",
        body: JSON.stringify({ file: data.file }),
      });
      if (key !== epoch.current) return;
      await p.replace(
        data,
        asText(source.title, "导入的设计"),
        isRecord(source.extra) ? source.extra : {},
      );
    } catch (e) {
      p.report(e);
    }
  }
  return (
    <div className="design-app">
      <a className="skip" href="#canvas">
        跳到设计画布
      </a>
      <header className="topbar">
        <div className="brand">
          <MousePointer2 size={20} />
          <span>
            组件制图<small>OPENPENCIL</small>
          </span>
        </div>
        <input
          className="project-title"
          aria-label="项目名称"
          name="title"
          autoComplete="off"
          value={p.title}
          disabled={!mutable}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable}
          onOpen={(id) => void transition(() => p.open(id))}
        />
        <div className="actions">
          <button disabled={!mutable} onClick={() => void transition(() => p.fresh())}>
            <Plus size={16} />
            新建
          </button>
          <button
            disabled={!mutable}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            导入
          </button>
          <button disabled={!p.data.file || loading} onClick={exportNative}>
            <Download size={16} />
            FIG
          </button>
          <button onClick={p.exportDraft}>完整项目</button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".fig,.json"
          aria-label="导入设计文件"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void transition(() => importFile(f));
          }}
        />
      </header>
      <div className="notice-zone">
        <Notice error={p.error || error} notice={p.notice} />
      </div>
      <nav className="mobile-tabs" aria-label="工作区域">
        {[
          ["layers", "图层"],
          ["canvas", "画布"],
          ["inspector", "属性"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={panel === id}
            onClick={() => setPanel(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className={"workspace show-" + panel}>
        <aside className="layer-panel">
          <div className="section-title">
            <Layers size={15} />
            <h1>图层</h1>
          </div>
          <label className="page-select">
            页面
            <select
              value={view?.pageId ?? ""}
              disabled={!mutable || loading}
              onChange={(e) =>
                p.setDraft((d) => ({
                  ...d,
                  pageId: e.target.value,
                  selectedId: "",
                }))
              }
            >
              {view?.pages.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="layer-list">
            {view?.layers.map((n) => (
              <button
                key={n.id}
                className={selected?.id === n.id ? "active" : ""}
                aria-label={n.name || "未命名图层"}
                disabled={!mutable || loading}
                style={{ paddingLeft: 12 + n.depth * 12 }}
                onClick={() => choose(n.id)}
                aria-pressed={selected?.id === n.id}
              >
                <span className="layer-icon">
                  {n.type === "TEXT" ? "T" : n.type === "FRAME" ? "▣" : "◇"}
                </span>
                <span>{n.name || "未命名图层"}</span>
                {!n.visible && <small>隐藏</small>}
              </button>
            ))}
            {view && !view.layers.length && (
              <p className="empty">这个页面还没有图层。用工具栏添加。</p>
            )}
          </div>
          <button
            className="json-toggle"
            onClick={() => setJsonOpen(!jsonOpen)}
          >
            项目 JSON 草稿
          </button>
        </aside>
        <section className="canvas-panel" id="canvas" aria-label="设计画布">
          <div className="toolstrip">
            {[
              ["FRAME", "画板", Square],
              ["RECTANGLE", "矩形", Square],
              ["ELLIPSE", "圆形", Circle],
              ["TEXT", "文字", Type],
            ].map(([type, label, Icon]) => {
              const Glyph = Icon as typeof Square;
              return (
                <button
                  key={String(type)}
                  disabled={!mutable || loading}
                  onClick={() => void act({ kind: "add", type })}
                >
                  <Glyph size={16} />
                  {String(label)}
                </button>
              );
            })}
            <span className="toolspacer" />
            <button
              disabled={!selected || !mutable || loading}
              onClick={() => void act({ kind: "duplicate", id: selected?.id })}
              aria-label="复制图层"
            >
              <Copy size={16} />
            </button>
            <button
              disabled={!selected || !mutable || loading}
              onClick={() => {
                if (confirm("删除选中图层及其子图层？"))
                  void act({ kind: "delete", id: selected?.id });
              }}
              aria-label="删除图层"
            >
              <Trash2 size={16} />
            </button>
            <button
              disabled={!view || loading}
              onClick={() =>
                view &&
                download(
                  new Blob([view.svg], { type: "image/svg+xml" }),
                  p.title + ".svg",
                )
              }
            >
              导出 SVG
            </button>
          </div>
          <div className="drawing-space">
            {view ? (
              <div className="artboard-wrap">
                <div className="ruler">
                  {view.pages.find((x) => x.id === view.pageId)?.name}{" "}
                  <span>
                    {Math.round(view.width)} × {Math.round(view.height)}
                  </span>
                </div>
                <div
                  className="artboard"
                  style={{ aspectRatio: String(view.width / view.height) }}
                >
                  <img
                    alt="设计画板预览"
                    width={view.width}
                    height={view.height}
                    src={
                      "data:image/svg+xml;charset=utf-8," +
                      encodeURIComponent(view.svg)
                    }
                  />
                  {view.layers
                    .filter((x) => x.visible && x.depth > 0)
                    .map((n) => (
                      <button
                        className={
                          "hit-layer " + (selected?.id === n.id ? "chosen" : "")
                        }
                        key={n.id}
                        aria-label={"选择 " + n.name}
                        disabled={!mutable || loading}
                        title={n.name}
                        onClick={() => choose(n.id)}
                        style={{
                          left:
                            ((n.absoluteX - view.offsetX) / view.width) * 100 +
                            "%",
                          top:
                            ((n.absoluteY - view.offsetY) / view.height) * 100 +
                            "%",
                          width: (n.width / view.width) * 100 + "%",
                          height: (n.height / view.height) * 100 + "%",
                        }}
                      />
                    ))}
                </div>
              </div>
            ) : (
              <p className="empty">
                {loading
                  ? "正在读取设计…"
                  : "无法显示画板，请检查文件或重新导入。"}
              </p>
            )}
          </div>
          <div className="canvas-footer">
            <span role="status">
              {actionBusy
                ? "正在应用修改…"
                : loading
                  ? "正在更新预览…"
                  : "选择图层以编辑 · 原生 FIG 文档"}
            </span>
            <span>{view?.layers.length ?? 0} 个图层</span>
          </div>
        </section>
        <aside className="inspector">
          <div className="section-title">
            <h2>设计属性</h2>
            {stored && <span className="draft-pill">未应用</span>}
          </div>
          {selected && values ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  void act(
                    {
                      kind: "update",
                      id: selected.id,
                      props: propertyValue(values),
                    },
                    selected.id,
                  );
                } catch (err) {
                  setError(err instanceof Error ? err.message : "属性无效");
                }
              }}
            >
              <fieldset disabled={!mutable}>
                <label>
                  图层名称
                  <input
                    name="layerName"
                    autoComplete="off"
                    value={asText(values.name)}
                    onChange={(e) => editProp("name", e.target.value)}
                  />
                </label>
                <div className="property-grid">
                  {[
                    ["x", "X"],
                    ["y", "Y"],
                    ["width", "宽度"],
                    ["height", "高度"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        name={key}
                        aria-label={label}
                        inputMode="decimal"
                        autoComplete="off"
                        value={asText(values[key as keyof typeof values])}
                        onChange={(e) => editProp(key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  填色
                  <div className="color-input">
                    <input
                      type="color"
                      aria-label="选择填色"
                      value={
                        /^#[0-9a-f]{6}$/i.test(asText(values.color))
                          ? asText(values.color)
                          : "#ffffff"
                      }
                      onChange={(e) => editProp("color", e.target.value)}
                    />
                    <input
                      name="color"
                      aria-label="填色值"
                      autoComplete="off"
                      value={asText(values.color)}
                      onChange={(e) => editProp("color", e.target.value)}
                    />
                  </div>
                </label>
                {selected.type === "TEXT" && (
                  <label>
                    文字内容
                    <textarea
                      name="text"
                      aria-label="文字内容"
                      value={asText(values.text)}
                      onChange={(e) => editProp("text", e.target.value)}
                    />
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={values.visible !== false}
                    onChange={(e) => editProp("visible", e.target.checked)}
                  />
                  显示图层
                </label>
                <button
                  className="primary"
                  disabled={!mutable || loading}
                  type="submit"
                >
                  应用属性
                </button>
                <button
                  type="button"
                  disabled={!stored}
                  onClick={() =>
                    p.setDraft((d) => {
                      const map = isRecord(d.properties)
                        ? { ...d.properties }
                        : {};
                      delete map[selected.id];
                      return { ...d, properties: map };
                    })
                  }
                >
                  <Undo2 size={14} />
                  还原属性草稿
                </button>
              </fieldset>
            </form>
          ) : (
            <div className="empty">选择一个图层，查看尺寸、颜色和文字。</div>
          )}
          <section className="handoff">
            <h2>交付备注</h2>
            <textarea
              aria-label="交付备注"
              disabled={!mutable}
              name="notes"
              value={p.data.notes}
              onChange={(e) =>
                p.setData((d) => ({ ...d, notes: e.target.value }))
              }
            />
          </section>
        </aside>
      </main>
      {jsonOpen && (
        <section className="json-editor">
          <label>
            未应用项目 JSON
            <textarea
              aria-label="项目 JSON 草稿"
              disabled={!mutable}
              value={json}
              onChange={(e) =>
                p.setDraft((d) => ({ ...d, json: e.target.value }))
              }
            />
          </label>
          <button onClick={() => void transition(() => applyJson())} disabled={!mutable}>
            作为新项目导入
          </button>
        </section>
      )}
      <footer className="savebar">
        <span className={"save-state " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        {["offline", "conflict", "draft"].includes(p.autoState.phase) && (
          <>
            <button disabled={!mutable} onClick={() => void p.save()}>重试保存</button>
            <button onClick={p.exportDraft}>导出恢复稿</button>
            {p.current && (
              <button disabled={!mutable} onClick={() => void transition(() => p.open(p.current!.id))}>
                打开服务器版本
              </button>
            )}
          </>
        )}
        <span>属性草稿与设计一起保存</span>
      </footer>
    </div>
  );
}
