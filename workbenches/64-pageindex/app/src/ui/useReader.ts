import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord, boundedText } from "../contracts/project.ts";
import {
  seed,
  readerValue,
  indexValue,
  runValue,
  type DocumentIndex,
  type QuestionRun,
  type Answer,
} from "../contracts/reader.ts";
import { blobRequest, fromBase64, toBase64, uploadPdf } from "./files.ts";
export function useReader() {
  const project = useProjects(seed, readerValue, "未命名阅读项目", {
    storageKey: "pageindex-reader-v1",
  });
  const [index, setIndex] = useState<DocumentIndex | null>(null),
    [runs, setRuns] = useState<QuestionRun[]>([]),
    [operation, setOperation] = useState("");
  const [status, setStatus] = useState({
    parser: false,
    model: false,
    parserMessage: "正在检查服务…",
  });
  const epoch = useRef(project.documentKey);
  epoch.current = project.documentKey;
  const file = useRef<HTMLInputElement>(null),
    portable = useRef<HTMLInputElement>(null);
  const sourceId = project.data.document?.id,
    currentId = project.current?.id;
  const pending = isRecord(project.draft.pendingQuestion)
    ? project.draft.pendingQuestion
    : null;
  const mutable = !project.loading && !project.busy && !operation;
  async function refreshStatus() {
    try {
      const raw = await request("/api/status");
      if (isRecord(raw))
        setStatus({
          parser: raw.parser === true,
          model: raw.model === true,
          parserMessage:
            typeof raw.parserMessage === "string"
              ? raw.parserMessage
              : "服务状态未知",
        });
    } catch {
      setStatus({
        parser: false,
        model: false,
        parserMessage: "无法读取服务状态",
      });
    }
  }
  useEffect(() => {
    void refreshStatus();
  }, []);
  useEffect(() => {
    let live = true;
    setIndex(null);
    if (sourceId)
      void request(`/api/documents/${sourceId}`)
        .then((raw) => {
          if (live) setIndex(indexValue(raw));
        })
        .catch((e) => {
          if (live) project.report(e);
        });
    return () => {
      live = false;
    };
  }, [sourceId, project.documentKey]);
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
    const timer = setInterval(() => void load(), 1800);
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
  async function replaceDocument(next: DocumentIndex) {
    if (
      await project.replace(
        { ...seed, document: next.source },
        next.source.name.replace(/\.pdf$/i, "").slice(0, 120),
      )
    ) {
      setIndex(next);
      project.setNotice("已打开文档，编辑内容会自动保存。");
    }
  }
  async function loadPdf(selected: File) {
    if (selected.size > 8 * 1024 * 1024) {
      project.report(new Error("PDF不能超过8MiB。"));
      return;
    }
    const key = epoch.current;
    setOperation("准备上传…");
    try {
      const doc = await uploadPdf(
        new Uint8Array(await selected.arrayBuffer()),
        selected.name,
        setOperation,
      );
      if (epoch.current === key) await replaceDocument(doc);
    } catch (e) {
      if (epoch.current === key) project.report(e);
    } finally {
      setOperation("");
    }
  }
  async function sample() {
    const key = epoch.current;
    setOperation("正在索引示例手册…");
    try {
      const doc = indexValue(await request("/api/sample", { method: "POST" }));
      if (epoch.current === key) await replaceDocument(doc);
    } catch (e) {
      if (epoch.current === key) project.report(e);
    } finally {
      setOperation("");
    }
  }
  async function ask() {
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
      setOperation("");
    }
  }
  function answers(): Answer[] {
    return [
      ...project.data.archivedAnswers,
      ...runs.flatMap((r) => (r.result ? [r.result] : [])),
    ].filter((a, i, list) => list.findIndex((x) => x.id === a.id) === i);
  }
  async function exportProject() {
    setOperation("正在准备完整项目…");
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
      const pdf = sourceId
        ? toBase64(
            new Uint8Array(
              await (
                await blobRequest(`/api/documents/${sourceId}/pdf`)
              ).arrayBuffer(),
            ),
          )
        : null;
      download(
        new Blob(
          [
            JSON.stringify(
              {
                format: "floatboat-pageindex",
                version: 1,
                title: project.title,
                data: { ...project.data, archivedAnswers: all },
                draft: project.draft,
                pdf,
                runLedger: latest,
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
        "pageindex-project.json",
      );
    } catch (e) {
      project.report(e);
    } finally {
      setOperation("");
    }
  }
  async function importProject(selected: File) {
    const key = epoch.current;
    setOperation("正在读取完整项目…");
    try {
      if (selected.size > 15 * 1024 * 1024)
        throw new Error("项目文件超过15MiB。");
      const raw: unknown = JSON.parse(await selected.text());
      if (
        !isRecord(raw) ||
        raw.format !== "floatboat-pageindex" ||
        raw.version !== 1
      )
        throw new Error("不是PageIndex工作台项目。");
      const data = readerValue(raw.data),
        title = boundedText(raw.title, 120);
      if (data.document) {
        if (typeof raw.pdf !== "string") throw new Error("项目没有原PDF。");
        const doc = await uploadPdf(
          fromBase64(raw.pdf),
          data.document.name,
          setOperation,
        );
        if (
          doc.source.id !== data.document.id ||
          doc.source.pages !== data.document.pages
        )
          throw new Error("项目索引与原PDF不一致。");
      }
      const extra = isRecord(raw.draft) ? { ...raw.draft } : {};
      if (Array.isArray(raw.runLedger) && raw.runLedger.length) {
        if (raw.runLedger.length > 15)
          throw new Error("导入任务记录超过容量。");
        extra.importedRunLedger = raw.runLedger
          .map(runValue)
          .map((r) => ({ ...r, result: null }));
      }
      if (extra.pendingQuestion) {
        extra.importedPendingQuestion = extra.pendingQuestion;
        delete extra.pendingQuestion;
      }
      if (epoch.current === key) await project.replace(data, title, extra);
    } catch (e) {
      if (epoch.current === key) project.report(e);
    } finally {
      setOperation("");
    }
  }
  function exportReview() {
    const text = [
      `# ${project.title}`,
      ...project.data.notes.map(
        (n) =>
          `## 第${n.page}页\n\n> ${n.quote.replace(/\n/g, "\n> ")}\n\n${n.text}`,
      ),
      ...answers().map(
        (a) =>
          `## ${a.question}\n\n${a.answer}\n\n${a.citations.map((c) => `- 第${c.page}页：${c.quote}`).join("\n")}`,
      ),
    ].join("\n\n");
    download(
      new Blob([text], { type: "text/markdown" }),
      "pageindex-review.md",
    );
  }
  return {
    project,
    index: index?.source.id === sourceId ? index : null,
    runs,
    operation,
    status,
    mutable,
    pending,
    file,
    portable,
    refreshStatus,
    loadPdf,
    sample,
    ask,
    answers: answers(),
    exportProject,
    importProject,
    exportReview,
  };
}
