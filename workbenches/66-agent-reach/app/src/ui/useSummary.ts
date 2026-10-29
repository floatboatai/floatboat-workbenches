// ABOUTME: 可选的 Floatboat 模型概括：按需检查 Host、生成草稿、插入研究小结或丢弃。

import { useRef, useState, type RefObject } from "react";
import { request } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import { sourceItem, type Collection } from "../contracts/research.ts";
import { summaryMaterial, summaryDraftValue } from "../contracts/summary.ts";

export type HostState = { llm: "unknown" | "checking" | "available" | "not-connected" | "unavailable"; message: string };
type Desk = {
  data: Collection;
  draft: Record<string, unknown>;
  setData: (v: Collection | ((d: Collection) => Collection)) => void;
  setDraft: (v: (d: Record<string, unknown>) => Record<string, unknown>) => void;
  setError: (v: string) => void;
  setNotice: (v: string) => void;
  report: (e: unknown) => void;
};

export function useSummary(p: Desk, epoch: RefObject<string>) {
  const [summarizing, setSummarizing] = useState(false),
    [host, setHost] = useState<HostState>({ llm: "unknown", message: "" });
  const summaryLock = useRef(false);
  const summary = summaryDraftValue(p.draft.summary);
  const summaryFocus =
    typeof p.draft.summaryFocus === "string" ? p.draft.summaryFocus : "";
  const summaryPick = Array.isArray(p.draft.summaryPick)
    ? p.draft.summaryPick.filter(
        (x): x is string =>
          typeof x === "string" && p.data.sources.some((s) => s.id === x),
      )
    : p.data.sources.filter((s) => s.status !== "unreviewed").map((s) => s.id).slice(0, 8);
  async function checkHost() {
    setHost({ llm: "checking", message: "正在检查 Floatboat 模型…" });
    try {
      const r = await request("/api/host/status");
      if (!isRecord(r) || typeof r.llm !== "string" || typeof r.message !== "string")
        throw new Error();
      setHost({ llm: r.llm as HostState["llm"], message: r.message });
    } catch {
      setHost({ llm: "unavailable", message: "无法检查 Floatboat 状态，请稍后重试。" });
    }
  }
  function setSummaryPick(ids: string[]) {
    p.setDraft((d) => ({ ...d, summaryPick: ids.slice(0, 8) }));
  }
  function setSummaryFocus(text: string) {
    p.setDraft((d) => ({ ...d, summaryFocus: text }));
  }
  async function summarize() {
    if (summaryLock.current) return;
    summaryLock.current = true;
    setSummarizing(true);
    p.setError("");
    const key = epoch.current,
      ids = summaryPick;
    try {
      const material = summaryMaterial(p.data, ids, summaryFocus);
      if (!material.sources.length) throw new Error("请至少勾选一条来源");
      const r = await request("/api/summarize", {
        method: "POST",
        body: JSON.stringify(material),
      });
      if (!isRecord(r) || typeof r.text !== "string") throw new Error("模型返回无效");
      const draft = summaryDraftValue({
        text: r.text,
        model: typeof r.model === "string" ? r.model : "",
        requestId: typeof r.requestId === "string" ? r.requestId : "",
        at: new Date().toISOString(),
        sourceIds: ids,
        focus: summaryFocus,
      });
      if (epoch.current === key && draft) p.setDraft((d) => ({ ...d, summary: draft }));
    } catch (e) {
      if (epoch.current === key) {
        p.report(e);
        if (e instanceof Error && "status" in e && e.status === 503)
          setHost({ llm: "not-connected", message: e.message });
      }
    } finally {
      summaryLock.current = false;
      setSummarizing(false);
    }
  }
  function insertSummary() {
    if (!summary) return;
    const titles = summary.sourceIds
      .map((id, i) => {
        const s = p.data.sources.find((x) => x.id === id);
        if (!s) return null;
        const it = sourceItem(p.data, s);
        return `［${i + 1}］${it.title ?? it.url ?? "未命名来源"}`;
      })
      .filter(Boolean)
      .join("；");
    const block =
      `\n\n—— 模型概括（${summary.model || "Floatboat"}，${summary.at.slice(0, 10)}，未经人工核对）——\n` +
      summary.text +
      (titles ? `\n来源编号：${titles}` : "");
    p.setData((d) => ({ ...d, brief: (d.brief.trimEnd() + block).trimStart().slice(0, 20000) }));
    p.setDraft((d) => {
      const n = { ...d };
      delete n.summary;
      return n;
    });
    p.setNotice("概括已插入研究小结末尾，请对照来源核对后再使用。");
  }
  function discardSummary() {
    p.setDraft((d) => {
      const n = { ...d };
      delete n.summary;
      return n;
    });
  }
  return {
    host,
    checkHost,
    summary,
    summaryFocus,
    summaryPick,
    setSummaryPick,
    setSummaryFocus,
    summarize,
    summarizing,
    insertSummary,
    discardSummary,
  };
}
