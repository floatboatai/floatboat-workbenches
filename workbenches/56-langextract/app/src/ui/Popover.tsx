import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Button + anchored panel. Escape and outside clicks close it and return focus to the button. */
export function Popover({
  label,
  className,
  buttonClass,
  children,
  align = "start",
  role = "dialog",
}: {
  label: ReactNode;
  className?: string;
  buttonClass?: string;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  role?: "dialog" | "menu";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    id = useId();
  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    const first = root.current?.querySelector<HTMLElement>(
      "[data-autofocus], [role=menuitem], input, button:not([aria-haspopup])",
    );
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div className={"popover " + (className ?? "")} ref={root}>
      <button
        ref={button}
        type="button"
        className={buttonClass}
        aria-haspopup={role === "menu" ? "menu" : "dialog"}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div id={id} className={"popover-panel " + align} role={role}>
          {children(() => close())}
        </div>
      )}
    </div>
  );
}
