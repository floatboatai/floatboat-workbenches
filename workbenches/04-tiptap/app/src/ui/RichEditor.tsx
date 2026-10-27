import { memo, useRef, useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/core";
const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false },
  }),
];
export const RichEditor = memo(function RichEditor({
  initial,
  onChange,
  disabled = false,
}: {
  initial: JSONContent;
  onChange: (content: JSONContent) => void;
  disabled?: boolean;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const editor = useEditor(
    {
      extensions,
      content: initial,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-label": "文档正文",
          "aria-multiline": "true",
          spellcheck: "true",
        },
      },
      onUpdate: ({ editor }) => callback.current(editor.getJSON()),
    },
    [initial],
  );
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            heading: editor.isActive("heading", { level: 2 }),
            list: editor.isActive("bulletList"),
            quote: editor.isActive("blockquote"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
          }
        : null,
  });
  return (
    <div className="writing-editor">
      <div className="format-bar" role="toolbar" aria-label="文字格式">
        <button
          type="button"
          aria-label="加粗"
          aria-pressed={state?.bold ?? false}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          aria-label="斜体"
          aria-pressed={state?.italic ?? false}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </button>
        <span className="format-divider" />
        <button
          type="button"
          aria-pressed={state?.heading ?? false}
          disabled={disabled || !editor}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          小标题
        </button>
        <button
          type="button"
          aria-pressed={state?.list ?? false}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          列表
        </button>
        <button
          type="button"
          aria-pressed={state?.quote ?? false}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          引用
        </button>
        <span className="format-divider" />
        <button
          type="button"
          aria-label="撤销"
          disabled={disabled || !state?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="重做"
          disabled={disabled || !state?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          ↷
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});
