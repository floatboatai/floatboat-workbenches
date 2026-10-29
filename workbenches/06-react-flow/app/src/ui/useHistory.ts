// ABOUTME: 画布编辑的撤销/重做栈：只记录节点与连线，连续输入同一字段合并为一步，切换文档时清空。
import { useCallback, useEffect, useRef, useState } from "react";
import type { FlowDocument } from "../contracts/flow";

type Graph = Pick<FlowDocument, "nodes" | "edges">;
const LIMIT = 100;
const COALESCE_MS = 1200;

export function useHistory(get: () => FlowDocument, set: (next: FlowDocument) => void, resetKey: string) {
  const past = useRef<Graph[]>([]),
    future = useRef<Graph[]>([]),
    last = useRef<{ key: string; at: number } | null>(null);
  const [, bump] = useState(0);
  useEffect(() => {
    past.current = [];
    future.current = [];
    last.current = null;
    bump((n) => n + 1);
  }, [resetKey]);

  /** 应用一次编辑；相同 key 在短时间内的连续编辑合并为一步撤销。 */
  const commit = useCallback(
    (next: FlowDocument, key?: string) => {
      const current = get();
      const now = Date.now();
      const merge = key && last.current?.key === key && now - last.current.at < COALESCE_MS;
      if (!merge) {
        past.current = [...past.current.slice(-(LIMIT - 1)), { nodes: current.nodes, edges: current.edges }];
        future.current = [];
      }
      last.current = key ? { key, at: now } : null;
      set(next);
      bump((n) => n + 1);
    },
    [get, set],
  );

  const step = useCallback(
    (from: { current: Graph[] }, to: { current: Graph[] }) => {
      const target = from.current.at(-1);
      if (!target) return false;
      const current = get();
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, { nodes: current.nodes, edges: current.edges }];
      last.current = null;
      set({ ...current, nodes: target.nodes, edges: target.edges });
      bump((n) => n + 1);
      return true;
    },
    [get, set],
  );

  return {
    commit,
    undo: useCallback(() => step(past, future), [step]),
    redo: useCallback(() => step(future, past), [step]),
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
