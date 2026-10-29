import { useEffect, useRef, useState } from "react";
import { request } from "./requests";
import type { useWorkbenchState } from "./autosave-client";
import {
  commandInput,
  mergeRun,
  mergeCommand,
  terminal,
  type Command,
  type CommandInput,
  type Run,
} from "../contracts/run";
import type { Scenario } from "../contracts/scenario";
import { isRecord } from "../contracts/project";
type Workspace = ReturnType<typeof useWorkbenchState<Scenario>>;
export function useSimulationControl(p: Workspace, available: boolean) {
  const [command, setCommand] = useState<Command | null>(null),
    [run, setRun] = useState<Run | null>(null),
    [busy, setBusy] = useState(false);
  const flight = useRef(false),
    observing = useRef(false),
    sequence = useRef(0),
    epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const selected =
    typeof p.draft.runSelection === "string" ? p.draft.runSelection : "";
  const rawRounds =
    typeof p.draft.runRounds === "string" ? p.draft.runRounds : "10";
  const platform = ["twitter", "reddit", "parallel"].includes(
    String(p.draft.runPlatform),
  )
    ? (String(p.draft.runPlatform) as CommandInput["platform"])
    : "parallel";
  const pending = isRecord(p.draft.pendingRun) ? p.draft.pendingRun : undefined;
  const pendingId = typeof pending?.id === "string" ? pending.id : "";
  const active = command?.id === pendingId ? command : null;
  const unresolved = Boolean(
    pendingId &&
      (!active ||
        ["unknown", "submitting"].includes(active.phase) ||
        (active.action === "stop" &&
          active.phase === "observed" &&
          active.run &&
          !terminal(active.run.status))),
  );
  async function observe() {
    if (!available || (!selected && !pendingId) || observing.current) return;
    observing.current = true;
    const seq = ++sequence.current,
      key = epoch.current;
    try {
      if (pendingId) {
        const v = (await request(
          "/api/run-commands/" + encodeURIComponent(pendingId),
        )) as Command;
        if (seq !== sequence.current || key !== epoch.current) return;
        if (v.id !== pendingId || v.simulationId !== pending?.simulationId)
          throw new Error("命令核对身份不匹配");
        setCommand((old) => mergeCommand(old, v));
        if (v.run) setRun((old) => mergeRun(old, v.run!));
      } else {
        const v = (await request(
          "/api/simulations/" + encodeURIComponent(selected) + "/status",
        )) as Run;
        if (seq !== sequence.current || key !== epoch.current) return;
        if (v.simulationId !== selected) throw new Error("运行身份不匹配");
        setRun((old) => mergeRun(old, v));
      }
    } catch (e) {
      if (seq === sequence.current && key === epoch.current) p.report(e);
    } finally {
      observing.current = false;
    }
  }
  useEffect(() => {
    sequence.current++;
    setRun(null);
    setCommand(null);
    void observe();
  }, [p.documentKey, selected, pendingId, available]);
  useEffect(() => {
    if (!available || (!selected && !pendingId)) return;
    const timer = setInterval(() => void observe(), 4000);
    return () => clearInterval(timer);
  }, [available, selected, pendingId, p.documentKey]);
  function select(id: string) {
    sequence.current++;
    setCommand(null);
    setRun(null);
    p.setDraft((d) => ({ ...d, runSelection: id }));
  }
  async function execute(action: "start" | "stop") {
    if (flight.current || unresolved || !available) return;
    flight.current = true;
    setBusy(true);
    const key = epoch.current;
    try {
      const input = commandInput({
        id: crypto.randomUUID(),
        simulationId: selected,
        action,
        platform,
        rounds: Number(rawRounds),
        startedAt: action === "stop" ? run?.startedAt : null,
      });
      p.setDraft((d) => ({
        ...d,
        previousRun: d.pendingRun,
        pendingRun: input,
      }));
      if (!(await p.save()))
        throw new Error("命令尚未安全保存，请先恢复保存；未发送上游");
      const v = (await request("/api/run-commands", {
        method: "POST",
        body: JSON.stringify(input),
      })) as Command;
      if (key !== epoch.current) return;
      if (v.id !== input.id || v.simulationId !== input.simulationId)
        throw new Error("命令回执身份不匹配");
      setCommand((old) => mergeCommand(old, v));
      if (v.run) setRun((old) => mergeRun(old, v.run!));
    } catch (e) {
      if (key === epoch.current) p.report(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function archive() {
    if (unresolved) return;
    p.setDraft((d) => {
      const next: Record<string, unknown> = { ...d, previousRun: d.pendingRun };
      delete next.pendingRun;
      return next;
    });
    setCommand(null);
  }
  return {
    selected,
    rawRounds,
    platform,
    pendingId,
    command: active,
    run: run?.simulationId === (pending?.simulationId ?? selected) ? run : null,
    busy,
    unresolved,
    observe,
    select,
    execute,
    archive,
  };
}
