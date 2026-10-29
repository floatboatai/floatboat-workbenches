// ABOUTME: 节点画布组件：创建 GraphEditor，承载就地搜索/文本/下拉层、缩放控件与小地图，处理拖放。

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { IWidget, LGraphNode } from "@comfyorg/litegraph";
import type { NodeDef, NodeDefs } from "../contracts/comfy";
import type { UiWorkflow } from "../contracts/workflow";
import { GraphEditor, type ComboRequest, type SearchRequest, type TextEditRequest } from "./graph/editor";
import { ComboPicker, Minimap, NodeSearch, TextEditor } from "./overlays";
import type { LibraryEntry } from "./search";

export interface CanvasApi {
  editor: GraphEditor;
  openSearch(): void;
}
export interface CanvasProps {
  entries: LibraryEntry[];
  onReady(api: CanvasApi): void;
  onChange(workflow: UiWorkflow): void;
  onSelection(ids: string[]): void;
  onUpload(node: LGraphNode, widget: IWidget): void;
  inputImage(file: string): HTMLImageElement | null;
  onDropFile(file: File): void;
  empty: boolean;
}

export const NODE_DRAG_TYPE = "application/x-comfy-node";

export function CanvasView(props: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<GraphEditor | null>(null);
  const [searchReq, setSearchReq] = useState<SearchRequest | null>(null);
  const [textReq, setTextReq] = useState<TextEditRequest | null>(null);
  const [comboReq, setComboReq] = useState<ComboRequest | null>(null);
  const [view, setView] = useState(0);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const instance = new GraphEditor(el, {
      change: (wf) => latest.current.onChange(wf),
      selection: (ids) => latest.current.onSelection(ids),
      search: (req) => setSearchReq(req),
      view: () => setView((v) => v + 1),
      editText: (req) => setTextReq(req),
      pickCombo: (req) => setComboReq(req),
      upload: (node, widget) => latest.current.onUpload(node, widget),
      inputImage: (file) => latest.current.inputImage(file),
    });
    setEditor(instance);
    latest.current.onReady({
      editor: instance,
      openSearch: () => {
        const rect = hostRef.current?.getBoundingClientRect();
        setSearchReq({
          graphPos: instance.centerPos(),
          screenPos: [(rect?.left ?? 0) + (rect?.width ?? 600) / 2 - 190, (rect?.top ?? 0) + 80],
        });
      },
    });
    return () => instance.dispose();
  }, []);

  const closeSearch = () => {
    setSearchReq(null);
    editor?.focus();
  };

  return (
    <div
      ref={hostRef}
      className="canvas-host"
      onKeyDown={(e) => {
        if (!editor) return;
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        const mod = e.metaKey || e.ctrlKey;
        const key = e.key.toLowerCase();
        if (mod && key === "z") {
          e.preventDefault();
          if (e.shiftKey) editor.redo();
          else editor.undo();
        } else if (mod && key === "y") {
          e.preventDefault();
          editor.redo();
        } else if (mod && key === "b") {
          e.preventDefault();
          editor.toggleBypass();
        } else if (mod && key === "m") {
          e.preventDefault();
          editor.toggleMute();
        } else if (mod && key === "g") {
          e.preventDefault();
          editor.groupSelected();
        } else if (mod && key === "d") {
          e.preventDefault();
          editor.duplicate();
        } else if (!mod && key === "c" && e.altKey) {
          e.preventDefault();
          editor.toggleCollapse();
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(NODE_DRAG_TYPE) || e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        if (!editor) return;
        const type = e.dataTransfer.getData(NODE_DRAG_TYPE);
        if (type) {
          e.preventDefault();
          editor.add(type, editor.clientToGraph(e.clientX, e.clientY));
          editor.focus();
          return;
        }
        const file = e.dataTransfer.files[0];
        if (file) {
          e.preventDefault();
          latest.current.onDropFile(file);
        }
      }}
    >
      <canvas ref={canvasRef} className="graph-canvas" tabIndex={0} aria-label="节点画布：拖动平移，滚轮缩放，双击空白处搜索节点" />
      {props.empty && (
        <div className="canvas-empty">
          <strong>画布是空的</strong>
          <span>双击画布搜索节点，或从“工作流”菜单选择一个模板。</span>
        </div>
      )}
      {editor && (
        <>
          <div className="zoom-controls" role="group" aria-label="视图">
            <button type="button" onClick={() => editor.zoomBy(1 / 1.25)} aria-label="缩小" title="缩小">
              <Minus size={15} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => editor.zoomBy(1.25)} aria-label="放大" title="放大">
              <Plus size={15} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => editor.fit()} aria-label="适合窗口" title="适合窗口">
              <Maximize2 size={14} aria-hidden="true" />
            </button>
          </div>
          <Minimap editor={editor} version={view} />
        </>
      )}
      {editor && searchReq && (
        <NodeSearch
          request={searchReq}
          entries={props.entries}
          onClose={closeSearch}
          onPick={(def: NodeDef) => {
            editor.add(def.name, searchReq.graphPos, searchReq.from);
            closeSearch();
          }}
        />
      )}
      {editor && textReq && (
        <TextEditor
          request={textReq}
          editor={editor}
          onClose={() => {
            setTextReq(null);
            editor.focus();
          }}
        />
      )}
      {editor && comboReq && (
        <ComboPicker
          request={comboReq}
          editor={editor}
          onClose={() => {
            setComboReq(null);
            editor.focus();
          }}
        />
      )}
    </div>
  );
}

export type { NodeDefs };
