// ABOUTME: 菜单/浮层通用行为：Escape 关闭并把焦点还给触发按钮，点击外部关闭。

import { useCallback, useEffect, useRef, useState } from "react";

export function usePopover() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key, true);
    // focus first control for keyboard users
    queueMicrotask(() => panel.current?.querySelector<HTMLElement>("input,button,[tabindex]")?.focus());
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, close]);
  return { open, setOpen, trigger, panel, close };
}
