// ABOUTME: 撤销/重做：记录文稿快照，连续拖动或同一文本框的连续输入合并为一步；切换文稿时清空。
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

export function createHistory<T>(limit = 100) {
  let past: T[] = [];
  let future: T[] = [];
  let lastKey = "";
  let lastAt = 0;
  return {
    record(previous: T, key = "", now = Date.now()) {
      if (key && key === lastKey && now - lastAt < 1500) {
        lastAt = now;
        future = [];
        return;
      }
      past.push(previous);
      if (past.length > limit) past.shift();
      future = [];
      lastKey = key;
      lastAt = now;
    },
    undo(current: T): T | undefined {
      const previous = past.pop();
      if (previous === undefined) return undefined;
      future.push(current);
      lastKey = "";
      return previous;
    },
    redo(current: T): T | undefined {
      const next = future.pop();
      if (next === undefined) return undefined;
      past.push(current);
      lastKey = "";
      return next;
    },
    clear() {
      past = [];
      future = [];
      lastKey = "";
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
  };
}

export function useHistory<T>(setData: (value: SetStateAction<T>) => void, documentKey: string) {
  const history = useRef(createHistory<T>());
  const [, setVersion] = useState(0);
  useEffect(() => {
    history.current.clear();
    setVersion((v) => v + 1);
  }, [documentKey]);
  const commit = useCallback(
    (update: (previous: T) => T, key?: string) => {
      setData((previous) => {
        const next = update(previous);
        if (next !== previous) history.current.record(previous, key);
        return next;
      });
      setVersion((v) => v + 1);
    },
    [setData],
  );
  const undo = useCallback(() => {
    setData((current) => history.current.undo(current) ?? current);
    setVersion((v) => v + 1);
  }, [setData]);
  const redo = useCallback(() => {
    setData((current) => history.current.redo(current) ?? current);
    setVersion((v) => v + 1);
  }, [setData]);
  return { commit, undo, redo, canUndo: history.current.canUndo, canRedo: history.current.canRedo };
}
