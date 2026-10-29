// ABOUTME: 正文编辑器：Tiptap 实例、工具条、选区浮条、「/」插入、链接浮层与图片粘贴/拖入；对外只暴露目录跳转和插入内容。
import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { documentExtensions } from "../contracts/schema";
import { documentBytes, MAX_DOCUMENT_BYTES, MAX_TEXT } from "../contracts/domain";
import { importKind } from "../contracts/files";
import { prepareImage } from "./images";
import { slashCommand, type SlashBridge } from "./slash";
import { SlashMenu } from "./SlashMenu";
import { SelectionBubble } from "./SelectionBubble";
import { LinkPopover, linkTarget, type LinkTarget } from "./LinkPopover";
import { ContextBar, Toolbar } from "./Toolbar";
import { useToolState } from "./editor-state";

export interface EditorApi {
  focusHeading(index: number): void;
  insertContent(content: JSONContent[]): void;
}

export type EditorMessage = (kind: "error" | "notice", text: string) => void;

function headingPosition(editor: Editor, index: number): number {
  let seen = -1,
    found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === "heading" && ++seen === index) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

/** 工具条在编辑器实例就绪后才订阅状态，保证首屏即反映光标处格式且按钮可用。 */
function EditorChrome({
  editor,
  disabled,
  onLink,
  onPickImage,
}: {
  editor: Editor | null;
  disabled: boolean;
  onLink: () => void;
  onPickImage: () => void;
}) {
  return (
    <div className="editor-chrome">
      {editor ? (
        <ReadyChrome editor={editor} disabled={disabled} onLink={onLink} onPickImage={onPickImage} />
      ) : (
        <Toolbar editor={null} state={null} disabled onLink={onLink} onPickImage={onPickImage} />
      )}
    </div>
  );
}

function ReadyChrome({
  editor,
  disabled,
  onLink,
  onPickImage,
}: {
  editor: Editor;
  disabled: boolean;
  onLink: () => void;
  onPickImage: () => void;
}) {
  const state = useToolState(editor);
  return (
    <>
      <Toolbar editor={editor} state={state} disabled={disabled} onLink={onLink} onPickImage={onPickImage} />
      <ContextBar editor={editor} state={state} disabled={disabled} />
    </>
  );
}

export const RichEditor = memo(function RichEditor({
  initial,
  onChange,
  disabled = false,
  apiRef,
  onMessage,
  onImportFile,
}: {
  initial: JSONContent;
  onChange: (content: JSONContent) => void;
  disabled?: boolean;
  apiRef: RefObject<EditorApi | null>;
  onMessage: EditorMessage;
  onImportFile: (file: File) => void;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const message = useRef(onMessage);
  message.current = onMessage;
  const importFile = useRef(onImportFile);
  importFile.current = onImportFile;
  const slashBridge = useRef<SlashBridge | null>(null);
  const openLinkRef = useRef<() => void>(() => {});
  const insertImagesRef = useRef<(files: File[], pos?: number) => void>(() => {});
  const imageInput = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<LinkTarget | null>(null);

  const extensions = useMemo(
    () => [
      ...documentExtensions({ editor: true }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "标题" : "输入正文，或键入 / 插入标题、表格、图片…",
      }),
      CharacterCount.configure({ limit: MAX_TEXT }),
      slashCommand(slashBridge),
      Extension.create({
        name: "writingShortcuts",
        addKeyboardShortcuts() {
          return {
            "Mod-k": () => {
              openLinkRef.current();
              return true;
            },
          };
        },
      }),
    ],
    [],
  );

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
        // 页头与工具条吸顶：光标滚动时留出它们的高度，避免输入位置被遮住。
        scrollThreshold: { top: 140, bottom: 80, left: 0, right: 0 },
        scrollMargin: { top: 150, bottom: 96, left: 0, right: 0 },
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
            file.type.startsWith("image/"),
          );
          if (!files.length) return false;
          event.preventDefault();
          insertImagesRef.current(files);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (!files.length) return false;
          event.preventDefault();
          const images = files.filter((file) => file.type.startsWith("image/"));
          if (images.length) {
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
            insertImagesRef.current(images, pos);
          } else {
            const docFile = files.find((file) => importKind(file.name, file.type));
            if (docFile) importFile.current(docFile);
            else message.current("error", "只能拖入图片，或 Markdown / JSON 文稿文件。");
          }
          return true;
        },
      },
      onUpdate: ({ editor: current }) => callback.current(current.getJSON()),
    },
    [initial],
  );

  const openLink = useCallback(() => {
    if (!editor || !editor.isEditable) return;
    setLink(linkTarget(editor));
  }, [editor]);
  openLinkRef.current = openLink;

  const pickImage = useCallback(() => imageInput.current?.click(), []);

  insertImagesRef.current = (files, pos) => {
    if (!editor) return;
    void (async () => {
      let inserted = 0;
      for (const file of files) {
        try {
          const image = await prepareImage(file);
          if (documentBytes(editor.getJSON()) + image.src.length + 400 > MAX_DOCUMENT_BYTES)
            throw new Error(
              `加入「${file.name}」后文稿将超过 ${(MAX_DOCUMENT_BYTES / 1_000_000).toFixed(1)} MB，请先删除部分图片或拆分文稿。`,
            );
          const node = { type: "image", attrs: { src: image.src, alt: image.alt || null } };
          const chain = editor.chain().focus();
          if (pos !== undefined && inserted === 0) chain.insertContentAt(pos, node).run();
          else chain.insertContent(node).run();
          inserted++;
        } catch (error) {
          message.current("error", error instanceof Error ? error.message : "图片插入失败。");
        }
      }
      if (inserted)
        message.current(
          "notice",
          `已插入 ${inserted} 张图片（已压缩并嵌入文稿）。选中图片可补写替代文字或拖动右下角调整宽度。`,
        );
    })();
  };

  useImperativeHandle(
    apiRef,
    () => ({
      focusHeading(index) {
        if (!editor) return;
        const pos = headingPosition(editor, index);
        if (pos < 0) return;
        editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(pos + 1).run();
        const dom = editor.view.nodeDOM(pos);
        if (dom instanceof HTMLElement)
          dom.scrollIntoView({
            block: "start",
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          });
      },
      insertContent(content) {
        editor?.chain().focus().insertContent(content).run();
      },
    }),
    [editor],
  );

  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  const closeLink = useCallback(() => setLink(null), []);

  return (
    <div className="writing-editor">
      <EditorChrome editor={editor} disabled={disabled} onLink={openLink} onPickImage={pickImage} />
      <EditorContent editor={editor} />
      {editor ? <SelectionBubble editor={editor} onLink={openLink} /> : null}
      <SlashMenu bridge={slashBridge} editor={editor} pickImage={pickImage} />
      {editor && link ? <LinkPopover editor={editor} target={link} onClose={closeLink} /> : null}
      <input
        ref={imageInput}
        className="sr-only"
        type="file"
        tabIndex={-1}
        aria-label="选择要插入的图片"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) insertImagesRef.current(files);
        }}
      />
    </div>
  );
});
