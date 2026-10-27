import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Plus,
  Search,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import {
  isBoard,
  isBoardSummary,
  record,
  sceneValue,
  type Board,
  type BoardSummary,
} from "../contracts/boards";
import { request } from "./api";
import { CanvasBoundary } from "./CanvasBoundary";
const Whiteboard = lazy(() =>
  import("./Whiteboard").then((module) => ({ default: module.Whiteboard })),
);
export function WorkspaceApp() {
  const [boards, setBoards] = useState<BoardSummary[]>([]),
    [active, setActive] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [sidebar, setSidebar] = useState(true);
  const [creating, setCreating] = useState(false),
    [name, setName] = useState("");
  const [platform, setPlatform] = useState("正在连接");
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    const result = await request("/api/boards");
    if (!Array.isArray(result) || !result.every(isBoardSummary))
      throw new Error("画布列表格式无效。");
    setBoards(result);
  }, []);
  const fail = (value: unknown) =>
    setError(value instanceof Error ? value.message : "操作失败，请重试。");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await refresh();
    } catch (value) {
      fail(value);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    void load();
    document.title = "白板工作台";
  }, [load]);
  useEffect(() => {
    let disposed = false;
    void request("/api/app")
      .then((value) => {
        if (disposed) return;
        if (record(value))
          setPlatform(
            value.llmAvailable === true
              ? "AI 已连接"
              : value.platform === "connected"
                ? "AI 需要授权"
                : "AI 尚未连接",
          );
      })
      .catch(() => {
        if (!disposed) setPlatform("AI 暂不可用");
      });
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function canLeave() {
    return (
      !dirty || window.confirm("当前画布有未保存的修改。确定放弃这些修改吗？")
    );
  }
  function acceptBoard(value: unknown) {
    if (!isBoard(value)) throw new Error("画布响应无效。");
    setActive(value);
    setDirty(false);
    if (matchMedia("(max-width: 760px)").matches) setSidebar(false);
  }
  async function open(board: BoardSummary) {
    if (board.id === active?.id || !canLeave()) return;
    setBusy(true);
    setError("");
    try {
      acceptBoard(await request(`/api/boards/${board.id}`));
    } catch (value) {
      fail(value);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!canLeave()) return;
    setBusy(true);
    setError("");
    try {
      acceptBoard(
        await request("/api/boards", {
          method: "POST",
          body: JSON.stringify({ title: name.trim() || "未命名画布" }),
        }),
      );
      setCreating(false);
      setName("");
      await refresh();
    } catch (value) {
      fail(value);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File) {
    if (!canLeave()) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 1_500_000)
        throw new Error("文件超过 1.5 MB，请减少图片后再导入。");
      const { loadFromBlob } = await import("@excalidraw/excalidraw");
      await loadFromBlob(file, null, null);
      const scene = sceneValue(await file.text());
      acceptBoard(
        await request("/api/boards", {
          method: "POST",
          body: JSON.stringify({
            title:
              file.name.replace(/\.(excalidraw|json)$/i, "").slice(0, 120) ||
              "导入画布",
            scene,
          }),
        }),
      );
      await refresh();
    } catch (value) {
      fail(value);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !active ||
      !window.confirm(
        `删除「${active.title}」？${dirty ? "未保存的修改也会丢失。" : ""}此操作不能撤销。`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/boards/${active.id}`, {
        method: "DELETE",
        body: JSON.stringify({ revision: active.revision }),
      });
      setActive(null);
      setDirty(false);
      await refresh();
    } catch (value) {
      fail(value);
    } finally {
      setBusy(false);
    }
  }
  const saved = useCallback(
    (board: Board) => {
      setActive(board);
      void refresh().catch(fail);
    },
    [refresh],
  );
  const visible = boards.filter((board) =>
    board.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <main className={`studio ${sidebar ? "with-sidebar" : ""}`}>
      <a className="skip-link" href="#main-content">
        跳到画布
      </a>
      <aside className="sidebar" aria-label="画布列表" hidden={!sidebar}>
        <div className="brand">
          <span className="brand-mark">
            <PenTool aria-hidden="true" size={19} />
          </span>
          <div>
            <strong>白板工作台</strong>
            <span>把想法展开</span>
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
        {creating && (
          <form
            className="create-form"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setCreating(false);
                document
                  .querySelector<HTMLButtonElement>(".new-board")
                  ?.focus();
              }
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
              autoFocus={matchMedia("(min-width: 761px)").matches}
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
        )}
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
          <span>我的画布</span>
          <span>{boards.length}</span>
        </div>
        <nav className="board-list">
          {loading ? (
            <p className="muted">正在加载…</p>
          ) : visible.length ? (
            visible.map((board) => (
              <button
                className={`board-item ${active?.id === board.id ? "selected" : ""}`}
                key={board.id}
                onClick={() => void open(board)}
                disabled={busy}
                aria-current={active?.id === board.id ? "page" : undefined}
              >
                <span className="board-glyph">
                  <PenTool aria-hidden="true" size={16} />
                </span>
                <span>
                  <strong>{board.title}</strong>
                  <small>
                    {new Date(board.updatedAt).toLocaleDateString("zh-CN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </span>
                {active?.id === board.id && <span className="active-dot" />}
              </button>
            ))
          ) : (
            <p className="muted">
              {search ? "没有找到匹配画布" : "还没有画布，从新建开始。"}
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
          <small>画布保存在当前工作空间</small>
        </div>
      </aside>
      <div className="main-area" id="main-content" tabIndex={-1}>
        {!sidebar && (
          <button
            className="open-sidebar icon-button"
            aria-label="展开画布列表"
            onClick={() => setSidebar(true)}
          >
            <PanelLeftOpen aria-hidden="true" size={20} />
          </button>
        )}
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => void load()}>
              <RefreshCw aria-hidden="true" size={14} />
              重试
            </button>
            <button aria-label="关闭错误提示" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {active ? (
          <CanvasBoundary key={active.id}>
            <Suspense
              fallback={
                <div className="editor-loading" role="status">
                  正在准备画布…
                </div>
              }
            >
              <h1 className="sr-only">{active.title}</h1>
              <Whiteboard
                key={active.id}
                board={active}
                onSaved={saved}
                onDirty={setDirty}
                onDelete={() => void remove()}
                busy={busy}
              />
            </Suspense>
          </CanvasBoundary>
        ) : (
          <section className="welcome">
            <div className="welcome-kicker">留出空间，让想法生长</div>
            <h1>
              下一张好图，
              <br />
              从这里开始。
            </h1>
            <p>
              画出一个流程，整理一段思路，
              <br />
              或让 AI 帮你搭起第一个框架。
            </p>
            <button
              className="primary"
              onClick={() => {
                setSidebar(true);
                setCreating(true);
              }}
            >
              <Plus aria-hidden="true" size={18} />
              创建第一张画布
              <ArrowUpRight aria-hidden="true" size={16} />
            </button>
            <div className="welcome-notes">
              <span>自由编辑</span>
              <span>本地保存</span>
              <span>PNG / SVG 导出</span>
            </div>
            <div className="sketch" aria-hidden="true">
              <div>想法</div>
              <span>→</span>
              <div>方案</div>
              <span>→</span>
              <div>行动</div>
            </div>
          </section>
        )}
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
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
