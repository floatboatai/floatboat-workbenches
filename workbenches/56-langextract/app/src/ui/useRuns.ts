import { useCallback, useEffect, useRef, useState } from "react";
import { isRecord } from "../contracts/project";
import { validateJob, type Job } from "../contracts/evidence";
import { validateHostRun, type HostRun } from "../contracts/host-run";
import { request } from "./workspace";

export interface ChannelState {
  checking: boolean;
  available: boolean;
  message: string;
}
export interface ServiceState extends ChannelState {
  connected: boolean;
}
const ACTIVE_JOB = ["submitting", "queued", "running", "unknown"];

/** Channel status and run history for the built-in Host channel and the optional Python service. */
export function useRuns(report: (e: unknown) => void) {
  const reportRef = useRef(report);
  reportRef.current = report;
  const [host, setHost] = useState<ChannelState>({ checking: true, available: false, message: "正在检查 Floatboat 模型…" });
  const [service, setService] = useState<ServiceState>({ checking: true, available: false, connected: false, message: "正在检查 Python 服务…" });
  const [hostRuns, setHostRuns] = useState<HostRun[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  const checkHost = useCallback(async () => {
    setHost((h) => ({ ...h, checking: true }));
    try {
      const v = await request("/api/host-status");
      if (!isRecord(v) || typeof v.available !== "boolean" || typeof v.message !== "string") throw Error();
      setHost({ checking: false, available: v.available, message: v.message });
    } catch {
      setHost({ checking: false, available: false, message: "无法读取 Floatboat 状态，可继续手工标注与复核。" });
    }
  }, []);
  const checkService = useCallback(async () => {
    setService((s) => ({ ...s, checking: true }));
    try {
      const v = await request("/api/service");
      if (!isRecord(v) || typeof v.connected !== "boolean" || typeof v.message !== "string") throw Error();
      setService({ checking: false, connected: v.connected, available: v.ready === true, message: v.message });
    } catch {
      setService({ checking: false, connected: false, available: false, message: "无法读取 Python 服务状态。" });
    }
  }, []);
  const refreshRuns = useCallback(async () => {
    try {
      const [h, j] = await Promise.all([request("/api/host-runs"), request("/api/jobs")]);
      if (!Array.isArray(h) || !Array.isArray(j)) throw Error("任务列表无效。");
      setHostRuns(h.map(validateHostRun));
      setJobs(j.map(validateJob));
    } catch (e) {
      reportRef.current(e);
    }
  }, []);
  useEffect(() => {
    void checkHost();
    void checkService();
    void refreshRuns();
  }, [checkHost, checkService, refreshRuns]);

  const activeHost = hostRuns.filter((r) => r.status === "running").map((r) => r.id).join(",");
  const activeJobs = jobs.filter((j) => ACTIVE_JOB.includes(j.status)).map((j) => j.id).join(",");
  useEffect(() => {
    if (!activeHost && !activeJobs) return;
    let alive = true;
    const timer = setInterval(() => {
      void Promise.all([
        ...(activeHost ? activeHost.split(",") : []).map((id) => request("/api/host-runs/" + id).then(validateHostRun)),
      ])
        .then((updated) => {
          if (alive && updated.length) setHostRuns((old) => old.map((r) => updated.find((u) => u.id === r.id) ?? r));
        })
        .catch(() => {});
      void Promise.all((activeJobs ? activeJobs.split(",") : []).map((id) => request("/api/jobs/" + id).then(validateJob)))
        .then((updated) => {
          if (alive && updated.length) setJobs((old) => old.map((j) => updated.find((u) => u.id === j.id) ?? j));
        })
        .catch(() => {});
    }, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [activeHost, activeJobs]);

  return {
    host,
    service,
    hostRuns,
    jobs,
    checkHost,
    checkService,
    refreshRuns,
    putHostRun: (r: HostRun) => setHostRuns((old) => [r, ...old.filter((x) => x.id !== r.id)]),
    putJob: (j: Job) => setJobs((old) => [j, ...old.filter((x) => x.id !== j.id)]),
    activeCount: (activeHost ? activeHost.split(",").length : 0) + (activeJobs ? activeJobs.split(",").length : 0),
  };
}
