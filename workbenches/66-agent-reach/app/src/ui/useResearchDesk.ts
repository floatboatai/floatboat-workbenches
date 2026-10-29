// ABOUTME: 资料桌业务状态：采集、收件区、收藏去重、摘录、审阅、导入导出与可选模型概括。

import { useNavigation } from "./navigation.ts";
import { decodeProjectImport } from "../contracts/import-project.ts";
import { useMemo, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import {
  empty,
  projectValue,
  restoreDraftData,
  queryValue,
  captureValue,
  envelopeValue,
  mergeCapture,
  sourceItem,
  canonical,
  report,
  type Capture,
  type Source,
  type Query,
} from "../contracts/research.ts";
import { useSummary } from "./useSummary.ts";
import { sample, SAMPLE_TITLE } from "../contracts/sample.ts";

export type View = "list" | "read" | "folder";
const fileStem = (title: string) =>
  (title.trim() || "research").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 60);

export function useResearchDesk() {
  const base = useProjects(sample, projectValue, SAMPLE_TITLE, {
    storageKey: "agent-reach-sources-v1",
    restoreDraftData,
  });
  const navigation = useNavigation();
  const p = {
    ...base,
    busy: base.busy || navigation.transitioning,
    open: (...args: Parameters<typeof base.open>) =>
      navigation.run(() => base.open(...args)),
    remove: () => navigation.run(() => base.remove()),
    setData: (value: Parameters<typeof base.setData>[0]) => {
      if (!navigation.active.current) base.setData(value);
    },
    setDraft: (value: Parameters<typeof base.setDraft>[0]) => {
      if (!navigation.active.current) base.setDraft(value);
    },
    setTitle: (value: Parameters<typeof base.setTitle>[0]) => {
      if (!navigation.active.current) base.setTitle(value);
    },
    save: (...args: Parameters<typeof base.save>) =>
      navigation.active.current ? Promise.resolve(null) : base.save(...args),
  };
  const [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all"),
    [jsonOpen, setJsonOpen] = useState(false),
    [view, setView] = useState<View>("read"),
    [folderTab, setFolderTab] = useState<"clips" | "brief">("clips");
  const epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const lock = useRef(false),
    file = useRef<HTMLInputElement>(null),
    body = useRef<HTMLPreElement>(null);
  const mutable = !p.loading && !p.busy,
    selected = p.data.sources.find((s) => s.id === p.data.selected),
    item = selected ? sourceItem(p.data, selected) : null,
    capture = selected
      ? p.data.captures.find((c) => c.id === selected.captureId)
      : null;
  let candidate: Capture | null = null;
  try {
    if (p.draft.candidate) candidate = captureValue(p.draft.candidate);
  } catch {
    candidate = null;
  }
  const chosen = Array.isArray(p.draft.chosen)
    ? p.draft.chosen.filter(
        (x): x is number =>
          typeof x === "number" && Number.isInteger(x) && x >= 0,
      )
    : (candidate?.envelope.items.map((_, i) => i) ?? []);
  const known = useMemo(() => {
    const keys = new Set<string>();
    for (const s of p.data.sources)
      try {
        keys.add(canonical(sourceItem(p.data, s)));
      } catch {
        /* a missing reference is reported by validation */
      }
    return keys;
  }, [p.data]);
  const pending = isRecord(p.draft.pendingQuery) ? p.draft.pendingQuery : null;
  const clipDrafts = isRecord(p.draft.clipDrafts) ? p.draft.clipDrafts : {},
    clipDraft =
      selected && isRecord(clipDrafts[selected.id])
        ? (clipDrafts[selected.id] as Record<string, unknown>)
        : {};
  const clipText = typeof clipDraft.text === "string" ? clipDraft.text : "",
    clipNote = typeof clipDraft.note === "string" ? clipDraft.note : "";
  function setClipDraft(change: Partial<{ text: string; note: string }>) {
    if (!selected) return;
    p.setDraft((d) => {
      const map = isRecord(d.clipDrafts) ? d.clipDrafts : {},
        value = map[selected.id],
        old = isRecord(value) ? value : {};
      return {
        ...d,
        clipDrafts: { ...map, [selected.id]: { ...old, ...change } },
      };
    });
  }
  const rawJson =
    typeof p.draft.resultJson === "string"
      ? p.draft.resultJson
      : JSON.stringify(candidate?.envelope ?? capture?.envelope ?? {}, null, 2);

  function setInput(change: Partial<Query>) {
    p.setData((s) => ({ ...s, input: { ...s.input, ...change } }));
  }
  async function collect(input: Query = p.data.input) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    p.setError("");
    p.setNotice("");
    const key = epoch.current,
      command = { id: crypto.randomUUID(), input: { ...input } };
    try {
      queryValue(input);
      p.setDraft((d) => ({ ...d, pendingQuery: command }));
      const raw = await request("/api/collect", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!isRecord(raw)) throw new Error("采集响应无效");
      const result = captureValue({
        id: command.id,
        input,
        at: new Date().toISOString(),
        envelope: envelopeValue(raw.envelope),
      });
      if (epoch.current === key) {
        const fresh = result.envelope.items
          .map((it, i) => [it, i] as const)
          .filter(([it]) => {
            try {
              return !known.has(canonical(it));
            } catch {
              return true;
            }
          })
          .map(([, i]) => i);
        p.setDraft((d) => {
          const n: Record<string, unknown> = {
            ...d,
            candidate: result,
            chosen: fresh,
          };
          delete n.pendingQuery;
          return n;
        });
        setView("list");
      }
    } catch (e) {
      if (epoch.current === key) {
        p.report(e);
        p.setDraft((d) => {
          const n = { ...d };
          delete n.pendingQuery;
          return n;
        });
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function dismissCandidate() {
    p.setDraft((v) => {
      const n = { ...v };
      delete n.candidate;
      delete n.chosen;
      return n;
    });
  }
  function adopt() {
    if (!candidate) return;
    try {
      const r = mergeCapture(p.data, candidate, chosen);
      p.setData(r.data);
      dismissCandidate();
      p.setError("");
      p.setNotice(
        r.added
          ? `已收藏 ${r.added} 条来源${r.skipped ? `，跳过 ${r.skipped} 条目录里已有的来源` : ""}。`
          : `选中的 ${r.skipped} 条来源已在目录中，保留原有笔记。`,
      );
      if (r.added) setView("read");
    } catch (e) {
      p.report(e);
    }
  }
  function select(id: string) {
    p.setData((d) => ({ ...d, selected: id }));
    setView("read");
  }
  function quoteSelection() {
    const selection = window.getSelection();
    if (
      !selection ||
      selection.isCollapsed ||
      !body.current?.contains(selection.anchorNode) ||
      !body.current.contains(selection.focusNode)
    ) {
      p.setError("请先在来源正文中选中一段文字。");
      return;
    }
    const text = selection.toString();
    if (text.length > 4000) {
      p.setError("每条摘录最多4000字符，请分段摘录。");
      return;
    }
    p.setError("");
    setClipDraft({ text });
    setFolderTab("clips");
    setView("folder");
  }
  function addClip() {
    if (!selected || !item) return;
    try {
      const text = clipText.trim();
      if (!text || text.length > 4000 || !item.text?.includes(text))
        throw new Error("摘录须是来源正文中的原文（逐字一致），最多4000字符。");
      if (selected.clips.length >= 20) throw new Error("每条来源最多20条摘录");
      const next = projectValue({
        ...p.data,
        sources: p.data.sources.map((s) =>
          s.id === selected.id
            ? {
                ...s,
                clips: [
                  ...s.clips,
                  { id: crypto.randomUUID(), text, note: clipNote },
                ],
              }
            : s,
        ),
      });
      p.setData(next);
      p.setDraft((d) => {
        const map = isRecord(d.clipDrafts) ? { ...d.clipDrafts } : {};
        delete map[selected.id];
        return { ...d, clipDrafts: map };
      });
      p.setError("");
    } catch (e) {
      p.report(e);
    }
  }
  function updateClip(id: string, note: string) {
    if (!selected) return;
    p.setData((data) => ({
      ...data,
      sources: data.sources.map((s) =>
        s.id === selected.id
          ? { ...s, clips: s.clips.map((c) => (c.id === id ? { ...c, note } : c)) }
          : s,
      ),
    }));
  }
  function locateClip(id: string) {
    setView("read");
    requestAnimationFrame(() => {
      const mark = document.getElementById("mark-" + id);
      if (!mark) return;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      // Scroll only the reading pane on wide screens (the page itself stays put);
      // narrow screens scroll the document.
      const pane = mark.closest<HTMLElement>(".pane-read");
      const offset = mark.getBoundingClientRect().top;
      if (pane && pane.scrollHeight > pane.clientHeight + 1)
        pane.scrollTo({ top: pane.scrollTop + offset - pane.getBoundingClientRect().top - pane.clientHeight / 3, behavior });
      else window.scrollTo({ top: window.scrollY + offset - window.innerHeight / 3, behavior });
      mark.classList.remove("flash");
      void mark.offsetWidth;
      mark.classList.add("flash");
    });
  }
  function removeClip(id: string) {
    if (!selected || !confirm("删除这条摘录？")) return;
    p.setData((data) => ({
      ...data,
      sources: data.sources.map((s) =>
        s.id === selected.id ? { ...s, clips: s.clips.filter((c) => c.id !== id) } : s,
      ),
    }));
  }
  function updateSource(change: Partial<Pick<Source, "note" | "status">>) {
    if (!selected) return;
    p.setData((d) => ({
      ...d,
      sources: d.sources.map((s) =>
        s.id === selected.id ? { ...s, ...change } : s,
      ),
    }));
  }
  function removeSource() {
    if (!selected || !confirm("移除这条来源及其摘录？可先导出完整项目。"))
      return;
    const sources = p.data.sources.filter((s) => s.id !== selected.id),
      used = new Set(sources.map((s) => s.captureId));
    p.setData((d) => ({
      ...d,
      sources,
      captures: d.captures.filter((c) => used.has(c.id)),
      selected: sources[0]?.id ?? "",
    }));
    p.setDraft((d) => {
      const map = isRecord(d.clipDrafts) ? { ...d.clipDrafts } : {};
      delete map[selected.id];
      return { ...d, clipDrafts: map };
    });
  }
  function newResearch() {
    return navigation.run(async () => {
      const ok = await base.replace(structuredClone(empty), "未命名调研", {});
      if (ok) {
        base.setNotice("已新建空白调研。从左侧采集条开始，或在「调研」菜单导入原生结果。");
        setView("list");
      }
      return ok;
    });
  }
  function openSample() {
    return navigation.run(async () => {
      const ok = await base.replace(structuredClone(sample), SAMPLE_TITLE, {});
      if (ok) base.setNotice("已打开示例调研的新副本。");
      return ok;
    });
  }
  function exportProject() {
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "floatboat.agent-reach.collection",
              version: 1,
              title: p.title,
              data: p.data,
              extra: p.draft,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      fileStem(p.title) + ".project.json",
    );
  }
  function exportReport() {
    download(
      new Blob([report(p.data, p.title)], { type: "text/markdown" }),
      fileStem(p.title) + ".md",
    );
  }
  function exportNative(c: Capture) {
    download(
      new Blob([JSON.stringify(c.envelope, null, 2)], {
        type: "application/json",
      }),
      `agent-reach-${c.envelope.channel ?? "result"}-${c.envelope.action ?? "read"}.json`,
    );
  }
  async function importFile(f: File) {
    await navigation.run(async () => {
      try {
        if (f.size > 8 * 1024 * 1024) throw new Error("文件超过8MB");
        let raw: unknown;
        try {
          raw = JSON.parse(await f.text());
        } catch {
          throw new Error("不是有效的 JSON 文件");
        }
        const imported = decodeProjectImport(raw);
        if (imported) {
          const ok = await base.replace(
            imported.data,
            imported.title,
            imported.extra,
          );
          if (ok)
            base.setNotice(
              imported.archived
                ? "工作稿已导入为新调研；旧查询仅保留历史记录，不会自动采集。"
                : "已导入为新调研。",
            );
          return ok;
        }
        const envelope = envelopeValue(
            isRecord(raw) && raw.envelope ? raw.envelope : raw,
          ),
          c = captureValue({
            id: crypto.randomUUID(),
            input: {
              channel: envelope.channel ?? "import",
              action: envelope.action ?? "read",
              query: f.name,
            },
            at: new Date().toISOString(),
            envelope,
          });
        const data = envelope.ok
          ? mergeCapture(
              empty,
              c,
              envelope.items.map((_, i) => i),
            ).data
          : empty;
        const ok = await base.replace(data, f.name.replace(/\.json$/i, ""), {
          candidate: c,
          chosen: [],
        });
        if (ok)
          base.setNotice(
            envelope.ok
              ? `已从原生结果新建调研，收藏 ${data.sources.length} 条来源。`
              : "原生结果为失败记录，已放入收件区查看。",
          );
        return ok;
      } catch (e) {
        base.report(e);
        return false;
      }
    });
  }
  function applyJson() {
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        throw new Error("JSON 语法有误，请检查括号与引号。");
      }
      const envelope = envelopeValue(parsed),
        c = captureValue({
          id: crypto.randomUUID(),
          input: {
            channel: envelope.channel ?? "import",
            action: envelope.action ?? "read",
            query: "编辑的结果JSON",
          },
          at: new Date().toISOString(),
          envelope,
        });
      p.setDraft((d) => ({
        ...d,
        candidate: c,
        chosen: envelope.items.map((_, i) => i),
      }));
      p.setError("");
      setJsonOpen(false);
      setView("list");
      p.setNotice("结果已放入收件区，勾选后收藏。");
    } catch (e) {
      p.report(e);
    }
  }
  const summaryApi = useSummary(p, epoch);
  return {
    p,
    busy,
    filter,
    setFilter,
    jsonOpen,
    setJsonOpen,
    view,
    setView,
    folderTab,
    setFolderTab,
    file,
    body,
    mutable,
    selected,
    item,
    capture,
    candidate,
    chosen,
    known,
    pending,
    clipText,
    clipNote,
    setClipDraft,
    rawJson,
    setInput,
    collect,
    adopt,
    dismissCandidate,
    select,
    quoteSelection,
    addClip,
    updateClip,
    locateClip,
    removeClip,
    updateSource,
    removeSource,
    newResearch,
    openSample,
    exportProject,
    exportReport,
    exportNative,
    importFile,
    applyJson,
    ...summaryApi,
  };
}
export type Desk = ReturnType<typeof useResearchDesk>;
