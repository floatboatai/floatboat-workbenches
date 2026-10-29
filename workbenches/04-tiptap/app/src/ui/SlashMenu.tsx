// ABOUTME: 「/」插入菜单的界面：跟随光标的列表，方向键选择、回车插入、Esc 关闭，编辑器始终保留焦点。
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { exitSuggestion } from "@tiptap/suggestion";
import type { Editor } from "@tiptap/core";
import { slashKey, type SlashBridge, type SlashItem } from "./slash";

interface MenuState {
  items: SlashItem[];
  rect: DOMRect | null;
  command: (item: SlashItem) => void;
  query: string;
}

const MENU_WIDTH = 280;

export function SlashMenu({
  bridge,
  editor,
  pickImage,
}: {
  bridge: RefObject<SlashBridge | null>;
  editor: Editor | null;
  pickImage: () => void;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [active, setActive] = useState(0);
  const live = useRef({ menu, active });
  live.current = { menu, active };
  const list = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    const read = (props: SuggestionProps<SlashItem, SlashItem>): MenuState => ({
      items: props.items,
      rect: props.clientRect?.() ?? null,
      command: props.command,
      query: props.query,
    });
    bridge.current = {
      open(props) {
        setMenu(read(props));
        setActive(0);
      },
      update(props) {
        setMenu(read(props));
        setActive(0);
      },
      close() {
        setMenu(null);
      },
      keyDown(event) {
        const { menu: current, active: index } = live.current;
        if (!current) return false;
        const count = current.items.length;
        if (event.key === "Escape") {
          if (editor) exitSuggestion(editor.view, slashKey);
          setMenu(null);
          return true;
        }
        if (!count) return false;
        if (event.key === "ArrowDown") {
          setActive((index + 1) % count);
          return true;
        }
        if (event.key === "ArrowUp") {
          setActive((index - 1 + count) % count);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          current.command(current.items[index]);
          return true;
        }
        return false;
      },
      context: { pickImage },
    };
    return () => {
      bridge.current = null;
    };
  }, [bridge, editor, pickImage]);

  useLayoutEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, menu]);

  if (!menu?.rect) return null;
  const { rect } = menu;
  const below = window.innerHeight - rect.bottom > 300 || rect.top < 300;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
  const style = below
    ? { top: rect.bottom + 6, left }
    : { bottom: window.innerHeight - rect.top + 6, left };
  return (
    <div className="slash-menu" style={style} role="presentation">
      {menu.items.length ? (
        <ul ref={list} role="listbox" aria-label="插入块">
          {menu.items.map((item, index) => (
            <li
              key={item.id}
              id={`slash-${item.id}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                menu.command(item);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="slash-label">{item.label}</span>
              <span className="slash-hint">{item.hint}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="slash-empty">没有匹配「{menu.query}」的块，继续输入或按 Esc。</p>
      )}
    </div>
  );
}
