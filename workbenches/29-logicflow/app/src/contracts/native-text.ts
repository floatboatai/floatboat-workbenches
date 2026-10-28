import { isRecord } from "./project.ts";
import type { Graph } from "./flow.ts";
export interface NativeTextDraft {
  id: string;
  text: string;
}
export function nativeTextDrafts(
  extra: Record<string, unknown>,
): NativeTextDraft[] {
  if (!isRecord(extra.nativeTextEdits)) return [];
  return Object.entries(extra.nativeTextEdits).flatMap(([id, value]) =>
    isRecord(value) && value.id === id && typeof value.text === "string"
      ? [{ id, text: value.text }]
      : [],
  );
}
export function recordNativeText(
  extra: Record<string, unknown>,
  edit: NativeTextDraft,
): Record<string, unknown> {
  return {
    ...extra,
    nativeTextEdits: {
      ...(isRecord(extra.nativeTextEdits) ? extra.nativeTextEdits : {}),
      [edit.id]: { ...edit },
    },
  };
}
export function graphText(graph: Graph, id: string): string | undefined {
  const item =
    graph.nodes.find((n) => n.id === id) ??
    graph.edges.find((e) => e.id === id);
  return item
    ? typeof item.text === "string"
      ? item.text
      : (item.text?.value ?? "")
    : undefined;
}
// Match the official TextEditTool's newline handling only when acknowledging a
// real model update. Never normalize an unfinished or restored working copy.
export function acknowledgeNativeText(
  extra: Record<string, unknown>,
  edit: NativeTextDraft,
  actual: string | undefined,
): Record<string, unknown> {
  const pending = nativeTextDrafts(extra).find((d) => d.id === edit.id);
  if (
    !pending ||
    pending.text !== edit.text ||
    actual === undefined ||
    (actual !== edit.text &&
      actual !== edit.text.replace(/(\r\n)+$|(\n)+$/, ""))
  )
    return extra;
  const edits = {
    ...(isRecord(extra.nativeTextEdits) ? extra.nativeTextEdits : {}),
  };
  delete edits[edit.id];
  const next = { ...extra };
  if (Object.keys(edits).length) next.nativeTextEdits = edits;
  else delete next.nativeTextEdits;
  return next;
}
