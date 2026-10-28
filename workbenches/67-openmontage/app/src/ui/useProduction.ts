import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace";
import { isRecord } from "../contracts/project";
import { readyMontage, type Montage } from "../contracts/montage";
import {
  jobValue,
  mergeJobs,
  terminal,
  type RenderJob,
} from "../contracts/render-state";
import { getPageConnection } from "./connection";
type Workspace = ReturnType<typeof useProjects<Montage>>;
export function useProduction(p: Workspace) {
  const [jobs, setJobs] = useState<RenderJob[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState({
      available: false,
      message: "正在检查制作服务…",
    });
  const epoch = useRef(p.documentKey),
    sequence = useRef(0),
    flight = useRef(false),
    pendingRef = useRef(p.draft.pendingRender);
  epoch.current = p.documentKey;
  pendingRef.current = p.draft.pendingRender;
  function clear(id: string) {
    if (isRecord(pendingRef.current) && pendingRef.current.id === id) {
      pendingRef.current = undefined;
      p.setDraft((d) => {
        const e = { ...d };
        delete e.pendingRender;
        return e;
      });
    }
  }
  async function check() {
    try {
      const v = await request("/api/renderer");
      if (isRecord(v))
        setStatus({
          available: v.available === true,
          message: String(v.message),
        });
    } catch (e) {
      p.report(e);
    }
  }
  async function load() {
    const key = epoch.current,
      seq = ++sequence.current,
      id = p.current?.id;
    if (!id) return;
    try {
      const v = await request("/api/projects/" + id + "/renders");
      if (!Array.isArray(v)) throw new Error("制作记录格式无效");
      const list = await Promise.all(
        v.map(async (raw) => {
          const j = jobValue(raw);
          return terminal(j.state)
            ? j
            : jobValue(await request("/api/renders/" + j.id));
        }),
      );
      if (key === epoch.current && seq === sequence.current) {
        setJobs((old) => mergeJobs(old, list));
        list.filter((j) => terminal(j.state)).forEach((j) => clear(j.id));
      }
    } catch (e) {
      if (key === epoch.current && seq === sequence.current) p.report(e);
    }
  }
  useEffect(() => {
    void check();
  }, []);
  useEffect(() => {
    setJobs([]);
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [p.current?.id, p.documentKey]);
  async function run() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    const key = epoch.current;
    p.setError("");
    try {
      let command: { id: string; projectId: string; montage: Montage };
      const old = pendingRef.current;
      if (old !== undefined) {
        if (
          !isRecord(old) ||
          typeof old.id !== "string" ||
          !/^[0-9a-f-]{36}$/.test(old.id) ||
          old.projectId !== p.current?.id ||
          typeof old.projectId !== "string"
        )
          throw new Error("待确认制作记录无效，请导出恢复稿核对原项目。");
        command = {
          id: old.id,
          projectId: old.projectId,
          montage: readyMontage(old.montage),
        };
      } else {
        if (jobs.some((j) => !terminal(j.state)))
          throw new Error("已有制作任务等待确认。");
        const snapshot = readyMontage(p.data),
          saved = await p.save();
        if (!saved || key !== epoch.current) return;
        command = {
          id: crypto.randomUUID(),
          projectId: saved.id,
          montage: snapshot,
        };
        pendingRef.current = command;
        p.setDraft((d) => ({ ...d, pendingRender: command }));
      }
      if (!(await p.save()) || key !== epoch.current) return;
      const j = jobValue(
        await request("/api/renders", {
          method: "POST",
          body: JSON.stringify(command),
        }),
      );
      if (key === epoch.current) {
        sequence.current++;
        setJobs((old) => mergeJobs(old, [j]));
        if (terminal(j.state)) clear(j.id);
      }
    } catch (e) {
      if (key === epoch.current) p.report(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function canLeave() {
    if (pendingRef.current !== undefined) {
      p.setError("制作任务尚未确认，请先核对同一任务或取消。");
      return false;
    }
    return true;
  }
  async function cancel(id: string) {
    try {
      const key = epoch.current,
        j = jobValue(
          await request("/api/renders/" + id + "/cancel", { method: "POST" }),
        );
      if (key === epoch.current) {
        sequence.current++;
        setJobs((old) => mergeJobs(old, [j]));
        if (terminal(j.state)) clear(j.id);
      }
    } catch (e) {
      p.report(e);
    }
  }
  async function video(id: string) {
    try {
      const page = await getPageConnection(),
        r = await page.fetch("/api/renders/" + id + "/video");
      if (!r.ok) throw new Error("成片暂不可读，请检查制作服务。");
      download(await r.blob(), p.title + ".mp4");
    } catch (e) {
      p.report(e);
    }
  }
  return {
    jobs,
    busy,
    status,
    pending: p.draft.pendingRender !== undefined,
    run,
    load,
    check,
    cancel,
    video,
    canLeave,
    open: async (id: string) => canLeave() && p.open(id),
    fresh: async () => canLeave() && p.fresh(),
  };
}
