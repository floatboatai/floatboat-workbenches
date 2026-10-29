// ABOUTME: 下拉面板：按钮开合，Escape 或点击外部关闭并把焦点还给按钮。
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Menu({
  label,
  icon,
  className = "",
  align = "start",
  disabled,
  children,
}: {
  label: ReactNode;
  icon?: ReactNode;
  className?: string;
  align?: "start" | "end";
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    panel.current?.querySelector<HTMLElement>("button:not([disabled]), input, select")?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className={`menu ${className}`}>
      <button
        ref={button}
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        <span>{label}</span>
        <span aria-hidden="true" className="caret">
          ▾
        </span>
      </button>
      {open ? (
        <div id={id} ref={panel} className={`menu-panel align-${align}`} role="group">
          {children(() => close())}
        </div>
      ) : null}
    </div>
  );
}
