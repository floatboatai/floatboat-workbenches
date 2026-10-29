// ABOUTME: 选中文字时浮在选区上方的格式条；光标落在链接里时显示链接地址与编辑/移除入口。
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { Bold, Code, Highlighter, Italic, Link2, Strikethrough, Underline, Unlink } from "lucide-react";
import { tip } from "./keys";
import { safeHref } from "../contracts/domain";

const ICON = { size: 15, strokeWidth: 1.9, "aria-hidden": true } as const;

export function SelectionBubble({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      highlight: current.isActive("highlight"),
      href: current.isActive("link") ? String(current.getAttributes("link").href ?? "") : "",
      empty: current.state.selection.empty,
    }),
  });
  const button = (
    label: string,
    keys: string,
    pressed: boolean,
    action: () => void,
    icon: ReactNode,
  ) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
      {...tip(label, keys)}
    >
      {icon}
    </button>
  );
  const chain = () => editor.chain().focus();
  const linkOnly = state.empty && state.href;
  return (
    <BubbleMenu
      editor={editor}
      className="selection-bubble"
      role="toolbar"
      aria-label={linkOnly ? "链接" : "选中文字格式"}
      options={{ placement: "top", offset: 8, flip: true, shift: { padding: 8 } }}
      shouldShow={({ editor: current, view, state: editorState, from, to, element }) => {
        if (!current.isEditable) return false;
        if (!view.hasFocus() && !element.contains(document.activeElement)) return false;
        const { selection } = editorState;
        if (selection instanceof NodeSelection || selection instanceof CellSelection) return false;
        if (current.isActive("codeBlock")) return false;
        if (selection.empty) return current.isActive("link");
        return editorState.doc.textBetween(from, to).trim().length > 0;
      }}
    >
      {linkOnly ? (
        <>
          <span className="bubble-href" title={state.href}>
            {state.href.replace(/^https?:\/\//, "").replace(/^mailto:/, "")}
          </span>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onLink} {...tip("编辑链接", "Mod-k")}>
            编辑
          </button>
          <a href={safeHref(state.href) ?? "#"} target="_blank" rel="noopener noreferrer">
            打开 ↗
          </a>
          <button
            type="button"
            aria-label="移除链接"
            title="移除链接"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => chain().extendMarkRange("link").unsetLink().run()}
          >
            <Unlink {...ICON} />
          </button>
        </>
      ) : (
        <>
          {button("加粗", "Mod-b", state.bold, () => chain().toggleBold().run(), <Bold {...ICON} />)}
          {button("斜体", "Mod-i", state.italic, () => chain().toggleItalic().run(), <Italic {...ICON} />)}
          {button("下划线", "Mod-u", state.underline, () => chain().toggleUnderline().run(), <Underline {...ICON} />)}
          {button("删除线", "Mod-Shift-s", state.strike, () => chain().toggleStrike().run(), <Strikethrough {...ICON} />)}
          {button("行内代码", "Mod-e", state.code, () => chain().toggleCode().run(), <Code {...ICON} />)}
          {button("高亮", "Mod-Shift-h", state.highlight, () => chain().toggleHighlight().run(), <Highlighter {...ICON} />)}
          {button("链接", "Mod-k", Boolean(state.href), onLink, <Link2 {...ICON} />)}
        </>
      )}
    </BubbleMenu>
  );
}
