// Small Python 3.12 semantics used by the DeepTutor practice port.
// The upstream modules rely on str(), str.strip(), str.split(), len() over code
// points, round(x, n) and json.dumps(sort_keys=True, ensure_ascii=False). The
// question identity hash depends on these being byte-for-byte equal.

/** Python's str.isspace() characters (also what `\s` matches in a str regex). */
export const PY_SPACE =
  "\\t\\n\\x0b\\x0c\\r\\x1c\\x1d\\x1e\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const edge = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "gu");
const runs = new RegExp(`[${PY_SPACE}]+`, "u");

/** A ValueError/TypeError raised by the ported upstream code. */
export class PyValueError extends Error {}

export const strip = (s: string) => s.replace(edge, "");
export const splitWhitespace = (s: string) =>
  strip(s).split(runs).filter((x) => x !== "");
export const codePoints = (s: string) => Array.from(s);
export const pyLen = (s: string) => {
  let n = 0;
  for (const _ of s) n++;
  return n;
};
/** Code-point comparison, as Python sorts str values. */
export function compareStr(a: string, b: string) {
  const x = codePoints(a),
    y = codePoints(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}

/** A JSON number that remembers whether Python would have parsed int or float. */
export class PyNumber {
  readonly source: string;
  readonly isFloat: boolean;
  constructor(source: string, isFloat: boolean) {
    this.source = source;
    this.isFloat = isFloat;
  }
  valueOf() {
    return Number(this.source);
  }
}
/**
 * json.loads with Python's int/float distinction preserved for str(). JS's
 * JSON.parse rejects NaN/Infinity literals that Python accepts; such files fail
 * with a JSON error rather than being guessed at.
 */
export function loadsJson(text: string): unknown {
  return JSON.parse(text, function (_key, value, context?: { source?: string }) {
    if (typeof value === "number" && context?.source !== undefined)
      return new PyNumber(context.source, /[.eE]/.test(context.source));
    return value;
  });
}

export function floatRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mantissa, expText] = x.toExponential().split("e");
  const exp = Number(expText),
    negative = mantissa.startsWith("-"),
    digits = mantissa.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const m = digits.length > 1 ? digits[0] + "." + digits.slice(1) : digits;
    body = m + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) body = "0." + "0".repeat(-exp - 1) + digits;
  else if (digits.length > exp + 1)
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  else body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  return (negative ? "-" : "") + body;
}

function reprString(s: string) {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === quote || ch === "\\") out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 0x20 || c === 0x7f) out += "\\x" + c.toString(16).padStart(2, "0");
    else out += ch;
  }
  return out + quote;
}
/** repr() for the JSON-shaped values a question bank can contain. */
export function pyRepr(v: unknown): string {
  if (typeof v === "string") return reprString(v);
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  if (v && typeof v === "object" && !(v instanceof PyNumber))
    return (
      "{" +
      Object.entries(v)
        .map(([k, x]) => reprString(k) + ": " + pyRepr(x))
        .join(", ") +
      "}"
    );
  return pyStr(v);
}
/** str() for JSON-shaped values. */
export function pyStr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "True" : "False";
  if (v instanceof PyNumber)
    return v.isFloat ? floatRepr(Number(v.source)) : BigInt(v.source).toString();
  if (typeof v === "number")
    return Number.isInteger(v) ? String(v) : floatRepr(v);
  return pyRepr(v);
}
/** Python truthiness for JSON-shaped values. */
export function truthy(v: unknown): boolean {
  if (v instanceof PyNumber) return Number(v.source) !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v).length > 0;
  return !!v;
}

function dumpString(s: string) {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i],
      c = s.charCodeAt(i);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (c < 0x20) out += "\\u" + c.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + '"';
}
/** json.dumps(value, sort_keys=True, ensure_ascii=False) for str/list/dict values. */
export function dumpsSorted(v: unknown): string {
  if (typeof v === "string") return dumpString(v);
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof PyNumber) return pyStr(v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : floatRepr(v);
  if (Array.isArray(v)) return "[" + v.map(dumpsSorted).join(", ") + "]";
  if (typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .sort(compareStr)
        .map((k) => dumpString(k) + ": " + dumpsSorted((v as Record<string, unknown>)[k]))
        .join(", ") +
      "}"
    );
  throw new PyValueError("Object is not JSON serializable");
}
/** str.encode() refuses lone surrogates; Python raises UnicodeEncodeError. */
export function utf8(s: string): Uint8Array {
  if (/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s))
    throw new PyValueError("'utf-8' codec can't encode a surrogate character");
  return new TextEncoder().encode(s);
}

/** round(x, digits) with Python's exact half-even decimal rounding. */
export function pyRound(x: number, digits: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const hi = view.getUint32(0),
    lo = view.getUint32(4);
  const negative = hi >>> 31 === 1,
    biased = (hi >>> 20) & 0x7ff;
  let mantissa = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo),
    exponent: number;
  if (biased === 0) exponent = -1074;
  else {
    mantissa |= 1n << 52n;
    exponent = biased - 1075;
  }
  const scale = 10n ** BigInt(digits);
  let quotient: bigint;
  if (exponent >= 0) quotient = (mantissa << BigInt(exponent)) * scale;
  else {
    const numerator = mantissa * scale,
      denominator = 1n << BigInt(-exponent);
    quotient = numerator / denominator;
    const twice = (numerator % denominator) * 2n;
    if (twice > denominator || (twice === denominator && quotient % 2n === 1n))
      quotient += 1n;
  }
  const result = Number(`${quotient}e-${digits}`);
  return negative ? -result : result;
}
