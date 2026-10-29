import { memo, type ReactNode } from "react";
import {
  X,
  RotateCcw,
  ArrowDownToLine,
  FileArchive,
  Check,
  Undo2,
} from "lucide-react";
import type {
  AssetDocument,
  Compression,
  MaterialEdit,
  NodeEdit,
  Vec3Text,
} from "../contracts/asset";
import type { Inspection, NodeRow } from "../contracts/inspection";
import type { StageReport } from "../contracts/pipeline";
import { display } from "../contracts/transform";
import { ClipPanel, ReportPanel, TexturePanel } from "./panels";

function Field({
  label,
  value,
  onChange,
  limit = 160,
  decimal = false,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  limit?: number;
  decimal?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={label}
        inputMode={decimal ? "decimal" : undefined}
        value={value ?? ""}
        maxLength={limit}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}

const AXES = ["X", "Y", "Z"] as const;
function VecField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Vec3Text;
  onChange: (v: Vec3Text) => void;
}) {
  return (
    <fieldset className="vec-field">
      <legend>{label}</legend>
      {AXES.map((axis, i) => (
        <label key={axis}>
          <span>{axis}</span>
          <input
            name={`${label}-${axis}`}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            value={value[i]}
            onChange={(e) => {
              const next = [...value] as Vec3Text;
              next[i] = e.target.value;
              onChange(next);
            }}
          />
        </label>
      ))}
    </fieldset>
  );
}
const vec = (v: number[]): Vec3Text => [display(v[0]), display(v[1]), display(v[2])];

export type InspectorMode = "object" | "notes";
export interface InspectorProps {
  open: boolean;
  mode: InspectorMode;
  document: AssetDocument;
  source: Inspection | null;
  view: Inspection | null;
  viewLabel: string;
  sourceReport: StageReport | null;
  pipeline: ReactNode;
  locked: boolean;
  pending: string;
  stale: boolean;
  changes: number;
  playing: boolean;
  onClose: () => void;
  onMaterial: (patch: MaterialEdit) => void;
  onNode: (patch: NodeEdit) => void;
  onResetNode: () => void;
  onNotes: (v: string) => void;
  onRootExtras: (v: string) => void;
  onReplaceTexture: (index: number) => void;
  onRevertTexture: (index: number) => void;
  onClip: (index: number, play: boolean) => void;
  onReset: () => void;
  onApply: () => void;
  onCompression: (c: Compression) => void;
  onExport: () => void;
  onProject: () => void;
  onRecovery: () => void;
}
const TITLES: Record<AssetDocument["tab"], string> = {
  optimize: "优化流水线",
  materials: "材质",
  nodes: "节点",
  textures: "贴图",
  animations: "动画片段",
  resources: "检查报告",
};
export const Inspector = memo(function Inspector(p: InspectorProps) {
  const d = p.document,
    material = p.source?.materials[d.selected],
    node: NodeRow | undefined = p.source?.nodes[d.selected],
    m = { ...material, ...d.edits.materials[d.selected] },
    nodeEdit = d.edits.nodes[d.selected] ?? {},
    notes = p.mode === "notes";
  const heading = notes
    ? "交付前记录"
    : d.tab === "materials"
      ? m.name || "未命名材质"
      : d.tab === "nodes"
        ? (nodeEdit.name ?? node?.name) || "未命名节点"
        : TITLES[d.tab];
  const clip = Number(d.clip) || 0;
  return (
    <aside className="inspector" hidden={!p.open} aria-label="模型检查器">
      <header>
        <div>
          <span className="eyebrow">
            {notes
              ? "检查备注"
              : d.tab === "optimize"
                ? "glTF Transform"
                : d.tab === "animations" || d.tab === "resources"
                  ? "预览 · " + p.viewLabel
                  : "修订原件 · 应用后进入流水线"}
          </span>
          <h2>{heading}</h2>
        </div>
        <button aria-label="收起检查器" className="icon-button" onClick={p.onClose}>
          <X size={17} />
        </button>
      </header>
      <fieldset disabled={p.locked} className="inspector-fields">
        <div className="inspector-body">
          {notes ? (
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
          ) : d.tab === "optimize" ? (
            p.pipeline
          ) : d.tab === "materials" && material ? (
            <>
              <div className="material-identity">
                <span
                  className="material-orb"
                  style={{
                    background: /^#[\da-f]{6}$/i.test(m.color ?? "") ? m.color : material.color,
                  }}
                />
                <span>
                  {material.texture ? "底色贴图 · " + material.texture : "纯色材质"}
                  <small>
                    {material.extensions.length ? material.extensions.join(" · ") : "METALLIC / ROUGHNESS"}
                  </small>
                </span>
              </div>
              <Field label="材质名称" value={m.name} onChange={(v) => p.onMaterial({ name: v })} />
              <Field
                label="底色 · sRGB HEX"
                value={m.color}
                onChange={(v) => p.onMaterial({ color: v })}
                limit={32}
              />
              <div className="field-pair">
                <Field label="金属度 · 0–1" decimal value={m.metallic} onChange={(v) => p.onMaterial({ metallic: v })} limit={32} />
                <Field label="粗糙度 · 0–1" decimal value={m.roughness} onChange={(v) => p.onMaterial({ roughness: v })} limit={32} />
              </div>
              <div className="field-pair">
                <Field label="不透明度 · 0–1" decimal value={m.opacity} onChange={(v) => p.onMaterial({ opacity: v })} limit={32} />
                <label className="field">
                  <span>透明模式</span>
                  <select
                    name="material-alpha-mode"
                    value={m.alphaMode}
                    onChange={(e) => p.onMaterial({ alphaMode: e.target.value as MaterialEdit["alphaMode"] })}
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
                  onChange={(e) => p.onMaterial({ doubleSided: e.target.checked })}
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
                value={nodeEdit.name ?? node.name}
                onChange={(v) => p.onNode({ name: v })}
              />
              <VecField
                label="平移"
                value={nodeEdit.translation ?? vec(node.translation)}
                onChange={(v) => p.onNode({ translation: v })}
              />
              <VecField
                label="旋转 · 欧拉 XYZ 度"
                value={nodeEdit.rotation ?? vec(node.rotation)}
                onChange={(v) => p.onNode({ rotation: v })}
              />
              <VecField
                label="缩放"
                value={nodeEdit.scale ?? vec(node.scale)}
                onChange={(v) => p.onNode({ scale: v })}
              />
              <div className="node-actions">
                {node.animated ? (
                  <p className="quiet">此节点由动画驱动，播放时动画会覆盖 TRS。</p>
                ) : (
                  <p className="quiet">原件视图实时预览变换；应用修订后写入结果。</p>
                )}
                <button
                  className="text-button"
                  disabled={!d.edits.nodes[d.selected]}
                  onClick={p.onResetNode}
                >
                  <Undo2 size={13} />
                  还原节点
                </button>
              </div>
              <dl className="resource-grid">
                <dt>网格</dt>
                <dd>{node.mesh || "无"}{node.instances > 1 ? ` · ${node.instances} 实例` : ""}</dd>
                <dt>子节点</dt>
                <dd>{node.children}</dd>
                <dt>蒙皮</dt>
                <dd>{node.skinned ? "是" : "否"}</dd>
              </dl>
              <details className="metadata">
                <summary>节点附加信息</summary>
                <label className="field">
                  <span>节点附加信息 · JSON</span>
                  <textarea
                    name="node-extras"
                    autoComplete="off"
                    value={nodeEdit.extras ?? node.extras}
                    rows={6}
                    maxLength={60000}
                    spellCheck={false}
                    onChange={(e) => p.onNode({ extras: e.target.value })}
                  />
                </label>
              </details>
            </>
          ) : d.tab === "textures" && p.source ? (
            <TexturePanel p={p} />
          ) : d.tab === "animations" ? (
            <ClipPanel p={p} />
          ) : d.tab === "resources" && p.view ? (
            <ReportPanel p={p} />
          ) : (
            <p className="quiet">{p.source ? "从模型中选择一个对象。" : "读取模型…"}</p>
          )}
        </div>
        <div className="delivery">
          <div className="revision-state">
            <span>
              {p.stale
                ? `配方已变化 · ${p.changes} 项修订 · ${d.passes.length} 步`
                : d.passes.length || p.changes
                  ? "结果已就绪"
                  : "原件即结果，可直接导出"}
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
          {p.stale ? (
            <button className="primary generate" disabled={!d.source || Boolean(p.pending)} onClick={p.onApply}>
              <Check size={16} />
              {p.pending === "处理" ? "正在处理…" : "应用修订并更新结果"}
            </button>
          ) : null}
          <div className="export-row">
            <label className="field compact">
              <span>导出压缩</span>
              <select
                name="export-compression"
                value={d.compression}
                onChange={(e) => p.onCompression(e.target.value as Compression)}
              >
                <option value="none">无（GLB）</option>
                <option value="meshopt">Meshopt</option>
                <option value="draco">Draco</option>
              </select>
            </label>
            <button
              className={p.stale ? "" : "primary"}
              disabled={!d.source || p.stale || Boolean(p.pending)}
              onClick={p.onExport}
            >
              <ArrowDownToLine size={15} />
              {p.pending === "导出结果" ? "导出中…" : "导出 GLB"}
            </button>
          </div>
          <div className="export-actions">
            <button disabled={!d.source || Boolean(p.pending)} onClick={p.onProject}>
              <FileArchive size={15} />
              完整工程
            </button>
            <button className="quiet-button" onClick={p.onRecovery}>
              下载恢复稿
            </button>
          </div>
        </div>
      </fieldset>
    </aside>
  );
});
