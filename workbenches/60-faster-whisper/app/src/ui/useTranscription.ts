// ABOUTME: 转写服务状态检查、任务队列轮询、提交/取消/重试，以及把完成结果采用为新字幕稿。
import { useCallback, useEffect, useState } from "react";
import { request } from "./workspace";
import { emptyTranscript } from "../contracts/transcript";
import { carrySpeakers, segmentCues } from "../contracts/edit";
import { describeOptions } from "../contracts/options";
import { parseJob, type Job } from "../contracts/job";
import { isRecord } from "../contracts/project";
import { activeStates, type Health } from "./TranscribePanel";
import type { Desk } from "./desk";

export function useTranscription(p: Desk) {
  const [jobBusy, setJobBusy] = useState(false),
    [jobs, setJobs] = useState<Job[]>([]),
    [queueError, setQueueError] = useState(""),
    [health, setHealth] = useState<Health>({ connected: false, reason: "checking", model: "", multilingual: true, url: "", message: "" });
  const checkService = useCallback(async () => {
    setHealth((h) => ({ ...h, reason: "checking" }));
    try {
      const raw = await request("/api/service");
      if (!isRecord(raw) || typeof raw.connected !== "boolean" || typeof raw.message !== "string") throw new Error("bad");
      setHealth({
        connected: raw.connected,
        reason: (["ok", "unreachable", "auth", "incompatible", "outdated"].includes(String(raw.reason)) ? raw.reason : "unreachable") as Health["reason"],
        model: typeof raw.model === "string" ? raw.model : "",
        multilingual: raw.multilingual !== false,
        url: typeof raw.url === "string" ? raw.url : "",
        message: raw.message,
      });
    } catch {
      setHealth({ connected: false, reason: "unreachable", model: "", multilingual: true, url: "", message: "无法询问工作台服务端；请确认页面仍连接着工作台。" });
    }
  }, []);
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const list = await request("/api/jobs");
        if (!Array.isArray(list)) throw new Error("任务列表无效。");
        const next = list.map(parseJob);
        const refreshed = await Promise.all(
          next
            .filter((j) => activeStates.includes(j.status))
            .map((j) =>
              request("/api/jobs/" + j.id)
                .then(parseJob)
                .catch(() => j),
            ),
        );
        if (!disposed) {
          setJobs(next.map((j) => ({ ...(refreshed.find((r) => r.id === j.id) ?? j), segments: null })));
          setQueueError("");
        }
      } catch (e) {
        if (!disposed) setQueueError(e instanceof Error ? e.message : "任务队列暂不可用。");
      } finally {
        if (!disposed) timer = setTimeout(poll, 3500);
      }
    };
    void poll();
    void checkService();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, []);
  async function start() {
    setJobBusy(true);
    p.setError("");
    try {
      const saved = await p.save();
      if (!saved?.data.source) throw new Error("请先导入音频，并等字幕稿保存后再转写。");
      const job = parseJob(
        await request("/api/jobs", {
          method: "POST",
          body: JSON.stringify({ id: crypto.randomUUID(), projectId: saved.id, input: { source: saved.data.source, language: saved.data.language, options: saved.data.options } }),
        }),
      );
      setJobs((list) => [job, ...list.filter((j) => j.id !== job.id)]);
      p.setNotice("转写已提交。完成后在队列中采用为新字幕稿。");
    } catch (e) {
      p.report(e);
    } finally {
      setJobBusy(false);
    }
  }
  async function jobAction(job: Job, action: "cancel" | "retry") {
    setJobBusy(true);
    try {
      const result = parseJob(await request(`/api/jobs/${job.id}/${action}`, { method: "POST" }));
      setJobs((list) => list.map((j) => (j.id === result.id ? { ...result, segments: null } : j)));
    } catch (e) {
      p.report(e);
    } finally {
      setJobBusy(false);
    }
  }
  async function adopt(job: Job) {
    setJobBusy(true);
    try {
      const result = parseJob(await request("/api/jobs/" + job.id));
      if (result.status !== "completed" || result.segments === null) throw new Error("转写结果尚未就绪。");
      const same = p.data.source?.id === result.input.source.id;
      let cues = segmentCues(result.segments);
      if (same) cues = carrySpeakers(cues, p.data.cues);
      const ok = await p.replace(
        {
          ...emptyTranscript,
          source: result.input.source,
          language: result.input.language,
          options: result.input.options,
          speakers: same ? p.data.speakers : [],
          notes: same ? p.data.notes : "",
          cues,
          origin: `faster-whisper · ${result.model} · ${describeOptions(result.input.language, result.input.options)}`.slice(0, 240),
        },
        `${result.input.source.name.replace(/\.[^.]+$/, "")} · ${result.input.options.task === "translate" ? "英译稿" : "转写稿"}`.slice(0, 120),
      );
      if (ok) p.setNotice(same ? "已采用为新字幕稿，并按时间重叠沿用了原稿的说话人；原稿保持不变。" : "已采用为新字幕稿，原稿保持不变。");
    } catch (e) {
      p.report(e);
    } finally {
      setJobBusy(false);
    }
  }

  return { health, checkService, jobs, queueError, jobBusy, start, jobAction, adopt };
}
