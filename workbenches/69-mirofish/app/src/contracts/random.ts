// ABOUTME: 可复现随机数与指纹：同一字符串种子在浏览器和 Node 中产生完全相同的序列。

/** cyrb53: fast 53-bit string hash, identical in every JS runtime. */
export function hash53(input: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export const fingerprint = (input: string) => hash53(input).toString(16).padStart(14, "0");

export type Rng = {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  normal(): number;
  shuffle<T>(items: T[]): T[];
  chance(p: number): boolean;
};
/** sfc32 seeded from a string. */
export function rng(seed: string): Rng {
  let a = hash53(seed, 1) >>> 0,
    b = hash53(seed, 2) >>> 0,
    c = hash53(seed, 3) >>> 0,
    d = hash53(seed, 4) >>> 0;
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  const self: Rng = {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (items) => items[Math.floor(next() * items.length)],
    normal() {
      const u = Math.max(next(), 1e-12),
        v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
    chance: (p) => next() < p,
  };
  return self;
}
export const round3 = (v: number) => Math.round(v * 1000) / 1000;
