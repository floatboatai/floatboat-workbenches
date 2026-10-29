// ABOUTME: 弹出层的 Escape 关闭、点击外部关闭与焦点归还。
import { useEffect, type RefObject } from "react";

export function usePopover(open: boolean, close: () => void, wrap: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
      wrap.current?.querySelector<HTMLElement>("button")?.focus();
    };
    const outside = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
    };
  }, [open, close, wrap]);
}
