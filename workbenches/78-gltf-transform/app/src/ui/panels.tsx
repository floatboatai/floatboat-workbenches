import { useEffect, useState } from "react";
import { ImageUp, Undo2, Play, Pause } from "lucide-react";
import { formatBytes, REPORT_ROWS } from "../contracts/pipeline";
import { fetchBlob } from "./files";
import { dataUri } from "./preview";
import type { InspectorProps } from "./Inspector";

/** Loads an image through the page connection; CSP permits data: images only. */
function Thumb({ path, label }: { path: string; label: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setSrc("");
    setFailed(false);
    void fetchBlob(path)
      .then(async (r) => {
        const type = r.headers.get("content-type") ?? "image/png",
          bytes = new Uint8Array(await r.arrayBuffer());
        if (!alive) return;
        if (type === "image/ktx2") setFailed(true);
        else setSrc(dataUri(bytes, type));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path]);
  return (
    <span className="thumb">
      {src ? (
        <img src={src} alt={label} width={56} height={56} loading="lazy" />
      ) : (
        <i>{failed ? "无预览" : "…"}</i>
      )}
    </span>
  );
}

/** Original textures with size, format, GPU estimate, slots and replacement. */
export function TexturePanel({ p }: { p: InspectorProps }) {
  const d = p.document;
  if (!p.source) return null;
  return (
    <>
{p.source.textures.length ? (
              <ul className="texture-list">
                {p.source.textures.map((t) => {
                  const replaced = d.edits.textures[t.index];
                  return (
                    <li key={t.index} className={replaced ? "is-replaced" : ""}>
                      <Thumb
                        path={replaced ? `/api/models/${replaced.id}` : `/api/models/${d.source!.id}/textures/${t.index}`}
                        label={t.name}
                      />
                      <div>
                        <b>{t.name}</b>
                        <small>
                          {replaced
                            ? `替换为 ${replaced.name} · ${replaced.width}×${replaced.height} · ${formatBytes(replaced.bytes)}`
                            : `${t.mime.replace("image/", "").toUpperCase()} · ${t.width}×${t.height} · ${formatBytes(t.bytes)}`}
                        </small>
                        <small>
                          显存 ≈ {formatBytes(t.gpuBytes)} · {t.slots.join("、") || "未使用"}
                        </small>
                        <div className="texture-actions">
                          <button className="text-button" onClick={() => p.onReplaceTexture(t.index)}>
                            <ImageUp size={13} />
                            替换
                          </button>
                          {replaced ? (
                            <button className="text-button" onClick={() => p.onRevertTexture(t.index)}>
                              <Undo2 size={13} />
                              还原
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="quiet">此模型没有贴图。</p>
            )}
    </>
  );
}

/** Clips of the previewed model; selecting a clip plays it on the canvas. */
export function ClipPanel({ p }: { p: InspectorProps }) {
  const clip = Number(p.document.clip) || 0;
  return (
    <>
{p.view?.animations.length ? (
              <ul className="clip-list">
                {p.view.animations.map((a, i) => (
                  <li key={i}>
                    <button
                      className="clip-row"
                      aria-pressed={clip === i}
                      onClick={() => p.onClip(i, !(clip === i && p.playing))}
                    >
                      {clip === i && p.playing ? <Pause size={14} /> : <Play size={14} />}
                      <span>
                        <b>{a.name}</b>
                        <small>
                          {a.duration.toFixed(2)} s · {a.channels} 通道 · {a.keyframes.toLocaleString()} 关键帧 · {formatBytes(a.bytes)}
                        </small>
                        <small>{a.targets.join("、")}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet">{p.viewLabel}没有动画片段。</p>
            )}
    </>
  );
}

/** glTF Transform inspect() style report for the previewed stage. */
export function ReportPanel({ p }: { p: InspectorProps }) {
  const d = p.document;
  if (!p.view) return null;
  return (
            <>
              <p className="quiet">当前：{p.viewLabel} · {p.view.engine}</p>
              <dl className="resource-grid">
                {REPORT_ROWS.map((row) => (
                  <div key={row.key} className="grid-pair">
                    <dt>{row.label}</dt>
                    <dd>
                      {row.unit === "bytes"
                        ? formatBytes(p.view!.report[row.key])
                        : p.view!.report[row.key].toLocaleString()}
                      {p.sourceReport && p.view!.report[row.key] !== p.sourceReport[row.key] ? (
                        <small>
                          {" "}原件{" "}
                          {row.unit === "bytes"
                            ? formatBytes(p.sourceReport[row.key])
                            : p.sourceReport[row.key].toLocaleString()}
                        </small>
                      ) : null}
                    </dd>
                  </div>
                ))}
                <div className="grid-pair">
                  <dt>场景</dt>
                  <dd>{p.view.scenes.join(" / ") || "—"}</dd>
                </div>
                <div className="grid-pair">
                  <dt>尺寸</dt>
                  <dd>
                    {p.view.bounds
                      ? p.view.bounds.max.map((v, i) => (v - p.view!.bounds!.min[i]).toFixed(2)).join(" × ")
                      : "—"}
                  </dd>
                </div>
              </dl>
              <h3 className="section-title">扩展</h3>
              <p className="ext-list">
                {p.view.extensions.length
                  ? p.view.extensions.map((e) => (
                      <code key={e.name}>
                        {e.name}
                        {e.required ? " · 必需" : ""}
                      </code>
                    ))
                  : "无"}
              </p>
              {p.view.warnings.length ? (
                <ul className="warnings">
                  {p.view.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <h3 className="section-title">网格 <span>按大小</span></h3>
              <table className="mesh-table">
                <thead>
                  <tr>
                    <th scope="col">网格</th>
                    <th scope="col">顶点</th>
                    <th scope="col">面</th>
                    <th scope="col">大小</th>
                  </tr>
                </thead>
                <tbody>
                  {p.view.meshes.slice(0, 40).map((row, i) => (
                    <tr key={i}>
                      <th scope="row">
                        {row.name}
                        {row.instances > 1 ? <small> ×{row.instances}</small> : null}
                      </th>
                      <td>{row.vertices.toLocaleString()}</td>
                      <td>{row.triangles.toLocaleString()}</td>
                      <td>{formatBytes(row.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details className="metadata">
                <summary>资源标识</summary>
                <b>原件</b>
                <code>{d.source?.id}</code>
                <b>最终结果</b>
                <code>{d.result?.id ?? "尚未生成"}</code>
              </details>
              {p.source ? (
                <details className="metadata">
                  <summary>资产附加信息</summary>
                  <label className="field">
                    <span>资产附加信息 · JSON</span>
                    <textarea
                      name="asset-extras"
                      autoComplete="off"
                      value={d.edits.rootExtras ?? p.source.rootExtras}
                      rows={7}
                      maxLength={60000}
                      spellCheck={false}
                      onChange={(e) => p.onRootExtras(e.target.value)}
                    />
                  </label>
                </details>
              ) : null}
            </>
  );
}
