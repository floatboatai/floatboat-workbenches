import { useNavigation } from "./navigation.ts";
import { restoreDraftData } from "../contracts/research.ts";
import { decodeProjectImport } from "../contracts/import-project.ts";
import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import {
  seed,
  projectValue,
  queryValue,
  captureValue,
  envelopeValue,
  mergeCapture,
  sourceItem,
  report,
  type Capture,
  type Source,
  type Query,
} from "../contracts/research.ts";
export function useResearchDesk() {
  const base = useProjects(seed, projectValue, "公开来源 · 调研笔记", {
    storageKey: "agent-reach-sources-v1",
    restoreDraftData,
  });
  const navigation = useNavigation();
  const p = {
    ...base,
    busy: base.busy || navigation.transitioning,
    fresh: () => navigation.run(() => base.fresh()),
    open: (...args: Parameters<typeof base.open>) =>
      navigation.run(() => base.open(...args)),
    replace: (...args: Parameters<typeof base.replace>) =>
      navigation.run(() => base.replace(...args)),
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
    [status, setStatus] = useState({
      available: false,
      message: "正在检查采集服务…",
    });
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
  } catch {}
  const chosen = Array.isArray(p.draft.chosen)
    ? p.draft.chosen.filter(
        (x): x is number =>
          typeof x === "number" && Number.isInteger(x) && x >= 0,
      )
    : (candidate?.envelope.items.map((_, i) => i) ?? []);
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
  async function checkStatus() {
    try {
      const r = await request("/api/collector/status");
      if (
        !isRecord(r) ||
        typeof r.available !== "boolean" ||
        typeof r.message !== "string"
      )
        throw new Error("状态无效");
      setStatus({ available: r.available, message: r.message });
    } catch {
      setStatus({
        available: false,
        message: "采集服务未连接；已有资料仍可编辑和导出",
      });
    }
  }
  useEffect(() => {
    void checkStatus();
  }, []);
  async function collect(input: Query = p.data.input) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    p.setError("");
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
      if (epoch.current === key)
        p.setDraft((d) => {
          const n: Record<string, unknown> = {
            ...d,
            candidate: result,
            chosen: result.envelope.items.map((_, i) => i),
          };
          delete n.pendingQuery;
          return n;
        });
    } catch (e) {
      if (epoch.current === key) p.report(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function adopt() {
    if (!candidate) return;
    try {
      const r = mergeCapture(p.data, candidate, chosen);
      p.setData(r.data);
      p.setError("");
      p.setNotice(`已收藏 ${r.added} 条新来源，跳过 ${r.skipped} 条已有来源。`);
    } catch (e) {
      p.report(e);
    }
  }
  function select(id: string) {
    p.setData((d) => ({ ...d, selected: id }));
  }
  function quoteSelection() {
    const selection = window.getSelection();
    if (
      !selection ||
      !body.current?.contains(selection.anchorNode) ||
      !body.current.contains(selection.focusNode)
    ) {
      p.setError("请先在来源正文中选中文字，或将原文粘贴到摘录框。");
      return;
    }
    const text = selection.toString();
    if (text.length > 4000) {
      p.setError("每条摘录最多4000字符，请分段摘录。");
      return;
    }
    setClipDraft({ text });
  }
  function addClip() {
    if (!selected || !item) return;
    try {
      const text = clipText.trim();
      if (!text || text.length > 4000 || !item.text?.includes(text))
        throw new Error("摘录须为来源正文中的原文，最多4000字符。");
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
      "research-collection.project.json",
    );
  }
  function exportReport() {
    download(
      new Blob([report(p.data, p.title)], { type: "text/markdown" }),
      "research-brief.md",
    );
  }
  function exportNative(c: Capture) {
    download(
      new Blob([JSON.stringify(c.envelope, null, 2)], {
        type: "application/json",
      }),
      "agent-reach-result.json",
    );
  }
  async function importFile(f: File) {
    await navigation.run(async () => {
      try {
        if (f.size > 8 * 1024 * 1024) throw new Error("文件超过8MB");
        const raw: unknown = JSON.parse(await f.text()),
          imported = decodeProjectImport(raw);
        if (imported) {
          const ok = await base.replace(
            imported.data,
            imported.title,
            imported.extra,
          );
          if (ok)
            base.setNotice(
              imported.archived
                ? "工作稿已导入为新项目；旧查询仅保留历史记录，不会自动采集。"
                : "已导入为新项目。",
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
              seed,
              c,
              envelope.items.map((_, i) => i),
            ).data
          : seed;
        return await base.replace(data, f.name.replace(/\.json$/i, ""), {
          candidate: c,
          chosen: envelope.items.map((_, i) => i),
        });
      } catch (e) {
        base.report(e);
        return false;
      }
    });
  }
  function applyJson() {
    try {
      const envelope = envelopeValue(JSON.parse(rawJson)),
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
    } catch (e) {
      p.report(e);
    }
  }
  return {
    p,
    busy,
    filter,
    setFilter,
    jsonOpen,
    setJsonOpen,
    status,
    checkStatus,
    file,
    body,
    mutable,
    selected,
    item,
    capture,
    candidate,
    chosen,
    pending,
    clipText,
    clipNote,
    setClipDraft,
    rawJson,
    collect,
    adopt,
    select,
    quoteSelection,
    addClip,
    updateSource,
    removeSource,
    exportProject,
    exportReport,
    exportNative,
    importFile,
    applyJson,
  };
}
