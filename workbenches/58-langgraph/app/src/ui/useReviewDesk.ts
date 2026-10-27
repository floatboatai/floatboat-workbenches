import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace";
import { isRecord, titleValue } from "../contracts/project";
import {
  seed,
  projectValue,
  restoreProjectDraft,
  inputValue,
  recordValue,
  runValue,
  type ReviewRecord,
  type RunView,
  type ReviewDecision,
} from "../contracts/review";
function usableRecord(value: unknown, fallback: ReviewRecord): ReviewRecord {
  try {
    return recordValue(value, false, true);
  } catch {
    return fallback;
  }
}
export function useReviewDesk() {
  const project = useProjects(seed, projectValue, "季度手册交付", {
    storageKey: "langgraph-review-v1",
    restoreDraftData: restoreProjectDraft,
  });
  const [runs, setRuns] = useState<RunView[]>([]),
    [actionBusy, setActionBusy] = useState(false),
    [listError, setListError] = useState("");
  const [model, setModel] = useState({
    available: false,
    message: "正在检查模型连接…",
  });
  const [jsonOpen, setJsonOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    epoch = useRef(project.documentKey);
  epoch.current = project.documentKey;
  const selected =
    runs.find((run) => run.id === project.data.selectedRunId) ?? null;
  const currentId = project.current?.id;
  const listSequence = useRef(0),
    modelSequence = useRef(0);
  const storedReviews = isRecord(project.draft.reviews)
    ? project.draft.reviews
    : {};
  const byRun = selected ? storedReviews[selected.id] : null;
  const rawReview = isRecord(byRun)
    ? byRun
    : isRecord(project.draft.review) &&
        project.draft.review.runId === selected?.id
      ? project.draft.review
      : null;
  const reviewed = usableRecord(
    rawReview?.record,
    selected?.prepared ?? project.data.input,
  );
  const note = typeof rawReview?.note === "string" ? rawReview.note : "";
  const jsonDraft =
    typeof project.draft.inputJson === "string"
      ? project.draft.inputJson
      : JSON.stringify(project.data.input, null, 2);
  const pending = isRecord(project.draft.pendingCommand)
    ? project.draft.pendingCommand
    : null;
  const pendingOperation =
    pending && typeof pending.operationId === "string"
      ? pending.operationId
      : "";
  const mutable = !project.loading && !project.busy;

  async function loadRuns(id = currentId, key = epoch.current) {
    const sequence = ++listSequence.current;
    if (!id) {
      setRuns([]);
      return;
    }
    try {
      const raw = await request(`/api/projects/${id}/runs`);
      if (!Array.isArray(raw)) throw new Error("运行列表格式无效。");
      const decoded = raw.map(runValue);
      if (epoch.current === key && sequence === listSequence.current) {
        setRuns(decoded);
        setListError("");
      }
    } catch (error) {
      if (epoch.current === key && sequence === listSequence.current)
        setListError(
          error instanceof Error ? error.message : "无法读取运行列表，请重试。",
        );
    }
  }
  async function modelStatus() {
    const sequence = ++modelSequence.current;
    try {
      const value = await request("/api/model-status");
      if (
        sequence === modelSequence.current &&
        isRecord(value) &&
        typeof value.available === "boolean" &&
        typeof value.message === "string"
      )
        setModel({ available: value.available, message: value.message });
    } catch {
      if (sequence !== modelSequence.current) return;
      setModel({ available: false, message: "无法读取模型连接，请重试" });
    }
  }
  useEffect(() => {
    void modelStatus();
  }, []);
  useEffect(() => {
    setRuns([]);
    setJsonOpen(false);
    setListError("");
    void loadRuns(currentId, project.documentKey);
  }, [currentId, project.documentKey]);
  const running = runs.some((run) => run.status === "running");
  useEffect(() => {
    if (!currentId || !running) return;
    const key = project.documentKey;
    const timer = setInterval(() => {
      void loadRuns(currentId, key);
    }, 1200);
    return () => clearInterval(timer);
  }, [running, currentId, project.documentKey]);

  function upsert(run: RunView) {
    listSequence.current++;
    setRuns((previous) => [
      run,
      ...previous.filter((item) => item.id !== run.id),
    ]);
  }
  function editReview(record: ReviewRecord, nextNote = note) {
    if (!selected) return;
    project.setDraft((extra) => ({
      ...extra,
      reviews: {
        ...(isRecord(extra.reviews) ? extra.reviews : {}),
        [selected.id]: { record, note: nextNote },
      },
    }));
  }
  async function submitCommand(command: Record<string, unknown>) {
    const key = epoch.current;
    setActionBusy(true);
    project.setError("");
    try {
      if (command.type !== "start" && command.type !== "review")
        throw new Error("待提交操作无效，请导出草稿后重新打开项目。");
      project.setDraft((extra) => ({ ...extra, pendingCommand: command }));
      if (!(await project.save()))
        throw new Error("请先完成项目保存，再提交运行。");
      if (epoch.current !== key) return;
      const endpoint =
        command.type === "start"
          ? "/api/runs"
          : `/api/runs/${String(command.runId)}/review`;
      if (
        command.type === "review" &&
        !/^[0-9a-f-]{36}$/i.test(String(command.runId))
      )
        throw new Error("待复核任务编号无效。");
      const run = runValue(
        await request(endpoint, {
          method: "POST",
          body: JSON.stringify(command),
        }),
      );
      if (epoch.current !== key) return;
      upsert(run);
      project.setDraft((extra) => {
        const copy = { ...extra };
        if (
          isRecord(copy.pendingCommand) &&
          copy.pendingCommand.operationId === command.operationId
        )
          delete copy.pendingCommand;
        return copy;
      });
      void loadRuns(run.projectId, key);
    } catch (error) {
      if (epoch.current === key) {
        if (
          error instanceof Error &&
          "status" in error &&
          error.status === 409
        ) {
          project.setDraft((extra) => {
            const copy = { ...extra };
            if (
              isRecord(copy.pendingCommand) &&
              copy.pendingCommand.operationId === command.operationId
            )
              delete copy.pendingCommand;
            return copy;
          });
          void loadRuns(currentId, key);
        }
        project.report(error);
      }
    } finally {
      setActionBusy(false);
    }
  }
  async function start() {
    try {
      const missing =
        project.data.mode === "model"
          ? !project.data.source.trim()
            ? "source"
            : ""
          : !project.data.input.subject.trim()
            ? "input-subject"
            : !project.data.input.owner.trim()
              ? "input-owner"
              : "";
      if (missing) document.getElementById(missing)?.focus();
      if (pendingOperation)
        throw new Error("还有一项提交未确认，请先核对并重试。");
      const input = inputValue({
        mode: project.data.mode,
        source: project.data.source,
        record: project.data.input,
      });
      setActionBusy(true);
      const saved = await project.save();
      if (!saved) throw new Error("请先完成项目保存。");
      const operationId = crypto.randomUUID();
      project.setData((data) => ({ ...data, selectedRunId: operationId }));
      await submitCommand({
        type: "start",
        operationId,
        projectId: saved.id,
        title: saved.title,
        input,
      });
    } catch (error) {
      project.report(error);
    } finally {
      setActionBusy(false);
    }
  }
  async function decide(decision: ReviewDecision["decision"]) {
    if (!selected) return;
    try {
      if (!reviewed.subject.trim())
        document.getElementById("review-subject")?.focus();
      else if (!reviewed.owner.trim())
        document.getElementById("review-owner")?.focus();
      const record = recordValue(reviewed);
      if (
        decision === "reject" &&
        !confirm("退回这次交付？资料和复核意见将保留。")
      )
        return;
      await submitCommand({
        type: "review",
        operationId: crypto.randomUUID(),
        runId: selected.id,
        version: selected.version,
        review: { decision, record, note },
      });
    } catch (error) {
      project.report(error);
    }
  }
  async function changeRun(action: "cancel" | "recover") {
    if (!selected) return;
    if (
      action === "cancel" &&
      !confirm("取消这次运行？已保存资料与检查点会保留。")
    )
      return;
    setActionBusy(true);
    project.setError("");
    const key = epoch.current;
    try {
      const run = runValue(
        await request(`/api/runs/${selected.id}/${action}`, {
          method: "POST",
          body: JSON.stringify({ version: selected.version }),
        }),
      );
      if (epoch.current === key) upsert(run);
    } catch (error) {
      if (epoch.current === key) project.report(error);
    } finally {
      setActionBusy(false);
    }
  }
  function exportProject() {
    download(
      new Blob(
        [
          JSON.stringify(
            {
              kind: "langgraph-review-project",
              version: 1,
              title: project.title,
              data: { ...project.data, selectedRunId: "" },
              inputJson: jsonDraft,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "交付复核项目.json",
    );
  }
  async function importProject(selectedFile?: File) {
    if (!selectedFile) return;
    try {
      if (selectedFile.size > 900000)
        throw new Error("项目文件不能超过 900 KB。");
      const value: unknown = JSON.parse(await selectedFile.text());
      if (
        !isRecord(value) ||
        value.kind !== "langgraph-review-project" ||
        value.version !== 1
      )
        throw new Error("请选择交付复核项目 JSON。");
      const data = restoreProjectDraft(value.data);
      await project.replace(
        { ...data, selectedRunId: "" },
        titleValue(value.title),
        typeof value.inputJson === "string" && value.inputJson.length <= 40000
          ? { inputJson: value.inputJson }
          : {},
      );
    } catch (error) {
      project.report(error);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  function exportResult(markdown = false) {
    if (!selected?.output) return;
    const output = selected.output;
    const content = markdown
      ? `# ${output.subject}\n\n负责人：${output.owner}\n\n交付日期：${output.dueDate || "待确认"}\n\n${output.summary}\n\n## 检查事项\n\n${output.checklist.map((item) => "- " + item).join("\n")}\n\n复核意见：${selected.review?.note || "无"}\n\n运行编号：${selected.id}\n`
      : JSON.stringify(
          {
            kind: "langgraph-review-delivery",
            version: 1,
            runId: selected.id,
            mode: selected.input.mode,
            input: selected.input,
            record: output,
            review: selected.review,
            completedAt: selected.updatedAt,
          },
          null,
          2,
        );
    download(
      new Blob([content], {
        type: markdown ? "text/markdown;charset=utf-8" : "application/json",
      }),
      `交付记录.${markdown ? "md" : "json"}`,
    );
  }
  const step =
    selected?.status === "completed"
      ? 3
      : selected?.prepared
        ? 2
        : selected
          ? 1
          : 0;

  return {
    project,
    runs,
    actionBusy,
    listError,
    model,
    jsonOpen,
    setJsonOpen,
    file,
    selected,
    reviewed,
    note,
    jsonDraft,
    pending,
    pendingOperation,
    mutable,
    loadRuns,
    modelStatus,
    editReview,
    submitCommand,
    start,
    decide,
    changeRun,
    exportProject,
    importProject,
    exportResult,
    running,
    step,
  };
}
