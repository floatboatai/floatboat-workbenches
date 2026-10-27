import type { DatabaseSync } from "node:sqlite";
import {
  Annotation,
  StateGraph,
  START,
  END,
  interrupt,
  Command,
} from "@langchain/langgraph";
import { SqliteCheckpointer } from "./checkpointer.ts";
import { StoreError } from "./store.ts";
import {
  inputValue,
  decisionValue,
  recordValue,
  idValue,
  type RunInput,
  type ReviewRecord,
  type ReviewDecision,
  type RunView,
} from "../contracts/review.ts";

export type ModelPrepare = (
  source: string,
  signal: AbortSignal,
  operationId: string,
) => Promise<ReviewRecord>;
const State = Annotation.Root({
  input: Annotation<RunInput>(),
  prepared: Annotation<ReviewRecord>(),
  review: Annotation<ReviewDecision>(),
  output: Annotation<ReviewRecord>(),
});
type Launch =
  | { kind: "start" }
  | { kind: "resume"; review: ReviewDecision }
  | { kind: "recover" };
const now = () => new Date().toISOString();

export function createRunService(db: DatabaseSync, prepareModel: ModelPrepare) {
  const saver = new SqliteCheckpointer(db);
  const active = new Map<
    string,
    { controller: AbortController; task: Promise<void> }
  >();
  // A previous process may have sent a model request. Never resend it on startup.
  db.prepare(
    "UPDATE lg_runs SET status='interrupted',error='运行进程已中断。请检查保存的进度后手动恢复。',version=version+1,updated_at=? WHERE status='running'",
  ).run(now());
  function graphFor(id: string, signal: AbortSignal) {
    return new StateGraph(State)
      .addNode("prepare", async (state) => {
        const prepared =
          state.input.mode === "structured"
            ? recordValue(state.input.record)
            : await prepareModel(state.input.source, signal, id);
        return { prepared: recordValue(prepared) };
      })
      .addNode("human_review", (state) => {
        const answer: unknown = interrupt({
          kind: "record-review",
          record: state.prepared,
        });
        return { review: decisionValue(answer) };
      })
      .addNode("deliver", (state) => ({
        output: recordValue(state.review.record),
      }))
      .addEdge(START, "prepare")
      .addEdge("prepare", "human_review")
      .addConditionalEdges(
        "human_review",
        (state) => (state.review.decision === "approve" ? "deliver" : END),
        ["deliver", END],
      )
      .addEdge("deliver", END)
      .compile({ checkpointer: saver });
  }
  function rowFor(id: string) {
    const row = db.prepare("SELECT * FROM lg_runs WHERE id=?").get(idValue(id));
    if (!row) throw new StoreError(404, "运行记录不存在。");
    return row;
  }
  async function view(id: string): Promise<RunView> {
    const row = rowFor(id);
    const checkpoints: RunView["checkpoints"] = [];
    for await (const tuple of saver.list(
      { configurable: { thread_id: id } },
      { limit: 16 },
    )) {
      checkpoints.push({
        id: tuple.checkpoint.id,
        at: tuple.checkpoint.ts,
        step: tuple.metadata?.step ?? -1,
        next: Object.keys(tuple.checkpoint.channel_values)
          .filter((name) => name.startsWith("branch:to:"))
          .map((name) => name.slice(10)),
      });
    }
    const record = (raw: unknown) =>
      typeof raw === "string" ? recordValue(JSON.parse(raw)) : null;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      title: String(row.title),
      input: inputValue(JSON.parse(String(row.input_json))),
      status: String(row.status) as RunView["status"],
      version: Number(row.version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      error: String(row.error),
      prepared: record(row.prepared_json),
      review:
        typeof row.review_json === "string"
          ? decisionValue(JSON.parse(row.review_json))
          : null,
      output: record(row.output_json),
      checkpoints,
    };
  }
  async function execute(id: string, launch: Launch, signal: AbortSignal) {
    const row = rowFor(id),
      input = inputValue(JSON.parse(String(row.input_json))),
      graph = graphFor(id, signal);
    const config = {
      configurable: { thread_id: id },
      signal,
      recursionLimit: 10,
    };
    try {
      await graph.invoke(
        launch.kind === "start"
          ? { input }
          : launch.kind === "resume"
            ? new Command({ resume: launch.review })
            : null,
        config,
      );
      const snapshot = await graph.getState({
        configurable: { thread_id: id },
      });
      const state = snapshot.values as Partial<typeof State.State>;
      const waiting = snapshot.tasks.some(
        (task) => task.interrupts && task.interrupts.length > 0,
      );
      const status = waiting
        ? "waiting"
        : state.review?.decision === "reject"
          ? "rejected"
          : state.output
            ? "completed"
            : "failed";
      db.prepare(
        "UPDATE lg_runs SET status=?,prepared_json=?,review_json=?,output_json=?,error=?,version=version+1,updated_at=? WHERE id=? AND status='running'",
      ).run(
        status,
        state.prepared ? JSON.stringify(recordValue(state.prepared)) : null,
        state.review ? JSON.stringify(decisionValue(state.review)) : null,
        state.output ? JSON.stringify(recordValue(state.output)) : null,
        status === "failed" ? "流程没有返回可复核的资料，请检查输入。" : "",
        now(),
        id,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 2000)
          : "运行失败，请检查资料后重试。";
      db.prepare(
        "UPDATE lg_runs SET status='failed',error=?,version=version+1,updated_at=? WHERE id=? AND status='running'",
      ).run(message, now(), id);
    }
  }
  function launch(id: string, work: Launch) {
    if (active.has(id)) throw new StoreError(409, "这项任务正在运行。");
    const controller = new AbortController();
    const task = Promise.resolve()
      .then(() => execute(id, work, controller.signal))
      .catch((error: unknown) => {
        db.prepare(
          "UPDATE lg_runs SET status='failed',error=?,version=version+1,updated_at=? WHERE id=? AND status='running'",
        ).run(
          error instanceof Error ? error.message.slice(0, 2000) : "运行失败。",
          now(),
          id,
        );
      })
      .finally(() => active.delete(id));
    active.set(id, { controller, task });
  }
  async function start(
    id: string,
    projectId: string,
    title: string,
    raw: unknown,
  ) {
    idValue(id);
    idValue(projectId);
    const input = inputValue(raw),
      serialized = JSON.stringify(input);
    const existing = db.prepare("SELECT * FROM lg_runs WHERE id=?").get(id);
    if (existing) {
      if (
        existing.project_id !== projectId ||
        existing.input_json !== serialized
      )
        throw new StoreError(409, "相同操作编号不能用于另一份输入。");
      return view(id);
    }
    if (!db.prepare("SELECT id FROM projects WHERE id=?").get(projectId))
      throw new StoreError(400, "请先保存项目，再启动运行。");
    if (
      db
        .prepare(
          "SELECT id FROM lg_runs WHERE project_id=? AND status='running'",
        )
        .get(projectId)
    )
      throw new StoreError(409, "当前项目已有执行中的任务，请等待完成或取消。");
    const time = now();
    db.prepare(
      "INSERT INTO lg_runs(id,project_id,title,input_json,status,created_at,updated_at) VALUES(?,?,?,?,'running',?,?)",
    ).run(id, projectId, title.slice(0, 120), serialized, time, time);
    launch(id, { kind: "start" });
    return view(id);
  }
  async function resume(
    id: string,
    operationId: string,
    version: number,
    raw: unknown,
  ) {
    idValue(operationId);
    const review = decisionValue(raw),
      request = JSON.stringify({ id, version, review });
    const previous = db
      .prepare("SELECT * FROM lg_actions WHERE id=?")
      .get(operationId);
    if (previous) {
      if (previous.request_json !== request || previous.run_id !== id)
        throw new StoreError(409, "复核操作编号已用于另一份决定。");
      return view(id);
    }
    rowFor(id);
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = db
        .prepare(
          "UPDATE lg_runs SET status='running',review_json=?,error='',version=version+1,updated_at=? WHERE id=? AND status='waiting' AND version=?",
        )
        .run(JSON.stringify(review), now(), id, version);
      if (!result.changes)
        throw new StoreError(
          409,
          "运行状态已变化，请刷新任务。你的复核草稿仍然保留。",
        );
      db.prepare("INSERT INTO lg_actions VALUES(?,?,?,?)").run(
        operationId,
        id,
        request,
        now(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    launch(id, { kind: "resume", review });
    return view(id);
  }
  async function recover(id: string, version: number) {
    const row = rowFor(id);
    if (
      Number(row.version) !== version ||
      !["interrupted", "failed"].includes(String(row.status))
    )
      throw new StoreError(409, "运行状态已变化，请刷新后再恢复。");
    const graph = graphFor(id, new AbortController().signal);
    const snapshot = await graph.getState({ configurable: { thread_id: id } });
    const state = snapshot.values as Partial<typeof State.State>;
    if (
      inputValue(JSON.parse(String(row.input_json))).mode === "model" &&
      !state.prepared
    )
      throw new StoreError(
        409,
        "模型步骤没有已确认的结果；为避免重复调用，此任务不会自动重发。请核查后手动新建运行。",
      );
    if (!snapshot.config?.configurable?.checkpoint_id)
      throw new StoreError(409, "没有可恢复的检查点，请手动新建运行。");
    const waiting = snapshot.tasks.some(
      (task) => task.interrupts && task.interrupts.length > 0,
    );
    const pendingReview =
      typeof row.review_json === "string"
        ? decisionValue(JSON.parse(row.review_json))
        : null;
    if (waiting && !pendingReview) {
      db.prepare(
        "UPDATE lg_runs SET status='waiting',prepared_json=?,error='',version=version+1,updated_at=? WHERE id=? AND version=?",
      ).run(JSON.stringify(recordValue(state.prepared)), now(), id, version);
    } else {
      const result = db
        .prepare(
          "UPDATE lg_runs SET status='running',error='',version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .run(now(), id, version);
      if (!result.changes)
        throw new StoreError(409, "运行状态已变化，请刷新。");
      launch(
        id,
        waiting && pendingReview
          ? { kind: "resume", review: pendingReview }
          : { kind: "recover" },
      );
    }
    return view(id);
  }
  async function cancel(id: string, version: number) {
    const result = db
      .prepare(
        "UPDATE lg_runs SET status='cancelled',error='任务已取消。资料和检查点保留，未生成新交付物。',version=version+1,updated_at=? WHERE id=? AND version=? AND status IN ('running','waiting','interrupted','failed')",
      )
      .run(now(), idValue(id), version);
    if (!result.changes) throw new StoreError(409, "运行状态已变化，请刷新。");
    active.get(id)?.controller.abort();
    return view(id);
  }
  return {
    start,
    view,
    resume,
    recover,
    cancel,
    async settle(id: string) {
      await active.get(id)?.task;
      return view(id);
    },
    async list(projectId: string) {
      const rows = db
        .prepare(
          "SELECT id FROM lg_runs WHERE project_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .all(idValue(projectId));
      return Promise.all(rows.map((row) => view(String(row.id))));
    },
  };
}
