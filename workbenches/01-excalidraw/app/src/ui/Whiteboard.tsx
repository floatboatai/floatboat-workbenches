import { AutoStatus } from "./AutosaveStatus";
import type { SavePhase } from "../contracts/autosave";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  getSceneVersion,
  exportToBlob,
  exportToSvg,
  loadFromBlob,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import { Save, Download, Sparkles, Trash2 } from "lucide-react";
import { diagramValue, sceneValue, type Diagram } from "../contracts/boards";
import { request, download } from "./api";
import "@excalidraw/excalidraw/index.css";

type EditorAPI = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];
type OnChange = NonNullable<ComponentProps<typeof Excalidraw>["onChange"]>;
type Props = {
  scene: string;
  title: string;
  onTitleChange: (title: string) => void;
  onSceneChange: (scene: string) => void;
  onSave: () => Promise<unknown>;
  onDelete: () => void;
  canDelete: boolean;
  busy: boolean;
  autoState: { phase: SavePhase; message: string; savedAt: string };
  prompt: string;
  onPromptChange: (prompt: string) => void;
  feedback: ReactNode;
};
const editorOptions = {
  canvasActions: { loadScene: false, saveToActiveFile: false },
};
const editorMenu = (
  <MainMenu>
    <MainMenu.DefaultItems.ClearCanvas />
    <MainMenu.DefaultItems.ChangeCanvasBackground />
    <MainMenu.DefaultItems.Help />
  </MainMenu>
);
const fingerprint = (
  elements: Parameters<OnChange>[0],
  state: Parameters<OnChange>[1],
) => `${getSceneVersion(elements)}:${state.viewBackgroundColor}`;

function elementsFromDiagram(diagram: Diagram) {
  const elements: Parameters<typeof convertToExcalidrawElements>[0] = [];
  const positions = new Map(
    diagram.nodes.map((node, index) => [
      node.id,
      { x: (index % 3) * 320 + 80, y: Math.floor(index / 3) * 240 + 80 },
    ]),
  );
  for (const node of diagram.nodes) {
    const p = positions.get(node.id)!;
    elements.push({
      type: "rectangle",
      id: node.id,
      x: p.x,
      y: p.y,
      width: 220,
      height: 110,
      backgroundColor: "#e7edf7",
      strokeColor: "#375789",
      roundness: { type: 3 },
      label: { text: node.label, fontSize: 20 },
    });
  }
  for (const edge of diagram.edges) {
    const a = positions.get(edge.from)!,
      b = positions.get(edge.to)!;
    elements.push({
      type: "arrow",
      x: a.x + 220,
      y: a.y + 55,
      points: [
        [0, 0],
        [b.x - a.x - 220, b.y - a.y],
      ],
      start: { id: edge.from },
      end: { id: edge.to },
      endArrowhead: "arrow",
      strokeColor: "#587599",
      label: edge.label ? { text: edge.label, fontSize: 16 } : undefined,
    });
  }
  return convertToExcalidrawElements(elements, { regenerateIds: true });
}

export function Whiteboard({
  scene,
  title,
  onTitleChange,
  onSceneChange,
  onSave,
  onDelete,
  canDelete,
  busy,
  autoState,
  prompt,
  onPromptChange,
  feedback,
}: Props) {
  const [api, setApi] = useState<EditorAPI | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [generating, setGenerating] = useState(false),
    [assistant, setAssistant] = useState(false);
  const [dark, setDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const previousVersion = useRef("");
  const canvasElement = useRef<HTMLDivElement>(null);
  const initialized = useRef(false),
    ready = useRef(false),
    initialNonEmpty = useRef(false);
  const updateScene = useRef(onSceneChange);
  updateScene.current = onSceneChange;
  const alive = useRef(true);
  const [initialData] = useState(() =>
    loadFromBlob(
      new Blob([scene], { type: "application/json" }),
      null,
      null,
    ).then((data) => {
      ready.current = true;
      initialNonEmpty.current = !!data.elements?.some(
        (element) => !element.isDeleted,
      );
      return { ...data, scrollToContent: true };
    }),
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const change = () => setDark(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const element = canvasElement.current;
    if (!api || !element) return;
    let frame = 0,
      narrow: boolean | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width < 700;
      const crossed = narrow !== undefined && narrow !== next;
      narrow = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        api.refresh();
        if (crossed)
          api.scrollToContent(undefined, {
            fitToContent: true,
            animate: false,
          });
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [api]);
  const change = useCallback<OnChange>((elements, state, files) => {
    if (!ready.current || state.isLoading) return;
    if (
      !initialized.current &&
      initialNonEmpty.current &&
      !elements.some((element) => !element.isDeleted)
    )
      return;
    initialized.current = true;
    const version =
      fingerprint(elements, state) +
      ":" +
      Object.values(files)
        .map((file) => file.id + ":" + file.dataURL.length + ":" + file.created)
        .join("|");
    if (version === previousVersion.current) return;
    previousVersion.current = version;
    updateScene.current(serializeAsJSON(elements, state, files, "local"));
  }, []);
  const snapshot = () => {
    if (!api) throw new Error("画布仍在加载，请稍后重试。");
    return serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      "local",
    );
  };
  const showError = (value: unknown) => {
    if (alive.current)
      setError(value instanceof Error ? value.message : "操作失败，请重试。");
  };
  async function save() {
    setError("");
    try {
      updateScene.current(snapshot());
      await onSave();
    } catch (error) {
      showError(error);
    }
  }
  async function exportFile(format: "json" | "png" | "svg") {
    setError("");
    try {
      if (!api) throw new Error("画布仍在加载。");
      const name = title.replace(/[\\/:*?"<>|]/g, "_") || "画布";
      if (format === "json") {
        download(
          new Blob([snapshot()], { type: "application/json" }),
          `${name}.excalidraw`,
        );
        return;
      }
      const options = {
        elements: api.getSceneElements(),
        appState: {
          ...api.getAppState(),
          exportWithDarkMode: false,
          exportBackground: true,
        },
        files: api.getFiles(),
      };
      if (!options.elements.length) throw new Error("请先在画布中添加内容。");
      const blob =
        format === "png"
          ? await exportToBlob({
              ...options,
              mimeType: "image/png",
              maxWidthOrHeight: 4096,
            })
          : new Blob([(await exportToSvg(options)).outerHTML], {
              type: "image/svg+xml",
            });
      download(blob, `${name}.${format}`);
    } catch (value) {
      showError(value);
    }
  }
  async function generate() {
    if (!api || !prompt.trim()) return;
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const diagram = diagramValue(
        await request("/api/generate", {
          method: "POST",
          body: JSON.stringify({ prompt }),
        }),
      );
      if (!alive.current) return;
      const fresh = elementsFromDiagram(diagram);
      const old = api.getSceneElements();
      const bottom = old.reduce(
        (max, item) => Math.max(max, item.y + item.height),
        0,
      );
      const moved = fresh.map((item) => ({
        ...item,
        y: item.y + (old.length ? bottom + 100 : 0),
      }));
      api.updateScene({ elements: [...old, ...moved] });
      api.scrollToContent(moved, { fitToContent: true });
      setMessage("已添加到画布，正在自动保存。");
      setAssistant(false);
    } catch (value) {
      showError(value);
    } finally {
      if (alive.current) setGenerating(false);
    }
  }
  return (
    <section className="workspace" aria-label="画布编辑器">
      <header className="canvas-header">
        <div className="document-title">
          <label className="sr-only" htmlFor="board-title">
            画布名称
          </label>
          <input
            id="board-title"
            name="boardTitle"
            autoComplete="off"
            value={title}
            maxLength={120}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <AutoStatus state={autoState} />
        </div>
        <div className="toolbar">
          <details
            className="canvas-file-menu"
            onClick={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest("button")
              )
                event.currentTarget.open = false;
            }}
          >
            <summary>文件与操作</summary>
            <div className="canvas-file-actions">
              <button
                className="primary"
                onClick={() => void save()}
                disabled={!api || busy}
              >
                <Save aria-hidden="true" size={16} />
                立即保存
              </button>
              <button
                aria-expanded={assistant}
                onClick={() => setAssistant((value) => !value)}
              >
                <Sparkles aria-hidden="true" size={16} />
                生成图形
              </button>
              <button onClick={() => void exportFile("json")} disabled={!api}>
                <Download aria-hidden="true" size={16} />
                源文件
              </button>
              <button onClick={() => void exportFile("png")} disabled={!api}>
                PNG
              </button>
              <button onClick={() => void exportFile("svg")} disabled={!api}>
                SVG
              </button>
              <button
                onClick={() =>
                  api?.scrollToContent(undefined, { fitToContent: true })
                }
                disabled={!api}
              >
                适应画布
              </button>
              <button
                className="icon-button danger"
                aria-label="删除当前画布"
                disabled={busy || generating || !canDelete}
                onClick={onDelete}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          </details>
        </div>
      </header>
      {feedback}
      {message ? (
        <p className="canvas-message" role="status">
          {message}
        </p>
      ) : null}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="关闭错误提示" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {assistant && (
        <form
          className="assistant-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void generate();
          }}
        >
          <label htmlFor="diagram-prompt">描述你想画的流程</label>
          <textarea
            id="diagram-prompt"
            name="diagramPrompt"
            autoComplete="off"
            required
            value={prompt}
            maxLength={4000}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="例如：客户提交需求，评估后安排设计，再进入开发和验收。"
            disabled={generating}
          />
          <div>
            <button type="button" onClick={() => setAssistant(false)}>
              关闭
            </button>
            <p>生成内容会添加到现有画布。</p>
            <button
              className="primary"
              type="submit"
              disabled={generating || !api}
            >
              {generating ? "正在生成…" : "生成并添加"}
            </button>
          </div>
        </form>
      )}
      <div className="canvas" ref={canvasElement}>
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          onChange={change}
          langCode="zh-CN"
          theme={dark ? "dark" : "light"}
          name={title}
          UIOptions={editorOptions}
        >
          {editorMenu}
        </Excalidraw>
      </div>
    </section>
  );
}
