// ABOUTME: 仪器台控件：时基（运行/单步/复位/速度）与可调元件滑块条。值来自原生引擎读数。

import { useEffect, useId, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, StepForward, SlidersHorizontal, X } from 'lucide-react';
import { si, stepsPerSecond, type EngineStatus, type ProbeReading, type SliderReading } from './bench-protocol';
import { parseValue, suggestRange, type SliderDraft } from '../contracts/sliders';

/** Range bound to a remote value; keeps the local value while the user is dragging. */
function LiveRange({ value, min, max, label, onChange, disabled, valueText }: { value: number; min: number; max: number; label: string; onChange: (v: number) => void; disabled: boolean; valueText: string }) {
  const [local, setLocal] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <input type="range" min={min} max={max} step={1} value={local ?? value} aria-label={label} aria-valuetext={valueText} disabled={disabled}
    onChange={e => { const v = Number(e.target.value); setLocal(v); onChange(v); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setLocal(null), 900); }} />;
}

type TimebaseProps = { status: EngineStatus; ready: boolean; disabled: boolean; send: (type: string, more?: Record<string, unknown>) => void };
export function Timebase({ status, ready, disabled, send }: TimebaseProps) {
  const off = !ready || disabled;
  const rate = stepsPerSecond(status.speed) * status.timeStep;
  return <div className="timebase">
    <span className="panel-label"><i className={status.running ? 'running' : ''} />{status.running ? '运行' : '暂停'} / TIMEBASE</span>
    <div className="run-controls">
      <button className="run" disabled={off} onClick={() => send('run')}>{status.running ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}{status.running ? '暂停' : '运行'}</button>
      <button aria-label="单步：推进一个时间步" title="单步（一个时间步）" disabled={off || !!status.stop} onClick={() => send('step')}><StepForward size={15} aria-hidden="true" />单步</button>
      <button aria-label="复位时间与元件状态" title="复位：时间归零并重置元件状态，保持运行/暂停" disabled={off} onClick={() => send('reset')}><RotateCcw size={15} aria-hidden="true" />复位</button>
      <output className="elapsed" aria-label="仿真时间">{si(status.time, 's', 4)}</output>
    </div>
    <div className="speed-controls">
      <label><span>速度</span><LiveRange label="仿真速度" min={1} max={259} value={status.speed} disabled={off} valueText={`每秒推进 ${si(rate, 's')}`} onChange={v => send('speed', { value: v })} /><small>{si(rate, 's')}/秒</small></label>
      <label><span>电流动画</span><LiveRange label="电流动画速度" min={1} max={99} value={status.currentSpeed} disabled={off} valueText={String(status.currentSpeed)} onChange={v => send('current-speed', { value: v })} /><small>步长 {si(status.timeStep, 's')}</small></label>
    </div>
  </div>;
}

type StripProps = {
  sliders: SliderReading[]; ready: boolean; disabled: boolean; labelFor: (index: number) => string;
  draft: SliderDraft | null; probe: ProbeReading | null; probeLabel: string;
  setDraft: (d: SliderDraft | null) => void; send: (type: string, more?: Record<string, unknown>) => void; report: (e: unknown) => void;
};
export function SliderStrip({ sliders, ready, disabled, labelFor, draft, probe, probeLabel, setDraft, send, report }: StripProps) {
  const id = useId();
  const off = !ready || disabled;
  const draftParam = draft && probe && probe.index === draft.element ? probe.params.find(p => p.item === draft.item) : undefined;
  function submit() {
    if (!draft) return;
    const min = parseValue(draft.min), max = parseValue(draft.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) { report(new Error('滑块范围无效：最小值必须小于最大值，可用 4.7k、100n 等写法。')); return; }
    if (draft.log && min <= 0) { report(new Error('对数滑块的最小值必须大于 0。')); return; }
    if (!draft.label.trim()) { report(new Error('请填写滑块名称。')); return; }
    send('add-slider', { element: draft.element, item: draft.item, min, max, label: draft.label.trim(), log: draft.log });
    setDraft(null);
  }
  if (!sliders.length && !draft) return null;
  return <section className="slider-strip" aria-label="可调元件滑块">
    <span className="panel-label"><SlidersHorizontal size={12} aria-hidden="true" />滑块 / ADJUST</span>
    <div className="slider-list">
      {sliders.map(s => <div className="slider-item" key={s.index}>
        <label htmlFor={`${id}-${s.index}`} title={`${labelFor(s.element)} · ${s.param}`}>{s.label}<small>{labelFor(s.element)}{s.linked ? ` +${s.linked} 联动` : ''}</small></label>
        <LiveRange label={`${s.label}（${s.param}）`} min={0} max={s.positions} value={s.position} disabled={off} valueText={si(s.value)} onChange={v => send('slider', { index: s.index, position: v })} />
        <output>{si(s.value)}</output>
        <button className="icon-button" aria-label={`移除滑块 ${s.label}`} title="移除滑块（元件保留当前值）" disabled={off} onClick={() => send('remove-slider', { index: s.index })}><X size={13} aria-hidden="true" /></button>
      </div>)}
    </div>
    {draft ? <form className="slider-form" aria-label="添加滑块" onSubmit={e => { e.preventDefault(); submit(); }}>
      <strong>{probe?.index === draft.element ? probeLabel : `元件 ${draft.element + 1}`}</strong>
      <label>参数<select value={draft.item} disabled={disabled} onChange={e => { const item = Number(e.target.value); const param = probe?.params.find(p => p.item === item); const [min, max] = param ? suggestRange(param.value, param.min, param.max) : [draft.min, draft.max]; setDraft({ ...draft, item, label: param?.name ?? draft.label, min, max }); }}>
        {(probe?.index === draft.element ? probe.params : []).map(p => <option key={p.item} value={p.item} disabled={p.hasSlider}>{p.name}{p.hasSlider ? '（已有）' : ''}</option>)}
        {!draftParam ? <option value={draft.item}>参数 {draft.item + 1}</option> : null}
      </select></label>
      <label>名称<input name="slider-label" autoComplete="off" value={draft.label} disabled={disabled} onChange={e => setDraft({ ...draft, label: e.target.value })} /></label>
      <label>最小<input name="slider-min" inputMode="decimal" autoComplete="off" spellCheck={false} value={draft.min} disabled={disabled} onChange={e => setDraft({ ...draft, min: e.target.value })} /></label>
      <label>最大<input name="slider-max" inputMode="decimal" autoComplete="off" spellCheck={false} value={draft.max} disabled={disabled} onChange={e => setDraft({ ...draft, max: e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={draft.log} disabled={disabled} onChange={e => setDraft({ ...draft, log: e.target.checked })} />对数</label>
      <button type="submit" className="primary" disabled={off || probe?.index !== draft.element}>添加滑块</button>
      <button type="button" disabled={disabled} onClick={() => setDraft(null)}>取消</button>
    </form> : null}
  </section>;
}
