import type { Editor } from "grapesjs";
import { isRecord } from "../contracts/project";
interface InputDraft {
  id: string;
  property: string;
  field: number;
  value: string;
}
function decode(raw: unknown): Record<string, InputDraft> {
  if (
    !isRecord(raw) ||
    new TextEncoder().encode(JSON.stringify(raw)).length > 100000
  )
    return {};
  const result: Record<string, InputDraft> = {};
  for (const value of Object.values(raw)) {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,300}$/.test(value.id) ||
      typeof value.property !== "string" ||
      !/^[a-z-]{1,60}$/.test(value.property) ||
      typeof value.field !== "number" ||
      !Number.isInteger(value.field) ||
      value.field < 0 ||
      value.field > 2 ||
      typeof value.value !== "string" ||
      value.value.length > 300
    )
      continue;
    const item: InputDraft = {
      id: value.id,
      property: value.property,
      field: value.field,
      value: value.value,
    };
    result[key(item)] = item;
  }
  return result;
}
const key = (item: InputDraft) => `${item.id}:${item.property}:${item.field}`;
export function bindInspector(
  host: HTMLElement,
  editor: Editor,
  raw: unknown,
  onDraft: (value: Record<string, InputDraft>) => void,
  onError: (error: unknown) => void,
) {
  let pending = decode(raw),
    disposed = false;
  const publish = (next: Record<string, InputDraft>) => {
    if (new TextEncoder().encode(JSON.stringify(next)).length > 100000) {
      onError(new Error("属性输入草稿超出容量，请先完成或减少输入。"));
      return;
    }
    pending = next;
    onDraft(next);
  };
  const identity = (target: EventTarget | null): InputDraft | null => {
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement
      )
    )
      return null;
    const group = target.closest(".gjs-sm-property"),
      id = editor.getSelected()?.getId();
    const property = Array.from(group?.classList ?? [])
      .find((name) => name.startsWith("gjs-sm-property__"))
      ?.slice("gjs-sm-property__".length);
    if (!group || !id || !property) return null;
    const field = Array.from(group.querySelectorAll("input,select")).indexOf(
      target,
    );
    return { id, property, field, value: target.value };
  };
  const restore = () => {
    if (disposed) return;
    const selected = editor.getSelected()?.getId();
    for (const item of Object.values(pending)) {
      if (item.id !== selected) continue;
      const field = host
        .querySelector(`.gjs-sm-property__${item.property}`)
        ?.querySelectorAll("input,select")[item.field];
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement
      )
        field.value = item.value;
    }
  };
  const labels = () =>
    host.querySelectorAll<HTMLElement>(".gjs-sm-property").forEach((group) => {
      const label =
        group.querySelector(".gjs-sm-label")?.textContent?.trim() || "样式";
      group.querySelectorAll("input,select").forEach((field, index) => {
        field.setAttribute("aria-label", label + (index ? " 单位" : ""));
        if (field instanceof HTMLInputElement) field.maxLength = 300;
      });
    });
  const observer = new MutationObserver(() => {
    labels();
    restore();
  });
  observer.observe(host, { childList: true, subtree: true });
  labels();
  const input = (event: Event) => {
    const item = identity(event.target);
    if (item && item.value.length <= 300)
      publish({ ...pending, [key(item)]: item });
  };
  const change = (event: Event) => {
    const item = identity(event.target);
    if (!item) return;
    // Retain the original value when the native numeric editor normalizes or rejects it.
    // CSS.supports checks the raw text, not the potentially changed DOM value after blur.
    const value = pending[`${item.id}:${item.property}:0`]?.value ?? item.value;
    const group = host.querySelector(`.gjs-sm-property__${item.property}`);
    const unit =
      pending[`${item.id}:${item.property}:1`]?.value ??
      group?.querySelector("select")?.value ??
      "";
    if (
      CSS.supports(item.property, value) ||
      CSS.supports(item.property, value + unit)
    ) {
      const next = { ...pending };
      for (const [entry, draft] of Object.entries(next))
        if (draft.id === item.id && draft.property === item.property)
          delete next[entry];
      publish(next);
    }
    setTimeout(restore, 0);
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Enter")
      setTimeout(() => {
        if (!disposed) change(event);
      }, 0);
  };
  host.addEventListener("input", input, true);
  host.addEventListener("change", change);
  host.addEventListener("keydown", keydown);
  return {
    restore: () => setTimeout(restore, 100),
    dispose: () => {
      disposed = true;
      observer.disconnect();
      host.removeEventListener("input", input, true);
      host.removeEventListener("change", change);
      host.removeEventListener("keydown", keydown);
    },
  };
}
