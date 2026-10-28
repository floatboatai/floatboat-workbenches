import type { DatabaseSync } from "node:sqlite";
import {
  commandInput,
  mergeRun,
  terminal,
  type Command,
  type Run,
} from "../contracts/run.ts";
import type { createMiroFishClient } from "./mirofish-client.ts";
type Client = ReturnType<typeof createMiroFishClient>;
export function createRunCommands(db: DatabaseSync, client: Client) {
  const get = (id: string): Command => {
    const row = db
      .prepare("SELECT payload FROM run_commands WHERE id=?")
      .get(id);
    if (!row)
      throw new Error("命令尚未到达本地服务；只允许核对，不会再次发送上游");
    return JSON.parse(String(row.payload));
  };
  const save = (c: Command) => {
    db.prepare("UPDATE run_commands SET payload=? WHERE id=?").run(
      JSON.stringify(c),
      c.id,
    );
    return c;
  };
  const observe = (next: Run) => {
    const row = db
      .prepare("SELECT payload FROM run_observations WHERE simulation_id=?")
      .get(next.simulationId);
    const value = mergeRun(row ? JSON.parse(String(row.payload)) : null, next);
    db.prepare(
      "INSERT INTO run_observations VALUES(?,?) ON CONFLICT(simulation_id) DO UPDATE SET payload=excluded.payload",
    ).run(next.simulationId, JSON.stringify(value));
    return value;
  };
  async function status(id: string) {
    return observe(await client.status(id));
  }
  async function refresh(id: string) {
    let c = get(id);
    try {
      const current = await status(c.simulationId);
      c = get(id); // re-read after await; a concurrent acknowledgement may have arrived
      const expected = c.run?.startedAt ?? c.startedAt;
      if (expected && current.startedAt !== expected)
        return save({
          ...c,
          message: "上游已切换到另一轮运行；本命令不会作用于新运行",
        });
      if (current.startedAt) {
        const run = mergeRun(c.run, current);
        return save({
          ...c,
          run,
          phase:
            c.phase === "acknowledged"
              ? "acknowledged"
              : c.phase === "rejected"
                ? "rejected"
                : "observed",
          message:
            c.phase === "acknowledged"
              ? "已收到上游回执"
              : c.action === "stop" && !terminal(run.status)
                ? "已观察到原运行；停止回执待核对，不会重发"
                : "已观察到该模拟的运行；无法用上游幂等键证明命令归属",
        });
      }
      return save({
        ...c,
        message: "尚未观察到启动，命令回执仍待核对；不会自动重发",
      });
    } catch {
      c = get(id);
      return save({
        ...c,
        message: "暂时无法读取上游状态；保留原命令，不会自动重发",
      });
    }
  }
  async function submit(value: unknown) {
    const input = commandInput(value),
      serialized = JSON.stringify(input);
    const exists = db
      .prepare("SELECT input FROM run_commands WHERE id=?")
      .get(input.id);
    if (exists) {
      if (String(exists.input) !== serialized)
        throw new Error("相同命令编号不能改变内容");
      return get(input.id);
    }
    const previous = db
      .prepare(
        "SELECT payload FROM run_commands WHERE json_extract(input,'$.simulationId')=? AND json_extract(input,'$.action')=?",
      )
      .all(input.simulationId, input.action)
      .map((row) => JSON.parse(String(row.payload)) as Command);
    if (
      previous.some(
        (c) =>
          c.phase !== "rejected" &&
          (input.action === "start" || c.startedAt === input.startedAt),
      )
    )
      throw new Error("同一运行已有命令记录；请核对原命令，不会重复提交");
    // Reserve synchronously before every await. This local ID is NOT sent as an upstream idempotency key.
    const initial: Command = {
      ...input,
      phase: "submitting",
      run: null,
      message: "命令已记录，正在核对启动条件",
    };
    db.prepare("INSERT INTO run_commands VALUES(?,?,?)").run(
      input.id,
      serialized,
      JSON.stringify(initial),
    );
    try {
      const baseline = await status(input.simulationId);
      if (input.action === "start") {
        const list = await client.list();
        if (
          !list.some(
            (s) => s.id === input.simulationId && s.status === "ready",
          ) ||
          baseline.status !== "idle" ||
          baseline.startedAt
        )
          throw new Error(
            "仅可启动已准备且尚未运行的模拟；已有运行请读取或停止",
          );
      } else if (
        baseline.startedAt !== input.startedAt ||
        !["starting", "running", "paused"].includes(baseline.status)
      )
        throw new Error("原运行已改变或不再可停止，请核对状态");
    } catch (e) {
      return save({
        ...get(input.id),
        phase: "rejected",
        message: e instanceof Error ? e.message : "启动条件不满足",
      });
    }
    // After this persistent marker even a process crash is treated as unknown, never replayed.
    save({
      ...get(input.id),
      phase: "unknown",
      message: "已尝试发送；回执未确认时只核对状态",
    });
    try {
      const result = await client.command(input);
      const latest = get(input.id);
      if (input.action === "stop" && result.startedAt !== input.startedAt)
        throw new Error("停止回执属于另一轮运行");
      if (!result.startedAt) throw new Error("回执缺少本次运行身份");
      const run = mergeRun(latest.run, observe(result));
      if (latest.run?.startedAt && run.startedAt !== latest.run.startedAt)
        throw new Error("运行身份改变");
      return save({
        ...latest,
        phase: "acknowledged",
        run,
        message: "已收到上游回执",
      });
    } catch {
      return refresh(input.id);
    }
  }
  return { get, submit, refresh, status };
}
