import {
  X,
  Layers,
  RotateCcw,
  ArrowDownToLine,
  FileJson,
  Check,
} from "lucide-react";
import type { AssetDocument, MaterialEdit, NodeEdit } from "../contracts/asset";
import type { Inspection } from "../contracts/inspection";
const size = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + " MB" : (n / 1000).toFixed(1) + " KB";
function Field({
  label,
  value,
  onChange,
  limit = 160,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  limit?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={label}
        inputMode={label.includes("0–1") ? "decimal" : undefined}
        value={value ?? ""}
        maxLength={limit}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}
interface Props {
  open: boolean;
  mode: "object" | "notes";
  document: AssetDocument;
  source: Inspection | null;
  result: Inspection | null;
  locked: boolean;
  pending: string;
  stale: boolean;
  changes: number;
  onClose: () => void;
  onMaterial: (patch: MaterialEdit) => void;
  onNode: (patch: NodeEdit) => void;
  onNotes: (v: string) => void;
  onRootExtras: (v: string) => void;
  onReset: () => void;
  onGenerate: () => void;
  onExport: () => void;
  onProject: () => void;
  onRecovery: () => void;
}
export function Inspector(p: Props) {
  const d = p.document,
    material = p.source?.materials[d.selected],
    node = p.source?.nodes[d.selected],
    m = { ...material, ...d.edits.materials[d.selected] },
    n = { ...node, ...d.edits.nodes[d.selected] };
  const label =
    p.mode === "notes"
      ? "检查备注"
      : d.tab === "materials"
        ? "材质"
        : d.tab === "nodes"
          ? "节点"
          : "资源";
  return (
    <aside className="inspector" hidden={!p.open} aria-label="模型检查器">
      <header>
        <div>
          <span className="eyebrow">{label}</span>
          <h2>
            {p.mode === "notes"
              ? "交付前记录"
              : d.tab === "resources"
                ? "文件与资源"
                : d.tab === "materials"
                  ? m.name || "未命名材质"
                  : n.name || "未命名节点"}
          </h2>
        </div>
        <button
          aria-label="收起检查器"
          className="icon-button"
          onClick={p.onClose}
        >
          <X size={17} />
        </button>
      </header>
      <fieldset disabled={p.locked} className="inspector-fields">
        <div className="inspector-body">
          {p.mode === "notes" ? (
            <>
              <label className="field">
                <span>检查备注</span>
                <textarea
                  id="notes"
                  name="review-notes"
                  autoComplete="off"
                  aria-label="检查备注"
                  value={d.notes}
                  maxLength={40000}
                  onChange={(e) => p.onNotes(e.target.value)}
                  rows={12}
                  placeholder="记录命名、贴图或交付事项…"
                />
              </label>
              <p className="quiet">备注随工程保存，不写入模型文件。</p>
            </>
          ) : d.tab === "materials" && material ? (
            <>
              <div className="material-identity">
                <span
                  className="material-orb"
                  style={{
                    background: /^#[\da-f]{6}$/i.test(m.color ?? "")
                      ? m.color
                      : material.color,
                  }}
                />
                <span>
                  {material.texture === "无底色贴图"
                    ? "纯色材质"
                    : material.texture}
                  <small>METALLIC / ROUGHNESS</small>
                </span>
              </div>
              <Field
                label="材质名称"
                value={m.name}
                onChange={(v) => p.onMaterial({ name: v })}
              />
              <Field
                label="底色 · sRGB HEX"
                value={m.color}
                onChange={(v) => p.onMaterial({ color: v })}
                limit={32}
              />
              <div className="field-pair">
                <Field
                  label="金属度 · 0–1"
                  value={m.metallic}
                  onChange={(v) => p.onMaterial({ metallic: v })}
                  limit={32}
                />
                <Field
                  label="粗糙度 · 0–1"
                  value={m.roughness}
                  onChange={(v) => p.onMaterial({ roughness: v })}
                  limit={32}
                />
              </div>
              <div className="field-pair">
                <Field
                  label="不透明度 · 0–1"
                  value={m.opacity}
                  onChange={(v) => p.onMaterial({ opacity: v })}
                  limit={32}
                />
                <label className="field">
                  <span>透明模式</span>
                  <select
                    name="material-alpha-mode"
                    value={m.alphaMode}
                    onChange={(e) =>
                      p.onMaterial({
                        alphaMode: e.target.value as MaterialEdit["alphaMode"],
                      })
                    }
                  >
                    <option>OPAQUE</option>
                    <option>MASK</option>
                    <option>BLEND</option>
                  </select>
                </label>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  name="material-double-sided"
                  checked={m.doubleSided ?? false}
                  onChange={(e) =>
                    p.onMaterial({ doubleSided: e.target.checked })
                  }
                />
                双面渲染
              </label>
              <details className="metadata">
                <summary>材质附加信息</summary>
                <label className="field">
                  <span>材质附加信息 · JSON</span>
                  <textarea
                    name="material-extras"
                    autoComplete="off"
                    value={m.extras ?? "{}"}
                    maxLength={60000}
                    rows={5}
                    spellCheck={false}
                    onChange={(e) => p.onMaterial({ extras: e.target.value })}
                  />
                </label>
              </details>
            </>
          ) : d.tab === "nodes" && node ? (
            <>
              <Field
                label="节点名称"
                value={n.name}
                onChange={(v) => p.onNode({ name: v })}
              />
              <dl className="resource-grid">
                <dt>网格</dt>
                <dd>{node.mesh || "无"}</dd>
                <dt>平移 XYZ</dt>
                <dd>{node.translation.map((v) => v.toFixed(3)).join(" / ")}</dd>
                <dt>子节点</dt>
                <dd>{node.children}</dd>
              </dl>
              <label className="field">
                <span>节点附加信息 · JSON</span>
                <textarea
                  name="node-extras"
                  autoComplete="off"
                  value={n.extras ?? "{}"}
                  rows={8}
                  maxLength={60000}
                  spellCheck={false}
                  onChange={(e) => p.onNode({ extras: e.target.value })}
                />
              </label>
            </>
          ) : d.tab === "resources" && p.source ? (
            <>
              <dl className="resource-grid">
                <dt>场景</dt>
                <dd>{p.source.scenes.join(" / ")}</dd>
                <dt>几何访问器</dt>
                <dd>{size(p.source.geometryBytes)}</dd>
                <dt>图像像素</dt>
                <dd>{p.source.pixels.toLocaleString()}</dd>
                <dt>骨架 / 动画</dt>
                <dd>
                  {p.source.skins} / {p.source.animations.length}
                </dd>
              </dl>
              <div className="image-resources">
                {p.source.images.map((image, i) => (
                  <div key={i}>
                    <Layers size={14} />
                    <span>
                      <b>{image.name}</b>
                      <small>
                        {image.mime} · {size(image.bytes)}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
              <details className="metadata">
                <summary>原件与结果标识</summary>
                <p className="quiet">模型按 SHA-256 分别保存。</p>
                <b>原件</b>
                <code>{d.source?.id}</code>
                <b>修订结果</b>
                <code>{d.result?.id ?? "尚未生成"}</code>
              </details>
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
            </>
          ) : (
            <p className="quiet">从模型中选择一个节点或材质。</p>
          )}
        </div>
        <div className="delivery">
          <div className="revision-state">
            <span>
              {d.result
                ? p.stale
                  ? "有修改待更新"
                  : "修订已就绪"
                : "修订尚未生成"}
            </span>
            <button
              className="icon-button"
              aria-label="重置修订配方"
              disabled={!p.changes || Boolean(p.pending)}
              onClick={p.onReset}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <button
            className="primary generate"
            disabled={!p.source || Boolean(p.pending)}
            onClick={p.onGenerate}
          >
            <Check size={16} />
            {p.pending === "生成修订"
              ? "正在生成…"
              : p.stale
                ? "更新修订"
                : "生成修订"}
            <span>{p.changes} 项</span>
          </button>
          <div className="export-actions">
            <button
              disabled={!d.result || p.stale || Boolean(p.pending)}
              onClick={p.onExport}
            >
              <ArrowDownToLine size={15} />
              导出 GLB
            </button>
            <button
              disabled={!d.source || Boolean(p.pending)}
              onClick={p.onProject}
            >
              <FileJson size={15} />
              完整工程
            </button>
          </div>
          <button className="quiet-button" onClick={p.onRecovery}>
            下载恢复稿
          </button>
        </div>
      </fieldset>
    </aside>
  );
}
