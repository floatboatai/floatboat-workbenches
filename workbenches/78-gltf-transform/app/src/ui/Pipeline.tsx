import { memo } from "react";
import {
  Scissors,
  CopyMinus,
  Combine,
  TriangleRight,
  AudioWaveform,
  Binary,
  Layers2,
  Merge,
  Boxes,
  Crosshair,
  ImageDown,
  Undo2,
  X,
  Play,
  type LucideIcon,
} from "lucide-react";
import type { AssetDocument } from "../contracts/asset";
import {
  PASSES,
  REPORT_ROWS,
  describePass,
  formatBytes,
  formatDelta,
  PASS_BY_KIND,
  type PassKind,
  type StageReport,
} from "../contracts/pipeline";

export const PASS_ICONS: Record<PassKind, LucideIcon> = {
  prune: Scissors,
  dedup: CopyMinus,
  weld: Combine,
  simplify: TriangleRight,
  resample: AudioWaveform,
  quantize: Binary,
  flatten: Layers2,
  join: Merge,
  instance: Boxes,
  center: Crosshair,
  textureResize: ImageDown,
};
const value = (r: StageReport, key: (typeof REPORT_ROWS)[number]["key"], unit: string) =>
  unit === "bytes" ? formatBytes(r[key]) : r[key].toLocaleString();

const KEY_ROWS: string[] = ["bytes", "drawCalls", "triangles", "uploadVertices", "materials", "gpuBytes", "keyframes"];
interface Props {
  document: AssetDocument;
  sourceReport: StageReport | null;
  viewReport: StageReport | null;
  viewLabel: string;
  valid: number;
  running: PassKind | "pipeline" | null;
  disabled: boolean;
  onDraft: (kind: PassKind, key: string, value: string | boolean) => void;
  onRun: (kind: PassKind) => void;
  onUndo: () => void;
  onRemove: (index: number) => void;
  onPreview: (stage: number) => void;
}
export const Pipeline = memo(function Pipeline(p: Props) {
  const d = p.document,
    previewed = d.view === "source" ? -2 : d.stage < 0 ? d.passes.length : d.stage,
    stage0 = d.stages[0],
    edited = Boolean(stage0 && d.source && stage0.ref.id !== d.source.id);
  return (
    <div className="pipeline">
      {p.sourceReport && p.viewReport && p.viewLabel !== "原件" ? (
        <section aria-labelledby="compare-title">
          <h3 id="compare-title" className="section-title">
            对比 <span>原件 → {p.viewLabel}</span>
          </h3>
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">指标</th>
                <th scope="col">原件</th>
                <th scope="col">{p.viewLabel}</th>
                <th scope="col">变化</th>
              </tr>
            </thead>
            <tbody>
              {REPORT_ROWS.filter((row) => KEY_ROWS.includes(row.key)).map((row) => {
                const a = p.sourceReport![row.key],
                  b = p.viewReport![row.key];
                return (
                  <tr key={row.key} className={b < a ? "is-down" : b > a ? "is-up" : ""}>
                    <th scope="row">{row.label}</th>
                    <td>{value(p.sourceReport!, row.key, row.unit)}</td>
                    <td>{value(p.viewReport!, row.key, row.unit)}</td>
                    <td>{formatDelta(a, b)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
      <section aria-labelledby="stack-title">
        <h3 id="stack-title" className="section-title">
          阶段 <span>{d.passes.length} 步</span>
          <button
            className="text-button"
            disabled={p.disabled || !d.passes.length}
            onClick={p.onUndo}
          >
            <Undo2 size={13} />
            撤销上一步
          </button>
        </h3>
        <ol className="stage-stack">
          <li>
            <button
              className="stage-row"
              aria-current={previewed === -2 ? "true" : undefined}
              onClick={() => p.onPreview(-2)}
            >
              <span className="stage-index">0</span>
              <span className="stage-label">
                <b>原件</b>
                <small>{d.source?.name}</small>
              </span>
              <span className="stage-size">
                {p.sourceReport ? formatBytes(p.sourceReport.bytes) : "—"}
              </span>
            </button>
          </li>
          {edited ? (
            <li>
              <button
                className="stage-row"
                aria-current={previewed === 0 ? "true" : undefined}
                disabled={p.valid < 1}
                onClick={() => p.onPreview(0)}
              >
                <span className="stage-index">✎</span>
                <span className="stage-label">
                  <b>修订</b>
                  <small>{p.valid < 1 ? "待更新" : stage0.note}</small>
                </span>
                <span className="stage-size">{formatBytes(stage0.report.bytes)}</span>
              </button>
            </li>
          ) : null}
          {d.passes.map((step, i) => {
            const stage = d.stages[i + 1],
              before = d.stages[i]?.report,
              fresh = i + 1 < p.valid,
              Icon = PASS_ICONS[step.kind];
            return (
              <li key={step.id} className={fresh ? "" : "is-stale"}>
                <button
                  className="stage-row"
                  aria-current={previewed === i + 1 ? "true" : undefined}
                  disabled={!fresh}
                  onClick={() => p.onPreview(i + 1)}
                >
                  <span className="stage-index">
                    <Icon size={13} aria-hidden="true" />
                  </span>
                  <span className="stage-label">
                    <b>
                      {i + 1}. {PASS_BY_KIND[step.kind].label}
                      {describePass(step) ? <em> · {describePass(step)}</em> : null}
                    </b>
                    <small>
                      {fresh && stage
                        ? [stage.ms + " ms", stage.note].filter(Boolean).join(" · ")
                        : p.running
                          ? "等待运行"
                          : "待更新"}
                    </small>
                  </span>
                  <span className="stage-size">
                    {fresh && stage ? formatBytes(stage.report.bytes) : "—"}
                    {fresh && stage && before ? (
                      <small>{formatDelta(before.bytes, stage.report.bytes)}</small>
                    ) : null}
                  </span>
                </button>
                <button
                  className="icon-button stage-remove"
                  aria-label={`移除第 ${i + 1} 步 ${PASS_BY_KIND[step.kind].label}`}
                  disabled={p.disabled}
                  onClick={() => p.onRemove(i)}
                >
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      <section aria-labelledby="passes-title">
        <h3 id="passes-title" className="section-title">
          优化步骤 <span>运行即追加并预览</span>
        </h3>
        <ul className="pass-list">
          {PASSES.map((spec) => {
            const Icon = PASS_ICONS[spec.kind],
              draft = d.passDrafts[spec.kind] ?? {},
              busy = p.running === spec.kind;
            return (
              <li key={spec.kind} className="pass-row">
                <span className="pass-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div className="pass-text">
                  <b>{spec.label}</b>
                  <small>{spec.hint}</small>
                  {spec.options.length ? (
                    <div className="pass-options">
                      {spec.options.map((o) => {
                        const id = `pass-${spec.kind}-${o.key}`,
                          raw = draft[o.key];
                        if (o.type === "boolean")
                          return (
                            <label key={o.key} className="pass-check">
                              <input
                                type="checkbox"
                                name={id}
                                checked={typeof raw === "boolean" ? raw : o.value}
                                onChange={(e) => p.onDraft(spec.kind, o.key, e.target.checked)}
                              />
                              {o.label}
                            </label>
                          );
                        if (o.type === "select")
                          return (
                            <label key={o.key} className="pass-field">
                              <span>{o.label}</span>
                              <select
                                name={id}
                                value={typeof raw === "string" ? raw : o.value}
                                onChange={(e) => p.onDraft(spec.kind, o.key, e.target.value)}
                              >
                                {o.values.map((v) => (
                                  <option key={v.value} value={v.value}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        return (
                          <label key={o.key} className="pass-field">
                            <span>{o.label}</span>
                            <input
                              name={id}
                              inputMode="decimal"
                              autoComplete="off"
                              spellCheck={false}
                              maxLength={16}
                              value={typeof raw === "string" ? raw : String(o.value)}
                              onChange={(e) => p.onDraft(spec.kind, o.key, e.target.value)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <button
                  className="run-pass"
                  disabled={p.disabled || !d.source}
                  aria-label={`运行${spec.label}`}
                  onClick={() => p.onRun(spec.kind)}
                >
                  {busy ? "运行中…" : <Play size={13} />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
});
