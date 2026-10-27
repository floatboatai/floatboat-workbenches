import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {isRecord,isSummary,type Project,type ProjectSummary} from '../contracts/project';
import {fingerprint,type CachedDraft,type DraftRecord,type SavePhase,type SaveReceipt,type SaveRequest,type WorkingCopy} from '../contracts/autosave';
import {readCache,writeCache} from './autosave-cache';
import {request,download} from './requests';
export interface AutosaveOptions<T>{storageKey?:string;restoreDraftData?:(value:unknown)=>T}
export function useWorkbenchState<T>(seed:T,validate:(value:unknown)=>T,defaultTitle:string,options:AutosaveOptions<T>={}){
  const storageKey=options.storageKey??defaultTitle;
  const initial:WorkingCopy<T>={title:defaultTitle,data:structuredClone(seed),extra:{}};
  const [work,setWork]=useState<WorkingCopy<T>>(initial),workRef=useRef(work);workRef.current=work;
  const [current,setCurrentState]=useState<Project<T>|null>(null),currentRef=useRef(current);
  const [items,setItems]=useState<ProjectSummary[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [autoState,setAutoState]=useState<{phase:SavePhase;message:string;savedAt:string}>({phase:'idle',message:'编辑后自动保存',savedAt:''});
  const [loadEpoch,setLoadEpoch]=useState(0),[tick,setTick]=useState(0);
  const doc=useRef<{id:string;revision:number}>({id:crypto.randomUUID(),revision:0}),ack=useRef(fingerprint(initial)),pending=useRef<SaveRequest<T>|null>(null);
  const flight=useRef<Promise<SaveReceipt<T>|null>|null>(null),active=useRef(true),edited=useRef(false),conflicted=useRef(false),failures=useRef(0),loaded=useRef(false),epoch=useRef(0);
  const restore=useRef(options.restoreDraftData??validate);restore.current=options.restoreDraftData??validate;
  const copyKey=()=>storageKey+':'+doc.current.id;
  const report=(e:unknown)=>setError(e instanceof Error?e.message:'操作失败，请重试。');
  function markCurrent(value:Project<T>|null){currentRef.current=value;setCurrentState(value);}
  function update(value:SetStateAction<WorkingCopy<T>>,user=true){const next=typeof value==='function'?value(workRef.current):value;workRef.current=next;if(user&&fingerprint(next)!==fingerprint(work))edited.current=true;setWork(next);}
  const setData=(value:SetStateAction<T>)=>update(w=>({...w,data:typeof value==='function'?(value as (previous:T)=>T)(w.data):value}));
  const setTitle=(value:SetStateAction<string>)=>update(w=>({...w,title:typeof value==='function'?value(w.title):value}));
  const setDraft=(value:SetStateAction<Record<string,unknown>>)=>update(w=>({...w,extra:typeof value==='function'?value(w.extra):value}));
  function cacheValue():CachedDraft<T>{return{documentId:doc.current.id,revision:doc.current.revision,snapshot:workRef.current,current:currentRef.current,acknowledged:ack.current,pending:pending.current,savedAt:new Date().toISOString()};}
  async function cache(){const key=copyKey();await writeCache(key,cacheValue());try{sessionStorage.setItem(storageKey+':active',doc.current.id);}catch{/* IndexedDB still contains the working copy. */}}
  const refresh=useCallback(async()=>{
    const [list,drafts]=await Promise.all([request('/api/projects'),request('/api/autosave/list')]);
    if(!Array.isArray(list)||!list.every(isSummary))throw new Error('项目列表无效。');
    setItems([...list,...(Array.isArray(drafts)?drafts.filter(isSummary):[])]);
  },[]);
  function decodeProject(value:unknown):Project<T>{if(!isSummary(value)||!isRecord(value))throw new Error('项目响应无效。');return{...value,data:validate(value.data)};}
  function decodeWork(value:unknown):WorkingCopy<T>{
    if(!isRecord(value)||typeof value.title!=='string'||value.title.length>120||!isRecord(value.extra))throw new Error('草稿格式无效，请导出恢复文件。');
    return{title:value.title,data:restore.current(value.data),extra:value.extra};
  }
  function validRecord(value:unknown):value is DraftRecord<T>{return isRecord(value)&&typeof value.documentId==='string'&&typeof value.revision==='number'&&isRecord(value.snapshot)&&isRecord(value.receipt);}
  function reset(snapshot:WorkingCopy<T>,project:Project<T>|null,saved:boolean,record?:DraftRecord<T>){
    epoch.current++;doc.current={id:record?.documentId??crypto.randomUUID(),revision:record?.revision??0};pending.current=null;conflicted.current=record?.receipt.phase==='conflict';failures.current=0;
    ack.current=saved?fingerprint(snapshot):'';edited.current=!saved;update(snapshot,false);markCurrent(project);setLoadEpoch(x=>x+1);setError('');setNotice('');
    setAutoState({phase:record?.receipt.phase??(saved?(project?'saved':'idle'):'pending'),message:record?.receipt.message??(saved?(project?'已自动保存':'编辑后自动保存'):'等待自动保存…'),savedAt:record?.updatedAt??''});
    void cache().catch(()=>{});
  }
  useEffect(()=>{
    active.current=true;
    void (async()=>{
      let cached:unknown;try{const id=sessionStorage.getItem(storageKey+':active');if(id)cached=await readCache(storageKey+':'+id);}catch{/* Remote draft recovery remains available. */}
      try{
        await refresh();
        if(edited.current)return;
        const recent=await request('/api/autosave/recent');
        if(!active.current||edited.current)return;
        if(isRecord(cached)&&typeof cached.documentId==='string'&&isRecord(cached.snapshot)){
          const snapshot=decodeWork(cached.snapshot),project=cached.current?decodeProject(cached.current):null;
          const remote=await request('/api/autosave/'+cached.documentId);
          if(validRecord(remote)&&remote.revision>=Number(cached.revision)&&!cached.pending&&fingerprint(cached.snapshot)===cached.acknowledged){reset(decodeWork(remote.snapshot),remote.receipt.project?decodeProject(remote.receipt.project):project,true,remote);}
          else{
            reset(snapshot,project,true);
            doc.current={id:cached.documentId,revision:Number(cached.revision)||0};ack.current=typeof cached.acknowledged==='string'?cached.acknowledged:'';
            pending.current=isRecord(cached.pending)?cached.pending as unknown as SaveRequest<T>:null;
            if(pending.current||fingerprint(snapshot)!==ack.current){edited.current=true;setAutoState({phase:'pending',message:'正在恢复待同步草稿…',savedAt:''});}
          }
        }else if(validRecord(recent)){
          const project=recent.receipt.project?decodeProject(recent.receipt.project):recent.projectId?decodeProject(await request('/api/projects/'+recent.projectId)):null;
          reset(decodeWork(recent.snapshot),project,true,recent);
        }
      }catch(e){
        if(isRecord(cached)&&isRecord(cached.snapshot)&&!edited.current)try{
          const snapshot=decodeWork(cached.snapshot);reset(snapshot,cached.current?decodeProject(cached.current):null,true);
          if(typeof cached.documentId==='string')doc.current.id=cached.documentId;doc.current.revision=Number(cached.revision)||0;ack.current=typeof cached.acknowledged==='string'?cached.acknowledged:'';pending.current=isRecord(cached.pending)?cached.pending as unknown as SaveRequest<T>:null;edited.current=true;
          setAutoState({phase:'offline',message:'已恢复本机草稿，等待重新连接。',savedAt:''});
        }catch{report(e);}else report(e);
      }finally{if(active.current){loaded.current=true;setLoading(false);setTick(x=>x+1);}}
    })();
    return()=>{active.current=false;};
  },[storageKey,refresh]);
  async function persist(force=false):Promise<SaveReceipt<T>|null>{
    while(flight.current)await flight.current;
    if(conflicted.current){setError('项目存在版本冲突，请先导出草稿或打开服务器版本。');return null;}
    const now=fingerprint(workRef.current);
    if(!pending.current&&now===ack.current&&(!force||currentRef.current))return null;
    const generation=epoch.current;
    if(!pending.current)pending.current={documentId:doc.current.id,mutationId:crypto.randomUUID(),draftRevision:doc.current.revision,projectId:currentRef.current?.id??null,projectRevision:currentRef.current?.revision??null,snapshot:structuredClone(workRef.current)};
    const command=pending.current;
    const task=(async()=>{
      let local=false;try{await cache();local=true;}catch{/* Continue trying the durable server. */}
      setAutoState({phase:'saving',message:'正在自动保存…',savedAt:''});
      try{
        const raw=await request('/api/autosave',{method:'POST',body:JSON.stringify(command)});
        if(!isRecord(raw)||!['saved','draft','conflict'].includes(String(raw.phase))||typeof raw.draftRevision!=='number'||typeof raw.message!=='string'||typeof raw.savedAt!=='string')throw new Error('自动保存响应无效。');
        const receipt=raw as unknown as SaveReceipt<T>;
        if(receipt.project)receipt.project=decodeProject(receipt.project);
        if(generation!==epoch.current)return receipt;
        doc.current.revision=receipt.draftRevision;pending.current=null;ack.current=fingerprint(command.snapshot);failures.current=0;
        if(receipt.phase==='saved'&&receipt.project){
          markCurrent(receipt.project);
          setItems(previous=>[{id:receipt.project!.id,title:receipt.project!.title,revision:receipt.project!.revision,updatedAt:receipt.project!.updatedAt},...previous.filter(p=>p.id!==receipt.project!.id&&p.id!=='draft:'+doc.current.id)]);
          if(fingerprint(workRef.current)===fingerprint(command.snapshot)){
            const data=fingerprint(workRef.current.data)===fingerprint(receipt.project.data)?workRef.current.data:receipt.project.data;
            const canonical={...workRef.current,title:receipt.project.title,data};if(canonical.title!==workRef.current.title||canonical.data!==workRef.current.data)update(canonical,false);ack.current=fingerprint(canonical);
          }
        }
        if(receipt.phase!=='saved')setItems(previous=>[{id:'draft:'+doc.current.id,title:'草稿 · '+(command.snapshot.title.trim()||'未命名'),revision:receipt.draftRevision,updatedAt:receipt.savedAt},...previous.filter(p=>p.id!=='draft:'+doc.current.id)]);
        conflicted.current=receipt.phase==='conflict';setError('');setNotice('');
        setAutoState({phase:fingerprint(workRef.current)!==ack.current&&!conflicted.current?'pending':receipt.phase,message:receipt.message,savedAt:receipt.savedAt});
        await cache().catch(()=>{});return receipt;
      }catch(e){
        if(generation!==epoch.current)return null;
        const conflict=e instanceof Error&&'status' in e&&e.status===409;conflicted.current=conflict;failures.current++;
        setAutoState({phase:conflict?'conflict':'offline',message:conflict?'草稿发生冲突，本机输入已保留。':local?'草稿已暂存本机，连接恢复后重试。':'自动保存未完成，请保持页面打开或导出草稿。',savedAt:''});
        if(force)report(e);return null;
      }finally{flight.current=null;setTick(x=>x+1);}
    })();flight.current=task;return task;
  }
  const signature=fingerprint(work),dirty=signature!==ack.current;
  useEffect(()=>{
    if(!loaded.current||!edited.current||conflicted.current||(!dirty&&!pending.current))return;
    if(!flight.current)setAutoState(previous=>previous.phase==='offline'?previous:{...previous,phase:'pending',message:'等待自动保存…'});
    const local=setTimeout(()=>{void cache().catch(()=>{});},120);
    const delay=failures.current?Math.min(30000,1500*2**Math.min(failures.current-1,4)):700;
    const timer=setTimeout(()=>{void persist();},delay);
    return()=>{clearTimeout(local);clearTimeout(timer);};
  },[signature,loading,loadEpoch,tick]);
  useEffect(()=>{const wake=()=>setTick(x=>x+1);window.addEventListener('online',wake);return()=>window.removeEventListener('online',wake);},[]);
  useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(fingerprint(workRef.current)!==ack.current||pending.current){void cache().catch(()=>{});e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[]);
  async function leave(){
    if(!dirty&&!pending.current&&!conflicted.current)return true;
    if(!conflicted.current)await persist();
    if(fingerprint(workRef.current)===ack.current&&!conflicted.current)return true;
    await cache().catch(()=>{});return confirm('草稿尚未完全同步。保留本机草稿并切换项目吗？');
  }
  async function save(override?:T){
    if(override!==undefined)setData(override);setBusy(true);setError('');
    try{const receipt=await persist(true);if(receipt){if(receipt.phase!=='saved'){setError(receipt.message);return null;}return receipt.project;}return autoState.phase==='draft'||conflicted.current||pending.current||fingerprint(workRef.current)!==ack.current?null:currentRef.current;}finally{setBusy(false);}
  }
  async function open(id:string):Promise<boolean>{
    if(!await leave())return false;setBusy(true);setError('');
    try{
      if(id.startsWith('draft:')){const d=await request('/api/autosave/'+id.slice(6));if(!validRecord(d))throw new Error('草稿不存在。');const project=d.receipt.project?decodeProject(d.receipt.project):d.projectId?decodeProject(await request('/api/projects/'+d.projectId)):null;reset(decodeWork(d.snapshot),project,true,d);}
      else{const [raw,d]=await Promise.all([request('/api/projects/'+id),request('/api/autosave/project/'+id)]);const project=decodeProject(raw);if(validRecord(d)&&d.projectRevision===project.revision&&d.receipt.phase!=='conflict')reset(decodeWork(d.snapshot),project,true,{...d,documentId:crypto.randomUUID(),revision:0});else reset({title:project.title,data:project.data,extra:{}},project,true);}
      return true;
    }catch(e){report(e);return false;}finally{setBusy(false);}
  }
  async function fresh():Promise<boolean>{if(!await leave())return false;reset({title:defaultTitle,data:structuredClone(seed),extra:{}},null,true);return true;}
  async function replace(data:T,title:string,extra:Record<string,unknown>={}):Promise<boolean>{if(!await leave())return false;reset({title,data,extra},null,false);return true;}
  async function remove():Promise<boolean>{
    const selected=currentRef.current;if(!selected||!confirm('删除「'+selected.title+'」？此操作不能撤销。'))return false;
    while(flight.current)await flight.current;setBusy(true);setError('');
    try{const c=currentRef.current??selected;await request('/api/projects/'+c.id,{method:'DELETE',body:JSON.stringify({revision:c.revision})});await request('/api/autosave/'+doc.current.id,{method:'DELETE'}).catch(()=>{});reset({title:defaultTitle,data:structuredClone(seed),extra:{}},null,true);await refresh();return true;}catch(e){report(e);return false;}finally{setBusy(false);}
  }
  const exportDraft=()=>download(new Blob([JSON.stringify(cacheValue(),null,2)],{type:'application/json'}),'workbench-working-copy.json');
  return {items,current,data:work.data,setData,title:work.title,setTitle,draft:work.extra,setDraft,busy,error,setError,report,notice,setNotice,loading,dirty,autoState,documentKey:doc.current.id,loadEpoch,refresh,save,open,fresh,replace,remove,exportDraft};
}
