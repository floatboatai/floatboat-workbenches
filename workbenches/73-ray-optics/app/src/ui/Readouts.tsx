import type { Trace } from "./NativeBench";
import { useTrace } from "./trace-store";
import { qualityBudgets, type Quality } from "../contracts/optics";

const phaseText: Record<Trace["phase"], string> = {
  loading: "正在载入光学内核…",
  tracing: "追踪中",
  done: "光路已更新",
  limit: "已达质量上限",
  stopped: "已停止",
  error: "无法追踪",
};
const fmt = (n: number) => (Math.abs(n) >= 1000 ? n.toFixed(0) : Math.abs(n) >= 1 ? n.toFixed(3) : n.toPrecision(3));

/** Fixed-height strip under the bench: trace state and detector readings. */
export function Readouts({ quality, onSelect, onStop }: { quality: Quality; onSelect(index: number): void; onStop(): void }) {
  const trace = useTrace();
  const budget = qualityBudgets[quality];
  return (
    <section className="readouts" aria-label="探测器读数与追踪状态">
      <div className="trace-state" data-phase={trace.phase}>
        <span className="dot" aria-hidden="true" />
        <span role="status">{phaseText[trace.phase]}</span>
        <span className="mono">
          {trace.rays.toLocaleString("zh-CN")} 段{trace.phase !== "loading" ? " · " + trace.ms + " ms" : ""}
        </span>
        {trace.phase === "tracing" ? (
          <button type="button" className="link" onClick={onStop}>
            停止
          </button>
        ) : null}
        {trace.phase === "limit" ? (
          <span className="hint">质量“{budget.label}”上限 {budget.rays.toLocaleString("zh-CN")} 段；可在平台工具条提高质量。</span>
        ) : null}
      </div>
      {trace.error ? (
        <p className="trace-message error" role="alert">
          {trace.error}
        </p>
      ) : trace.warning ? (
        <p className="trace-message">{trace.warning}</p>
      ) : null}
      {trace.readings.length ? (
        <table>
          <caption className="sr-only">探测器读数（任意单位）</caption>
          <thead>
            <tr>
              <th scope="col">探测器</th>
              <th scope="col">功率 P</th>
              <th scope="col">法向动量 F⊥</th>
              <th scope="col">切向动量 F∥</th>
            </tr>
          </thead>
          <tbody>
            {trace.readings.map((r) => (
              <tr key={r.index}>
                <th scope="row">
                  <button type="button" className="link" onClick={() => onSelect(r.index)}>
                    {r.name}
                  </button>
                </th>
                <td className="mono">{fmt(r.power)}</td>
                <td className="mono">{fmt(r.normal)}</td>
                <td className="mono">{fmt(r.shear)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">场景中没有探测器。从器材架“测量与标注”放入探测器即可读出通过的功率与动量分量。</p>
      )}
    </section>
  );
}
