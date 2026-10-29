// ABOUTME: 原生引擎状态卡：说明受影响的动作、给出安装/启动命令并可重新检查。
import { RefreshCw, Cpu } from "lucide-react";

export interface EngineState {
  phase: "checking" | "ready" | "missing";
  message: string;
  service: string;
  engine: string;
  checkedAt: string;
}
export function parseEngine(value: unknown): EngineState {
  const v = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const s = (x: unknown) => (typeof x === "string" ? x.slice(0, 300) : "");
  return {
    phase: v.available === true ? "ready" : "missing",
    message: s(v.message) || "原生引擎不可用。",
    service: s(v.service) || "127.0.0.1:8796",
    engine: s(v.engine),
    checkedAt: s(v.checkedAt),
  };
}
const time = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
};

export function EngineCard({ state, onRecheck, compact = false }: { state: EngineState; onRecheck: () => void; compact?: boolean }) {
  if (state.phase === "ready")
    return (
      <section className="engine-card ready" aria-label="原生引擎状态">
        <p className="engine-title">
          <Cpu size={15} aria-hidden="true" />
          原生引擎已连接
        </p>
        <p>
          {state.engine || "FigCraft CLI"} · {state.service}。原生渲染、PNG/PDF 导出与修改都经由引擎完成，文字框会按真实字体重排。
        </p>
        <button type="button" onClick={onRecheck}>
          <RefreshCw size={14} aria-hidden="true" />
          重新检查
        </button>
      </section>
    );
  return (
    <section className={"engine-card" + (compact ? " compact" : "")} aria-label="原生引擎状态" aria-live="polite">
      <p className="engine-title">
        <Cpu size={15} aria-hidden="true" />
        {state.phase === "checking" ? "正在检查原生引擎…" : "原生引擎未连接"}
      </p>
      <p>
        原生 PNG/PDF 与原生渲染需要本机 FigCraft CLI 0.11.2 服务。校样、文案/名称/填色/交付状态修改，以及 SVG/PNG 近似导出不受影响。
      </p>
      {state.phase === "missing" ? (
        <>
          <ol className="engine-steps">
            <li>
              下载官方 FigCraft CLI 0.11.2（GitHub storytold/figcraft Releases，tag v0.11.2），按 SHA256SUMS 核对。
            </li>
            <li>
              在工作台源码的 <code>service/</code> 目录安装：
              <code className="cmd">pnpm install --frozen-lockfile --ignore-scripts</code>
            </li>
            <li>
              启动适配服务（默认监听 127.0.0.1:8796）：
              <code className="cmd">FIGCRAFT_CLI=/绝对路径/figcraft-cli pnpm start</code>
            </li>
            <li>
              非默认地址时，为工作台服务设置 <code>FIGCRAFT_SERVICE_URL</code>（远程须 HTTPS），可选 <code>FIGCRAFT_SERVICE_TOKEN</code>。
            </li>
          </ol>
          <p className="engine-meta">
            当前地址 {state.service} · {state.message}
            {state.checkedAt ? ` · 检查于 ${time(state.checkedAt)}` : ""}
          </p>
        </>
      ) : null}
      <button type="button" onClick={onRecheck} aria-busy={state.phase === "checking"}>
        <RefreshCw size={14} aria-hidden="true" />
        {state.phase === "checking" ? "检查中…" : "重新检查"}
      </button>
    </section>
  );
}
