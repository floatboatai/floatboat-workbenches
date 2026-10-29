// Bruno-style {{variable}} interpolation. Scopes are ordered from highest to lowest precedence.

export interface Scope {
  label: string;
  values: Record<string, string>;
}
export interface Interpolator {
  (text: string): string;
  missing: Set<string>;
  used: Map<string, string>;
}

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function variableNames(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((m) => m[1]);
}

export const DYNAMIC_NAMES = [
  "$randomUUID",
  "$guid",
  "$timestamp",
  "$isoTimestamp",
  "$randomInt",
  "$localEcho",
] as const;

export function dynamicValue(
  name: string,
  extra: Record<string, string> = {},
): string | undefined {
  if (name in extra) return extra[name];
  switch (name) {
    case "$randomUUID":
    case "$guid":
      return crypto.randomUUID();
    case "$timestamp":
      return String(Math.floor(Date.now() / 1000));
    case "$isoTimestamp":
      return new Date().toISOString();
    case "$randomInt":
      return String(Math.floor(Math.random() * 1000));
    default:
      return undefined;
  }
}

/**
 * Creates an interpolator. Unknown names are left in place and recorded in
 * `missing`; the caller decides whether that blocks execution. Values that
 * themselves contain variables are resolved recursively (depth-limited, so
 * cycles are reported as missing instead of looping).
 */
export function createInterpolator(
  scopes: Scope[],
  dynamic: Record<string, string> = {},
): Interpolator {
  const missing = new Set<string>(),
    used = new Map<string, string>();
  const lookup = (name: string): string | undefined => {
    if (name.startsWith("$")) return dynamicValue(name, dynamic);
    for (const scope of scopes)
      if (Object.prototype.hasOwnProperty.call(scope.values, name)) return scope.values[name];
    return undefined;
  };
  const run = (text: string, depth: number): string =>
    text.replace(TOKEN, (whole, raw: string) => {
      const name = raw.trim();
      if (name.startsWith("process.env.")) {
        missing.add(name);
        return whole;
      }
      const value = lookup(name);
      if (value === undefined || depth > 6) {
        missing.add(name);
        return whole;
      }
      const resolved = value.includes("{{") ? run(value, depth + 1) : value;
      if (!name.startsWith("$")) used.set(name, resolved);
      return resolved;
    });
  const fn = ((text: string) => run(text, 0)) as Interpolator;
  fn.missing = missing;
  fn.used = used;
  return fn;
}
