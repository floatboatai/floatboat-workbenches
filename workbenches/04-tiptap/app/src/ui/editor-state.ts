// ABOUTME: 工具条与上下文工具订阅的编辑器派生状态；只在这些值变化时重渲染工具条，不随每次输入刷新整页。
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";

export type BlockStyle = "paragraph" | "h1" | "h2" | "h3" | "other";
export type Align = "left" | "center" | "right" | "justify";

export interface ToolState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  highlight: boolean;
  link: boolean;
  block: BlockStyle;
  bullet: boolean;
  ordered: boolean;
  task: boolean;
  quote: boolean;
  codeBlock: boolean;
  codeLanguage: string;
  align: Align;
  table: boolean;
  image: boolean;
  imageAlt: string;
  imageSized: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canMerge: boolean;
  canSplit: boolean;
  emptySelection: boolean;
}

function block(editor: Editor): BlockStyle {
  if (editor.isActive("paragraph")) return "paragraph";
  for (const level of [1, 2, 3] as const)
    if (editor.isActive("heading", { level })) return `h${level}`;
  return "other";
}

function align(editor: Editor): Align {
  for (const value of ["center", "right", "justify"] as const)
    if (editor.isActive({ textAlign: value })) return value;
  return "left";
}

export function useToolState(editor: Editor | null): ToolState | null {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      const image = current.isActive("image");
      const imageAttrs = image ? current.getAttributes("image") : {};
      const codeBlock = current.isActive("codeBlock");
      const table = current.isActive("table");
      return {
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        strike: current.isActive("strike"),
        code: current.isActive("code"),
        highlight: current.isActive("highlight"),
        link: current.isActive("link"),
        block: block(current),
        bullet: current.isActive("bulletList"),
        ordered: current.isActive("orderedList"),
        task: current.isActive("taskList"),
        quote: current.isActive("blockquote"),
        codeBlock,
        codeLanguage: codeBlock ? String(current.getAttributes("codeBlock").language ?? "") : "",
        align: align(current),
        table,
        image,
        imageAlt: typeof imageAttrs.alt === "string" ? imageAttrs.alt : "",
        imageSized: image && imageAttrs.width != null,
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
        canMerge: table && current.can().mergeCells(),
        canSplit: table && current.can().splitCell(),
        emptySelection: current.state.selection.empty,
      } satisfies ToolState;
    },
  });
}
