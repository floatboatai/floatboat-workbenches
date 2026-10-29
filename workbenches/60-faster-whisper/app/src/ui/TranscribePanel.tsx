// ABOUTME: 「转写」页：服务状态、启动命令与重新检查紧挨转写按钮；连上后开放 transcribe() 参数与任务队列。
import { useState } from "react";
import { Copy, RotateCcw, Play } from "lucide-react";
import type { Job, JobStatus } from "../contracts/job";
import {
  describeOptions,
  HOTWORDS_MAX,
  languages,
  PROMPT_MAX,
  type TranscribeOptions,
} from "../contracts/options";

export interface Health {
  connected: boolean;
  reason: "checking" | "ok" | "unreachable" | "auth" | "incompatible" | "outdated";
  model: string;
  multilingual: boolean;
  url: string;
  message: string;
}
export const statusLabel: Record<JobStatus, string> = {
  submitting: "正在提交",
  queued: "排队中",
  running: "正在转写",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  unknown: "状态待确认",
  interrupted: "服务中断",
};
export const activeStates: JobStatus[] = ["submitting", "queued", "running", "unknown"];

export const START_COMMANDS = `cd workbenches/60-faster-whisper
uv venv .local/whisper-service --python 3.12
uv pip install --python .local/whisper-service/bin/python -r service/requirements.txt
.local/whisper-service/bin/python service/server.py \\
  --data .local/whisper-jobs --cache .local/whisper-models --model small`;

export function TranscribePanel({
  health,
  language,
  options,
  hasSource,
  busy,
  jobs,
  sourceId,
  onLanguage,
  onOptions,
  onStart,
  onRecheck,
  onAdopt,
  onJob,
}: {
  health: Health;
  language: string;
  options: TranscribeOptions;
  hasSource: boolean;
  busy: boolean;
  jobs: Job[];
  sourceId: string;
  onLanguage: (v: string) => void;
  onOptions: (patch: Partial<TranscribeOptions>) => void;
  onStart: () => void;
  onRecheck: () => void;
  onAdopt: (job: Job) => void;
  onJob: (job: Job, action: "cancel" | "retry") => void;
}) {
  const [copied, setCopied] = useState(false);
  const pending = jobs.some((j) => j.input.source.id === sourceId && activeStates.includes(j.status));
  const englishOnly = health.connected && !health.multilingual;
  const disabledReason = !hasSource
    ? "先导入音频"
    : !health.connected
      ? "服务未连接"
      : pending
        ? "这段音频已有任务在处理"
        : "";
  return (
    <div className="transcribe">
      <div className={`service-card ${health.connected ? "online" : health.reason === "checking" ? "checking" : "offline"}`}>
        <div className="service-line" role="status">
          <span className="dot" aria-hidden="true" />
          <strong>{health.connected ? `已连接 · ${health.model}` : health.reason === "checking" ? "正在检查转写服务…" : "转写服务未连接"}</strong>
          <button className="ghost" onClick={onRecheck} disabled={health.reason === "checking"}>
            <RotateCcw size={13} aria-hidden="true" />
            重新检查
          </button>
        </div>
        {!health.connected && health.reason !== "checking" ? (
          <>
            <p className="hint">{health.message}</p>
            <p className="hint">在仓库根目录的终端里运行（需要 Python 3.12 与 uv；首次转写会下载所选模型）：</p>
            <pre className="commands" tabIndex={0} aria-label="启动转写服务的命令">{START_COMMANDS}</pre>
            <button
              className="ghost"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(START_COMMANDS)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => setCopied(false));
              }}
            >
              <Copy size={13} aria-hidden="true" />
              {copied ? "已复制" : "复制命令"}
            </button>
            <p className="hint">启动后点“重新检查”。服务只在本机 127.0.0.1:8768 监听；其他地址见 README 的 FASTER_WHISPER_URL。</p>
          </>
        ) : null}
      </div>
      {health.connected ? (
        <fieldset className="params" disabled={busy}>
          <legend>transcribe() 参数</legend>
          <label className="stack">
            语言
            <select name="language" value={language} onChange={(e) => onLanguage(e.target.value)}>
              {languages.map(([id, name]) => (
                <option key={id} value={id} disabled={englishOnly && id !== "en" && id !== "auto"}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented" role="radiogroup" aria-label="任务">
            {(["transcribe", "translate"] as const).map((task) => (
              <label key={task}>
                <input
                  type="radio"
                  name="task"
                  value={task}
                  checked={options.task === task}
                  disabled={task === "translate" && (englishOnly || language === "en")}
                  onChange={() => onOptions({ task })}
                />
                <span>{task === "transcribe" ? "转写原文" : "翻译为英语"}</span>
              </label>
            ))}
          </div>
          {options.task === "translate" ? (
            <p className="hint warn">
              Whisper 只能译成英语。实测 small 模型处理中文时仍输出原文；需要译文请用 medium 或 large-v2/v3 启动服务，并清空中文提示词。
            </p>
          ) : null}
          <label className="check">
            <input type="checkbox" checked={options.wordTimestamps} onChange={(e) => onOptions({ wordTimestamps: e.target.checked })} />
            逐词时间戳 <code>word_timestamps</code>
          </label>
          <label className="check">
            <input type="checkbox" checked={options.vadFilter} onChange={(e) => onOptions({ vadFilter: e.target.checked })} />
            静音过滤 <code>vad_filter</code>
          </label>
          {options.vadFilter ? (
            <label className="stack inline">
              最短静音（毫秒）
              <input
                type="number"
                name="vad-min-silence"
                min={100}
                max={5000}
                step={50}
                value={options.vadMinSilenceMs}
                onChange={(e) => onOptions({ vadMinSilenceMs: Math.round(Number(e.target.value) || 0) })}
              />
            </label>
          ) : null}
          <label className="stack inline">
            beam_size
            <input
              type="number"
              name="beam-size"
              min={1}
              max={10}
              value={options.beamSize}
              onChange={(e) => onOptions({ beamSize: Math.round(Number(e.target.value) || 0) })}
            />
          </label>
          <label className="stack">
            提示词 <code>initial_prompt</code>
            <textarea
              name="initial-prompt"
              rows={3}
              maxLength={PROMPT_MAX}
              autoComplete="off"
              placeholder="人名、地名、术语与期望的书写体例…"
              value={options.initialPrompt}
              onChange={(e) => onOptions({ initialPrompt: e.target.value })}
            />
          </label>
          <label className="stack">
            热词 <code>hotwords</code>
            <input
              name="hotwords"
              maxLength={HOTWORDS_MAX}
              autoComplete="off"
              placeholder="以空格分隔"
              value={options.hotwords}
              onChange={(e) => onOptions({ hotwords: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.conditionOnPrevious}
              onChange={(e) => onOptions({ conditionOnPrevious: e.target.checked })}
            />
            承接上文 <code>condition_on_previous_text</code>
          </label>
        </fieldset>
      ) : null}
      <button className="primary" disabled={busy || !!disabledReason} onClick={onStart}>
        <Play size={16} aria-hidden="true" />
        {busy ? "正在提交…" : "开始转写"}
      </button>
      <p className="hint">
        {disabledReason
          ? `${disabledReason}。现有字幕仍可校对与导出。`
          : `${describeOptions(language, options)}。结果进入下方队列，采用后成为新的字幕稿，当前稿保留。`}
      </p>
      <details className="why">
        <summary>为什么不在浏览器里直接转写？</summary>
        <p>
          工作台页面的安全策略只允许同源脚本，不允许编译 WebAssembly，也不允许连接外部模型仓库；transformers.js 的 Whisper 依赖二者，
          打包进应用则需额外 40–250 MB 的模型与运行时。因此转写交给本机的 faster-whisper 服务，校对与导出全部在页面内完成。
        </p>
      </details>
      <section className="queue" aria-label="转写任务">
        <h4>任务队列</h4>
        {jobs.length ? (
          jobs.map((job) => (
            <article className={`job ${job.input.source.id === sourceId ? "mine" : ""}`} key={job.id}>
              <span className={`job-dot ${job.status}`} aria-hidden="true" />
              <div className="job-name">
                <strong>{job.input.source.name}</strong>
                <small>
                  {describeOptions(job.input.language, job.input.options)}
                  {job.model ? ` · ${job.model}` : ""}
                </small>
                {job.info?.language ? (
                  <small>
                    识别为 {job.info.language}（{Math.round(job.info.languageProbability * 100)}%）· 音频 {job.info.duration.toFixed(1)} 秒
                    {job.input.options.vadFilter ? `，VAD 后 ${job.info.durationAfterVad.toFixed(1)} 秒` : ""}
                  </small>
                ) : null}
                {job.error ? <p>{job.error}</p> : null}
              </div>
              <span className="job-status">{statusLabel[job.status]}</span>
              {job.status === "completed" ? (
                <button disabled={busy} onClick={() => onAdopt(job)}>
                  采用为新稿
                </button>
              ) : activeStates.includes(job.status) ? (
                <div className="job-buttons">
                  {job.status === "unknown" ? (
                    <button disabled={busy} onClick={() => onJob(job, "retry")}>
                      用原任务重试
                    </button>
                  ) : null}
                  <button disabled={busy} onClick={() => onJob(job, "cancel")}>
                    取消
                  </button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="hint">暂无转写任务。</p>
        )}
      </section>
    </div>
  );
}
