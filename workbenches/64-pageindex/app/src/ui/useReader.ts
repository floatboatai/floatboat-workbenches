import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord } from "../contracts/project.ts";
import { parseArchive, reviewMarkdown, safeName, type Archive } from "../contracts/archive.ts";
import {
  seed,
  readerValue,
  indexValue,
  runValue,
  activeStructure,
  MAX_PDF,
  MAX_NOTES,
  OUTLINE_SOURCES,
  type DocumentIndex,
  type QuestionRun,
  type Answer,
  type OutlineSource,
} from "../contracts/reader.ts";
import { blobRequest, fromBase64, toBase64, uploadDocument, type Opened } from "./files.ts";
import { openPdf, pdfError } from "./pdf.ts";
import { useService } from "./useService.ts";
export type { ServiceStatus, OutlineJob } from "./useService.ts";

export type PdfState = "none" | "loading" | "ready" | "missing" | "error";
export type Focus = { page: number; quote: string; key: number } | null;

export function useReader() {
  const project = useProjects(seed, readerValue, "未命名阅读", {
    storageKey: "pageindex-reader-v1",
  });
  const [index, setIndex] = useState<DocumentIndex | null>(null),
    [pdf, setPdf] = useState<{ id: string; doc: PDFDocumentProxy } | null>(null),
    [pdfState, setPdfState] = useState<PdfState>("none"),
    [pdfMessage, setPdfMessage] = useState(""),
    [runs, setRuns] = useState<QuestionRun[]>([]),
    [operation, setOperation] = useState(""),
    [focus, setFocusState] = useState<Focus>(null),
    [reload, setReload] = useState(0);
  const operationLock = useRef(false),
    handoff = useRef<(Opened & { id: string }) | null>(null),
    focusKey = useRef(0);
  function begin() {
    if (operationLock.current || project.loading || project.busy) return false;
    operationLock.current = true;
    return true;
  }
  function end() {
    operationLock.current = false;
    setOperation("");
  }
  const epoch = useRef(project.documentKey);
  epoch.current = project.documentKey;
  const file = useRef<HTMLInputElement>(null),
    portable = useRef<HTMLInputElement>(null),
    recoveryFile = useRef<HTMLInputElement>(null);
  const sourceId = project.data.document?.id,
    currentId = project.current?.id;
  const pending = isRecord(project.draft.pendingQuestion)
    ? project.draft.pendingQuestion
    : null;
  const mutable = !project.loading && !project.busy && !operation;
  const setFocus = useCallback((page: number, quote: string) => {
    focusKey.current++;
    setFocusState({ page, quote, key: focusKey.current });
  }, []);
  async function navigate(action: () => Promise<boolean>) {
    if (!begin()) return false;
    setOperation("正在切换阅读…");
    try {
      return await action();
    } finally {
      end();
    }
  }
  const { status, refreshStatus, job, buildOutline } = useService(
    sourceId,
    project.documentKey,
    async (id, mode) => {
      const fresh = indexValue(await request(`/api/documents/${id}`));
      if (project.data.document?.id !== id) return;
      setIndex(fresh);
      project.setData((d) => ({ ...d, outline: mode }));
      project.setNotice("PageIndex章节树已生成，目录已切换到新树。");
    },
    project.report,
  );
  // Document + original PDF lifecycle, keyed by the working copy and source hash.
  useEffect(() => {
    let live = true,
      task: PDFDocumentLoadingTask | null = null;
    setIndex(null);
    setPdf(null);
    setPdfMessage("");
    setFocusState(null);
    if (!sourceId) {
      setPdfState("none");
      return;
    }
    setPdfState("loading");
    const given = handoff.current?.id === sourceId ? handoff.current : null;
    handoff.current = null;
    void (async () => {
      try {
        if (!given) {
          const known = await request(`/api/documents/${sourceId}/stored`);
          if (!live) return;
          if (!isRecord(known) || known.stored !== true || known.original !== true) {
            if (isRecord(known) && known.stored === true)
              setIndex(indexValue(await request(`/api/documents/${sourceId}`)));
            if (live) setPdfState("missing");
            return;
          }
        }
        const next = given?.index ?? indexValue(await request(`/api/documents/${sourceId}`));
        if (!live) return;
        setIndex(next);
        task =
          given?.task ??
          openPdf(
            new Uint8Array(
              await (await blobRequest(`/api/documents/${sourceId}/pdf`)).arrayBuffer(),
            ),
          );
        if (!live) {
          void task.destroy();
          return;
        }
        const doc = await task.promise;
        if (!live) return;
        setPdf({ id: sourceId, doc });
        setPdfState("ready");
      } catch (e) {
        if (!live) return;
        if ((e as { status?: number }).status === 404) setPdfState("missing");
        else {
          setPdfState("error");
          setPdfMessage(pdfError(e).message);
        }
      }
    })();
    return () => {
      live = false;
      if (task) void task.destroy();
      else if (given?.task) void given.task.destroy();
    };
  }, [sourceId, project.documentKey, reload]);
  useEffect(() => {
    let live = true,
      busy = false;
    setRuns([]);
    const load = async () => {
      if (!currentId || busy) return;
      busy = true;
      try {
        const raw = await request(`/api/projects/${currentId}/questions`);
        if (!Array.isArray(raw)) throw new Error("任务列表格式无效。");
        if (live)
          setRuns(raw.map(runValue).filter((r) => r.documentId === sourceId));
      } catch (e) {
        if (live) project.report(e);
      } finally {
        busy = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 2500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [currentId, sourceId, project.documentKey]);
  useEffect(() => {
    if (!operation) return;
    const stop = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [operation]);
  async function replaceDocument(opened: Opened) {
    const next = opened.index;
    handoff.current = { ...opened, id: next.source.id };
    const meta = next.index.doc_title.trim(),
      generic = meta.length < 4 || /^(untitled|microsoft word|document\d*$|无标题)/i.test(meta);
    const title = (generic ? next.source.name.replace(/\.pdf$/i, "") : meta).slice(0, 120);
    if (await project.replace({ ...seed, document: next.source }, title))
      project.setNotice(
        next.pages.some((p) => p.text.trim())
          ? "已打开文档，阅读位置和摘录会自动保存。"
          : "已打开文档。此PDF没有可提取文字（可能是扫描件），可阅读与按页摘录，但不能检索或提问。",
      );
    else {
      if (opened.task) void opened.task.destroy();
      handoff.current = null;
    }
  }
  async function loadPdf(selected: File, repair = false) {
    if (selected.size > MAX_PDF) {
      project.report(new Error("PDF不能超过64MiB，请拆分后打开。"));
      return;
    }
    if (!begin()) return;
    const key = epoch.current;
    setOperation("正在读取PDF…");
    try {
      const opened = await uploadDocument(
        new Uint8Array(await selected.arrayBuffer()),
        selected.name,
        setOperation,
      );
      if (epoch.current !== key) {
        if (opened.task) void opened.task.destroy();
        return;
      }
      if (repair) {
        if (opened.task) void opened.task.destroy();
        if (
          !project.data.document ||
          opened.index.source.id !== project.data.document.id ||
          opened.index.source.pages !== project.data.document.pages
        )
          throw new Error("这不是此阅读档案对应的原PDF，请选择原始文件。");
        project.setError("");
        const saved = await project.save();
        setReload((n) => n + 1);
        if (saved) project.setNotice("原PDF已补齐，摘录与工作稿已保留。");
      } else await replaceDocument(opened);
    } catch (e) {
      if (epoch.current === key) project.report(e);
    } finally {
      end();
    }
  }
  async function sample(key: "report" | "handbook") {
    if (!begin()) return;
    const at = epoch.current;
    setOperation("正在打开示例…");
    try {
      const page = await blobRequest(`/api/samples/${key}`);
      const name =
        key === "report"
          ? "Riverside Library 2025 Annual Report.pdf"
          : "Harbor Workshop Handbook.pdf";
      const opened = await uploadDocument(
        new Uint8Array(await page.arrayBuffer()),
        name,
        setOperation,
      );
      if (epoch.current === at) await replaceDocument(opened);
      else if (opened.task) void opened.task.destroy();
    } catch (e) {
      if (epoch.current === at) project.report(e);
    } finally {
      end();
    }
  }
  async function ask() {
    if (!begin()) return;
    const key = epoch.current;
    setOperation(pending ? "正在核对提交…" : "正在提交提问…");
    try {
      let command = pending;
      if (!command) {
        const saved = await project.save();
        if (!saved?.data.document) return;
        command = {
          id: crypto.randomUUID(),
          projectId: saved.id,
          documentId: saved.data.document.id,
          question: saved.data.question,
        };
        project.setDraft((d) => ({ ...d, pendingQuestion: command }));
        if (!(await project.save())) return;
      }
      const run = runValue(
        await request("/api/questions", {
          method: "POST",
          body: JSON.stringify(command),
        }),
      );
      if (epoch.current !== key) return;
      setRuns((list) => [run, ...list.filter((r) => r.id !== run.id)]);
      project.setDraft((d) => {
        const next = { ...d };
        delete next.pendingQuestion;
        return next;
      });
    } catch (e) {
      if (epoch.current === key) project.report(e);
    } finally {
      end();
    }
  }
  function answers(): Answer[] {
    return [
      ...project.data.archivedAnswers,
      ...runs.flatMap((r) => (r.result ? [r.result] : [])),
    ].filter((a, i, list) => list.findIndex((x) => x.id === a.id) === i);
  }
  function addNote(page: number, quote: string) {
    if (project.data.notes.length >= MAX_NOTES) {
      project.report(new Error(`每份阅读档案最多${MAX_NOTES}条摘录。`));
      return null;
    }
    const id = crypto.randomUUID();
    project.setData((d) => ({
      ...d,
      notes: [{ id, page, quote: quote.trim().slice(0, 1000), text: "" }, ...d.notes],
    }));
    return id;
  }
  async function exportProject() {
    if (!begin()) return;
    setOperation("正在准备阅读档案…");
    try {
      let latest = runs;
      if (currentId) {
        const raw = await request(`/api/projects/${currentId}/questions`);
        if (!Array.isArray(raw)) throw new Error("任务列表无效。");
        latest = raw.map(runValue);
      }
      const all = [
        ...project.data.archivedAnswers,
        ...latest.flatMap((r) => (r.result ? [r.result] : [])),
      ].filter((a, i, list) => list.findIndex((x) => x.id === a.id) === i);
      const pdfBytes = sourceId
        ? toBase64(
            new Uint8Array(
              await (await blobRequest(`/api/documents/${sourceId}/pdf`)).arrayBuffer(),
            ),
          )
        : null;
      const archive: Archive = {
        format: "floatboat-pageindex",
        version: 1,
        title: project.title,
        data: { ...project.data, archivedAnswers: all },
        draft: project.draft,
        pdf: pdfBytes,
        outlines: index?.outlines ?? [],
        runLedger: latest,
      };
      download(
        new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }),
        `${safeName(project.title)}.pageindex.json`,
      );
    } catch (e) {
      project.report(e);
    } finally {
      end();
    }
  }
  async function importProject(selected: File) {
    if (!begin()) return;
    const key = epoch.current;
    setOperation("正在读取阅读档案…");
    try {
      if (selected.size > 100 * 1024 * 1024) throw new Error("阅读档案文件超过100MiB。");
      let input: unknown;
      try {
        input = JSON.parse(await selected.text());
      } catch {
        throw new Error("不是PageIndex阅读档案或恢复草稿（JSON无效）。");
      }
      const parsed = parseArchive(input),
        source = parsed.data.document;
      let opened: Opened | null = null;
      if (source && parsed.pdf) {
        opened = await uploadDocument(fromBase64(parsed.pdf), source.name, setOperation);
        if (opened.index.source.id !== source.id || opened.index.source.pages !== source.pages)
          throw new Error("阅读档案与原PDF不一致。");
        for (const tree of parsed.outlines)
          opened = {
            ...opened,
            index: indexValue(
              await request(`/api/documents/${source.id}/outlines/import`, {
                method: "POST",
                body: JSON.stringify({ tree }),
              }),
            ),
          };
      }
      if (epoch.current !== key) {
        if (opened?.task) void opened.task.destroy();
        return;
      }
      if (opened) handoff.current = { ...opened, id: opened.index.source.id };
      if (await project.replace(parsed.data, parsed.title, parsed.extra)) {
        project.setNotice(
          parsed.recovery
            ? "已恢复为新副本。恢复稿不包含原PDF；如缺失，请补齐原PDF。未确认提问不会重放。"
            : "已导入为新的阅读档案，历史回答保留为导入记录。",
        );
      } else if (opened?.task) {
        void opened.task.destroy();
        handoff.current = null;
      }
    } catch (e) {
      if (epoch.current === key) project.report(e);
    } finally {
      end();
    }
  }
  function exportReview() {
    const structure = index ? activeStructure(index, project.data.outline).structure : [];
    download(
      new Blob([reviewMarkdown(project.title, project.data, answers(), structure, (p) => index?.pages[p - 1]?.text ?? "")], {
        type: "text/markdown",
      }),
      `${safeName(project.title)}-审阅.md`,
    );
  }
  return {
    project,
    index: index?.source.id === sourceId ? index : null,
    pdf: pdf && pdf.id === sourceId ? pdf.doc : null,
    pdfState,
    pdfMessage,
    runs,
    operation,
    status,
    job,
    focus,
    setFocus,
    mutable,
    pending,
    file,
    portable,
    recoveryFile,
    refreshStatus,
    loadPdf,
    sample,
    buildOutline,
    ask,
    addNote,
    answers: answers(),
    exportProject,
    importProject,
    exportReview,
    newProject: () => navigate(() => project.fresh()),
    openProject: (id: string) => navigate(() => project.open(id)),
  };
}
