import type { KeyboardEvent } from "react";

/** WAI-ARIA tabs keyboard model: Arrow keys, Home and End move selection and focus. */
export function tabKeys<T extends string>(event: KeyboardEvent<HTMLElement>, ids: T[], current: T, select: (id: T) => void, prefix: string) {
  const i = ids.indexOf(current);
  const next =
    event.key === "ArrowRight" ? ids[(i + 1) % ids.length]
    : event.key === "ArrowLeft" ? ids[(i - 1 + ids.length) % ids.length]
    : event.key === "Home" ? ids[0]
    : event.key === "End" ? ids[ids.length - 1]
    : null;
  if (!next) return;
  event.preventDefault();
  select(next);
  requestAnimationFrame(() => document.getElementById(prefix + next)?.focus());
}
