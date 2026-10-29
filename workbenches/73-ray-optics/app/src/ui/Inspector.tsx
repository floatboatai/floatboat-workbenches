import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Trash2 } from "lucide-react";
import type { RefObject } from "react";
import type { BenchHandle, Inspection, ScenePatch } from "./NativeBench";
import { ControlField, PointRow } from "./fields";
import { colorModes, type OpticalScene } from "../contracts/optics";
import { objectNames } from "../contracts/catalog";

export type InspectorTab = "element" | "scene" | "notes";
interface Props {
  bench: RefObject<BenchHandle | null>;
  inspection: Inspection | null;
  scene: OpticalScene | null;
  selected: number;
  locked: boolean;
  tab: InspectorTab;
  setTab(tab: InspectorTab): void;
  advanced: boolean;
  setAdvanced(v: boolean): void;
  drafts: Record<string, string>;
  legacyDraft: string;
  setFieldDraft(key: string, value: string | null): void;
  clearDrafts(): void;
  act(action: () => void): void;
  raw: string;
  rawPending: boolean;
  setRaw(v: string): void;
  applyRaw(): void;
  downloadRaw(): void;
  notes: string;
  setNotes(v: string): void;
  original: { name: string; download(): void } | null;
}
const tabs: [InspectorTab, string][] = [
  ["element", "元件"],
  ["scene", "场景"],
  ["notes", "记录"],
];

export function Inspector(props: Props) {
  const { bench, inspection: ins, scene, locked, act } = props;
  const objects = scene?.objs ?? [];
  const pendingCount = Object.keys(props.drafts).length;
  return (
    <aside className="inspector" aria-label="检查器">
      <div className="tabs" role="tablist" aria-label="检查器页面">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={"tab-" + id}
            aria-selected={props.tab === id}
            aria-controls={"panel-" + id}
            onClick={() => props.setTab(id)}
          >
            {label}
            {id === "element" && pendingCount ? <span className="badge">{pendingCount}</span> : null}
          </button>
        ))}
      </div>
      {props.tab === "element" ? (
        <div className="panel" role="tabpanel" id="panel-element" aria-labelledby="tab-element">
          <label className="control">
            <span>场景元件（{objects.length}）</span>
            <select
              value={props.selected}
              disabled={locked}
              onChange={(e) => act(() => bench.current?.select(Number(e.target.value)))}
            >
              <option value={-1}>选择一个元件…</option>
              {objects.map((o, i) => (
                <option key={i} value={i}>
                  {i + 1}. {o.name || (o.type === "TextLabel" ? String(o.text ?? "").slice(0, 16) : "") || objectNames[o.type] || o.type}
                </option>
              ))}
            </select>
          </label>
          {ins ? (
            <ElementPanel {...props} ins={ins} />
          ) : (
            <p className="empty">在光学平台上点击元件，或从器材架放入一个新元件。</p>
          )}
          {props.legacyDraft ? (
            <p className="pending-note">
              0.7 版保留的未应用参数：<code>{props.legacyDraft}</code>
              <button type="button" className="link" onClick={props.clearDrafts}>
                放弃
              </button>
            </p>
          ) : null}
          {pendingCount ? (
            <p className="pending-note">
              有 {pendingCount} 项参数输入尚未完成，已随实验保存。
              <button type="button" className="link" onClick={props.clearDrafts}>
                放弃未应用输入
              </button>
            </p>
          ) : null}
        </div>
      ) : props.tab === "scene" ? (
        <ScenePanel {...props} />
      ) : (
        <div className="panel" role="tabpanel" id="panel-notes" aria-labelledby="tab-notes">
          <label className="control notes">
            <span>实验记录</span>
            <textarea name="notes" maxLength={40000} value={props.notes} disabled={locked} onChange={(e) => props.setNotes(e.target.value)} />
          </label>
          {props.original ? (
            <button type="button" onClick={props.original.download}>
              下载导入原件（{props.original.name || "JSON"}）
            </button>
          ) : null}
        </div>
      )}
    </aside>
  );
}

function ElementPanel(props: Props & { ins: Inspection }) {
  const { bench, ins, locked, act, drafts } = props;
  const key = (id: string) => ins.index + "|" + id;
  const visible = ins.controls.filter((c) => c.kind !== "info" || c.info);
  return (
    <>
      <div className="element-head">
        <h2>{ins.title}</h2>
        <span className="mono">#{ins.index + 1}</span>
      </div>
      <label className="control">
        <span>元件名称</span>
        <input
          name="elementName"
          autoComplete="off"
          maxLength={120}
          value={ins.name}
          disabled={locked}
          onChange={(e) => act(() => bench.current?.setName(ins.index, e.target.value))}
        />
      </label>
      <div className="controls">
        {visible.map((c) => (
          <ControlField
            key={ins.index + c.id}
            control={c}
            draft={drafts[key(c.id)]}
            disabled={locked}
            setDraft={(text) => props.setFieldDraft(key(c.id), text)}
            commit={(raw) => {
              let ok = false;
              act(() => {
                ok = bench.current?.setControl(ins.index, props.advanced, c.id, raw) ?? false;
              });
              return ok;
            }}
          />
        ))}
        {ins.hasAdvanced || props.advanced ? (
          <button type="button" className="link" onClick={() => props.setAdvanced(!props.advanced)}>
            {props.advanced ? "收起更多选项" : "更多选项…"}
          </button>
        ) : null}
      </div>
      {ins.points.length ? (
        <details className="points" open={ins.points.length <= 4}>
          <summary>控制点坐标（{ins.points.length}）</summary>
          {ins.points.map((p) => (
            <PointRow
              key={ins.index + p.key}
              point={p}
              disabled={locked}
              drafts={{ x: drafts[key("pt:" + p.key + ":x")], y: drafts[key("pt:" + p.key + ":y")] }}
              setDraft={(axis, text) => props.setFieldDraft(key("pt:" + p.key + ":" + axis), text)}
              commit={(x, y) => act(() => bench.current?.setPoint(ins.index, p.key, x, y))}
            />
          ))}
        </details>
      ) : null}
      <div className="nudge" role="group" aria-label="元件操作">
        {(
          [
            [ArrowLeft, -1, 0, "向左移动"],
            [ArrowRight, 1, 0, "向右移动"],
            [ArrowUp, 0, -1, "向上移动"],
            [ArrowDown, 0, 1, "向下移动"],
          ] as const
        ).map(([Icon, x, y, label]) => (
          <button key={label} type="button" aria-label={label} title={label} disabled={locked} onClick={() => act(() => bench.current?.nudge(ins.index, x * 5, y * 5))}>
            <Icon size={16} aria-hidden="true" />
          </button>
        ))}
        <button type="button" aria-label="复制元件" title="复制元件" disabled={locked} onClick={() => act(() => bench.current?.duplicate(ins.index))}>
          <Copy size={16} aria-hidden="true" />
        </button>
        <button type="button" className="danger" aria-label="删除元件" title="删除元件（可撤销）" disabled={locked} onClick={() => act(() => bench.current?.remove(ins.index))}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

function ScenePanel(props: Props) {
  const { scene, locked, act, bench } = props;
  if (!scene) return <p className="empty">场景无法解析，请在下方原生场景 JSON 中修复。</p>;
  const set = (patch: ScenePatch) => act(() => bench.current?.setScene(patch));
  const mode = String(scene.mode ?? "rays");
  const imageMode = mode === "images" || mode === "observer";
  const densityKey = imageMode ? "imageModeDensity" : "rayModeDensity";
  const density = Number(scene[densityKey] ?? (imageMode ? 1 : 0.1));
  const observer = scene.observer as { r?: number } | null | undefined;
  const num = (v: string, f: (n: number) => void) => {
    const n = Number(v);
    if (v.trim() && Number.isFinite(n)) f(n);
  };
  return (
    <div className="panel" role="tabpanel" id="panel-scene" aria-labelledby="tab-scene">
      <fieldset
        disabled={locked}
        className="scene-settings"
        key={JSON.stringify([scene.gridSize, scene.maxRayDepth, scene.redWavelength, scene.violetWavelength])}
      >
        <label className="control">
          <span>
            光线密度（{imageMode ? "成像/观察者" : "光线/延长线"}）<b className="mono">{density.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={imageMode ? 0.1 : 0.01}
            max={imageMode ? 5 : 2}
            step={0.01}
            value={density}
            onChange={(e) => set({ [densityKey]: Number(e.target.value) })}
          />
        </label>
        {mode === "observer" ? (
          <label className="control">
            <span>观察者瞳孔直径</span>
            <input type="range" min={4} max={200} step={1} value={Number(observer?.r ?? 20) * 2} onChange={(e) => set({ observerR: Number(e.target.value) / 2 })} />
          </label>
        ) : null}
        <label className="control check">
          <input type="checkbox" checked={Boolean(scene.simulateColors)} onChange={(e) => set({ simulateColors: e.target.checked })} />
          <span>按波长模拟颜色（色散、光栅）</span>
        </label>
        {scene.simulateColors ? (
          <div className="pair">
            <label className="control">
              <span>紫端 nm</span>
              <input inputMode="decimal" defaultValue={String(scene.violetWavelength ?? 420)} onBlur={(e) => num(e.target.value, (n) => set({ violetWavelength: n }))} />
            </label>
            <label className="control">
              <span>红端 nm</span>
              <input inputMode="decimal" defaultValue={String(scene.redWavelength ?? 620)} onBlur={(e) => num(e.target.value, (n) => set({ redWavelength: n }))} />
            </label>
          </div>
        ) : null}
        <label className="control">
          <span>亮度映射</span>
          <select value={String(scene.colorMode ?? "default")} onChange={(e) => set({ colorMode: e.target.value })}>
            {Object.entries(colorModes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="control check">
          <input type="checkbox" checked={Boolean(scene.showRayArrows)} onChange={(e) => set({ showRayArrows: e.target.checked })} />
          <span>显示光线方向箭头</span>
        </label>
        <label className="control check">
          <input type="checkbox" checked={Boolean(scene.showGrid)} onChange={(e) => set({ showGrid: e.target.checked })} />
          <span>显示网格</span>
        </label>
        <label className="control check">
          <input type="checkbox" checked={Boolean(scene.snapToGrid)} onChange={(e) => set({ snapToGrid: e.target.checked })} />
          <span>吸附网格</span>
        </label>
        <div className="pair">
          <label className="control">
            <span>网格间距</span>
            <input inputMode="decimal" defaultValue={String(scene.gridSize ?? 20)} onBlur={(e) => num(e.target.value, (n) => n >= 1 && set({ gridSize: n }))} />
          </label>
          <label className="control">
            <span>最大交互次数</span>
            <input
              inputMode="numeric"
              placeholder="不限"
              defaultValue={scene.maxRayDepth == null ? "" : String(scene.maxRayDepth)}
              onBlur={(e) =>
                e.target.value.trim() === ""
                  ? set({ maxRayDepth: null })
                  : num(e.target.value, (n) => Number.isInteger(n) && n >= 1 && set({ maxRayDepth: n }))
              }
            />
          </label>
        </div>
      </fieldset>
      <details className="raw" open={props.rawPending}>
        <summary>原生场景 JSON{props.rawPending ? "（有未应用修改）" : ""}</summary>
        <textarea
          aria-label="原生场景 JSON"
          name="nativeScene"
          spellCheck={false}
          value={props.raw}
          disabled={locked}
          onChange={(e) => props.setRaw(e.target.value)}
        />
        <div className="row">
          <button type="button" disabled={locked || !props.rawPending} onClick={props.applyRaw}>
            应用场景
          </button>
          <button type="button" onClick={props.downloadRaw}>
            下载此输入
          </button>
        </div>
      </details>
    </div>
  );
}
