// ABOUTME: 外层页面与原生引擎桥接的读数类型、解码与工程计数格式。

import { isRecord } from '../contracts/project';

export type Reading = { index: number; type: string; cls: string; voltage: number; current: number };
export type SliderReading = { index: number; label: string; element: number; param: string; value: number; position: number; positions: number; min: number; max: number; log: boolean; linked: number };
export type ProbeParam = { item: number; name: string; value: number; min: number; max: number; hasSlider: boolean };
export type ProbeReading = { index: number; cls: string; info: string[]; params: ProbeParam[] };
export type EngineStatus = { running: boolean; valid: boolean; time: number; stop: string; items: Reading[]; speed: number; currentSpeed: number; timeStep: number; tool: string; adjustables: SliderReading[]; probe: ProbeReading | null };
export type SourceCheck = { ok: boolean; message: string; entries: number; classes: Record<string, number> };

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const str = (x: unknown): x is string => typeof x === 'string';

export function decodeStatus(m: Record<string, unknown>): EngineStatus {
  const items = Array.isArray(m.items) ? m.items.filter((x): x is Reading => isRecord(x) && num(x.index) && str(x.type) && str(x.cls) && typeof x.voltage === 'number' && typeof x.current === 'number') : [];
  const adjustables = Array.isArray(m.adjustables) ? m.adjustables.filter((x): x is SliderReading => isRecord(x) && num(x.index) && str(x.label) && num(x.element) && str(x.param) && num(x.value) && num(x.position) && num(x.positions) && num(x.min) && num(x.max) && typeof x.log === 'boolean' && num(x.linked)) : [];
  let probe: ProbeReading | null = null;
  if (isRecord(m.probe) && num(m.probe.index) && str(m.probe.cls) && Array.isArray(m.probe.info) && Array.isArray(m.probe.params)) {
    probe = {
      index: m.probe.index, cls: m.probe.cls, info: m.probe.info.filter(str).slice(0, 12),
      params: m.probe.params.filter((x): x is ProbeParam => isRecord(x) && num(x.item) && str(x.name) && num(x.value) && typeof x.min === 'number' && typeof x.max === 'number' && typeof x.hasSlider === 'boolean'),
    };
  }
  return {
    running: m.running === true, valid: m.valid === true, time: num(m.time) ? m.time : 0, stop: str(m.stop) ? m.stop : '', items,
    speed: num(m.speed) ? m.speed : 117, currentSpeed: num(m.currentSpeed) ? m.currentSpeed : 50, timeStep: num(m.timeStep) ? m.timeStep : 5e-6,
    tool: str(m.tool) ? m.tool : 'Select', adjustables, probe,
  };
}

export function decodeCheck(m: Record<string, unknown>): SourceCheck {
  const classes: Record<string, number> = {};
  if (isRecord(m.classes)) for (const [k, v] of Object.entries(m.classes)) if (num(v)) classes[k] = v;
  return { ok: m.ok === true, message: str(m.message) ? m.message : '', entries: num(m.entries) ? m.entries : 0, classes };
}

export { si, stepsPerSecond } from '../contracts/units';
