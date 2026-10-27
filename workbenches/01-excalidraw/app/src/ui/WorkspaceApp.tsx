import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
} from "lucide-react";
import { record, sceneValue } from "../contracts/boards";
import {
  seedScene,
  validateSceneDocument,
  restoreSceneDraft,
} from "../contracts/scene-document";
import { useProjects, request } from "./workspace";
import { AutoFeedback } from "./AutosaveStatus";
import { CanvasBoundary } from "./CanvasBoundary";
const Whiteboard = lazy(() =>
  import("./Whiteboard").then((module) => ({ default: module.Whiteboard })),
);
export function WorkspaceApp() {
  const p = useProjects(seedScene, validateSceneDocument, "未命名画布", {
    storageKey: "excalidraw",
    restoreDraftData: restoreSceneDraft,
  });
  const [search, setSearch] = useState(""),
    [sidebar, setSidebar] = useState(false),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [platform, setPlatform] = useState("正在连接"),
    [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    listPanel = useRef<HTMLElement | null>(null),
    busy = p.busy || importing;
  useEffect(() => {
    if (sidebar) listPanel.current?.focus();
  }, [sidebar]);
  useEffect(() => {
    document.title = "白板工作台";
    let active = true;
    void request("/api/app")
      .then((value) => {
        if (active && record(value))
          setPlatform(
            value.llmAvailable === true
              ? "AI 已连接"
              : value.platform === "connected"
                ? "AI 需要授权"
                : "AI 尚未连接",
          );
      })
      .catch(() => {
        if (active) setPlatform("AI 暂不可用");
      });
    return () => {
      active = false;
    };
  }, []);
  async function open(id: string) {
    if (await p.open(id)) setSidebar(false);
  }
  async function create() {
    if (await p.replace(seedScene, name.trim() || "未命名画布")) {
      setCreating(false);
      setName("");
      setSidebar(false);
    }
  }
  async function importFile(file: File) {
    setImporting(true);
    try {
      if (file.size > 1500000)
        throw new Error("文件超过 1.5 MB，请减少图片后再导入。");
      const text = await file.text(),
        { loadFromBlob } = await import("@excalidraw/excalidraw");
      await loadFromBlob(file, null, null);
      if (
        await p.replace(
          { scene: sceneValue(text) },
          file.name.replace(/\.(excalidraw|json)$/i, "").slice(0, 120) ||
            "导入画布",
        )
      )
        setSidebar(false);
    } catch (error) {
      p.report(error);
    } finally {
      setImporting(false);
    }
  }
  const visible = p.items.filter((board) =>
    board.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const prompt =
    typeof p.draft.prompt === "string" && p.draft.prompt.length <= 4000
      ? p.draft.prompt
      : "";
  return (
    <main className={`studio ${sidebar ? "with-sidebar" : ""}`}>
      <a className="skip-link" href="#main-content">
        跳到画布
      </a>
      {sidebar ? (
        <button
          className="project-scrim"
          aria-label="关闭画布列表"
          onClick={() => setSidebar(false)}
        />
      ) : null}
      <aside
        ref={listPanel}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") setSidebar(false);
        }}
        className="sidebar"
        aria-label="画布列表"
        hidden={!sidebar}
      >
        <div className="brand">
          <span className="brand-mark">
            <PenTool aria-hidden="true" size={19} />
          </span>
          <div>
            <strong>白板工作台</strong>
            <span>画布文件</span>
          </div>
          <button
            className="icon-button"
            aria-label="收起画布列表"
            onClick={() => setSidebar(false)}
          >
            <PanelLeftClose aria-hidden="true" size={18} />
          </button>
        </div>
        <button
          className="new-board primary"
          onClick={() => setCreating(true)}
          disabled={busy}
        >
          <Plus aria-hidden="true" size={18} />
          新建画布
        </button>
        {creating ? (
          <form
            className="create-form"
            onKeyDown={(event) => {
              if (event.key === "Escape") setCreating(false);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <label htmlFor="new-board-name">画布名称</label>
            <input
              id="new-board-name"
              name="newBoardTitle"
              autoComplete="off"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：产品发布流程…"
            />
            <div>
              <button className="primary" disabled={busy}>
                创建
              </button>
              <button type="button" onClick={() => setCreating(false)}>
                取消
              </button>
            </div>
          </form>
        ) : null}
        <div className="search">
          <Search aria-hidden="true" size={15} />
          <label className="sr-only" htmlFor="board-search">
            搜索画布
          </label>
          <input
            id="board-search"
            type="search"
            name="boardSearch"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索画布…"
          />
        </div>
        <div className="list-heading">
          <span>我的画布与草稿</span>
          <span>{p.items.length}</span>
        </div>
        <nav className="board-list">
          {p.loading ? (
            <p className="muted">正在加载…</p>
          ) : visible.length ? (
            visible.map((board) => (
              <button
                className={`board-item ${p.current?.id === board.id ? "selected" : ""}`}
                key={board.id}
                onClick={() => void open(board.id)}
                disabled={busy}
                aria-current={p.current?.id === board.id ? "page" : undefined}
              >
                <span className="board-glyph">
                  <PenTool aria-hidden="true" size={16} />
                </span>
                <span>
                  <strong>{board.title}</strong>
                  <small>
                    {new Date(board.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </span>
                {p.current?.id === board.id ? (
                  <span className="active-dot" />
                ) : null}
              </button>
            ))
          ) : (
            <p className="muted">
              {search
                ? "没有找到匹配画布"
                : "直接在画布上绘图，修改会自动保存。"}
            </p>
          )}
        </nav>
        <div className="sidebar-footer">
          <button
            className="import-button"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            <Upload aria-hidden="true" size={16} />
            导入 .excalidraw
          </button>
          <p>
            <span className="status-dot" />
            {platform}
          </p>
          <small>画布与恢复草稿保存在当前工作空间</small>
        </div>
      </aside>
      <div className="main-area" id="main-content" tabIndex={-1}>
        {!sidebar ? (
          <button
            className="open-sidebar icon-button"
            aria-label="展开画布列表"
            onClick={() => setSidebar(true)}
          >
            <PanelLeftOpen aria-hidden="true" size={20} />
          </button>
        ) : null}
        {p.loading ? (
          <div className="editor-loading" role="status">
            正在恢复画布…
          </div>
        ) : (
          <CanvasBoundary key={p.documentKey}>
            <Suspense
              fallback={
                <div className="editor-loading" role="status">
                  正在准备画布…
                </div>
              }
            >
              <h1 className="sr-only">{p.title}</h1>
              <Whiteboard
                key={p.documentKey}
                scene={p.data.scene}
                title={p.title}
                onTitleChange={p.setTitle}
                onSceneChange={(scene) => p.setData({ scene })}
                onSave={() => p.save()}
                onDelete={() => void p.remove()}
                canDelete={!!p.current}
                busy={busy}
                autoState={p.autoState}
                prompt={prompt}
                onPromptChange={(prompt) =>
                  p.setDraft((previous) => ({ ...previous, prompt }))
                }
                feedback={
                  <>
                    {p.error ? (
                      <div className="error-banner" role="alert">
                        {p.error}
                        <button
                          aria-label="关闭错误提示"
                          onClick={() => p.setError("")}
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                    <AutoFeedback
                      state={p.autoState}
                      onRetry={() => void p.save()}
                      onExport={p.exportDraft}
                      onReload={
                        p.current ? () => void open(p.current!.id) : undefined
                      }
                    />
                  </>
                }
              />
            </Suspense>
          </CanvasBoundary>
        )}
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        aria-label="导入画布文件"
        accept=".excalidraw,.json,application/json"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
    </main>
  );
}
