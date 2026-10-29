// ABOUTME: 左侧纵向元件架与可检索的分类元件库抽屉；放置仍由原生画布拖动完成。

import { useEffect, useMemo, useRef, useState } from 'react';
import { MousePointer2, Search, Undo2, Redo2, Scan, LayoutGrid, X } from 'lucide-react';
import { PART_CATEGORIES, QUICK_PARTS, bestPart, partFor, searchParts, type Part } from '../contracts/parts';

const RECENT_KEY = 'circuitjs-v09-recent-parts';
function loadRecent(): string[] {
  try { const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!partFor(x)).slice(0, 3) : []; }
  catch { return []; }
}
function saveRecent(list: string[]) { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* per-viewer convenience only */ } }

type Props = {
  ready: boolean; disabled: boolean; activeTool: string; placeable: Set<string> | null; blocked: Record<string, string>;
  onTool: (tool: string) => void; onUndo: () => void; onRedo: () => void; onCenter: () => void;
};

export function ComponentRack({ ready, disabled, activeTool, placeable, blocked, onTool, onUndo, onRedo, onCenter }: Props) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [recent, setRecent] = useState<string[]>(loadRecent);
  const search = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null), drawer = useRef<HTMLDivElement>(null);
  const available = (cls: string) => !placeable || placeable.has(cls);
  const results = useMemo(() => searchParts(query), [query]);
  const resultCount = results.reduce((n, c) => n + c.parts.length, 0);
  const activePart = partFor(activeTool);
  const slots = [...QUICK_PARTS, ...recent.filter(cls => !QUICK_PARTS.includes(cls)), ...(activePart && !QUICK_PARTS.includes(activeTool) && !recent.includes(activeTool) ? [activeTool] : [])].slice(0, 10);
  useEffect(() => { if (open) search.current?.focus(); }, [open]);
  function close(returnFocus = true) { setOpen(false); if (returnFocus) trigger.current?.focus(); }
  function pick(part: Part) {
    if (!available(part.cls)) return;
    onTool(part.cls);
    if (!QUICK_PARTS.includes(part.cls)) { const next = [part.cls, ...recent.filter(x => x !== part.cls)].slice(0, 3); setRecent(next); saveRecent(next); }
    close(false);
  }
  const blockedList = Object.entries(blocked);
  return <>
    <nav className="component-rack" aria-label="元件工具架">
      <span className="rack-label">元件</span>
      <button aria-label="选择 / 移动" title="选择 / 移动（空格）" aria-pressed={activeTool === 'Select'} disabled={!ready || disabled} onClick={() => onTool('Select')}><b aria-hidden="true"><MousePointer2 size={18} /></b><small>选择</small></button>
      <button ref={trigger} className="library-trigger" aria-label="打开元件库" title="元件库：全部可用元件" aria-expanded={open} aria-controls="parts-library" disabled={!ready || disabled} onClick={() => open ? close() : setOpen(true)}><b aria-hidden="true"><LayoutGrid size={18} /></b><small>元件库</small></button>
      <div className="rack-divider" />
      {slots.map(cls => { const part = partFor(cls)!; return <button key={cls} aria-label={part.name} title={`${part.name} · ${part.en}`} aria-pressed={activeTool === cls} disabled={!ready || disabled || !available(cls)} onClick={() => pick(part)}><b aria-hidden="true">{part.symbol}</b><small>{part.name.length > 4 ? part.name.slice(0, 4) : part.name}</small></button>; })}
      <div className="rack-divider" />
      <button aria-label="撤销电路编辑" title="撤销" disabled={!ready || disabled} onClick={onUndo}><Undo2 size={17} aria-hidden="true" /></button>
      <button aria-label="重做电路编辑" title="重做" disabled={!ready || disabled} onClick={onRedo}><Redo2 size={17} aria-hidden="true" /></button>
      <button aria-label="适合画布" title="适合画布" disabled={!ready || disabled} onClick={onCenter}><Scan size={17} aria-hidden="true" /></button>
    </nav>
    {open ? <div ref={drawer} id="parts-library" className="parts-library" role="dialog" aria-label="元件库" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
      <header>
        <label className="parts-search"><Search size={15} aria-hidden="true" /><span className="sr-only">搜索元件</span>
          <input ref={search} type="search" name="part-search" autoComplete="off" spellCheck={false} placeholder="搜索：555、NPN、与门、LED…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const first = bestPart(query, available); if (first) { e.preventDefault(); pick(first); } } }} />
        </label>
        <button className="icon-button" aria-label="关闭元件库" onClick={() => close()}><X size={17} aria-hidden="true" /></button>
      </header>
      <p className="parts-count" aria-live="polite">{query ? `${resultCount} 个匹配元件` : `${PART_CATEGORIES.reduce((n, c) => n + c.parts.length, 0)} 个元件 · 选中后在画布上拖动放置`}</p>
      <div className="parts-scroll">
        {results.map(category => <section key={category.id} aria-labelledby={`cat-${category.id}`}>
          <h3 id={`cat-${category.id}`}>{category.name}<small>{category.en}</small></h3>
          <ul>{category.parts.map(part => <li key={part.cls}><button aria-pressed={activeTool === part.cls} disabled={!available(part.cls)} title={available(part.cls) ? part.en : '当前引擎未提供此元件'} onClick={() => pick(part)}><b aria-hidden="true">{part.symbol}</b><span>{part.name}<small>{part.en}</small></span></button></li>)}</ul>
        </section>)}
        {!resultCount ? <p className="empty-note">没有匹配的元件。可尝试英文名称或符号，例如 “npn”、“555”、“and”。</p> : null}
        {blockedList.length && !query ? <details className="parts-blocked"><summary>不开放的 {blockedList.length} 个元件</summary><ul>{blockedList.map(([cls, reason]) => <li key={cls}><strong>{cls.replace(/Elm$/, '')}</strong>{reason}</li>)}</ul></details> : null}
      </div>
    </div> : null}
  </>;
}
