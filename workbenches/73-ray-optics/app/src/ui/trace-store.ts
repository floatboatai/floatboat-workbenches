import { useSyncExternalStore } from "react";
import type { Trace } from "./NativeBench";

/** Trace updates arrive once per animation frame while tracing; only the readout strip subscribes. */
export const idleTrace: Trace = { phase: "loading", rays: 0, ms: 0, readings: [], error: "", warning: "" };
let value: Trace = idleTrace;
const listeners = new Set<() => void>();
export const traceStore = {
  set(next: Trace) {
    value = next;
    listeners.forEach((l) => l());
  },
  get: () => value,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
export function useTrace(): Trace {
  return useSyncExternalStore(traceStore.subscribe, traceStore.get, traceStore.get);
}
