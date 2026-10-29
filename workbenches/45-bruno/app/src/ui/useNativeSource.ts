// Keeps the structured request editor and the native .bru source in sync, both ways.
// Structured edits are saved as a draft {model, hash:null}, composed by the official
// serializer after a short pause, then tied to the produced source by its hash.
// Raw source edits are parsed by the official parser and adopted only when valid.
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  fileKind,
  parseResult,
  requestModel,
  type Collection,
  type Parsed,
  type RequestModel,
  type SourceFile,
} from "../contracts/bruno";
import { isRecord } from "../contracts/project";
import { sourceHash } from "./model";
import { bru } from "./native";
import type { EnvHost } from "./useEnvironments";

export type ParseState = Parsed | { error: string };
type ReqEntry = { model: RequestModel; hash: string | null };
const errorText = (e: unknown, fallback = "操作失败。") => (e instanceof Error ? e.message : fallback);

function decodeReq(v: unknown): ReqEntry | null {
  try {
    if (!isRecord(v)) return null;
    return { model: requestModel(v.model), hash: typeof v.hash === "string" ? v.hash : null };
  } catch {
    return null;
  }
}

export function useNativeSource(latest: MutableRefObject<EnvHost>, file: SourceFile | undefined, extraToParse: SourceFile[]) {
  const p = latest.current;
  const [parsed, setParsed] = useState<Record<string, ParseState>>({});
  const [composeError, setComposeError] = useState<Record<string, string>>({});
  const [rawError, setRawError] = useState<Record<string, string>>({});
  useEffect(() => {
    setComposeError({});
    setRawError({});
  }, [p.documentKey]);
  const cacheParsed = useCallback((source: string, value: ParseState) => {
    setParsed((m) => {
      const next = { ...m, [sourceHash(source)]: value };
      const keys = Object.keys(next);
      if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete next[k];
      return next;
    });
  }, []);

  const toParse = useMemo(() => (file ? [file, ...extraToParse] : extraToParse), [file, extraToParse]);
  const inflight = useRef(new Set<string>());
  useEffect(() => {
    for (const f of toParse) {
      const hash = sourceHash(f.source);
      if (parsed[hash] || inflight.current.has(hash)) continue;
      inflight.current.add(hash);
      const snapshot = { ...f };
      void bru("/api/bru/parse", snapshot)
        .then((v) => cacheParsed(snapshot.source, parseResult(v)))
        .catch((e) => cacheParsed(snapshot.source, { error: errorText(e, "解析失败。") }))
        .finally(() => inflight.current.delete(hash));
    }
  }, [toParse, parsed, cacheParsed]);

  const fileId = file?.id ?? "";
  const kind = file ? fileKind(file.path) : null;
  const reqRaw = p.draft["req-" + fileId];
  const reqEntry = useMemo(() => decodeReq(reqRaw), [reqRaw]);
  const rawDraft = typeof p.draft["raw-" + fileId] === "string" ? (p.draft["raw-" + fileId] as string) : undefined;
  const current = file ? parsed[sourceHash(file.source)] : undefined;
  const currentParsed = current && !("error" in current) ? current : null;
  const model: RequestModel | null =
    kind !== "request" || !file
      ? null
      : reqEntry && (reqEntry.hash === null || reqEntry.hash === sourceHash(file.source))
        ? reqEntry.model
        : (currentParsed?.model ?? null);

  const setModel = useCallback(
    (next: RequestModel) => {
      if (fileId) latest.current.setDraft((v) => ({ ...v, ["req-" + fileId]: { model: next, hash: null } }));
    },
    [fileId, latest],
  );
  const setRaw = useCallback(
    (text: string) => {
      if (fileId) latest.current.setDraft((v) => ({ ...v, ["raw-" + fileId]: text }));
    },
    [fileId, latest],
  );

  /** Composes a structured model now (used by the debounce and by Send). */
  const composeNow = useCallback(
    async (base: SourceFile, sent: RequestModel) => {
      const key = latest.current.documentKey;
      const r = await bru("/api/bru/compose", { file: base, model: sent });
      if (!isRecord(r) || typeof r.source !== "string") throw new Error("原生序列化失败。");
      const source = r.source,
        result = parseResult(r.parsed);
      if (latest.current.documentKey !== key) return null;
      cacheParsed(source, result);
      latest.current.setData((v: Collection) => ({
        ...v,
        files: v.files.map((f) => (f.id === base.id ? { ...f, source } : f)),
      }));
      latest.current.setDraft((v) => {
        const cur = v["req-" + base.id];
        if (!isRecord(cur) || cur.model !== sent) return v;
        return { ...v, ["req-" + base.id]: { model: sent, hash: sourceHash(source) } };
      });
      setComposeError((m) => ({ ...m, [base.id]: "" }));
      return { source, parsed: result };
    },
    [latest, cacheParsed],
  );
  useEffect(() => {
    if (!file || !reqEntry || reqEntry.hash !== null || rawDraft !== undefined) return;
    const key = p.documentKey,
      base = { ...file };
    const timer = setTimeout(() => {
      composeNow(base, reqEntry.model).catch((e) => {
        if (latest.current.documentKey === key) setComposeError((m) => ({ ...m, [base.id]: errorText(e) }));
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [reqEntry, file?.id, p.documentKey, rawDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!file || rawDraft === undefined) return;
    const key = p.documentKey,
      id = file.id,
      text = rawDraft,
      base = { ...file };
    const finish = () => {
      latest.current.setData((v: Collection) => ({
        ...v,
        files: v.files.map((f) => (f.id === id ? { ...f, source: text } : f)),
      }));
      latest.current.setDraft((v) => {
        if (v["raw-" + id] !== text) return v;
        const n = { ...v };
        for (const k of ["raw-", "req-", "env-"]) delete n[k + id];
        return n;
      });
      setRawError((m) => ({ ...m, [id]: "" }));
    };
    const timer = setTimeout(() => {
      if (text === base.source) return finish();
      void bru("/api/bru/parse", { ...base, source: text })
        .then((v) => {
          const result = parseResult(v);
          if (latest.current.documentKey !== key) return;
          cacheParsed(text, result);
          finish();
        })
        .catch((e) => {
          if (latest.current.documentKey === key) setRawError((m) => ({ ...m, [id]: errorText(e) }));
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [rawDraft, file?.id, p.documentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceError = (rawDraft !== undefined ? rawError[fileId] : "") || (current && "error" in current ? current.error : "");
  const pendingCompose = reqEntry?.hash === null;
  const syncError = Boolean(composeError[fileId] || rawError[fileId]);
  const syncLabel =
    rawDraft !== undefined
      ? rawError[fileId]
        ? "源文件有错误"
        : "检查源文件…"
      : composeError[fileId]
        ? "未写入：" + composeError[fileId]
        : pendingCompose
          ? "同步中…"
          : "已同步到 .bru";
  return {
    parsed,
    model,
    reqEntry,
    rawDraft,
    currentParsed,
    setModel,
    setRaw,
    composeNow,
    sourceText: rawDraft ?? file?.source ?? "",
    sourceError,
    pendingCompose,
    syncLabel,
    syncError,
  };
}
