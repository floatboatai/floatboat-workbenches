import { useRef, useState } from "react";
import {
  Plus,
  Download,
  Upload,
  ArrowUpRight,
  Palette,
  Type,
  LayoutTemplate,
  Trash2,
} from "lucide-react";
import {
  useProjects,
  ProjectPicker,
  Notice,
  download,
  request,
} from "./workspace";
import {
  seed,
  kitValue,
  restoreKit,
  css,
  type Kit,
  type Sample,
} from "../contracts/domain";
import { isRecord } from "../contracts/project";
const safeColor = (value: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? value : "#e8e6df";
export function App() {
  const p = useProjects(seed, kitValue, "Fieldnotes / 设计资产", {
    storageKey: "penpot-assets-v1",
    restoreDraftData: restoreKit,
  });
  const [tab, setTab] = useState("colors"),
    [busy, setBusy] = useState(false),
    [jsonOpen, setJsonOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
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
  const mutable = !p.loading && !p.busy && !transitioning && !busy;
  let issue = "";
  try {
    kitValue(p.data);
  } catch (e) {
    issue = e instanceof Error ? e.message : "请完善资产。";
  }
  function removeColor(id: string) {
    if (p.data.samples.some((s) => s.colorId === id || s.foregroundId === id)) {
      p.setError("这个颜色仍被样本引用，请先更换样本的颜色。");
      return;
    }
    if (confirm("删除这个颜色资产？"))
      p.setData((d) => ({ ...d, colors: d.colors.filter((c) => c.id !== id) }));
  }
  function removeFont(id: string) {
    if (p.data.samples.some((s) => s.fontId === id)) {
      p.setError("这个字体仍被样本引用，请先更换样本字体。");
      return;
    }
    if (confirm("删除这个字体资产？"))
      p.setData((d) => ({ ...d, fonts: d.fonts.filter((f) => f.id !== id) }));
  }
  function addSample(kind: Sample["kind"]) {
    if (!p.data.colors.length || !p.data.fonts.length) {
      p.setError("先添加至少一个颜色和字体资产。");
      return;
    }
    p.setData((d) => ({
      ...d,
      samples: [
        ...d.samples,
        {
          id: crypto.randomUUID(),
          kind,
          name: kind === "button" ? "新的按钮样本" : "新的卡片样本",
          label: "Your next idea",
          body: "A considered detail for every day.",
          colorId: d.colors[0].id,
          foregroundId: d.colors.at(-1)!.id,
          fontId: d.fonts[0].id,
          width: kind === "button" ? "260" : "390",
          height: kind === "button" ? "56" : "250",
          radius: "12",
        },
      ],
    }));
  }
  function patchSample(id: string, key: keyof Sample, value: string) {
    p.setData((d) => ({
      ...d,
      samples: d.samples.map((s) => (s.id === id ? { ...s, [key]: value } : s)),
    }));
  }
  async function native() {
    setBusy(true);
    p.setError("");
    try {
      const raw = await request("/api/native-export", {
        method: "POST",
        body: JSON.stringify({ title: p.title, data: kitValue(p.data) }),
      });
      if (!isRecord(raw) || typeof raw.data !== "string")
        throw new Error("原生导出响应无效。");
      download(
        new Blob([Uint8Array.from(atob(raw.data), (c) => c.charCodeAt(0))], {
          type: "application/penpot",
        }),
        p.title + ".penpot",
      );
      p.setNotice("已生成含颜色、字体与组件样本的原生Penpot包。");
    } catch (e) {
      p.report(e);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(f: File) {
    const key = epoch.current;
    setBusy(true);
    p.setError("");
    try {
      if (f.size > 1200000) throw new Error("导入文件最多1.2MB。");
      let data: Kit,
        extra: Record<string, unknown> = {},
        title = f.name.replace(/\.[^.]+$/, "");
      if (/\.(penpot|zip)$/i.test(f.name)) {
        let binary = "";
        for (const n of new Uint8Array(await f.arrayBuffer()))
          binary += String.fromCharCode(n);
        const raw = await request("/api/native-import", {
          method: "POST",
          body: JSON.stringify({ data: btoa(binary) }),
        });
        if (!isRecord(raw)) throw new Error("资产响应无效。");
        data = kitValue(raw.data);
        p.setNotice(
          `已提取颜色与字体，跳过${Number(raw.skipped) || 0}项不支持资产；原生画板未导入。`,
        );
      } else {
        const raw: unknown = JSON.parse(await f.text());
        if (!isRecord(raw)) throw new Error("项目JSON无效。");
        const s = isRecord(raw.snapshot) ? raw.snapshot : raw;
        data = restoreKit(s.data);
        extra = isRecord(s.extra) ? s.extra : {};
        title = typeof s.title === "string" ? s.title : title;
      }
      if (key === epoch.current) await p.replace(data, title, extra);
    } catch (e) {
      p.report(e);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  const json =
    typeof p.draft.json === "string"
      ? p.draft.json
      : JSON.stringify(
          {
            title: p.title,
            data: p.data,
            extra: { ...p.draft, json: undefined },
          },
          null,
          2,
        );
  async function applyJson() {
    try {
      const raw: unknown = JSON.parse(json);
      if (!isRecord(raw)) throw new Error("项目JSON无效。");
      const s = isRecord(raw.snapshot) ? raw.snapshot : raw;
      await p.replace(
        restoreKit(s.data),
        typeof s.title === "string" ? s.title : "导入的资产",
        isRecord(s.extra) ? s.extra : {},
      );
    } catch (e) {
      p.report(e);
    }
  }
  return (
    <div className="kit-app">
      <a className="skip" href="#assets">
        跳到资产样本
      </a>
      <header className="masthead">
        <div className="brand">
          <Palette size={24} />
          <span>
            设计资产<small>PENPOT / DESIGN LIBRARY</small>
          </span>
        </div>
        <input
          aria-label="项目名称"
          name="title"
          value={p.title}
          disabled={!mutable}
          autoComplete="off"
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable}
          onOpen={(id) => void transition(() => p.open(id))}
        />
        <div className="top-actions">
          <button disabled={!mutable} onClick={() => void transition(() => p.fresh())}>
            <Plus size={15} />
            新建
          </button>
          <button disabled={!mutable} onClick={() => file.current?.click()}>
            <Upload size={15} />
            导入
          </button>
          <button onClick={p.exportDraft}>完整项目</button>
        </div>
        <input
          hidden
          ref={file}
          type="file"
          aria-label="导入资产文件"
          accept=".json,.penpot,.zip"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void transition(() => importFile(f));
          }}
        />
      </header>
      <Notice error={p.error} notice={p.notice} />
      <div className="library-intro">
        <div>
          <span className="eyebrow">A SHARED VISUAL LANGUAGE</span>
          <h1>把每个细节，整理成共同语言。</h1>
          <p>色彩、字体与组件样本，随设计一起交付。</p>
        </div>
        <button
          className="native-export"
          disabled={!mutable || Boolean(issue)}
          onClick={() => void native()}
        >
          <Download size={18} />
          {busy ? "正在生成…" : "导出 Penpot"}
          <ArrowUpRight size={18} />
        </button>
      </div>
      <nav className="chapter-tabs" aria-label="资产章节">
        {[
          ["colors", "01", "色彩", Palette],
          ["fonts", "02", "字体", Type],
          ["samples", "03", "样本", LayoutTemplate],
        ].map(([id, number, label, Icon]) => {
          const Glyph = Icon as typeof Palette;
          return (
            <button
              key={String(id)}
              aria-pressed={tab === id}
              onClick={() => setTab(String(id))}
            >
              <small>{String(number)}</small>
              <Glyph size={15} />
              {String(label)}
            </button>
          );
        })}
        <span />
        <button
          disabled={Boolean(issue)}
          onClick={() => {
            try {
              download(
                new Blob([css(p.data)], { type: "text/css" }),
                p.title + ".css",
              );
            } catch (e) {
              p.report(e);
            }
          }}
        >
          CSS 变量
        </button>
        <button onClick={() => setJsonOpen(!jsonOpen)}>JSON 草稿</button>
      </nav>
      {issue && (
        <p className="draft-message" role="status">
          未完成的输入会保存为草稿。{issue}
        </p>
      )}
      <main id="assets">
        {tab === "colors" && (
          <>
            <div className="section-label">
              <h2>色彩角色</h2>
              <button
                disabled={!mutable || p.data.colors.length >= 100}
                onClick={() =>
                  p.setData((d) => ({
                    ...d,
                    colors: [
                      ...d.colors,
                      {
                        id: crypto.randomUUID(),
                        name: "新的颜色",
                        value: "#7b9689",
                      },
                    ],
                  }))
                }
              >
                <Plus size={15} />
                添加颜色
              </button>
            </div>
            <div className="color-grid">
              {p.data.colors.map((c, index) => (
                <article className="color-card" key={c.id}>
                  <div
                    className="swatch"
                    style={{ background: safeColor(c.value) }}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <input
                      type="color"
                      aria-label={"选择颜色 " + c.name}
                      disabled={!mutable}
                      value={safeColor(c.value)}
                      onChange={(e) =>
                        p.setData((d) => ({
                          ...d,
                          colors: d.colors.map((x) =>
                            x.id === c.id ? { ...x, value: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="color-fields">
                    <label>
                      资产名称
                      <input
                        aria-label={"颜色名称 " + c.id}
                        name="colorName"
                        autoComplete="off"
                        disabled={!mutable}
                        value={c.name}
                        onChange={(e) =>
                          p.setData((d) => ({
                            ...d,
                            colors: d.colors.map((x) =>
                              x.id === c.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      HEX
                      <input
                        aria-label={"颜色值 " + c.id}
                        name="hex"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={!mutable}
                        value={c.value}
                        onChange={(e) =>
                          p.setData((d) => ({
                            ...d,
                            colors: d.colors.map((x) =>
                              x.id === c.id
                                ? { ...x, value: e.target.value }
                                : x,
                            ),
                          }))
                        }
                      />
                    </label>
                    <button
                      aria-label={"删除颜色 " + c.name}
                      disabled={!mutable}
                      onClick={() => removeColor(c.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!p.data.colors.length && (
              <p className="empty">添加第一个色彩角色，开始建立资产库。</p>
            )}
          </>
        )}
        {tab === "fonts" && (
          <>
            <div className="section-label">
              <h2>字体层级</h2>
              <button
                disabled={!mutable || p.data.fonts.length >= 50}
                onClick={() =>
                  p.setData((d) => ({
                    ...d,
                    fonts: [
                      ...d.fonts,
                      {
                        id: crypto.randomUUID(),
                        name: "新的字体",
                        family: "Source Sans Pro",
                        size: "16",
                        weight: "400",
                      },
                    ],
                  }))
                }
              >
                <Plus size={15} />
                添加字体
              </button>
            </div>
            <div className="font-list">
              {p.data.fonts.map((f) => (
                <article className="font-card" key={f.id}>
                  <div
                    className="font-specimen"
                    style={{
                      fontFamily: f.family + ", sans-serif",
                      fontSize:
                        Number(f.size) > 0 && Number(f.size) <= 120
                          ? Number(f.size)
                          : 16,
                      fontWeight: Number(f.weight) || 400,
                    }}
                  >
                    The details make the difference.
                    <span>让表达有轻重，让阅读有节奏。</span>
                  </div>
                  <div className="font-fields">
                    {[
                      ["name", "名称"],
                      ["family", "字体家族"],
                      ["size", "字号"],
                      ["weight", "字重"],
                    ].map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          aria-label={label + " " + f.id}
                          name={key}
                          autoComplete="off"
                          disabled={!mutable}
                          value={f[key as keyof typeof f]}
                          onChange={(e) =>
                            p.setData((d) => ({
                              ...d,
                              fonts: d.fonts.map((x) =>
                                x.id === f.id
                                  ? { ...x, [key]: e.target.value }
                                  : x,
                              ),
                            }))
                          }
                        />
                      </label>
                    ))}
                    <button
                      aria-label={"删除字体 " + f.name}
                      disabled={!mutable}
                      onClick={() => removeFont(f.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {tab === "samples" && (
          <>
            <div className="section-label">
              <h2>组件样本</h2>
              <div>
                <button
                  disabled={!mutable || p.data.samples.length >= 100}
                  onClick={() => addSample("button")}
                >
                  <Plus size={15} />
                  按钮
                </button>
                <button
                  disabled={!mutable || p.data.samples.length >= 100}
                  onClick={() => addSample("card")}
                >
                  <Plus size={15} />
                  卡片
                </button>
              </div>
            </div>
            <div className="sample-grid">
              {p.data.samples.map((s) => {
                const bg = p.data.colors.find((c) => c.id === s.colorId),
                  fg = p.data.colors.find((c) => c.id === s.foregroundId),
                  f = p.data.fonts.find((x) => x.id === s.fontId);
                return (
                  <article className="sample-card" key={s.id}>
                    <div className={"sample-stage " + s.kind}>
                      <div
                        className="sample-object"
                        style={{
                          background: bg ? safeColor(bg.value) : "#eee",
                          color: fg ? safeColor(fg.value) : "#333",
                          borderRadius: Number(s.radius) || 0,
                          width: Math.min(Number(s.width) || 260, 390),
                          minHeight: Math.min(Number(s.height) || 56, 400),
                          fontFamily:
                            (f?.family ?? "sans-serif") + ", sans-serif",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: Math.min(Number(f?.size) || 16, 50),
                            fontWeight: Number(f?.weight) || 400,
                          }}
                        >
                          {s.label}
                        </strong>
                        {s.kind === "card" && <p>{s.body}</p>}
                      </div>
                    </div>
                    <div className="sample-fields">
                      <label>
                        样本名称
                        <input
                          aria-label={"样本名称 " + s.id}
                          value={s.name}
                          disabled={!mutable}
                          onChange={(e) =>
                            patchSample(s.id, "name", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        标题
                        <input
                          aria-label={"样本文案 " + s.id}
                          value={s.label}
                          disabled={!mutable}
                          onChange={(e) =>
                            patchSample(s.id, "label", e.target.value)
                          }
                        />
                      </label>
                      {s.kind === "card" && (
                        <label>
                          说明
                          <textarea
                            aria-label={"样本说明 " + s.id}
                            value={s.body}
                            disabled={!mutable}
                            onChange={(e) =>
                              patchSample(s.id, "body", e.target.value)
                            }
                          />
                        </label>
                      )}
                      <div className="sample-selectors">
                        {[
                          ["colorId", "背景"],
                          ["foregroundId", "文字颜色"],
                        ].map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <select
                              value={s[key as "colorId" | "foregroundId"]}
                              disabled={!mutable}
                              onChange={(e) =>
                                patchSample(
                                  s.id,
                                  key as "colorId",
                                  e.target.value,
                                )
                              }
                            >
                              {p.data.colors.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                        <label>
                          字体
                          <select
                            value={s.fontId}
                            disabled={!mutable}
                            onChange={(e) =>
                              patchSample(s.id, "fontId", e.target.value)
                            }
                          >
                            {p.data.fonts.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="dimensions">
                        {[
                          ["width", "宽"],
                          ["height", "高"],
                          ["radius", "圆角"],
                        ].map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <input
                              aria-label={label + " " + s.id}
                              name={key}
                              inputMode="decimal"
                              disabled={!mutable}
                              value={s[key as "width"]}
                              onChange={(e) =>
                                patchSample(
                                  s.id,
                                  key as "width",
                                  e.target.value,
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        className="delete-sample"
                        disabled={!mutable}
                        onClick={() => {
                          if (confirm("删除这个样本？"))
                            p.setData((d) => ({
                              ...d,
                              samples: d.samples.filter((x) => x.id !== s.id),
                            }));
                        }}
                      >
                        移除样本
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        <section className="delivery-note">
          <h2>交付说明</h2>
          <textarea
            aria-label="交付说明"
            value={p.data.notes}
            disabled={!mutable}
            onChange={(e) =>
              p.setData((d) => ({ ...d, notes: e.target.value }))
            }
          />
        </section>
      </main>
      {jsonOpen && (
        <section className="json-panel">
          <label>
            未应用项目JSON
            <textarea
              aria-label="项目 JSON 草稿"
              disabled={!mutable}
              value={json}
              onChange={(e) =>
                p.setDraft((d) => ({ ...d, json: e.target.value }))
              }
            />
          </label>
          <button disabled={!mutable} onClick={() => void transition(() => applyJson())}>
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
            <button disabled={!mutable} onClick={() => void p.save()}>重试保存</button>
            <button onClick={p.exportDraft}>导出恢复稿</button>
            {p.current && (
              <button disabled={!mutable} onClick={() => void transition(() => p.open(p.current!.id))}>
                打开服务器版本
              </button>
            )}
          </>
        )}
        <span>设计资产与未完成输入自动保存</span>
      </footer>
    </div>
  );
}
