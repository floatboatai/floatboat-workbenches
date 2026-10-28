import { useEffect, useRef, useState } from "react";
import {
  Layers,
  Upload,
  Download,
  Check,
  ChevronRight,
  Plus,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import {
  useProjects,
  ProjectPicker,
  Notice,
  request,
  download,
} from "./workspace";
import { designValue, viewValue, type View } from "../contracts/design";
import { isRecord } from "../contracts/project";
import initial from "../contracts/seed.json";
const seed = designValue(initial);
const str = (v: unknown, backup = "") => (typeof v === "string" ? v : backup);
function blob(data: string, type: string) {
  return new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {
    type,
  });
}
export function App() {
  const p = useProjects(seed, designValue, "Ridgeline / 移动端校样", {
    storageKey: "figcraft-review-v1",
  });
  const [view, setView] = useState<View | null>(null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [tab, setTab] = useState("preview"),
    [jsonOpen, setJsonOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    epoch = useRef(p.documentKey),
    current = useRef(p.data.file),
    seq = useRef(0);
  epoch.current = p.documentKey;
  current.current = p.data.file;
  const frameId = typeof p.draft.frameId === "number" ? p.draft.frameId : 0;
  useEffect(() => {
    if (p.loading) return;
    const token = ++seq.current;
    setLoading(true);
    setView(null);
    setError("");
    request("/api/engine", {
      method: "POST",
      body: JSON.stringify({ file: p.data.file, frameId }),
    })
      .then((raw) => {
        if (token === seq.current) setView(viewValue(raw));
      })
      .catch((e) => {
        if (token === seq.current)
          setError(e instanceof Error ? e.message : "无法连接渲染服务。");
      })
      .finally(() => {
        if (token === seq.current) setLoading(false);
      });
    return () => {
      seq.current++;
    };
  }, [p.documentKey, p.data.file, p.loading, frameId, refresh]);
  const mutable = !p.loading && !p.busy && !busy,
    selected = view?.frames.find((x) => x.id === view.selectedId),
    texts = isRecord(p.draft.texts) ? p.draft.texts : {};
  const names = isRecord(p.draft.frameNames) ? p.draft.frameNames : {};
  function draftText(id: number, value: string) {
    p.setDraft((d) => ({
      ...d,
      texts: { ...(isRecord(d.texts) ? d.texts : {}), [id]: value },
    }));
  }
  async function edit(action: Record<string, unknown>) {
    const source = current.current,
      key = epoch.current,
      id = String(action.id),
      draftSnapshot = texts[id];
    setBusy(true);
    setError("");
    p.setNotice("");
    try {
      const next = viewValue(
        await request("/api/engine", {
          method: "POST",
          body: JSON.stringify({
            file: source,
            frameId: view?.selectedId,
            action,
          }),
        }),
      );
      if (key !== epoch.current || current.current !== source) return;
      p.setData((d) => ({ ...d, file: next.file }));
      setView(next);
      if (action.kind === "status")
        p.setNotice("画板已在原生设计中标记为可交付。");
      if (action.kind === "text")
        p.setDraft((d) => {
          const values = isRecord(d.texts) ? { ...d.texts } : {};
          if (values[id] === draftSnapshot) delete values[id];
          return { ...d, texts: values };
        });
    } catch (e) {
      if (key === epoch.current)
        setError(
          e instanceof Error ? e.message : "修订未完成，原稿和草稿仍在。",
        );
    } finally {
      setBusy(false);
    }
  }
  async function exportFile(format: string) {
    if (!view) return;
    const key = epoch.current;
    setBusy(true);
    setError("");
    try {
      const result = viewValue(
        await request("/api/engine", {
          method: "POST",
          body: JSON.stringify({
            file: p.data.file,
            frameId: view.selectedId,
            export: format,
          }),
        }),
      );
      if (key === epoch.current && result.artifact)
        download(
          blob(
            result.artifact.data,
            format === "png"
              ? "image/png"
              : format === "svg"
                ? "image/svg+xml"
                : "application/pdf",
          ),
          (selected?.name ?? p.title) + "." + format,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }
  async function importFile(f: File) {
    const key = epoch.current;
    try {
      if (f.size > 1300000) throw new Error("文件过大，请拆分设计。");
      let data,
        extra: Record<string, unknown> = {},
        title = f.name.replace(/\.[^.]+$/, "");
      if (f.name.endsWith(".figcraft")) {
        if (f.size > 600000) throw new Error("原生设计最多600KB。");
        let binary = "";
        for (const n of new Uint8Array(await f.arrayBuffer()))
          binary += String.fromCharCode(n);
        data = designValue({ file: btoa(binary), notes: {} });
      } else {
        const raw: unknown = JSON.parse(await f.text());
        if (!isRecord(raw)) throw new Error("项目格式无效。");
        const s = isRecord(raw.snapshot) ? raw.snapshot : raw;
        data = designValue(s.data);
        extra = isRecord(s.extra) ? s.extra : {};
        title = str(s.title, title);
      }
      if (key === epoch.current) await p.replace(data, title, extra);
    } catch (e) {
      p.report(e);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  const json = str(
    p.draft.json,
    JSON.stringify(
      { title: p.title, data: p.data, extra: { ...p.draft, json: undefined } },
      null,
      2,
    ),
  );
  async function applyJson() {
    try {
      const raw: unknown = JSON.parse(json);
      if (!isRecord(raw)) throw new Error("项目JSON无效。");
      const s = isRecord(raw.snapshot) ? raw.snapshot : raw;
      await p.replace(
        designValue(s.data),
        str(s.title, "导入的校样"),
        isRecord(s.extra) ? s.extra : {},
      );
    } catch (e) {
      p.report(e);
    }
  }
  return (
    <div className="proof-app">
      <a className="skip" href="#proof-stage">
        跳到校样画板
      </a>
      <header>
        <div className="brand">
          <Layers size={23} />
          <div>
            原型校样<small>FIGCRAFT / PROOF ROOM</small>
          </div>
        </div>
        <input
          aria-label="项目名称"
          name="title"
          autoComplete="off"
          value={p.title}
          onChange={(e) => p.setTitle(e.target.value)}
          disabled={!mutable}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable}
          onOpen={(id) => void p.open(id)}
        />
        <div className="header-actions">
          <button disabled={!mutable} onClick={() => void p.fresh()}>
            <Plus size={15} />
            新建
          </button>
          <button disabled={!mutable} onClick={() => file.current?.click()}>
            <Upload size={15} />
            导入
          </button>
          <button
            onClick={() =>
              download(
                blob(p.data.file, "application/octet-stream"),
                p.title + ".figcraft",
              )
            }
          >
            <Download size={15} />
            设计文件
          </button>
          <button onClick={p.exportDraft}>完整项目</button>
        </div>
        <input
          hidden
          type="file"
          ref={file}
          accept=".figcraft,.json"
          aria-label="导入校样项目"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
          }}
        />
      </header>
      <Notice error={p.error || error} notice={p.notice} />
      <nav className="mobile-nav" aria-label="校样区域">
        <button
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          画板
        </button>
        <button aria-pressed={tab === "copy"} onClick={() => setTab("copy")}>
          文案与备注
        </button>
      </nav>
      <main className={"review-room tab-" + tab}>
        <aside className="filmstrip">
          <div className="film-heading">
            <h1>画板顺序</h1>
            <span>{view?.frames.length ?? "—"}</span>
          </div>
          {view?.frames.map((f, index) => (
            <button
              className={view.selectedId === f.id ? "selected" : ""}
              key={f.id}
              disabled={busy || loading}
              onClick={() => p.setDraft((d) => ({ ...d, frameId: f.id }))}
            >
              <span className="frame-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>{f.name}</strong>
                <small>
                  {Math.round(f.width)} × {Math.round(f.height)}
                </small>
              </div>
              <ChevronRight size={14} />
            </button>
          ))}
          <div className="film-bottom">
            <p>原生画板 · 独立复核</p>
            <button disabled={busy} onClick={() => setRefresh((x) => x + 1)}>
              <RefreshCw size={14} />
              重新渲染
            </button>
            <button onClick={() => setJsonOpen(!jsonOpen)}>JSON 草稿</button>
          </div>
        </aside>
        <section
          className="stage-column"
          id="proof-stage"
          aria-label="画板校样"
        >
          <div className="stage-heading">
            <div>
              <span className="eyebrow">SCREEN REVIEW</span>
              <h2>{selected?.name ?? "设计校样"}</h2>
              {selected?.status === "readyForDev" && (
                <span className="ready-label">已标记可交付</span>
              )}
            </div>
            <div className="export-actions">
              {["png", "svg", "pdf"].map((f) => (
                <button
                  key={f}
                  disabled={!view || busy || loading}
                  onClick={() => void exportFile(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="proof-stage">
            {loading ? (
              <div className="empty" role="status">
                正在渲染画板…
              </div>
            ) : view ? (
              <img
                src={"data:image/png;base64," + view.image}
                alt={selected?.name + " 原生画板渲染"}
                width={view.width}
                height={view.height}
              />
            ) : (
              <div className="empty">
                <FileCheck size={32} />
                <p>设计文件已保留。连接本地 FigCraft 引擎后继续校样。</p>
                <button onClick={() => setRefresh((x) => x + 1)}>
                  重试渲染
                </button>
              </div>
            )}
          </div>
          <div className="stage-footer">
            <span>{view?.engine ?? "FigCraft引擎未就绪"}</span>
            <span>
              {selected
                ? `${Math.round(selected.width)} × ${Math.round(selected.height)}`
                : "等待画板"}
            </span>
          </div>
        </section>
        <aside className="copy-panel">
          <div className="copy-heading">
            <span className="eyebrow">COPY & HANDOFF</span>
            <h2>文案修订</h2>
          </div>
          <div className="copy-list">
            {view?.layers
              .filter((x) => x.type === "text")
              .map((n) => {
                const value = str(texts[n.id], n.text);
                return (
                  <section className="copy-item" key={n.id}>
                    <label htmlFor={"text-" + n.id}>
                      <span>{n.name}</span>
                      {texts[n.id] !== undefined && <em>未应用</em>}
                    </label>
                    <textarea
                      id={"text-" + n.id}
                      aria-label={"文案 " + n.id}
                      value={value}
                      disabled={p.loading || p.busy}
                      onChange={(e) => draftText(n.id, e.target.value)}
                    />
                    <button
                      disabled={!mutable || loading || value === n.text}
                      onClick={() =>
                        void edit({ kind: "text", id: n.id, text: value })
                      }
                    >
                      应用文案
                      <Check size={13} />
                    </button>
                  </section>
                );
              })}
            {view && !view.layers.some((x) => x.type === "text") && (
              <p className="empty">此画板没有文字图层。</p>
            )}
          </div>
          {selected && (
            <section className="review-notes">
              <h2>画板复核</h2>
              <label>
                画板名称
                <input
                  aria-label="画板名称"
                  name="frameName"
                  autoComplete="off"
                  value={str(names[selected.id], selected.name)}
                  disabled={!mutable}
                  onChange={(e) =>
                    p.setDraft((d) => ({
                      ...d,
                      frameNames: {
                        ...(isRecord(d.frameNames) ? d.frameNames : {}),
                        [selected.id]: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <button
                disabled={!mutable || loading}
                onClick={() =>
                  void edit({
                    kind: "rename",
                    id: selected.id,
                    name: str(names[selected.id], selected.name),
                  })
                }
              >
                应用名称
              </button>
              <label htmlFor="review-note">交付备注</label>
              <textarea
                id="review-note"
                aria-label="交付备注"
                value={p.data.notes[selected.id] ?? ""}
                disabled={p.loading || p.busy}
                onChange={(e) =>
                  p.setData((d) => ({
                    ...d,
                    notes: { ...d.notes, [selected.id]: e.target.value },
                  }))
                }
              />
              <button
                className="ready"
                disabled={!mutable || loading}
                onClick={() =>
                  void edit({
                    kind: "status",
                    id: selected.id,
                    status: "readyForDev",
                  })
                }
              >
                <FileCheck size={16} />
                标记可交付
              </button>
            </section>
          )}
        </aside>
      </main>
      {jsonOpen && (
        <section className="json-draft">
          <label>
            项目 JSON 草稿
            <textarea
              aria-label="项目 JSON 草稿"
              value={json}
              disabled={!mutable}
              onChange={(e) =>
                p.setDraft((d) => ({ ...d, json: e.target.value }))
              }
            />
          </label>
          <button disabled={!mutable} onClick={() => void applyJson()}>
            作为新项目导入
          </button>
        </section>
      )}
      <footer>
        <span className={"save-state " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        {["offline", "draft", "conflict"].includes(p.autoState.phase) && (
          <>
            <button onClick={() => void p.save()}>重试保存</button>
            <button onClick={p.exportDraft}>导出恢复稿</button>
            {p.current && (
              <button onClick={() => void p.open(p.current!.id)}>
                打开服务器版本
              </button>
            )}
          </>
        )}
        <span>文案草稿与原生设计一同保留</span>
      </footer>
    </div>
  );
}
