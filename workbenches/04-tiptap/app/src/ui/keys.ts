// ABOUTME: 快捷键的显示文字与 aria-keyshortcuts 值；按平台显示 ⌘ 或 Ctrl。

const mac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

const LABEL: Record<string, string> = mac
  ? { Mod: "⌘", Shift: "⇧", Alt: "⌥" }
  : { Mod: "Ctrl", Shift: "Shift", Alt: "Alt" };
const ARIA: Record<string, string> = { Mod: mac ? "Meta" : "Control", Shift: "Shift", Alt: "Alt" };

export interface Shortcut {
  /** 例如 ⌘⇧8 或 Ctrl+Shift+8 */
  label: string;
  aria: string;
}

/** keys 形如 "Mod-Shift-8"。 */
export function shortcut(keys: string): Shortcut {
  const parts = keys.split("-");
  const label = parts
    .map((part) => LABEL[part] ?? part.toUpperCase())
    .join(mac ? "" : "+");
  const aria = parts.map((part) => ARIA[part] ?? part.toUpperCase()).join("+");
  return { label, aria };
}

export function tip(name: string, keys?: string): { title: string; "aria-keyshortcuts"?: string } {
  if (!keys) return { title: name };
  const key = shortcut(keys);
  return { title: `${name}（${key.label}）`, "aria-keyshortcuts": key.aria };
}
