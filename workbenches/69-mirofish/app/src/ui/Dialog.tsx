// ABOUTME: 模态面板：Escape 或点击背景关闭，浏览器在关闭后把焦点还给触发按钮。
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Modal sheet: Escape or the backdrop closes it; the caller restores focus. */
export function Dialog({
  open,
  close,
  title,
  eyebrow,
  className = "",
  children,
}: {
  open: boolean;
  close: () => void;
  title: string;
  eyebrow: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `dialog-${eyebrow.replace(/\W+/g, "-").toLowerCase()}`;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`sheet ${className}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      {open ? (
        <div className="sheet-body">
          <header className="sheet-heading">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h2 id={titleId}>{title}</h2>
            </div>
            <button className="icon" aria-label={`关闭${title}`} onClick={close}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
