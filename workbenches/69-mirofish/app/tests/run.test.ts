import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createMiroFishClient } from "../src/server/mirofish-client.ts";
import { createRunCommands } from "../src/server/run-commands.ts";
import {
  mergeRun,
  mergeCommand,
  importedDraft,
  type CommandInput,
  type Command,
} from "../src/contracts/run.ts";
const stamp = "2026-10-28T12:00:00.000Z";
async function fixture(
  run: (value: {
    url: string;
    state: Record<string, unknown>;
    mode: { lost: boolean; blocked: boolean; pending: boolean };
    calls: Array<{ path: string; body: unknown }>;
  }) => Promise<void>,
) {
  const state: Record<string, unknown> = {
    simulation_id: "sim_contract",
    runner_status: "idle",
    current_round: 0,
    total_rounds: 10,
    total_actions_count: 0,
    started_at: null,
  };
  const mode = { lost: false, blocked: false, pending: false },
    calls: Array<{ path: string; body: unknown }> = [];
  const server = createServer(async (req, res) => {
    const bytes = [];
    for await (const part of req) bytes.push(part);
    const body = bytes.length
      ? JSON.parse(Buffer.concat(bytes).toString())
      : null;
    const path = req.url!;
    res.setHeader("content-type", "application/json");
    if (path === "/api/simulation/start") {
      calls.push({ path, body });
      Object.assign(state, {
        runner_status: "running",
        started_at: stamp,
        updated_at: stamp,
      });
      if (mode.lost) {
        req.socket.destroy();
        return;
      }
    }
    if (path === "/api/simulation/stop") {
      calls.push({ path, body });
      state.runner_status = mode.pending ? "stopping" : "stopped";
      if (mode.pending) {
        res.statusCode = 202;
        res.end(
          JSON.stringify({
            success: false,
            pending: true,
            error: "finalizing",
          }),
        );
        return;
      }
    }
    if (mode.blocked && path.endsWith("/run-status")) {
      res.statusCode = 503;
      res.end("{}");
      return;
    }
    const result =
      path === "/api/simulation/list"
        ? [{ simulation_id: "sim_contract", status: "ready" }]
        : state;
    res.end(JSON.stringify({ success: true, data: result }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  try {
    await run({ url: "http://127.0.0.1:" + address.port, state, mode, calls });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
function db() {
  const d = new DatabaseSync(":memory:");
  d.exec(
    readFileSync(
      new URL("../migrations/0004_run_commands.sql", import.meta.url),
      "utf8",
    ),
  );
  return d;
}
const start = (): CommandInput => ({
  id: randomUUID(),
  simulationId: "sim_contract",
  action: "start",
  platform: "reddit",
  rounds: 4,
  startedAt: null,
});
test("official start/stop body and simulation_id + started_at identity are used without force or graph writes", async () =>
  fixture(async ({ url, calls }) => {
    const ledger = createRunCommands(db(), createMiroFishClient(url));
    const a = await ledger.submit(start());
    assert.equal(a.phase, "acknowledged");
    assert.equal(a.run?.startedAt, stamp);
    assert.deepEqual(calls[0].body, {
      simulation_id: "sim_contract",
      platform: "reddit",
      max_rounds: 4,
      force: false,
      enable_graph_memory_update: false,
    });
    const stop = { ...start(), action: "stop" as const, startedAt: stamp };
    const b = await ledger.submit(stop);
    assert.equal(b.run?.status, "stopped");
    assert.deepEqual(calls[1].body, { simulation_id: "sim_contract" });
    await ledger.submit(stop);
    assert.equal(calls.length, 2);
  }));
test("lost upstream receipt plus unavailable status survives ledger recreation and never replays POST", async () =>
  fixture(async ({ url, mode, calls }) => {
    const database = db(),
      client = createMiroFishClient(url);
    const ledger = createRunCommands(database, client);
    mode.lost = true;
    // Block status only after the upstream accepts POST, while keeping preflight readable.
    const command = client.command.bind(client);
    client.command = async (input) => {
      try {
        return await command(input);
      } finally {
        mode.blocked = true;
      }
    };
    const input = start();
    const lost = await ledger.submit(input);
    assert.equal(lost.phase, "unknown");
    assert.equal(calls.length, 1);
    const reopened = createRunCommands(database, client);
    await reopened.submit(input);
    assert.equal(calls.length, 1);
    await assert.rejects(() => reopened.submit(start()), /已有命令/);
    mode.blocked = false;
    const recovered = await reopened.refresh(input.id);
    assert.equal(recovered.phase, "observed");
    assert.equal(recovered.run?.startedAt, stamp);
    assert.equal(calls.length, 1);
  }));
test("pending 202 stop remains observable and a different run cannot be stopped or read as the original", async () =>
  fixture(async ({ url, state, mode, calls }) => {
    const client = createMiroFishClient(url),
      ledger = createRunCommands(db(), client);
    await ledger.submit(start());
    mode.pending = true;
    const stop = { ...start(), action: "stop" as const, startedAt: stamp };
    const pending = await ledger.submit(stop);
    assert.equal(pending.phase, "observed");
    assert.equal(pending.run?.status, "stopping");
    state.runner_status = "stopped";
    assert.equal((await ledger.refresh(stop.id)).run?.status, "stopped");
    state.started_at = "2026-10-28T13:00:00Z";
    state.runner_status = "running";
    const wrong = await ledger.submit({
      ...stop,
      id: randomUUID(),
      startedAt: "2026-10-28T11:00:00Z",
    });
    assert.equal(wrong.phase, "rejected");
    assert.equal(calls.length, 2);
    await assert.rejects(() => client.result("sim_contract", stamp), /另一轮/);
  }));
test("terminal observations and acknowledgement cannot regress on late same-run responses; imports strip executable command", () => {
  const run = {
    simulationId: "sim_contract",
    status: "completed" as const,
    startedAt: stamp,
    updatedAt: stamp,
    round: 4,
    total: 4,
    actions: 8,
    error: null,
  };
  assert.equal(
    mergeRun(run, { ...run, status: "running", round: 1 }).status,
    "completed",
  );
  const command: Command = {
    ...start(),
    phase: "acknowledged",
    run,
    message: "ack",
  };
  assert.equal(
    mergeCommand(command, {
      ...command,
      phase: "unknown",
      run: { ...run, status: "running" },
    }).phase,
    "acknowledged",
  );
  assert.equal(
    mergeCommand(command, {
      ...command,
      phase: "unknown",
      run: { ...run, status: "running" },
    }).run?.status,
    "completed",
  );
  const draft = importedDraft({
    pendingRun: command,
    runSelection: "sim_contract",
    nativeRaw: "{ incomplete",
  });
  assert.equal(draft.pendingRun, undefined);
  assert.equal(draft.runSelection, undefined);
  assert.equal(draft.nativeRaw, "{ incomplete");
  assert.deepEqual(draft.importedRun, command);
});
