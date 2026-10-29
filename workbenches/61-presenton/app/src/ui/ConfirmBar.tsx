// ABOUTME: 页内确认条：替换类操作在原位确认，不依赖浏览器弹窗；Escape 取消。
import { useEffect, useRef } from "react";

export function ConfirmBar({ message, confirmLabel, onConfirm, onCancel }: { message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => ok.current?.focus(), []);
  return (
    <div className="confirm-bar" role="group" aria-label="确认操作" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <p>{message}</p>
      <div>
        <button type="button" className="ghost" onClick={onCancel}>
          取消
        </button>
        <button ref={ok} type="button" className="primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
