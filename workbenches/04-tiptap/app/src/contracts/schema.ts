// ABOUTME: 编辑器、HTML 导出、Markdown 转换和服务端 AI 解析共用的 Tiptap 扩展集合，保证四处使用同一套文档语法。
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { normalizeLinkInput } from "./domain.ts";

/** 只解析文稿自带的位图数据；粘贴来的外部图片地址不会进入文稿，也不会被请求。 */
const OwnedImage = Image.extend({
  parseHTML() {
    return [
      {
        tag: 'img[src^="data:image/png"],img[src^="data:image/jpeg"],img[src^="data:image/webp"],img[src^="data:image/gif"]',
      },
    ];
  },
});

export const CODE_LANGUAGES = [
  "",
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "markdown",
  "php",
  "python",
  "ruby",
  "rust",
  "sql",
  "swift",
  "typescript",
  "yaml",
] as const;

export function documentExtensions(options: { editor?: boolean } = {}): AnyExtension[] {
  const editor = options.editor === true;
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        isAllowedUri: (url, context) =>
          normalizeLinkInput(url) !== null && context.defaultValidate(url),
      },
      codeBlock: { languageClassPrefix: "language-" },
      trailingNode: editor ? {} : false,
      dropcursor: editor ? { width: 2 } : false,
      gapcursor: editor ? undefined : false,
      undoRedo: editor ? { depth: 200 } : false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({
      table: { resizable: editor, cellMinWidth: 60 },
    }),
    OwnedImage.configure({
      inline: false,
      allowBase64: true,
      resize: editor
        ? { enabled: true, directions: ["bottom-left", "bottom-right"], alwaysPreserveAspectRatio: true, minWidth: 48, minHeight: 32 }
        : false,
    }),
    Highlight,
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right", "justify"],
    }),
  ];
}
