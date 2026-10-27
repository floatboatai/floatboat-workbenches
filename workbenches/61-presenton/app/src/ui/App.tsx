import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Plus,
  Presentation,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  blank,
  example,
  importDeck,
  outline,
  portable,
  restoreDeck,
  validateDeck,
  type Slide,
  type Settings,
} from "../contracts/deck";
import { jobValue, states, type Job } from "../contracts/jobs";
import { isRecord } from "../contracts/project";
import {
  useProjects,
  ProjectPicker,
  Notice,
  download,
  request,
} from "./workspace";

export function App() {
  const p = useProjects(example, validateDeck, "城市绿荫计划 · 示例", {
    storageKey: "presenton-studio-v1",
    restoreDraftData: restoreDeck,
  });
  const [tab, setTab] = useState("outline"),
    [active, setActive] = useState("vision"),
    [jobs, setJobs] = useState<Job[]>([]),
    [configured, setConfigured] = useState(false),
    [connection, setConnection] = useState("正在检查服务…"),
    [working, setWorking] = useState(""),
    [allJobs, setAllJobs] = useState(false);
  const document = useRef(p.documentKey);
  document.current = p.documentKey;
  const currentIndex = Math.max(
      0,
      p.data.slides.findIndex((s) => s.id === active),
    ),
    slide = p.data.slides[currentIndex];
  const raw = typeof p.draft.importText === "string" ? p.draft.importText : "";
  const recovery =
    typeof p.draft.recoveryTask === "string" ? p.draft.recoveryTask : "";
  const presentationId =
    typeof p.draft.presentationId === "string"
      ? p.draft.presentationId
      : p.data.result?.presentationId || "";
  const selectedJobs = jobs.filter(
    (j) => allJobs || j.projectId === p.current?.id,
  );
  async function loadJobs() {
    const v = await request("/api/jobs");
    if (!Array.isArray(v)) throw new Error("制作记录格式无效。");
    setJobs(v.map(jobValue));
  }
  useEffect(() => {
    let alive = true;
    void Promise.allSettled([
      request("/api/presenton").then((v) => {
        if (
          !isRecord(v) ||
          typeof v.configured !== "boolean" ||
          typeof v.message !== "string"
        )
          throw new Error("服务状态无效。");
        if (alive) {
          setConfigured(v.configured);
          setConnection(v.message);
        }
      }),
      loadJobs(),
    ]).then((results) => {
      if (alive)
        for (const r of results)
          if (r.status === "rejected") p.report(r.reason);
    });
    return () => {
      alive = false;
    };
  }, []);
  const pendingKey = jobs
    .filter((j) => j.state === "pending")
    .map((j) => j.id)
    .join(",");
  useEffect(() => {
    if (!pendingKey) return;
    let disposed = false,
      polling = false;
    const timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void Promise.allSettled(
        pendingKey
          .split(",")
          .map((id) => request(`/api/jobs/${id}/refresh`, { method: "POST" })),
      )
        .then((results) => {
          if (disposed) return;
          const updated = results
            .filter(
              (r): r is PromiseFulfilledResult<unknown> =>
                r.status === "fulfilled",
            )
            .map((r) => jobValue(r.value));
          setJobs((old) =>
            old.map((j) => updated.find((n) => n.id === j.id) || j),
          );
          if (results.some((r) => r.status === "rejected"))
            setConnection("任务查询暂不可用。原任务已保留，可稍后重新查询。");
        })
        .finally(() => {
          polling = false;
        });
    }, 8000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [pendingKey]);
  const edit = (patch: Partial<Slide>) =>
    p.setData((d) => ({
      ...d,
      slides: d.slides.map((s) => (s.id === slide.id ? { ...s, ...patch } : s)),
    }));
  const setting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    p.setData((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  function move(offset: number) {
    const to = currentIndex + offset;
    if (to < 0 || to >= p.data.slides.length) return;
    p.setData((d) => {
      const slides = [...d.slides];
      [slides[currentIndex], slides[to]] = [slides[to], slides[currentIndex]];
      return { ...d, slides };
    });
  }
  function add() {
    const id = crypto.randomUUID();
    p.setData((d) => ({
      ...d,
      slides: [
        ...d.slides,
        { id, title: "", markdown: "", notes: "", reviewed: false },
      ],
    }));
    setActive(id);
  }
  async function action(name: string, fn: () => Promise<void>) {
    setWorking(name);
    p.setError("");
    try {
      await fn();
    } catch (e) {
      p.report(e);
    } finally {
      setWorking("");
    }
  }
  async function start(kind: "generate" | "export" = "generate") {
    if (
      kind === "generate" &&
      jobs.some(
        (j) =>
          j.projectId === p.current?.id &&
          ["pending", "submitting", "unknown"].includes(j.state),
      ) &&
      !confirm(
        "这份文稿已有未确认或进行中的任务。再次制作会创建新任务并可能产生额外费用。仍要继续？",
      )
    )
      return;
    const snapshot = structuredClone(p.data),
      title = p.title,
      epoch = p.documentKey;
    if (kind === "generate") validateDeck(snapshot);
    const saved = await p.save();
    if (!saved) throw new Error("请先完成并保存大纲。");
    if (document.current !== epoch)
      throw new Error("文稿已切换，请在当前文稿重新制作。");
    const id = crypto.randomUUID();
    // The operation ID is retained in the working copy before the request. Reload can query it.
    p.setDraft((d) => ({ ...d, lastOperation: id }));
    if (!(await p.save())) throw new Error("操作准备尚未保存，请稍后重试。");
    try {
      const value = await request("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          id,
          projectId: saved.id,
          title,
          kind,
          deck: snapshot,
          presentationId,
          format: snapshot.settings.format,
        }),
      });
      setJobs((old) => [jobValue(value), ...old.filter((j) => j.id !== id)]);
    } catch (e) {
      await loadJobs().catch(() => {});
      throw e;
    }
  }
  async function importText(text: string) {
    const parsed = importDeck(text);
    if (
      await p.replace(parsed.deck, parsed.title, {
        ...parsed.extra,
        importText: "",
      })
    ) {
      setActive(parsed.deck.slides[0].id);
      setTab("outline");
      p.setNotice("已创建独立文稿，可逐页复核。");
    }
  }
  async function getPresentation(path: string) {
    const value = await request(path);
    await importText(JSON.stringify(value));
  }
  async function downloadJob(j: Job) {
    const value = await request(`/api/jobs/${j.id}/artifact`, {
      method: "POST",
    });
    if (
      !isRecord(value) ||
      typeof value.bytes !== "number" ||
      typeof value.format !== "string" ||
      value.bytes > 50 * 1024 * 1024
    )
      throw new Error("文件记录无效。");
    const parts: Uint8Array[] = [];
    for (let i = 0; i < Math.ceil(value.bytes / 262144); i++) {
      const c = await request(`/api/jobs/${j.id}/chunks/${i}`);
      if (!isRecord(c) || typeof c.base64 !== "string")
        throw new Error("下载分块无效。");
      parts.push(Uint8Array.from(atob(c.base64), (ch) => ch.charCodeAt(0)));
    }
    if (parts.reduce((n, c) => n + c.length, 0) !== value.bytes)
      throw new Error("下载未完整，请重试。");
    download(
      new Blob(parts as BlobPart[], {
        type:
          value.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
      `${j.title.replace(/[\\/:*?"<>|]/g, "_")}.${value.format}`,
    );
    await loadJobs();
  }
  const icon = (
    name: string,
    node: React.ReactNode,
    click: () => void,
    disabled = false,
  ) => (
    <button
      type="button"
      className="icon"
      aria-label={name}
      title={name}
      onClick={click}
      disabled={disabled}
    >
      {node}
    </button>
  );
  return (
    <div className="studio">
      <a href="#stage" className="skip">
        跳至编辑区
      </a>
      <header className="document-bar">
        <div className="brand">
          <Presentation size={24} aria-hidden="true" />
          <span>
            Presenton<small>演示制作台</small>
          </span>
        </div>
        <label className="document-title">
          <span className="sr-only">文稿名称</span>
          <input
            aria-label="文稿名称"
            name="document-title"
            autoComplete="off"
            value={p.title}
            maxLength={120}
            onChange={(e) => p.setTitle(e.target.value)}
          />
        </label>
        <div
          className="save-state"
          data-phase={p.autoState.phase}
          role="status"
        >
          <span />
          {p.autoState.message}
        </div>
        <button
          className="quiet"
          onClick={() => void p.save()}
          disabled={p.busy}
        >
          立即保存
        </button>
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={p.busy}
          onOpen={(id) => void p.open(id)}
        />
      </header>
      <nav className="toolbar" aria-label="文稿工作区">
        <div className="tabs">
          {[
            ["outline", "编排"],
            ["production", "制作"],
            ["import", "导入"],
          ].map(([id, title]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "selected" : ""}
              onClick={() => setTab(id)}
            >
              {title}
            </button>
          ))}
        </div>
        <div className="file-actions">
          <button
            onClick={() =>
              void p.replace(structuredClone(blank), "未命名演示文稿")
            }
          >
            新建
          </button>
          <button
            onClick={() =>
              download(
                new Blob([outline(p.data)], {
                  type: "text/markdown;charset=utf-8",
                }),
                "presentation-outline.md",
              )
            }
          >
            导出大纲
          </button>
          <button
            onClick={() =>
              download(
                new Blob([portable(p.title, p.data, p.draft)], {
                  type: "application/json",
                }),
                "presenton-project.json",
              )
            }
          >
            <Download size={15} aria-hidden="true" />
            便携项目
          </button>
          <button
            className="quiet danger"
            onClick={() => void p.remove()}
            disabled={!p.current || p.busy}
            aria-label="删除文稿"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </nav>
      <Notice error={p.error} notice={p.notice} />
      {["conflict", "offline", "draft"].includes(p.autoState.phase) && (
        <div className="recovery">
          <button onClick={p.exportDraft}>导出完整工作副本</button>
          {p.current && p.autoState.phase === "conflict" && (
            <button
              onClick={() => {
                if (confirm("重新打开服务器版本？请先导出当前修改。"))
                  void p.open(p.current!.id);
              }}
            >
              打开服务器版本
            </button>
          )}
        </div>
      )}
      {p.loading ? (
        <p className="loading" role="status">
          正在恢复文稿…
        </p>
      ) : tab === "outline" ? (
        <main className="outline-workspace" id="stage">
          <aside className="sequence" aria-label="幻灯片目录">
            <div className="section-label">
              <span>故事线</span>
              <span>{p.data.slides.length.toString().padStart(2, "0")} 页</span>
            </div>
            <ol>
              {p.data.slides.map((s, i) => (
                <li key={s.id}>
                  <button
                    aria-label={`第 ${i + 1} 页：${s.title || "未命名"}`}
                    aria-current={s.id === slide.id ? "step" : undefined}
                    className={s.id === slide.id ? "thumb active" : "thumb"}
                    onClick={() => setActive(s.id)}
                  >
                    <span className="thumb-top">
                      <b>{String(i + 1).padStart(2, "0")}</b>
                      {s.reviewed ? (
                        <Check size={13} aria-label="已复核" />
                      ) : (
                        <span className="unreviewed" />
                      )}
                    </span>
                    <strong>{s.title || "写下这一页的标题"}</strong>
                    <span className="thumb-lines" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <button
              className="add-slide"
              onClick={add}
              disabled={p.data.slides.length >= 60}
            >
              <Plus size={16} aria-hidden="true" />
              添加一页
            </button>
          </aside>
          <section className="deck-area">
            <div className="stage-heading">
              <span>
                大纲预览{" "}
                <span className="subtle">
                  / {p.data.result ? "导入内容复核" : "演示计划"}
                </span>
              </span>
              <div>
                {icon(
                  "上一页",
                  <ChevronLeft size={16} />,
                  () =>
                    setActive(p.data.slides[Math.max(0, currentIndex - 1)].id),
                  currentIndex === 0,
                )}
                <span>
                  {currentIndex + 1} / {p.data.slides.length}
                </span>
                {icon(
                  "下一页",
                  <ChevronRight size={16} />,
                  () =>
                    setActive(
                      p.data.slides[
                        Math.min(p.data.slides.length - 1, currentIndex + 1)
                      ].id,
                    ),
                  currentIndex === p.data.slides.length - 1,
                )}
              </div>
            </div>
            <article
              className={`slide-stage ${currentIndex === 0 ? "cover" : ""}`}
              aria-label="当前幻灯片大纲预览"
            >
              <div className="slide-kicker">
                {currentIndex === 0
                  ? "PRESENTATION OUTLINE"
                  : `CHAPTER ${String(currentIndex).padStart(2, "0")}`}
                <span>
                  {p.data.result ? "IMPORTED OUTLINE" : "OUTLINE STUDY"}
                </span>
              </div>
              <h1>{slide.title || "这一页，想说什么？"}</h1>
              <div className="stage-copy">
                {slide.markdown ? (
                  slide.markdown
                    .split("\n")
                    .filter(Boolean)
                    .slice(0, 7)
                    .map((line, i) => (
                      <p
                        key={i}
                        className={/^[-*]|^\d\./.test(line) ? "bullet" : ""}
                      >
                        {line.replace(/^[-*]\s?/, "").replace(/^#+\s?/, "")}
                      </p>
                    ))
                ) : (
                  <p className="subtle">写下一个观点，再用清晰的要点支持它。</p>
                )}
              </div>
              <footer>
                <span>{p.data.audience || "YOUR AUDIENCE"}</span>
                <b>{String(currentIndex + 1).padStart(2, "0")}</b>
              </footer>
            </article>
            <div className="edit-heading">
              <h2>第 {currentIndex + 1} 页 · 内容编辑</h2>
              <div>
                {icon(
                  "上移一页",
                  <ArrowUp size={15} />,
                  () => move(-1),
                  currentIndex === 0,
                )}
                {icon(
                  "下移一页",
                  <ArrowDown size={15} />,
                  () => move(1),
                  currentIndex === p.data.slides.length - 1,
                )}
                {icon(
                  "删除当前页",
                  <Trash2 size={15} />,
                  () => {
                    if (confirm("删除这一页及其演讲备注？"))
                      p.setData((d) => ({
                        ...d,
                        slides: d.slides.filter((s) => s.id !== slide.id),
                      }));
                  },
                  p.data.slides.length === 1,
                )}
              </div>
            </div>
            <div className="slide-editors">
              <label>
                页面标题
                <textarea
                  aria-label="页面标题"
                  value={slide.title}
                  rows={2}
                  maxLength={300}
                  onChange={(e) => edit({ title: e.target.value })}
                />
              </label>
              <label>
                页面内容 <span>Markdown</span>
                <textarea
                  aria-label="页面内容"
                  value={slide.markdown}
                  rows={6}
                  maxLength={12000}
                  onChange={(e) => edit({ markdown: e.target.value })}
                />
              </label>
            </div>
            <label className="notes">
              演讲备注
              <textarea
                aria-label="演讲备注"
                rows={2}
                value={slide.notes}
                maxLength={6000}
                onChange={(e) => edit({ notes: e.target.value })}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={slide.reviewed}
                onChange={(e) => edit({ reviewed: e.target.checked })}
              />
              此页内容已复核
            </label>
          </section>
          <aside className="brief">
            <details open>
              <summary>
                演示简报<span>BRIEF</span>
              </summary>
              <label>
                这次讲给谁听？
                <input
                  autoComplete="off"
                  maxLength={1000}
                  value={p.data.audience}
                  onChange={(e) =>
                    p.setData((d) => ({ ...d, audience: e.target.value }))
                  }
                />
              </label>
              <label>
                希望听众带走什么？
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={p.data.objective}
                  onChange={(e) =>
                    p.setData((d) => ({ ...d, objective: e.target.value }))
                  }
                />
              </label>
              <div className="source-heading">
                <h2>参考资料</h2>
                <label className="file-label">
                  载入文本
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        void action("source", async () => {
                          if (f.size > 60000)
                            throw new Error("资料文件不能超过 60 KB。");
                          const source = await f.text();
                          p.setData((d) => ({ ...d, source }));
                        });
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <textarea
                aria-label="参考资料"
                rows={13}
                maxLength={60000}
                value={p.data.source}
                onChange={(e) =>
                  p.setData((d) => ({ ...d, source: e.target.value }))
                }
              />
              <p className="hint">
                资料、页面内容与演讲备注会一起用于制作。请在生成前核对来源与事实。
              </p>
            </details>
            <div className="production-note">
              <span className={configured ? "dot connected" : "dot"} />
              <strong>
                {configured ? "制作服务已配置" : "制作服务未连接"}
              </strong>
              <p>大纲准备就绪后，选择模板和输出格式。</p>
              <button className="primary" onClick={() => setTab("production")}>
                进入制作 <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </aside>
        </main>
      ) : tab === "production" ? (
        <main className="production" id="stage">
          <section className="production-settings">
            <p className="eyebrow">PRODUCTION DESK</p>
            <h1>从故事线，到演示文稿。</h1>
            <p className="intro">
              制作使用当前保存的大纲。生成结果会单独保留，复核时创建新文稿。
            </p>
            <div className="service-state" role="status">
              <span className={configured ? "dot connected" : "dot"} />
              {connection}
              <button
                disabled={!!working}
                onClick={() =>
                  void action("check", async () => {
                    const v = await request("/api/presenton/check", {
                      method: "POST",
                    });
                    if (isRecord(v) && typeof v.message === "string")
                      setConnection(v.message);
                  })
                }
              >
                检查连接
              </button>
            </div>
            <div className="settings-grid">
              <label>
                模板
                <input
                  value={p.data.settings.template}
                  maxLength={120}
                  onChange={(e) => setting("template", e.target.value)}
                />
              </label>
              <label>
                语言
                <select
                  value={p.data.settings.language}
                  onChange={(e) => setting("language", e.target.value)}
                >
                  <option value="Chinese">中文</option>
                  <option value="English">English</option>
                  <option value="Japanese">日本語</option>
                  <option value="Spanish">Español</option>
                </select>
              </label>
              <label>
                表达语气
                <select
                  value={p.data.settings.tone}
                  onChange={(e) => setting("tone", e.target.value)}
                >
                  <option value="professional">专业</option>
                  <option value="educational">教学</option>
                  <option value="casual">轻松</option>
                  <option value="sales_pitch">提案</option>
                  <option value="default">默认</option>
                  <option value="funny">幽默</option>
                </select>
              </label>
              <label>
                内容密度
                <select
                  value={p.data.settings.verbosity}
                  onChange={(e) => setting("verbosity", e.target.value)}
                >
                  <option value="concise">简洁</option>
                  <option value="standard">适中</option>
                  <option value="text-heavy">详尽</option>
                </select>
              </label>
            </div>
            <label>
              制作要求
              <textarea
                rows={4}
                value={p.data.settings.instructions}
                maxLength={6000}
                onChange={(e) => setting("instructions", e.target.value)}
              />
            </label>
            <div className="choices">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={p.data.settings.titleSlide}
                  onChange={(e) => setting("titleSlide", e.target.checked)}
                />
                包含封面
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={p.data.settings.contents}
                  onChange={(e) => setting("contents", e.target.checked)}
                />
                包含目录
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={p.data.settings.webSearch}
                  onChange={(e) => setting("webSearch", e.target.checked)}
                />
                允许联网查找资料
              </label>
            </div>
            <div className="launch">
              <label>
                输出格式
                <select
                  value={p.data.settings.format}
                  onChange={(e) =>
                    setting("format", e.target.value === "pdf" ? "pdf" : "pptx")
                  }
                >
                  <option value="pptx">PowerPoint · PPTX</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
              <button
                className="primary"
                disabled={!!working || !configured}
                onClick={() => void action("generate", () => start())}
              >
                {working === "generate"
                  ? "正在提交…"
                  : `制作 ${p.data.slides.length} 页演示文稿`}
              </button>
            </div>
            <p className="hint">
              {configured
                ? "由已配置的 Presenton 服务生成，可能产生模型费用。"
                : "连接后即可制作。目前可使用编排、导入、复核与项目导出。"}
            </p>
            <details className="existing">
              <summary>读取或导出已有演示文稿</summary>
              <label>
                Presenton 演示文稿 ID
                <input
                  value={presentationId}
                  maxLength={100}
                  autoComplete="off"
                  onChange={(e) =>
                    p.setDraft((d) => ({
                      ...d,
                      presentationId: e.target.value,
                    }))
                  }
                />
              </label>
              <button
                disabled={!configured || !!working || !presentationId}
                onClick={() =>
                  void action("fetch", () =>
                    getPresentation(
                      `/api/presentations/${encodeURIComponent(presentationId)}`,
                    ),
                  )
                }
              >
                读取为新文稿
              </button>
              <button
                disabled={!configured || !!working || !presentationId}
                onClick={() => void action("export", () => start("export"))}
              >
                导出原件
              </button>
            </details>
          </section>
          <section className="job-ledger">
            <div className="ledger-heading">
              <h2>制作记录</h2>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={allJobs}
                  onChange={(e) => setAllJobs(e.target.checked)}
                />
                所有文稿
              </label>
              <button
                disabled={!!working}
                onClick={() => void action("jobs", loadJobs)}
              >
                <RefreshCw size={15} aria-hidden="true" />
                刷新
              </button>
            </div>
            {selectedJobs.length === 0 ? (
              <div className="empty">
                <Presentation size={35} aria-hidden="true" />
                <h3>你的下一份演示，从这里出发。</h3>
                <p>提交后可离开页面。任务 ID 和制作输入会保留在这里。</p>
              </div>
            ) : (
              selectedJobs.map((j) => (
                <article key={j.id} className="job">
                  <div className="job-heading">
                    <strong>{j.title}</strong>
                    <span data-state={j.state}>{states[j.state]}</span>
                  </div>
                  <time dateTime={j.createdAt}>
                    {new Date(j.createdAt).toLocaleString()}
                  </time>
                  <p>{j.message}</p>
                  <dl>
                    <dt>本地操作</dt>
                    <dd>{j.id}</dd>
                    {j.taskId && (
                      <>
                        <dt>Presenton 任务</dt>
                        <dd>{j.taskId}</dd>
                      </>
                    )}
                    {j.presentationId && (
                      <>
                        <dt>演示文稿</dt>
                        <dd>{j.presentationId}</dd>
                      </>
                    )}
                  </dl>
                  <div className="job-actions">
                    <button
                      disabled={!!working}
                      onClick={() =>
                        void action("snapshot", async () => {
                          const value = await request(
                            `/api/jobs/${j.id}/snapshot`,
                          );
                          download(
                            new Blob([JSON.stringify(value, null, 2)], {
                              type: "application/json",
                            }),
                            "presenton-input-snapshot.json",
                          );
                        })
                      }
                    >
                      制作输入
                    </button>
                    {j.taskId && (
                      <button
                        disabled={!!working}
                        onClick={() =>
                          void action("refresh", async () => {
                            await request(`/api/jobs/${j.id}/refresh`, {
                              method: "POST",
                            });
                            await loadJobs();
                          })
                        }
                      >
                        查询原任务
                      </button>
                    )}
                    {["pending", "unknown"].includes(j.state) && (
                      <button
                        disabled={!!working}
                        onClick={() =>
                          void action("stop", async () => {
                            await request(`/api/jobs/${j.id}/stop`, {
                              method: "POST",
                            });
                            await loadJobs();
                          })
                        }
                      >
                        停止跟踪
                      </button>
                    )}
                    {j.state === "completed" && j.path && (
                      <button
                        className="primary"
                        disabled={!!working}
                        onClick={() =>
                          void action("download", () => downloadJob(j))
                        }
                      >
                        {working === "download" ? "正在下载…" : "下载生成原件"}
                      </button>
                    )}
                    {j.presentationId && (
                      <button
                        disabled={!!working || !configured}
                        onClick={() =>
                          void action("review", () =>
                            getPresentation(`/api/jobs/${j.id}/presentation`),
                          )
                        }
                      >
                        读取页面复核
                      </button>
                    )}
                  </div>
                  {["unknown", "stopped"].includes(j.state) && !j.taskId && (
                    <div className="adopt">
                      <label>
                        关联已创建的 Presenton 任务
                        <input
                          value={recovery}
                          maxLength={100}
                          onChange={(e) =>
                            p.setDraft((d) => ({
                              ...d,
                              recoveryTask: e.target.value,
                            }))
                          }
                          placeholder="task-…"
                          autoComplete="off"
                        />
                      </label>
                      <button
                        disabled={!!working || !recovery}
                        onClick={() =>
                          void action("adopt", async () => {
                            await request(`/api/jobs/${j.id}/adopt`, {
                              method: "POST",
                              body: JSON.stringify({ taskId: recovery }),
                            });
                            await loadJobs();
                          })
                        }
                      >
                        关联并查询
                      </button>
                      <p className="hint">
                        请在 Presenton
                        确认任务属于本次输入。关联不会发起新的制作。
                      </p>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        </main>
      ) : (
        <main className="import-workspace" id="stage">
          <section>
            <p className="eyebrow">BRING YOUR WORK</p>
            <h1>已有文稿，继续打磨。</h1>
            <p className="intro">
              载入便携项目，或粘贴 Presenton 返回的任务、生成结果或演示文稿
              JSON。导入会创建独立文稿。
            </p>
            <label className="upload">
              <FileUp size={23} aria-hidden="true" />
              <span>选择 JSON 文件</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void action("file", async () => {
                      if (f.size > 24000000)
                        throw new Error("文件不能超过 24 MB。");
                      const importedText = await f.text();
                      if (f.size > 1800000) {
                        await importText(importedText);
                        return;
                      }
                      p.setDraft((d) => ({ ...d, importText: importedText }));
                    });
                  e.target.value = "";
                }}
              />
            </label>
            <label>
              待导入内容
              <textarea
                className="json-input"
                aria-label="待导入内容"
                spellCheck={false}
                rows={17}
                value={raw}
                maxLength={1800000}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, importText: e.target.value }))
                }
              />
            </label>
            <button
              className="primary"
              disabled={!!working || !raw.trim()}
              onClick={() => void action("import", () => importText(raw))}
            >
              导入为新文稿
            </button>
          </section>
          <aside className="import-guide">
            <h2>从结构，走向表达。</h2>
            <p>
              导入后逐页检查标题、内容和演讲备注，使用「已复核」标记完成的页面。
            </p>
            <p>
              大纲舞台呈现文字结构。版式、图片和动画请在生成的 PPTX 或 PDF
              原件中检查。
            </p>
            {p.data.result && (
              <>
                <h3>当前导入结果</h3>
                <p>
                  {p.data.result.presentationId ||
                    p.data.result.taskId ||
                    "生成响应"}
                </p>
                <button
                  onClick={() =>
                    download(
                      new Blob([p.data.result!.raw], {
                        type: "application/json",
                      }),
                      "presenton-imported-response.json",
                    )
                  }
                >
                  导出原始响应
                </button>
                <button
                  disabled={!configured || !!working}
                  onClick={() =>
                    void action("attach", async () => {
                      const saved = await p.save();
                      if (!saved) throw new Error("请先完成并保存文稿。");
                      await request("/api/jobs/import", {
                        method: "POST",
                        body: JSON.stringify({
                          id: crypto.randomUUID(),
                          projectId: saved.id,
                          title: p.title,
                          result: JSON.parse(p.data.result!.raw),
                        }),
                      });
                      await loadJobs();
                      setTab("production");
                    })
                  }
                >
                  关联到当前制作服务
                </button>
              </>
            )}
            <button
              className="quiet"
              onClick={() =>
                void p.replace(structuredClone(example), "城市绿荫计划 · 示例")
              }
            >
              打开示例计划
            </button>
          </aside>
        </main>
      )}
      <footer className="studio-footer">
        <span>PRESENTON / 从内容开始</span>
        <span>
          {p.data.slides.filter((s) => s.reviewed).length} /{" "}
          {p.data.slides.length} 页已复核
        </span>
      </footer>
    </div>
  );
}
