// ABOUTME: 工程计数格式（SI 前缀）与 CircuitJS 速度条换算。

const PREFIXES: [number, string][] = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'μ'], [1e-9, 'n'], [1e-12, 'p']];
/** Engineering notation with SI prefix, e.g. 0.0015 → "1.50 m". */
export function si(x: number, unit = '', digits = 3): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return `0 ${unit}`.trim();
  const abs = Math.abs(x);
  const [scale, prefix] = PREFIXES.find(([s]) => abs >= s * 0.9995) ?? PREFIXES[PREFIXES.length - 1];
  return `${Number((x / scale).toPrecision(digits))} ${prefix}${unit}`.trim();
}

/** CircuitJS speed bar (1–259) → timesteps per wall-clock second (CirSim.getIterCount × 160). */
export function stepsPerSecond(speed: number): number {
  return 160 * 0.1 * Math.exp((speed - 61) / 24);
}
