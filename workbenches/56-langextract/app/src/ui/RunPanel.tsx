import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import type { PendingRun } from "../contracts/evidence";
import type { ChannelState, ServiceState } from "./useRuns";

export type Channel = "host" | "service";
export type Scope = "current" | "batch";

/** Extraction launcher: scope, channel status next to the action, start-up help and re-check. */
export function RunPanel({
  host,
  service,
  model,
  setModel,
  docCount,
  currentDoc,
  currentEmpty,
  batchChars,
  warnings,
  pending,
  sending,
  onStart,
  onRetry,
  onDiscard,
  onCheck,
}: {
  host: ChannelState;
  service: ServiceState;
  model: string;
  setModel: (v: string) => void;
  docCount: number;
  currentDoc: string;
  currentEmpty: boolean;
  batchChars: number;
  warnings: string[];
  pending: PendingRun | null;
  sending: boolean;
  onStart: (channel: Channel, scope: Scope) => void;
  onRetry: () => void;
  onDiscard: () => void;
  onCheck: () => void;
}) {
  const [channel, setChannel] = useState<Channel>(host.available || !service.available ? "host" : "service");
  const [scope, setScope] = useState<Scope>("batch");
  const ready = channel === "host" ? host.available : service.available;
  const blocked = !ready
    ? channel === "host"
      ? "Floatboat 模型未连接"
      : "Python 服务未就绪"
    : scope === "current" && currentEmpty
      ? "当前资料没有原文"
      : "";
  return (
    <div className="run-panel">
      <h2>抽取</h2>
      {pending && (
        <div className="source-warning" role="status">
          有一份提交结果未确认（{pending.channel === "host" ? "Floatboat 模型" : "Python 服务"}）。重试会沿用原任务标识，不会重复计费。
          <div className="row">
            <button onClick={onRetry} disabled={sending}>
              重试原任务提交
            </button>
            <button className="text-button" onClick={onDiscard}>
              放弃这次提交
            </button>
          </div>
        </div>
      )}
      <fieldset>
        <legend>范围</legend>
        <label className="radio">
          <input type="radio" name="run-scope" checked={scope === "batch"} onChange={() => setScope("batch")} />
          整个批次 · {docCount} 份资料 · {new Intl.NumberFormat("zh-CN").format(batchChars)} 字符
        </label>
        <label className="radio">
          <input type="radio" name="run-scope" checked={scope === "current"} onChange={() => setScope("current")} />
          当前资料 · {currentDoc}
        </label>
      </fieldset>
      <fieldset>
        <legend>通道</legend>
        <label className={"channel " + (host.available ? "ok" : "off")}>
          <input type="radio" name="run-channel" checked={channel === "host"} onChange={() => setChannel("host")} />
          <span>
            <strong>Floatboat 模型</strong>
            <small role="status">{host.checking ? "正在检查…" : host.message}</small>
          </span>
        </label>
        {channel === "host" && (
          <label className="model-field">
            模型 ID
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              maxLength={120}
              aria-describedby="model-help"
            />
            <small id="model-help">由 Floatboat 解析路由与凭据。分段、提示词、解析和原文对齐在本工作台的 Node 服务中完成。</small>
          </label>
        )}
        <label className={"channel " + (service.available ? "ok" : "off")}>
          <input type="radio" name="run-channel" checked={channel === "service"} onChange={() => setChannel("service")} />
          <span>
            <strong>LangExtract Python 服务（可选）</strong>
            <small role="status">{service.checking ? "正在检查…" : service.message}</small>
          </span>
        </label>
        {channel === "service" && !service.available && (
          <details className="setup" open>
            <summary>启动方式</summary>
            <p>在工作台目录创建 Python 环境并启动服务（需要 langextract==1.7.1 和模型凭据）：</p>
            <pre translate="no">{`uv venv service/.venv
uv pip install --python service/.venv/bin/python -r service/requirements.lock
export LANGEXTRACT_SERVICE_TOKEN=<随机连接密钥>
export LX_MODEL_ID=<模型 ID>  LANGEXTRACT_API_KEY=<提供方密钥>
service/.venv/bin/python service/server.py`}</pre>
            <p>
              再在工作台服务器进程设置 <code>LANGEXTRACT_SERVICE_URL=http://127.0.0.1:8767</code> 与相同的{" "}
              <code>LANGEXTRACT_SERVICE_TOKEN</code>，重启预览后点“重新检查”。服务一次最多 8 份资料、每份 3 万字符。
            </p>
          </details>
        )}
        <button className="text-button" onClick={onCheck} disabled={host.checking || service.checking}>
          <RotateCcw size={14} aria-hidden="true" />
          重新检查
        </button>
      </fieldset>
      {warnings.length > 0 && (
        <ul className="example-warnings">
          {warnings.slice(0, 4).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <div className="run-actions">
        <button className="primary" data-autofocus disabled={!!blocked || sending || !!pending} onClick={() => onStart(channel, scope)} aria-describedby="run-blocked">
          <Play size={15} aria-hidden="true" />
          {sending ? "正在提交…" : scope === "batch" ? `抽取 ${docCount} 份资料` : "抽取当前资料"}
        </button>
        <span id="run-blocked" className="hint">
          {blocked || (pending ? "请先处理未确认的提交" : "结果将另开为新批次，等待复核。")}
        </span>
      </div>
      <p className="hint offline-hint">
        没有模型时：在原文中选中文字即可手工标注；也可从“档案”导入 LangExtract JSONL 结果。
      </p>
    </div>
  );
}
