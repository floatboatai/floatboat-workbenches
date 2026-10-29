// ABOUTME: 实验簿示例库页：CircuitJS1 官方示例分类浏览、检索、布局示意预览与引擎兼容检查；打开即创建新实验。

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, FolderOpen } from 'lucide-react';
import { request } from './workspace';
import { isRecord } from '../contracts/project';
import { filterExamples, groupExamples, previewGeometry, type ExampleEntry } from '../contracts/examples';
import { partLabel } from '../contracts/parts';
import type { SourceCheck } from './bench-protocol';

const GROUP_NAMES: Record<string, string> = {
  Basics: '基础', 'A/C Circuits': '交流电路', 'Passive Filters': '无源滤波器', 'Other Passive Circuits': '其他无源电路', Diodes: '二极管', 'Op-Amps': '运算放大器',
  Transistors: '三极管', MOSFETs: 'MOSFET', '555 Timer Chip': '555 定时器', 'Active Filters': '有源滤波器', 'Logic Families': '逻辑电路族', 'Combinational Logic': '组合逻辑',
  'Sequential Logic': '时序逻辑', 'Analog/Digital': '模数 / 数模', 'Power Converters': '电源变换', 'Phase-Locked Loops': '锁相环', 'Transmission Lines': '传输线',
  'Controlled Sources': '受控源', Subcircuits: '子电路', 'Misc Devices': '其他器件', '2-D Scope': '二维示波器',
};
type Loaded = { entry: ExampleEntry; source: string };
function decodeEntry(x: unknown): ExampleEntry | null {
  if (!isRecord(x) || typeof x.file !== 'string' || typeof x.title !== 'string' || !Array.isArray(x.path)) return null;
  return { file: x.file, title: x.title, path: x.path.filter((p): p is string => typeof p === 'string'), ...(x.start === true ? { start: true } : {}) };
}

function Preview({ source }: { source: string }) {
  const g = useMemo(() => previewGeometry(source), [source]);
  const pad = 24, w = Math.max(g.maxX - g.minX, 32) + pad * 2, h = Math.max(g.maxY - g.minY, 32) + pad * 2, post = Math.max(w, h) / 160;
  return <svg className="example-preview" viewBox={`${g.minX - pad} ${g.minY - pad} ${w} ${h}`} role="img" aria-label={`布局示意：${g.segments.length} 个元件段`} preserveAspectRatio="xMidYMid meet">
    {g.segments.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="wire" vectorEffect="non-scaling-stroke" />)}
    {g.segments.filter(s => !s.wire).map((s, i) => { const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2, dx = (s.x2 - s.x1) * 0.22, dy = (s.y2 - s.y1) * 0.22; return <line key={`b${i}`} x1={mx - dx} y1={my - dy} x2={mx + dx} y2={my + dy} className="part" vectorEffect="non-scaling-stroke" />; })}
    {g.segments.filter(s => !s.wire).flatMap((s, i) => [<circle key={`p${i}a`} cx={s.x1} cy={s.y1} r={post} className="post" />, <circle key={`p${i}b`} cx={s.x2} cy={s.y2} r={post} className="post" />])}
  </svg>;
}

type Props = { disabled: boolean; check: (source: string) => Promise<SourceCheck | null>; onOpen: (entry: ExampleEntry, source: string) => void };
export function ExampleLibrary({ disabled, check, onOpen }: Props) {
  const [entries, setEntries] = useState<ExampleEntry[] | null>(null), [error, setError] = useState(''), [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Loaded | null>(null), [verdict, setVerdict] = useState<SourceCheck | null | 'pending'>(null), [loading, setLoading] = useState('');
  const cache = useRef(new Map<string, string>()), latest = useRef('');
  useEffect(() => {
    let live = true;
    request('/api/examples').then(value => {
      if (!live) return;
      const list = isRecord(value) && Array.isArray(value.examples) ? value.examples.map(decodeEntry).filter((x): x is ExampleEntry => !!x) : [];
      setEntries(list);
      const first = list.find(e => e.start) ?? list[0];
      if (first) void select(first);
    }).catch(e => { if (live) setError(e instanceof Error ? e.message : '示例目录不可用。'); });
    return () => { live = false; };
  }, []);
  async function select(entry: ExampleEntry) {
    latest.current = entry.file; setLoading(entry.file); setVerdict('pending');
    try {
      let source = cache.current.get(entry.file);
      if (source === undefined) {
        const value = await request(`/api/examples/${encodeURIComponent(entry.file)}`);
        if (!isRecord(value) || typeof value.source !== 'string') throw Error('示例内容无效。');
        source = value.source; cache.current.set(entry.file, source);
      }
      if (latest.current !== entry.file) return;
      setSelected({ entry, source }); setError('');
      const result = await check(source);
      if (latest.current === entry.file) setVerdict(result);
    } catch (e) { if (latest.current === entry.file) { setError(e instanceof Error ? e.message : '示例读取失败。'); setVerdict(null); } }
    finally { if (latest.current === entry.file) setLoading(''); }
  }
  const visible = useMemo(() => entries ? groupExamples(filterExamples(entries, query)) : [], [entries, query]);
  const total = visible.reduce((n, g) => n + g.count, 0);
  const summary = verdict && verdict !== 'pending' ? Object.entries(verdict.classes).filter(([cls]) => cls !== 'WireElm').sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  return <section className="examples-page" aria-label="CircuitJS1 示例库">
    <div className="examples-browser">
      <label className="parts-search"><Search size={15} aria-hidden="true" /><span className="sr-only">搜索示例</span><input type="search" name="example-search" autoComplete="off" placeholder="搜索示例：555、滤波、计数器…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <p className="parts-count" aria-live="polite">{entries ? `${total} / ${entries.length} 个官方示例` : error ? '' : '正在读取示例目录…'}</p>
      <div className="example-groups">
        {visible.map(group => <details key={group.name} open={!!query || group.name === 'Basics'}>
          <summary>{GROUP_NAMES[group.name] ?? group.name}<span lang="en">{group.name}</span><small>{group.count}</small></summary>
          {group.sections.map(section => <div key={section.name || '_'}>
            {section.name ? <h4>{section.name}</h4> : null}
            <ul>{section.entries.map(entry => <li key={entry.file}><button aria-current={selected?.entry.file === entry.file ? 'true' : undefined} onClick={() => void select(entry)}>{entry.title}</button></li>)}</ul>
          </div>)}
        </details>)}
        {entries && !total ? <p className="empty-note">没有匹配的示例。</p> : null}
      </div>
    </div>
    <div className="example-detail" aria-live="polite">
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      {selected ? <>
        <span className="example-path">{selected.entry.path.map((p, i) => i === 0 ? GROUP_NAMES[p] ?? p : p).join(' / ')}</span>
        <h3 lang="en">{selected.entry.title}</h3>
        <Preview source={selected.source} />
        <p className="preview-note">布局示意（元件端点连线，非原生渲染）· {selected.entry.file}</p>
        {verdict === 'pending' || loading ? <p className="check-state">正在由 CircuitJS 引擎检查…</p>
          : verdict === null ? <p className="check-state">引擎未就绪，打开时再检查。</p>
          : verdict.ok ? <p className="check-state ok">可打开 · {verdict.entries} 个元件</p>
          : <p className="check-state blocked">{verdict.message}</p>}
        {summary.length ? <ul className="example-parts">{summary.map(([cls, n]) => <li key={cls}>{partLabel(cls)}<small>×{n}</small></li>)}</ul> : null}
        <button className="primary" disabled={disabled || verdict === 'pending' || (verdict !== null && !verdict.ok)} onClick={() => onOpen(selected.entry, selected.source)}><FolderOpen size={15} aria-hidden="true" />作为新实验打开</button>
        <p className="license-note">示例来自 CircuitJS1（Paul Falstad 等，GPL-2.0-or-later），随本工作台源码保存，不联网读取。</p>
      </> : !error ? <p className="empty-note">选择左侧示例查看预览。</p> : null}
    </div>
  </section>;
}
