import { useEffect, useId, useRef, type ReactNode } from "react";

/** Native modal dialog: Escape and backdrop click close it; focus returns to the opener. */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    }
  }, [open]);
  const id = useId();
  return (
    <dialog
      ref={ref}
      className={"modal " + className}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="modal-body">
          <header className="modal-head">
            <div>
              {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
              <h2 id={id}>{title}</h2>
            </div>
            <button className="icon" aria-label={"关闭" + title} onClick={onClose}>
              ×
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
