import { useEffect,useRef,useState } from 'react';
import { Activity,Play,Pause,RotateCcw,Download,Upload,Undo2,Redo2,Scan,BookOpen,ChevronDown,X,MousePointer2,NotebookPen } from 'lucide-react';
import {useProjects,Notice,download} from './workspace';
import {seed,RC_SOURCE,DC_SOURCE,validateCircuit,restoreCircuit,parameterDraft,decodeImport} from '../contracts/circuit';
import {isRecord} from '../contracts/project';
type Reading={index:number;type:string;voltage:number;current:number;dump:string};
const fmt=(x:number,unit:string)=>Number.isFinite(x)?`${Math.abs(x)<0.001?(x*1e6).toFixed(2)+' μ':Math.abs(x)<1?(x*1000).toFixed(2)+' m':x.toFixed(3)+' '}${unit}`:'—';
export function App(){
 const p=useProjects(seed,validateCircuit,'RC 阶跃响应',{storageKey:'circuitjs-v08',restoreDraftData:restoreCircuit});
 const ref=useRef<HTMLIFrameElement>(null),latest=useRef(p),locked=useRef(false),exportRequest=useRef(''),freezeWait=useRef<((value:boolean)=>void)|null>(null);latest.current=p;
 const [ready,setReady]=useState(false),[running,setRunning]=useState(false),[readingValid,setReadingValid]=useState(false),[readings,setReadings]=useState<Reading[]>([]),[time,setTime]=useState(0),[selected,setSelected]=useState(1),[transition,setTransition]=useState(false),[engineError,setEngineError]=useState('');
 const book=useRef<HTMLDialogElement>(null),bookHeading=useRef<HTMLHeadingElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 const [bookOpen,setBookOpen]=useState(false),[bookPage,setBookPage]=useState<'files'|'notes'|'source'>('files'),[activeTool,setActiveTool]=useState('Select');
 function showBook(page:'files'|'notes'|'source'){returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setBookPage(page);setBookOpen(true);book.current?.showModal();bookHeading.current?.focus();}
 function closeBook(){book.current?.close();}
 function restoreBookFocus(){setBookOpen(false);returnFocus.current?.focus();}
 useEffect(()=>{book.current?.close();setActiveTool('Select');},[p.documentKey]);
 const raw=typeof p.draft.source==='string'?p.draft.source:p.data.source,draft=parameterDraft(p.draft.parameter);
 function send(type:string,more:Record<string,unknown>={}){ref.current?.contentWindow?.postMessage({bridge:'circuitjs-v08',key:latest.current.documentKey,type,...more},location.origin);}
 useEffect(()=>{document.title='CircuitJS1 · 电路实验台';},[]);
 useEffect(()=>{setReady(false);setRunning(false);setReadings([]);setEngineError('');setSelected(1);exportRequest.current='';},[p.documentKey]);
 useEffect(()=>{
  function receive(e:MessageEvent){
   if(e.origin!==location.origin||e.source!==ref.current?.contentWindow||!isRecord(e.data)||e.data.bridge!=='circuitjs-v08')return;
   const m=e.data,current=latest.current;if(m.type==='frozen'&&m.key===current.documentKey&&freezeWait.current){try{current.setData(data=>restoreCircuit({...data,source:m.source,view:m.view,viewport:m.viewport}));if(m.draft!==undefined)current.setDraft(extra=>({...extra,parameter:parameterDraft(m.draft)}));freezeWait.current(true);}catch(error){current.report(error);freezeWait.current(false);}freezeWait.current=null;return;}if(locked.current)return;
   if(m.type==='ready'){send('init',{source:current.data.source,view:current.data.view,viewport:current.data.viewport});return;}
   if(m.key!==current.documentKey)return;
   if(m.type==='loaded')setReady(true);
   if(m.type==='error'&&typeof m.message==='string'){setEngineError(m.message);setRunning(false);}
   if(m.type==='snapshot'&&typeof m.source==='string'&&Array.isArray(m.view))try{const view=m.view;current.setData(data=>restoreCircuit({...data,source:m.source,view,viewport:m.viewport}));}catch(error){current.report(error);}
   if(m.type==='draft'){const d=parameterDraft(m.draft);current.setDraft(extra=>({...extra,parameter:d}));}
   if(m.type==='readouts'&&Array.isArray(m.items)){setRunning(m.running===true);setReadingValid(m.valid===true);setTime(typeof m.time==='number'?m.time:0);setReadings(m.items.filter((x):x is Reading=>isRecord(x)&&typeof x.index==='number'&&typeof x.type==='string'&&typeof x.voltage==='number'&&typeof x.current==='number'&&typeof x.dump==='string'));if(typeof m.stop==='string')setEngineError(m.stop);}
   if(m.type==='export'&&m.request===exportRequest.current&&typeof m.source==='string'&&typeof m.png==='string'){
    const what=exportRequest.current.split(':')[0];exportRequest.current='';
    if(what==='circuit')download(new Blob([m.source],{type:'application/xml'}),'circuit.circuitjs');
    if(what==='png'){const bytes=Uint8Array.from(atob(m.png.split(',')[1]),c=>c.charCodeAt(0));download(new Blob([bytes],{type:'image/png'}),'circuit.png');}
    if(what==='report')download(new Blob([`# ${current.title}\n\n${current.data.notes}\n\n仿真时间：${m.time} s；读数${m.valid?'对应当前电路':'尚待重新运行'}\n\n${JSON.stringify(m.readouts,null,2)}\n\n## 电路快照\n\n\`\`\`xml\n${m.source}\`\`\`\n`],{type:'text/markdown'}),'experiment.md');
   }
  }
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[]);
 async function change(task:()=>Promise<boolean>){if(locked.current)return;locked.current=true;setTransition(true);let changed=false;try{if(ready){const frozen=await new Promise<boolean>(resolve=>{const timer=setTimeout(()=>{freezeWait.current=null;resolve(false);},3000);freezeWait.current=value=>{clearTimeout(timer);resolve(value);};send('freeze');});if(!frozen)throw Error('无法确认电路快照，已保留当前实验，请重试。');}changed=await task();}catch(error){p.report(error);}finally{if(!changed)send('thaw');locked.current=false;setTransition(false);}}
 function exportNative(kind:string){exportRequest.current=kind+':'+crypto.randomUUID();send('export',{request:exportRequest.current});}
 async function importFile(file:File){try{if(file.size>12*1024*1024)throw Error('文件超过 12 MiB，请拆分。');const text=await file.text();if(file.name.toLowerCase().endsWith('.json')){const next=decodeImport(JSON.parse(text));await change(()=>p.replace(next.data,next.title,next.extra));}else{const next=validateCircuit({...seed,source:text,original:text,notes:'导入的原始电路文本随实验记录保留。未支持字段可在原始文本中查看与下载。'});await change(()=>p.replace(next,file.name.slice(0,100)));}}catch(error){p.report(error);}}
 function newExample(source:string,title:string){void change(()=>p.replace({...seed,source,notes:source===DC_SOURCE?'实验目的：测量 5 V 电源、两个 1 kΩ 电阻的分压。\n\n预期：每个电阻两端 2.5 V，电流 2.5 mA。':seed.notes},title));}
 const savedMessage=transition?'正在保存并切换实验…':p.loading?'正在恢复实验…':p.autoState.phase==='saved'&&(draft||p.draft.source!==undefined)?'电路与草稿已保存 · 草稿尚未应用':p.autoState.message;
 return <main className="bench" aria-busy={transition}>
  <a className="skip-link" href="#instruments">前往仪器控制</a>
  <header className="bench-rim">
   <button className="experiment-trigger" disabled={transition} aria-haspopup="dialog" aria-expanded={bookOpen} onClick={()=>showBook('files')}><BookOpen size={17} aria-hidden="true"/>实验<ChevronDown size={13} aria-hidden="true"/></button>
   <div className="circuit-caption"><span>CIRCUITJS</span><h1>{p.title}</h1></div>
   <span className="save-state" role="status" data-phase={p.autoState.phase}>{savedMessage}</span>
  </header>
  <Notice error={p.error} notice={p.notice}/>
  {engineError?<p className="notice error" role="alert">{engineError}</p>:null}
  <div className="station">
   <nav className="component-rack" aria-label="元件工具架">
    <span className="rack-label">元件</span>
    {[
     ['Select','选择','↖'],['WireElm','导线','╱'],['ResistorElm','R 电阻','R'],['CapacitorElm','C 电容','C'],['InductorElm','L 电感','L'],['DCVoltageElm','V 电源','V'],['GroundElm','接地','⏚'],['SwitchElm','开关','S']
    ].map(([tool,label,symbol])=><button key={tool} aria-label={label} aria-pressed={activeTool===tool} disabled={!ready||transition} onClick={()=>{setActiveTool(tool);send('tool',{tool});}}><b aria-hidden="true">{tool==='Select'?<MousePointer2 size={18}/>:symbol}</b><small>{label.replace(/^[RCLV] /,'')}</small></button>)}
    <div className="rack-divider"/>
    <button aria-label="撤销电路编辑" title="撤销" disabled={!ready||transition} onClick={()=>send('undo')}><Undo2 size={17} aria-hidden="true"/></button>
    <button aria-label="重做电路编辑" title="重做" disabled={!ready||transition} onClick={()=>send('redo')}><Redo2 size={17} aria-hidden="true"/></button>
    <button aria-label="适合画布" title="适合画布" disabled={!ready||transition} onClick={()=>send('center')}><Scan size={17} aria-hidden="true"/></button>
   </nav>
   <section className="stage" aria-label="电路与示波器">
    <div className="canvas-rim"><span>电路 / 示波器</span><small>双击元件编辑 · 右键选择波形</small><div className="canvas-exports"><button onClick={()=>exportNative('circuit')} disabled={!ready||transition}><Download size={13} aria-hidden="true"/>电路文件</button><button onClick={()=>exportNative('png')} disabled={!ready||transition}>画布 PNG</button></div></div>
    <div className="framewrap" inert={transition||p.loading}>
     {!p.loading?<iframe key={p.documentKey} ref={ref} title="CircuitJS 原生电路编辑器与示波器" src="/api/engine/index.html?running=false&hideSidebar=true&hideMenu=true" sandbox="allow-scripts allow-same-origin"/>:null}
     {!ready?<div className="load">{engineError?'原文保留于实验簿，可在电路文本中修订。':'正在载入电路引擎…'}</div>:null}
    </div>
    <div className="trace-legend"><span><i/>电压 V</span><span><i/>电流 A</span><span>CircuitJS1</span></div>
   </section>
  </div>
  <section id="instruments" tabIndex={-1} className="instrument-console" aria-label="仪器控制台">
   <div className="timebase"><span className="panel-label"><i className={running?'running':''}/>{running?'运行':'暂停'} / TIMEBASE</span><div className="run-controls"><button className="run" disabled={!ready||transition} onClick={()=>send('run')}>{running?<Pause size={18} aria-hidden="true"/>:<Play size={18} aria-hidden="true"/>}{running?'暂停':'运行'}</button><button aria-label="重置时间" disabled={!ready||transition} onClick={()=>send('reset')}><RotateCcw size={15} aria-hidden="true"/>复位</button><output className="elapsed">{time.toFixed(6)}<small>s</small></output></div></div>
   <div className="probe"><label className="panel-label" htmlFor="selected-element">当前元件 / PROBE</label><select id="selected-element" disabled={transition} value={selected} aria-label="选择元件" onChange={e=>setSelected(Number(e.target.value))}>{readings.map(r=><option key={r.index} value={r.index}>{String(r.index+1).padStart(2,'0')} · {r.type}</option>)}</select><div className="probe-actions"><button disabled={!ready||transition} onClick={()=>send('edit',{index:selected})}>编辑参数</button><button disabled={!ready||transition} onClick={()=>send('scope',{index:selected})}>加入示波器</button></div></div>
   <div className="meter voltage"><span className="panel-label">电压差 / VOLTAGE</span><output>{readingValid?fmt(readings[selected]?.voltage??NaN,'V'):'待运行'}</output></div>
   <div className="meter current"><span className="panel-label">电流 / CURRENT</span><output>{readingValid?fmt(readings[selected]?.current??NaN,'A'):'待运行'}</output></div>
   <button className="notes-trigger" disabled={transition} onClick={()=>showBook('notes')}><NotebookPen size={22} aria-hidden="true"/><span>实验记录</span></button>
  </section>
  {draft?<section className="parameter-draft" aria-label="未提交的参数草稿"><strong>参数草稿</strong><div>{draft.fields.map(f=><span key={f.index}>{f.name}：<code>{f.value||'（空）'}</code></span>)}</div><button disabled={!ready||transition} onClick={()=>send('restore-draft',{draft})}>恢复到参数框</button><button disabled={transition} onClick={()=>p.setDraft(x=>({...x,parameter:null}))}>丢弃草稿</button></section>:null}
  <dialog ref={book} className="experiment-book" aria-labelledby="book-title" onClose={restoreBookFocus} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')).filter(element=>element.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===bookHeading.current)){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }}>
   <header className="book-heading"><div><span>CIRCUIT LAB / NOTEBOOK</span><h2 ref={bookHeading} tabIndex={-1} id="book-title">实验簿</h2></div><button aria-label="关闭实验簿" onClick={closeBook}><X size={19} aria-hidden="true"/></button></header>
   <nav className="book-pages" aria-label="实验簿页面">{[['files','电路'],['notes','记录'],['source','文本']].map(([page,label])=><button key={page} disabled={transition} aria-current={bookPage===page?'page':undefined} onClick={()=>setBookPage(page as 'files'|'notes'|'source')}>{label}</button>)}</nav>
   <div className="book-content">
    <Notice error={p.error} notice={p.notice}/>
    {bookPage==='files'?<section className="circuits-page">
     <h3>开始一次实验</h3><div className="example-list"><button aria-label="新建 RC 实验" disabled={transition||p.busy} onClick={()=>newExample(RC_SOURCE,'RC 阶跃响应')}><Activity size={22} aria-hidden="true"/><span><strong>RC 方波响应</strong><small>1 kΩ · 1 μF · 100 Hz</small></span><span aria-hidden="true">↗</span></button><button aria-label="新建直流分压实验" disabled={transition||p.busy} onClick={()=>newExample(DC_SOURCE,'电阻分压实验')}><span className="dc-symbol" aria-hidden="true">⎓</span><span><strong>直流分压</strong><small>5 V · 两个 1 kΩ 电阻</small></span><span aria-hidden="true">↗</span></button></div>
     <label className="file-button"><Upload size={16} aria-hidden="true"/><span>导入电路或恢复文件</span><input type="file" accept=".json,.txt,.circuitjs,.xml" aria-label="导入电路或恢复文件" disabled={transition||p.busy} onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.target.value='';}}/></label>
     <h3>最近实验</h3><ul className="recent-experiments">{p.items.length?p.items.map(item=><li key={item.id}><button disabled={transition||p.busy} aria-current={item.id===p.current?.id?'page':undefined} onClick={()=>void change(()=>p.open(item.id))}><span>{item.title}</span><small>{item.id===p.current?.id?'当前实验':'打开'}</small></button></li>):<li className="empty-note">编辑后的实验会保存在这里。</li>}</ul>
     <section className="recovery-tools"><h3>保存与恢复</h3><p role="status">{savedMessage}</p><div><button onClick={()=>void p.save()} disabled={p.busy||transition}>立即保存</button><button disabled={transition} onClick={p.exportDraft}>导出恢复包</button>{p.autoState.phase==='conflict'&&p.current?<button disabled={transition} onClick={()=>void change(()=>p.open(p.current!.id))}>打开服务端版本</button>:null}</div></section>
    </section>:null}
    {bookPage==='notes'?<section className="notes-page"><label>实验名称<input disabled={transition} name="experiment-title" autoComplete="off" value={p.title} onChange={e=>p.setTitle(e.target.value)}/></label><label>实验记录<textarea disabled={transition} name="experiment-notes" aria-label="实验记录" value={p.data.notes} onChange={e=>p.setData(x=>({...x,notes:e.target.value}))}/></label><button disabled={!ready||transition} onClick={()=>exportNative('report')}><Download size={15} aria-hidden="true"/>导出实验记录</button></section>:null}
    {bookPage==='source'?<section className="source-page"><label>电路文本<textarea disabled={transition} name="circuit-source" spellCheck={false} aria-label="电路文本" value={raw} onChange={e=>p.setDraft(x=>({...x,source:e.target.value}))}/></label><div><button disabled={transition||p.busy} onClick={()=>{try{const next=validateCircuit({...p.data,source:raw,original:raw,view:[]});void change(()=>p.replace(next,p.title+' · 文本'));}catch(error){p.report(error);}}}>作为新实验应用</button><button disabled={transition} onClick={()=>download(new Blob([p.data.original||p.data.source],{type:'text/plain'}),'original-circuit.txt')}>下载保留原文</button></div><p>应用前的原文保留在实验中。未支持的元件与字段可在此核对。</p></section>:null}
   </div>
   <footer className="book-footer"><span>CircuitJS1 · GPL-2.0-or-later</span><span>Esc 返回电路</span></footer>
  </dialog>
 </main>;
}
