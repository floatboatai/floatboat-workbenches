// ABOUTME: 连接状态（Floatboat模型、可选PageIndex服务）与PageIndex章节树生成任务的轮询。
import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./requests.ts";
import { isRecord } from "../contracts/project.ts";
import { OUTLINE_SOURCES, type OutlineSource } from "../contracts/reader.ts";

export type ServiceStatus = {
  available: boolean;
  url: string;
  version: string;
  modes: OutlineSource[];
  model: string;
  message: string;
};
export type OutlineJob = {
  mode: OutlineSource;
  status: "running" | "completed" | "failed";
  error: string;
};
export type Connection = { checked: boolean; model: boolean; service: ServiceStatus | null };

function serviceValue(raw: unknown): ServiceStatus | null {
  if (!isRecord(raw)) return null;
  return {
    available: raw.available === true,
    url: typeof raw.url === "string" ? raw.url : "",
    version: typeof raw.version === "string" ? raw.version : "",
    modes: Array.isArray(raw.modes)
      ? raw.modes.filter((m): m is OutlineSource => OUTLINE_SOURCES.includes(m as OutlineSource))
      : [],
    model: typeof raw.model === "string" ? raw.model : "",
    message: typeof raw.message === "string" ? raw.message : "",
  };
}
function jobValue(raw: unknown): OutlineJob | null {
  if (!isRecord(raw) || !isRecord(raw.job)) return null;
  const j = raw.job;
  if (!OUTLINE_SOURCES.includes(j.mode as OutlineSource)) return null;
  if (!["running", "completed", "failed"].includes(String(j.status))) return null;
  return {
    mode: j.mode as OutlineSource,
    status: j.status as OutlineJob["status"],
    error: typeof j.error === "string" ? j.error : "",
  };
}

export function useService(
  sourceId: string | undefined,
  documentKey: string,
  onBuilt: (id: string, mode: OutlineSource) => Promise<void>,
  report: (e: unknown) => void,
) {
  const [status, setStatus] = useState<Connection>({ checked: false, model: false, service: null }),
    [job, setJob] = useState<OutlineJob | null>(null);
  const jobRef = useRef<OutlineJob | null>(null),
    sourceRef = useRef(sourceId),
    built = useRef(onBuilt);
  sourceRef.current = sourceId;
  built.current = onBuilt;
  const refreshStatus = useCallback(async () => {
    try {
      const raw = await request("/api/status");
      if (isRecord(raw))
        setStatus({ checked: true, model: raw.model === true, service: serviceValue(raw.service) });
    } catch {
      setStatus({ checked: true, model: false, service: null });
    }
  }, []);
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);
  const checkJob = useCallback(async (id: string) => {
    try {
      const next = jobValue(await request(`/api/documents/${id}/outlines/job`));
      if (sourceRef.current !== id) return;
      const previous = jobRef.current;
      jobRef.current = next;
      setJob(next);
      if (previous?.status === "running" && next?.status === "completed")
        await built.current(id, next.mode);
    } catch {
      /* Job status is advisory; the card offers a manual re-check. */
    }
  }, []);
  useEffect(() => {
    jobRef.current = null;
    setJob(null);
    if (sourceId) void checkJob(sourceId);
  }, [sourceId, documentKey, checkJob]);
  const building = job?.status === "running";
  useEffect(() => {
    if (!building || !sourceId) return;
    const timer = setInterval(() => void checkJob(sourceId), 2000);
    return () => clearInterval(timer);
  }, [building, sourceId, checkJob]);
  async function buildOutline(mode: OutlineSource) {
    if (!sourceId) return;
    try {
      const next = jobValue({
        job: await request(`/api/documents/${sourceId}/outlines`, {
          method: "POST",
          body: JSON.stringify({ mode }),
        }),
      });
      jobRef.current = next;
      setJob(next);
    } catch (e) {
      report(e);
    }
  }
  return { status, refreshStatus, job, buildOutline };
}
