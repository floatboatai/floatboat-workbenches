// Explicit send: persist the initiation record, run once on the server, classify
// the outcome, and reconcile lost responses from the server ledger (never resend).
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { compactResults, receiptValue, snapshotOf, type Collection, type Receipt, type RequestModel, type SourceFile } from "../contracts/bruno";
import { request, type useProjects } from "./workspace";
import { SAFE_METHODS } from "./model";
import type { ResponseTab } from "./ResponseConsole";

export type Workbench = ReturnType<typeof useProjects<Collection>>;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "操作失败。");

export interface SendContext {
  file: SourceFile | undefined;
  model: RequestModel | null;
  rawPending: boolean;
  blocked: string[];
  pendingModel: RequestModel | null;
  composeNow: (base: SourceFile, model: RequestModel) => Promise<{ source: string; parsed: { blocked: string[] } } | null>;
  activeEnv: string;
  secrets: Record<string, Record<string, string>>;
  last: Receipt | undefined;
  busy: () => boolean;
}

export function useSender(latest: MutableRefObject<Workbench>) {
  const p = latest.current;
  const [running, setRunning] = useState<string | null>(null);
  const runRef = useRef<string | null>(null);
  const [live, setLive] = useState<Record<string, Receipt>>({});
  const [runtime, setRuntime] = useState<Record<string, string>>({});
  const [confirmUnknown, setConfirmUnknown] = useState(false);
  const [sendError, setSendError] = useState("");
  const [shownReceipt, setShownReceipt] = useState<string | null>(null);
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  useEffect(() => {
    setRuntime({});
    setLive({});
    setShownReceipt(null);
    setConfirmUnknown(false);
    setSendError("");
    runRef.current = null;
    setRunning(null);
  }, [p.documentKey]);

  const apply = useCallback(
    (receipt: Receipt, key: string) => {
      if (latest.current.documentKey !== key) return;
      setLive((m) => ({ ...m, [receipt.id]: receipt }));
      if (receipt.captured) setRuntime((r) => ({ ...r, ...receipt.captured }));
      latest.current.setData((v) => ({
        ...v,
        results: compactResults(
          v.results.some((r) => r.id === receipt.id)
            ? v.results.map((r) => (r.id === receipt.id ? snapshotOf(receipt) : r))
            : [...v.results, snapshotOf(receipt)],
        ),
      }));
    },
    [latest],
  );

  const reconcile = useCallback(
    async (r: Receipt, quiet = false) => {
      const key = latest.current.documentKey;
      try {
        const value = await request("/api/http/" + r.id);
        if (value === null) {
          if (r.state === "initiated")
            apply({ ...r, state: "failed", errorKind: "service", message: "工作台服务没有这次发送的记录：请求未发出，可直接重试。" }, key);
          else if (!quiet) latest.current.setNotice("服务器没有此操作记录；不会重发请求。");
          return;
        }
        const receipt = receiptValue(value);
        if (receipt.requestId !== r.requestId) throw new Error("回执不属于当前请求。");
        apply(receipt, key);
      } catch (e) {
        if (!quiet && latest.current.documentKey === key) latest.current.report(e);
      }
    },
    [apply, latest],
  );
  // Receipts that were mid-flight when the page closed are read back once (never resent).
  const reconciled = useRef("");
  useEffect(() => {
    if (p.loading || reconciled.current === p.documentKey) return;
    reconciled.current = p.documentKey;
    for (const r of p.data.results) if (r.state === "initiated" && r.id !== runRef.current) void reconcile(r, true);
  }, [p.loading, p.documentKey, p.data.results, reconcile]);

  async function send(ctx: SendContext, force = false) {
    const { file, model } = ctx;
    if (!file || !model || runRef.current || ctx.busy()) return;
    setSendError("");
    if (ctx.rawPending) return setSendError("Bru 源文件有未解析通过的修改，请先在「Bru 源」中修复。");
    if (ctx.blocked.length && !ctx.pendingModel) return setSendError(ctx.blocked.join(" "));
    if (!force && ctx.last?.state === "unknown" && !SAFE_METHODS.includes(model.method)) return setConfirmUnknown(true);
    setConfirmUnknown(false);
    const pp = latest.current;
    const key = pp.documentKey,
      id = crypto.randomUUID();
    runRef.current = id;
    setRunning(id);
    try {
      let source = file.source;
      if (ctx.pendingModel) {
        const composed = await ctx.composeNow(file, ctx.pendingModel);
        if (!composed) return;
        source = composed.source;
        if (composed.parsed.blocked.length) throw new Error(composed.parsed.blocked.join(" "));
      }
      const filesNow = latest.current.data.files.map((f) => (f.id === file.id ? { ...f, source } : f));
      const initial: Receipt = {
        id,
        documentId: key,
        requestId: file.id,
        state: "initiated",
        method: model.method,
        url: model.url,
        source,
        startedAt: new Date().toISOString(),
        ...(ctx.activeEnv ? { environment: ctx.activeEnv } : {}),
      };
      setShownReceipt(id);
      const saved = await pp.save({
        ...latest.current.data,
        files: filesNow,
        results: compactResults([...latest.current.data.results, initial]),
      });
      if (latest.current.documentKey !== key) return;
      if (!saved)
        return apply(
          { ...initial, state: "failed", errorKind: "invalid", message: "发起记录未能保存，请求未发送。请恢复保存（集合菜单 → 立即保存）后重试。" },
          key,
        );
      try {
        const receipt = receiptValue(
          await request("/api/http/run", {
            method: "POST",
            body: JSON.stringify({
              operationId: id,
              documentId: key,
              requestId: file.id,
              data: { files: filesNow, results: [], notes: "" },
              environment: ctx.activeEnv || undefined,
              secrets: ctx.activeEnv ? (ctx.secrets[ctx.activeEnv] ?? {}) : {},
              runtime,
            }),
          }),
        );
        apply(receipt, key);
        setResponseTab(receipt.assertions?.some((a) => !a.passed) ? "assert" : "body");
        if (window.matchMedia("(max-width: 960px)").matches)
          document.getElementById("response")?.scrollIntoView({ block: "start" });
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status && status < 500) return apply({ ...initial, state: "failed", errorKind: "invalid", message: errorText(e) }, key);
        // The page lost contact with its own service: read the ledger instead of guessing.
        for (const delay of [300, 1200]) {
          await new Promise((r) => setTimeout(r, delay));
          try {
            const v = await request("/api/http/" + id);
            return apply(
              v === null
                ? { ...initial, state: "failed", errorKind: "service", message: "工作台服务没有收到这次发送：请求未发出，可直接重试。" }
                : receiptValue(v),
              key,
            );
          } catch {
            /* keep trying */
          }
        }
        apply(
          {
            ...initial,
            state: SAFE_METHODS.includes(model.method) ? "failed" : "unknown",
            errorKind: "service",
            message: "无法联系工作台服务，未拿到回执。服务恢复后点「读取回执」核对，不会自动重发。",
          },
          key,
        );
      }
    } catch (e) {
      if (latest.current.documentKey === key) setSendError(errorText(e));
    } finally {
      if (latest.current.documentKey === key) {
        runRef.current = null;
        setRunning(null);
      }
    }
  }
  const cancel = () =>
    running &&
    void request("/api/http/" + running + "/cancel", { method: "POST" })
      .then(() => latest.current.setNotice("已请求取消。"))
      .catch(latest.current.report);
  return {
    running,
    runRef,
    live,
    runtime,
    clearRuntime: () => setRuntime({}),
    send,
    cancel,
    reconcile,
    confirmUnknown,
    setConfirmUnknown,
    sendError,
    setSendError,
    shownReceipt,
    setShownReceipt,
    responseTab,
    setResponseTab,
  };
}
