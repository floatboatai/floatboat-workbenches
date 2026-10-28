import { useEffect, useRef } from "react";
import MindMap, { type NativeNode } from "simple-mind-map";
import { restoreMap, type Branch, type MapProject } from "../contracts/mindmap";
import { isRecord } from "../contracts/project";
const palette = {
  garden: { root: "#315846", second: "#e4eddf", line: "#99ad8b" },
  ink: { root: "#293746", second: "#e1e6ea", line: "#8997a4" },
  plum: { root: "#70475e", second: "#f0e3e9", line: "#ba97aa" },
};
for (const [name, p] of Object.entries(palette))
  MindMap.defineTheme(name, {
    backgroundColor: "#f6f5ee",
    lineColor: p.line,
    lineWidth: 2,
    lineStyle: "curve",
    paddingX: 20,
    paddingY: 10,
    root: {
      fillColor: p.root,
      color: "#ffffff",
      fontSize: 23,
      borderRadius: 12,
      fontWeight: "bold",
    },
    second: {
      fillColor: p.second,
      color: "#29352c",
      fontSize: 17,
      borderWidth: 0,
      borderRadius: 9,
    },
    node: {
      fillColor: "transparent",
      color: "#465044",
      fontSize: 15,
      borderWidth: 0,
    },
  });
export interface MapHandle {
  command: (name: string, uid: string, text?: string) => void;
  focus: (uid: string) => void;
  fit: () => void;
  zoom: (dir: number) => void;
  flush: () => void;
  svg: () => Promise<string>;
  tree: () => Branch;
}
function nativeNode(v: unknown): NativeNode | null {
  return isRecord(v) &&
    typeof v.getData === "function" &&
    typeof v.active === "function"
    ? (v as unknown as NativeNode)
    : null;
}
export function MindCanvas({
  project,
  disabled,
  handle,
  onChange,
  onSelect,
  onDraft,
  onEnd,
  onError,
}: {
  project: MapProject;
  disabled: boolean;
  handle: React.RefObject<MapHandle | null>;
  onChange: (tree: Branch) => void;
  onSelect: (uid: string) => void;
  onDraft: (uid: string, text: string) => void;
  onEnd: () => void;
  onError: (e: unknown) => void;
}) {
  const el = useRef<HTMLDivElement>(null),
    engine = useRef<MindMap | null>(null),
    latest = useRef({
      project,
      disabled,
      onChange,
      onSelect,
      onDraft,
      onEnd,
      onError,
    }),
    lastTree = useRef(""),
    ready = useRef(false);
  latest.current = {
    project,
    disabled,
    onChange,
    onSelect,
    onDraft,
    onEnd,
    onError,
  };
  useEffect(() => {
    if (!el.current) return;
    const m = new MindMap({
      el: el.current,
      data: structuredClone(project.tree),
      layout: project.layout,
      theme: project.theme,
      readonly: disabled,
      fit: true,
      fitPadding: el.current.clientWidth < 700 ? 24 : 80,
      initRootNodePosition: ["center", "center"],
      textAutoWrapWidth: 240,
      addHistoryTime: 0,
      defaultInsertSecondLevelNodeText: "新的分支",
      defaultInsertBelowSecondLevelNodeText: "新的想法",
      enableAutoEnterTextEditWhenKeydown: false,
      isEndNodeTextEditOnClickOuter: true,
      customCheckEnableShortcut: (event: KeyboardEvent) =>
        !latest.current.disabled &&
        (event.target === document.body ||
          (event.target instanceof HTMLElement &&
            event.target.classList.contains("smm-node-edit-wrap"))),
      errorHandler: (_type: unknown, error: unknown) =>
        latest.current.onError(error),
    });
    engine.current = m;
    lastTree.current = JSON.stringify(project.tree);
    let disposed = false;
    const capture = () => {
      const tree = restoreMap({
        ...latest.current.project,
        tree: m.getData(),
      }).tree;
      lastTree.current = JSON.stringify(tree);
      latest.current.onChange(tree);
      return tree;
    };
    m.on("data_change", () => {
      if (!disposed && !latest.current.disabled)
        try {
          capture();
        } catch (e) {
          latest.current.onError(e);
        }
    });
    m.on("node_active", (_node, list) => {
      const node = Array.isArray(list)
        ? nativeNode(list[0])
        : nativeNode(_node);
      const id = node?.getData("uid");
      if (typeof id === "string") latest.current.onSelect(id);
    });
    m.on("node_text_edit_change", (value) => {
      if (
        !disposed &&
        !latest.current.disabled &&
        isRecord(value) &&
        typeof value.text === "string"
      ) {
        const node = nativeNode(value.node),
          id = node?.getData("uid");
        if (typeof id === "string") latest.current.onDraft(id, value.text);
      }
    });
    m.on("hide_text_edit", () => {
      if (!disposed && !latest.current.disabled) {
        try {
          capture();
          latest.current.onEnd();
        } catch (e) {
          latest.current.onError(e);
        }
      }
    });
    m.on("node_tree_render_end", () => {
      if (disposed) return;
      if (!ready.current) {
        ready.current = true;
        m.view.fit();
        if (!latest.current.disabled) capture();
      }
      const editor = m.renderer.textEdit.textEditNode;
      if (editor) {
        editor.setAttribute("role", "textbox");
        editor.setAttribute("aria-label", "原位节点文字");
        editor.setAttribute("aria-multiline", "true");
      }
    });
    m.on("before_show_text_edit", () => {
      requestAnimationFrame(() => {
        if (disposed) return;
        const editor = m.renderer.textEdit.textEditNode;
        editor?.setAttribute("role", "textbox");
        editor?.setAttribute("aria-label", "原位节点文字");
      });
    });
    m.keyCommand.removeShortcut("Del|Backspace");
    m.keyCommand.removeShortcut("Shift+Backspace");
    m.keyCommand.addShortcut("Del|Backspace", () => {
      if (!latest.current.disabled && confirm("删除选中分支及其子节点？"))
        m.execCommand("REMOVE_NODE");
    });
    const refreshGeometry = () => {
      const host = el.current;
      const rect = host?.isConnected ? host.getBoundingClientRect() : null;
      if (
        !disposed &&
        ready.current &&
        rect &&
        rect.width > 0 &&
        rect.height > 0
      )
        m.resize();
    };
    const observer = new ResizeObserver(refreshGeometry);
    observer.observe(el.current);
    observer.observe(document.body);
    window.addEventListener("scroll", refreshGeometry, {
      capture: true,
      passive: true,
    });
    handle.current = {
      command: (name, uid, text) => {
        if (latest.current.disabled || !ready.current) return;
        const node = m.renderer.findNodeByUid(uid) || m.renderer.root;
        if (name === "SET_NODE_TEXT")
          m.execCommand(name, node, text, false, false);
        else if (name === "SET_NODE_EXPAND")
          m.execCommand(name, node, !node.getData("expand"));
        else if (name === "INSERT_CHILD_NODE" || name === "INSERT_NODE")
          m.execCommand(name, false, [node]);
        else if (name === "BACK" || name === "FORWARD") m.execCommand(name);
        else m.execCommand(name, [node]);
        m.command.originAddHistory();
      },
      focus: (uid) => {
        if (ready.current) {
          refreshGeometry();
          m.renderer.goTargetNode(uid);
        }
      },
      fit: () => {
        refreshGeometry();
        m.view.fit();
      },
      zoom: (dir) => (dir > 0 ? m.view.enlarge() : m.view.narrow()),
      flush: () => {
        if (m.renderer.textEdit.isShowTextEdit()) {
          m.renderer.textEdit.hideEditTextBox();
          m.command.originAddHistory();
          capture();
        }
      },
      svg: () =>
        new Promise<string>((resolve, reject) => {
          if (!ready.current) {
            reject(new Error("导图仍在排版，请稍后导出。"));
            return;
          }
          m.render(() => {
            if (disposed) {
              reject(new Error("文档已切换"));
              return;
            }
            try {
              refreshGeometry();
              const result = m.getSvgData({ paddingX: 40, paddingY: 40 });
              try {
                resolve(result.svgHTML);
              } finally {
                result.svg.remove();
              }
            } catch (error) {
              reject(error);
            }
          });
        }),
      tree: () =>
        restoreMap({ ...latest.current.project, tree: m.getData() }).tree,
    };
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("scroll", refreshGeometry, true);
      handle.current = null;
      engine.current = null;
      m.destroy();
    };
  }, []);
  useEffect(() => {
    const m = engine.current;
    if (!m) return;
    m.setMode(disabled ? "readonly" : "edit");
  }, [disabled]);
  useEffect(() => {
    const m = engine.current;
    if (!m) return;
    const wire = JSON.stringify(project.tree);
    if (wire !== lastTree.current) {
      lastTree.current = wire;
      m.setData(structuredClone(project.tree));
    }
  }, [project.tree]);
  useEffect(() => {
    if (ready.current) engine.current?.setLayout(project.layout);
  }, [project.layout]);
  useEffect(() => {
    if (ready.current) engine.current?.setTheme(project.theme);
  }, [project.theme]);
  return (
    <div
      className="mindmap"
      ref={el}
      aria-label="导图画布；可通过分支导航与节点工具编辑"
    />
  );
}
