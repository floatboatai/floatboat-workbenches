import { useEffect,useRef,useState } from 'react';
import { Activity,Download,Upload,BookOpen,ChevronDown,X,NotebookPen,Library,SlidersHorizontal,Timer } from 'lucide-react';
import {useProjects,Notice,download} from './workspace';
import {seed,RC_SOURCE,DC_SOURCE,TIMER_SOURCE,validateCircuit,restoreCircuit,parameterDraft,decodeImport} from '../contracts/circuit';
import {isRecord} from '../contracts/project';
import {partFor,partLabel} from '../contracts/parts';
import type {ExampleEntry} from '../contracts/examples';
import {ComponentRack} from './ComponentRack';
import {Timebase,SliderStrip} from './Controls';
import {sliderDraft,suggestRange,type SliderDraft} from '../contracts/sliders';
import {ExampleLibrary} from './ExampleLibrary';
import {decodeCheck,decodeStatus,si,type EngineStatus,type SourceCheck} from './bench-protocol';
type BookPage='files'|'examples'|'notes'|'source';
const IDLE:EngineStatus={running:false,valid:false,time:0,stop:'',items:[],speed:117,currentSpeed:50,timeStep:5e-6,tool:'Select',adjustables:[],probe:null};
export function App(){
 const p=useProjects(seed,validateCircuit,'555 LED 闪烁器',{storageKey:'circuitjs-v08',restoreDraftData:restoreCircuit});
 const ref=useRef<HTMLIFrameElement>(null),latest=useRef(p),locked=useRef(false),exportRequest=useRef(''),freezeWait=useRef<((value:boolean)=>void)|null>(null),checks=useRef(new Map<string,(r:SourceCheck|null)=>void>()),autoProbe=useRef(false);latest.current=p;
 const [ready,setReady]=useState(false),[status,setStatus]=useState<EngineStatus>(IDLE),[selected,setSelected]=useState(0),[transition,setTransition]=useState(false),[engineError,setEngineError]=useState('');
 const [placeable,setPlaceable]=useState<Set<string>|null>(null),[blocked,setBlocked]=useState<Record<string,string>>({});
 const book=useRef<HTMLDialogElement>(null),bookHeading=useRef<HTMLHeadingElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 const [bookOpen,setBookOpen]=useState(false),[bookPage,setBookPage]=useState<BookPage>('files');
 function showBook(page:BookPage){returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setBookPage(page);setBookOpen(true);book.current?.showModal();bookHeading.current?.focus();}
 function closeBook(){book.current?.close();}
 function restoreBookFocus(){setBookOpen(false);returnFocus.current?.focus();}
 useEffect(()=>{book.current?.close();},[p.documentKey]);
 const raw=typeof p.draft.source==='string'?p.draft.source:p.data.source,draft=parameterDraft(p.draft.parameter),slider=sliderDraft(p.draft.slider);
 function send(type:string,more:Record<string,unknown>={}){ref.current?.contentWindow?.postMessage({bridge:'circuitjs-v08',key:latest.current.documentKey,type,...more},location.origin);}
 useEffect(()=>{document.title='CircuitJS1 · 电路实验台';},[]);
 useEffect(()=>{autoProbe.current=false;setReady(false);setStatus(IDLE);setEngineError('');setSelected(sliderDraft(latest.current.draft.slider)?.element??0);exportRequest.current='';for(const done of checks.current.values())done(null);checks.current.clear();},[p.documentKey]);
 useEffect(()=>{if(ready)send('probe',{index:selected});},[ready,selected]);
 useEffect(()=>{
  function receive(e:MessageEvent){
   if(e.origin!==location.origin||e.source!==ref.current?.contentWindow||!isRecord(e.data)||e.data.bridge!=='circuitjs-v08')return;
   const m=e.data,current=latest.current;if(m.type==='frozen'&&m.key===current.documentKey&&freezeWait.current){try{current.setData(data=>restoreCircuit({...data,source:m.source,view:m.view,viewport:m.viewport}));if(m.draft!==undefined)current.setDraft(extra=>({...extra,parameter:parameterDraft(m.draft)}));freezeWait.current(true);}catch(error){current.report(error);freezeWait.current(false);}freezeWait.current=null;return;}if(locked.current)return;
   if(m.type==='ready'){send('init',{source:current.data.source,view:current.data.view,viewport:current.data.viewport});return;}
   if(m.key!==current.documentKey)return;
   if(m.type==='loaded'){setReady(true);setEngineError('');}
   if(m.type==='catalog'&&Array.isArray(m.placeable)){setPlaceable(new Set(m.placeable.filter((x):x is string=>typeof x==='string')));if(isRecord(m.blocked))setBlocked(Object.fromEntries(Object.entries(m.blocked).filter((x):x is [string,string]=>typeof x[1]==='string')));}
   if(m.type==='error'&&typeof m.message==='string'){setEngineError(m.message);}
   if(m.type==='snapshot'&&typeof m.source==='string'&&Array.isArray(m.view))try{const view=m.view;current.setData(data=>restoreCircuit({...data,source:m.source,view,viewport:m.viewport}));}catch(error){current.report(error);}
   if(m.type==='draft'){const d=parameterDraft(m.draft);current.setDraft(extra=>({...extra,parameter:d}));}
   if(m.type==='selection'&&typeof m.index==='number'&&Number.isInteger(m.index))setSelected(m.index);
   if(m.type==='source-check'&&typeof m.request==='string'){const done=checks.current.get(m.request);if(done){checks.current.delete(m.request);done(decodeCheck(m));}}
   if(m.type==='readouts'){const next=decodeStatus(m);setStatus(next);if(next.stop)setEngineError(next.stop);if(!autoProbe.current&&next.items.length){autoProbe.current=true;const first=next.items.find(x=>!/^(Wire|Ground|Text|Box|Line)Elm$/.test(x.cls));if(first&&!sliderDraft(current.draft.slider))setSelected(first.index);}}
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
 function checkSource(source:string){return new Promise<SourceCheck|null>(resolve=>{if(!ready){resolve(null);return;}const request=crypto.randomUUID();const timer=setTimeout(()=>{checks.current.delete(request);resolve(null);},4000);checks.current.set(request,r=>{clearTimeout(timer);resolve(r);});send('check-source',{source,request});});}
 async function importFile(file:File){try{if(file.size>12*1024*1024)throw Error('文件超过 12 MiB，请拆分。');const text=await file.text();if(file.name.toLowerCase().endsWith('.json')){const next=decodeImport(JSON.parse(text));await change(()=>p.replace(next.data,next.title,next.extra));}else{const next=validateCircuit({...seed,source:text,original:text,notes:'导入的原始电路文本随实验记录保留。未支持字段可在原始文本中查看与下载。'});await change(()=>p.replace(next,file.name.slice(0,100)));}}catch(error){p.report(error);}}
 function newExample(source:string,title:string,notes:string){void change(()=>p.replace({...seed,source,notes},title));}
 function openExample(entry:ExampleEntry,source:string){try{const next=validateCircuit({...seed,source,original:source,view:[],notes:`示例：${entry.title}\n分类：${entry.path.join(' / ')}\n来源：CircuitJS1 官方示例 ${entry.file}（Paul Falstad 等，GPL-2.0-or-later）\n\n实验记录：`});void change(()=>p.replace(next,entry.title.slice(0,100)));}catch(error){p.report(error);}}
 function startSlider(){const probe=status.probe;if(!probe||probe.index!==selected)return;const param=probe.params.find(x=>!x.hasSlider);if(!param){p.report(new Error('该元件没有可用滑块调节的数值参数。'));return;}const [min,max]=suggestRange(param.value,param.min,param.max);p.setDraft(x=>({...x,slider:{element:selected,item:param.item,label:param.name,min,max,log:false}}));}
 const setSlider=(d:SliderDraft|null)=>p.setDraft(x=>({...x,slider:d}));
 const savedMessage=transition?'正在保存并切换实验…':p.loading?'正在恢复实验…':p.autoState.phase==='saved'&&(draft||slider||p.draft.source!==undefined)?'电路与草稿已保存 · 草稿尚未应用':p.autoState.message;
 const items=status.items,reading=items[selected],activePart=partFor(status.tool),labelAt=(index:number)=>items[index]?partLabel(items[index].cls):`元件 ${index+1}`;
 const probe=status.probe?.index===selected?status.probe:null,off=!ready||transition;
 return <main className="bench" aria-busy={transition}>
  <a className="skip-link" href="#instruments">前往仪器控制</a>
  <header className="bench-rim">
   <button className="experiment-trigger" disabled={transition} aria-haspopup="dialog" aria-expanded={bookOpen&&bookPage!=='examples'} onClick={()=>showBook('files')}><BookOpen size={17} aria-hidden="true"/>实验<ChevronDown size={13} aria-hidden="true"/></button>
   <button className="examples-trigger" disabled={transition} aria-haspopup="dialog" aria-expanded={bookOpen&&bookPage==='examples'} onClick={()=>showBook('examples')}><Library size={16} aria-hidden="true"/>示例库</button>
   <div className="circuit-caption"><span>CIRCUITJS</span><h1>{p.title}</h1></div>
   <span className="save-state" role="status" data-phase={p.autoState.phase}>{savedMessage}</span>
  </header>
  <Notice error={p.error} notice={p.notice}/>
  {engineError?<p className="notice error" role="alert">{engineError}{ready?<button className="notice-close" aria-label="关闭提示" onClick={()=>setEngineError('')}><X size={14} aria-hidden="true"/></button>:null}</p>:null}
  <div className="station">
   <ComponentRack ready={ready} disabled={transition} activeTool={status.tool} placeable={placeable} blocked={blocked} onTool={tool=>send('tool',{tool})} onUndo={()=>send('undo')} onRedo={()=>send('redo')} onCenter={()=>send('center')}/>
   <section className="stage" aria-label="电路与示波器">
    <div className="canvas-rim"><span>电路 / 示波器</span><small className={activePart?'placing':''}>{activePart?`放置：${activePart.name} · 在画布上拖动`:'双击元件编辑 · 右键选择波形'}</small><div className="canvas-exports"><button onClick={()=>exportNative('circuit')} disabled={off}><Download size={13} aria-hidden="true"/>电路文件</button><button onClick={()=>exportNative('png')} disabled={off}>画布 PNG</button></div></div>
    <div className="framewrap" inert={transition||p.loading}>
     {!p.loading?<iframe key={p.documentKey} ref={ref} title="CircuitJS 原生电路编辑器与示波器" src="/api/engine/index.html?running=false&hideSidebar=true&hideMenu=true" sandbox="allow-scripts allow-same-origin"/>:null}
     {!ready?<div className="load">{engineError?'原文保留于实验簿，可在电路文本中修订。':'正在载入电路引擎…'}</div>:null}
    </div>
    <div className="trace-legend"><span><i/>电压 V</span><span><i/>电流 A</span><span>{items.length} 个元件 · CircuitJS1</span></div>
   </section>
  </div>
  <SliderStrip sliders={status.adjustables} ready={ready} disabled={transition} labelFor={labelAt} draft={slider} probe={status.probe} probeLabel={`${String(selected+1).padStart(2,'0')} · ${labelAt(selected)}`} setDraft={setSlider} send={send} report={p.report}/>
  <section id="instruments" tabIndex={-1} className="instrument-console" aria-label="仪器控制台">
   <Timebase status={status} ready={ready} disabled={transition} send={send}/>
   <div className="probe"><label className="panel-label" htmlFor="selected-element">当前元件 / PROBE</label><select id="selected-element" disabled={transition} value={reading?selected:''} aria-label="选择元件" onChange={e=>setSelected(Number(e.target.value))}>{!reading?<option value="">—</option>:null}{items.map(r=><option key={r.index} value={r.index}>{String(r.index+1).padStart(2,'0')} · {partLabel(r.cls)}</option>)}</select>
    <div className="probe-actions"><button disabled={off||!reading} onClick={()=>send('edit',{index:selected})}>编辑参数</button><button disabled={off||!reading} onClick={()=>send('scope',{index:selected})}>加入示波器</button><button disabled={off||!probe?.params.some(x=>!x.hasSlider)} onClick={startSlider}><SlidersHorizontal size={12} aria-hidden="true"/>滑块</button></div>
    {probe?.info.length?<ul className="probe-info" aria-label="元件状态">{probe.info.slice(1).map((line,i)=><li key={i}>{line}</li>)}</ul>:null}
   </div>
   <div className="meter voltage"><span className="panel-label">电压差 / VOLTAGE</span><output>{status.valid&&reading?si(reading.voltage,'V',4):'待运行'}</output></div>
   <div className="meter current"><span className="panel-label">电流 / CURRENT</span><output>{status.valid&&reading?si(reading.current,'A',4):'待运行'}</output></div>
   <button className="notes-trigger" disabled={transition} onClick={()=>showBook('notes')}><NotebookPen size={22} aria-hidden="true"/><span>实验记录</span></button>
  </section>
  {draft?<section className="parameter-draft" aria-label="未提交的参数草稿"><strong>参数草稿</strong><div>{draft.fields.map(f=><span key={f.index}>{f.name}：<code>{f.value||'（空）'}</code></span>)}</div><button disabled={off} onClick={()=>send('restore-draft',{draft})}>恢复到参数框</button><button disabled={transition} onClick={()=>p.setDraft(x=>({...x,parameter:null}))}>丢弃草稿</button></section>:null}
  <dialog ref={book} className="experiment-book" data-page={bookPage} aria-labelledby="book-title" onClose={restoreBookFocus} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex="0"]')).filter(element=>element.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===bookHeading.current)){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }}>
   <header className="book-heading"><div><span>CIRCUIT LAB / NOTEBOOK</span><h2 ref={bookHeading} tabIndex={-1} id="book-title">{bookPage==='examples'?'示例库':'实验簿'}</h2></div><button aria-label="关闭实验簿" onClick={closeBook}><X size={19} aria-hidden="true"/></button></header>
   <nav className="book-pages" aria-label="实验簿页面">{([['files','电路'],['examples','示例库'],['notes','记录'],['source','文本']] as [BookPage,string][]).map(([page,label])=><button key={page} disabled={transition} aria-current={bookPage===page?'page':undefined} onClick={()=>setBookPage(page)}>{label}</button>)}</nav>
   <div className="book-content">
    <Notice error={p.error} notice={p.notice}/>
    {bookPage==='files'?<section className="circuits-page">
     <h3>开始一次实验</h3><div className="example-list">
      <button aria-label="新建 555 LED 闪烁实验" disabled={transition||p.busy} onClick={()=>newExample(TIMER_SOURCE,'555 LED 闪烁器',seed.notes)}><Timer size={22} aria-hidden="true"/><span><strong>555 LED 闪烁器</strong><small>无稳态 · 10 μF · 可调电阻滑块</small></span><span aria-hidden="true">↗</span></button>
      <button aria-label="新建 RC 实验" disabled={transition||p.busy} onClick={()=>newExample(RC_SOURCE,'RC 阶跃响应','实验目的：观察一阶 RC 低通电路的阶跃响应。\n\nR = 1 kΩ，C = 1 μF，时间常数 τ = 1 ms。\n输入：100 Hz 方波，幅度 ±5 V。\n\n运行后，比较电容电压的充放电曲线；双击电阻或电容调整参数。')}><Activity size={22} aria-hidden="true"/><span><strong>RC 方波响应</strong><small>1 kΩ · 1 μF · 100 Hz</small></span><span aria-hidden="true">↗</span></button>
      <button aria-label="新建直流分压实验" disabled={transition||p.busy} onClick={()=>newExample(DC_SOURCE,'电阻分压实验','实验目的：测量 5 V 电源、两个 1 kΩ 电阻的分压。\n\n预期：每个电阻两端 2.5 V，电流 2.5 mA。')}><span className="dc-symbol" aria-hidden="true">⎓</span><span><strong>直流分压</strong><small>5 V · 两个 1 kΩ 电阻</small></span><span aria-hidden="true">↗</span></button>
      <button aria-label="浏览官方示例库" disabled={transition} onClick={()=>setBookPage('examples')}><Library size={22} aria-hidden="true"/><span><strong>官方示例库</strong><small>360+ 个 CircuitJS1 电路</small></span><span aria-hidden="true">→</span></button>
     </div>
     <label className="file-button"><Upload size={16} aria-hidden="true"/><span>导入电路或恢复文件</span><input type="file" accept=".json,.txt,.circuitjs,.xml" aria-label="导入电路或恢复文件" disabled={transition||p.busy} onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.target.value='';}}/></label>
     <h3>最近实验</h3><ul className="recent-experiments">{p.items.length?p.items.map(item=><li key={item.id}><button disabled={transition||p.busy} aria-current={item.id===p.current?.id?'page':undefined} onClick={()=>void change(()=>p.open(item.id))}><span>{item.title}</span><small>{item.id===p.current?.id?'当前实验':'打开'}</small></button></li>):<li className="empty-note">编辑后的实验会保存在这里。</li>}</ul>
     <section className="recovery-tools"><h3>保存与恢复</h3><p role="status">{savedMessage}</p><div><button onClick={()=>void p.save()} disabled={p.busy||transition}>立即保存</button><button disabled={transition} onClick={p.exportDraft}>导出恢复包</button>{p.autoState.phase==='conflict'&&p.current?<button disabled={transition} onClick={()=>void change(()=>p.open(p.current!.id))}>打开服务端版本</button>:null}</div></section>
    </section>:null}
    {bookPage==='examples'?<ExampleLibrary disabled={transition||p.busy} check={checkSource} onOpen={openExample}/>:null}
    {bookPage==='notes'?<section className="notes-page"><label>实验名称<input disabled={transition} name="experiment-title" autoComplete="off" value={p.title} onChange={e=>p.setTitle(e.target.value)}/></label><label>实验记录<textarea disabled={transition} name="experiment-notes" aria-label="实验记录" value={p.data.notes} onChange={e=>p.setData(x=>({...x,notes:e.target.value}))}/></label><button disabled={off} onClick={()=>exportNative('report')}><Download size={15} aria-hidden="true"/>导出实验记录</button></section>:null}
    {bookPage==='source'?<section className="source-page"><label>电路文本<textarea disabled={transition} name="circuit-source" spellCheck={false} aria-label="电路文本" value={raw} onChange={e=>p.setDraft(x=>({...x,source:e.target.value}))}/></label><div><button disabled={transition||p.busy} onClick={()=>{try{const next=validateCircuit({...p.data,source:raw,original:raw,view:[]});void change(()=>p.replace(next,p.title+' · 文本'));}catch(error){p.report(error);}}}>作为新实验应用</button><button disabled={transition} onClick={()=>download(new Blob([p.data.original||p.data.source],{type:'text/plain'}),'original-circuit.txt')}>下载保留原文</button></div><p>应用前的原文保留在实验中。不开放或无法识别的元件会在打开时说明原因，原文不被覆盖。</p></section>:null}
   </div>
   <footer className="book-footer"><span>CircuitJS1 · GPL-2.0-or-later</span><span>Esc 返回电路</span></footer>
  </dialog>
 </main>;
}
