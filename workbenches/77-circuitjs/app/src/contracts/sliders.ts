// ABOUTME: 滑块草稿的解码、工程数值解析与默认范围建议；未完成的滑块表单作为工作副本草稿保存。

import { isRecord } from './project.ts';
import { si } from './units.ts';

export type SliderDraft = { element: number; item: number; label: string; min: string; max: string; log: boolean };
export function sliderDraft(value: unknown): SliderDraft | null {
  if (!isRecord(value) || !Number.isInteger(value.element) || !Number.isInteger(value.item) || typeof value.label !== 'string' || typeof value.min !== 'string' || typeof value.max !== 'string' || typeof value.log !== 'boolean') return null;
  if (value.label.length > 200 || value.min.length > 60 || value.max.length > 60) return null;
  return { element: value.element as number, item: value.item as number, label: value.label, min: value.min, max: value.max, log: value.log };
}
const UNIT: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, 'μ': 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
/** Parses "4.7k", "100n", "2.2 μ" like CircuitJS edit fields. */
export function parseValue(text: string): number {
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*([pnuμµmkKMG]?)\s*[A-Za-zΩ]*\s*$/.exec(text);
  return m ? Number(m[1]) * (UNIT[m[2]] ?? 1) : NaN;
}
export function suggestRange(value: number, min: number, max: number): [string, string] {
  if (max > min && max > 0) return [si(min).replace(/\s/g, ''), si(max).replace(/\s/g, '')];
  if (value > 0) return [si(value / 10).replace(/\s/g, ''), si(value * 10).replace(/\s/g, '')];
  if (value < 0) return [si(value * 10).replace(/\s/g, ''), si(value / 10).replace(/\s/g, '')];
  return ['0', '1'];
}

