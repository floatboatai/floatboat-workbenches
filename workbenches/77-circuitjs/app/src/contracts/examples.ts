// ABOUTME: CircuitJS1 示例库：解析上游 setuplist.txt 目录，并为示例生成轻量布局示意几何。

export type ExampleEntry = { file: string; title: string; path: string[]; start?: boolean };
export const EXAMPLE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.txt$/;

/** Upstream format: `+Category` opens a group, `-` closes it, `file title` lists an example, `>` marks the start circuit. */
export function parseSetupList(text: string): ExampleEntry[] {
  const stack: string[] = [], entries: ExampleEntry[] = [], seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('+')) { stack.push(line.slice(1).trim()); continue; }
    if (line === '-') { stack.pop(); continue; }
    const start = line.startsWith('>');
    const body = start ? line.slice(1) : line;
    const space = body.indexOf(' ');
    if (space < 0) continue;
    const file = body.slice(0, space), title = body.slice(space + 1).trim();
    if (!EXAMPLE_FILE.test(file) || !title || seen.has(file)) continue;
    seen.add(file);
    entries.push({ file, title, path: [...stack], ...(start ? { start: true } : {}) });
  }
  return entries;
}

export type ExampleGroup = { name: string; sections: { name: string; entries: ExampleEntry[] }[]; count: number };
/** Two-level tree for the browser: top category, then the remaining sub-path as a section heading. */
export function groupExamples(entries: ExampleEntry[]): ExampleGroup[] {
  const groups = new Map<string, ExampleGroup>();
  for (const entry of entries) {
    const top = entry.path[0] ?? '其他', section = entry.path.slice(1).join(' / ');
    let group = groups.get(top);
    if (!group) { group = { name: top, sections: [], count: 0 }; groups.set(top, group); }
    let target = group.sections.find(s => s.name === section);
    if (!target) { target = { name: section, entries: [] }; group.sections.push(target); }
    target.entries.push(entry);
    group.count++;
  }
  return [...groups.values()];
}

export function filterExamples(entries: ExampleEntry[], query: string): ExampleEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(e => e.title.toLowerCase().includes(q) || e.file.toLowerCase().includes(q) || e.path.some(p => p.toLowerCase().includes(q)));
}

export type PreviewSegment = { x1: number; y1: number; x2: number; y2: number; wire: boolean };
export type PreviewGeometry = { segments: PreviewSegment[]; minX: number; minY: number; maxX: number; maxY: number };
const TEXT_SKIP = new Set(['$', 'o', 'h', '!', '%', '?', 'B', '.', '32', '34', '38']);
const MAX_PREVIEW_SEGMENTS = 3000;

/** Element endpoints from either a legacy text dump or CircuitJS XML; not a native rendering. */
export function previewGeometry(source: string): PreviewGeometry {
  const segments: PreviewSegment[] = [];
  const add = (type: string, values: number[]) => {
    if (segments.length >= MAX_PREVIEW_SEGMENTS || values.length < 4 || !values.every(Number.isFinite)) return;
    const [x1, y1, x2, y2] = values;
    segments.push({ x1, y1, x2, y2, wire: type === 'w' });
  };
  const text = source.trimStart();
  if (text.startsWith('<')) {
    const body = text.replace(/<ccm\b[\s\S]*?<\/ccm>/g, '');
    for (const match of body.matchAll(/<([A-Za-z][\w-]*)\b[^>]*?\sx="([^"]+)"/g)) add(match[1], match[2].trim().split(/\s+/).map(Number));
  } else {
    for (const raw of text.split(/\r?\n|\r/)) {
      const tokens = raw.trim().split(/[ +\t]+/);
      if (!tokens[0] || TEXT_SKIP.has(tokens[0])) continue;
      add(tokens[0], tokens.slice(1, 5).map(Number));
    }
  }
  if (!segments.length) return { segments, minX: 0, minY: 0, maxX: 1, maxY: 1 };
  const xs = segments.flatMap(s => [s.x1, s.x2]), ys = segments.flatMap(s => [s.y1, s.y2]);
  return { segments, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
