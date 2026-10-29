// ABOUTME: 「/」插入菜单：基于官方 @tiptap/suggestion，命令列表与过滤在此定义，界面由 SlashMenu 通过桥接对象渲染。
import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { RefObject } from "react";

export interface SlashContext {
  pickImage: () => void;
}

export interface SlashItem {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  run: (editor: Editor, range: Range, context: SlashContext) => void;
}

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const SLASH_ITEMS: SlashItem[] = [
  { id: "paragraph", label: "正文", hint: "普通段落", keywords: ["p", "text", "zw", "paragraph"], run: (e, r) => chain(e, r).setParagraph().run() },
  { id: "h1", label: "标题 1", hint: "章节大标题", keywords: ["h1", "bt", "title", "heading"], run: (e, r) => chain(e, r).setHeading({ level: 1 }).run() },
  { id: "h2", label: "标题 2", hint: "小节标题", keywords: ["h2", "bt", "heading"], run: (e, r) => chain(e, r).setHeading({ level: 2 }).run() },
  { id: "h3", label: "标题 3", hint: "三级标题", keywords: ["h3", "bt", "heading"], run: (e, r) => chain(e, r).setHeading({ level: 3 }).run() },
  { id: "bullet", label: "无序列表", hint: "圆点列表", keywords: ["ul", "list", "lb", "bullet"], run: (e, r) => chain(e, r).toggleBulletList().run() },
  { id: "ordered", label: "有序列表", hint: "编号列表", keywords: ["ol", "list", "lb", "number"], run: (e, r) => chain(e, r).toggleOrderedList().run() },
  { id: "task", label: "任务清单", hint: "可勾选的待办", keywords: ["todo", "task", "rw", "check", "dbsx"], run: (e, r) => chain(e, r).toggleTaskList().run() },
  { id: "quote", label: "引用", hint: "引述原话或资料", keywords: ["quote", "yy", "blockquote"], run: (e, r) => chain(e, r).toggleBlockquote().run() },
  { id: "code", label: "代码块", hint: "等宽代码，可选语言", keywords: ["code", "dm", "pre"], run: (e, r) => chain(e, r).setCodeBlock().run() },
  { id: "table", label: "表格", hint: "3 × 3，含标题行", keywords: ["table", "bg", "grid"], run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: "image", label: "图片", hint: "从本机选择，嵌入文稿", keywords: ["image", "img", "tp", "picture", "photo"], run: (e, r, context) => { chain(e, r).run(); context.pickImage(); } },
  { id: "divider", label: "分隔线", hint: "分隔前后内容", keywords: ["hr", "divider", "fgx", "line"], run: (e, r) => chain(e, r).setHorizontalRule().run() },
];

export function filterSlash(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.hint.includes(q) ||
      item.keywords.some((keyword) => keyword.startsWith(q)),
  );
}

export interface SlashBridge {
  open(props: SuggestionProps<SlashItem, SlashItem>): void;
  update(props: SuggestionProps<SlashItem, SlashItem>): void;
  close(): void;
  keyDown(event: KeyboardEvent): boolean;
  context: SlashContext;
}

export const slashKey = new PluginKey("slashCommand");

export function slashCommand(bridge: RefObject<SlashBridge | null>) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          pluginKey: slashKey,
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          items: ({ query }) => filterSlash(query),
          allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
          command: ({ editor, range, props }) => {
            const context = bridge.current?.context ?? { pickImage: () => {} };
            props.run(editor, range, context);
          },
          render: () => ({
            onStart: (props) => bridge.current?.open(props),
            onUpdate: (props) => bridge.current?.update(props),
            onExit: () => bridge.current?.close(),
            onKeyDown: ({ event }) => bridge.current?.keyDown(event) ?? false,
          }),
        }),
      ];
    },
  });
}
