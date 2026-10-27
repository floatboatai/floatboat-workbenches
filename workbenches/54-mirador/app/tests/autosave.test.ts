import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createAutosaveStore} from '../src/server/autosave.ts';
import {createStore} from '../src/server/store.ts';
import {isRecord} from '../src/contracts/project.ts';
const validate=(value:unknown)=>{if(!isRecord(value)||typeof value.text!=='string'||!value.text.trim())throw new Error('正文不能为空');return {text:value.text};};
async function fixture(){const db=new DatabaseSync(':memory:');for(const file of ['0002_projects.sql','0004_autosave.sql'])db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));return db;}
function initial(text='first'){return{documentId:randomUUID(),mutationId:randomUUID(),draftRevision:0,projectId:null as string|null,projectRevision:null as number|null,snapshot:{title:'新项目',data:{text},extra:{raw:'尚未应用'}}};}
test('automatic create is idempotent after a lost response; the same request does not duplicate a project',async()=>{
 const db=await fixture();try{const a=createAutosaveStore(db,validate),q=initial();const first=await a.commit(q),again=await a.commit(q);assert.equal(first.phase,'saved');assert.deepEqual(again,first);assert.equal(first.project?.id,q.documentId);assert.equal(db.prepare('SELECT count(*) AS n FROM projects').get()?.n,1);assert.equal(a.get(q.documentId)?.snapshot.extra.raw,'尚未应用');}finally{db.close();}
});
test('newer edits follow the acknowledged revision and retain one project identity',async()=>{
 const db=await fixture();try{const a=createAutosaveStore(db,validate),q=initial();const first=await a.commit(q);const next={...q,mutationId:randomUUID(),draftRevision:1,projectId:first.project!.id,projectRevision:1,snapshot:{...q.snapshot,data:{text:'typed while saving'}}};const second=await a.commit(next);assert.equal(second.project?.revision,2);assert.equal(second.project?.data.text,'typed while saving');assert.equal(second.project?.id,first.project?.id);}finally{db.close();}
});
test('invalid input is durably retained as a draft without replacing the valid project',async()=>{
 const db=await fixture();try{const a=createAutosaveStore(db,validate),q=initial();const first=await a.commit(q);const result=await a.commit({...q,mutationId:randomUUID(),draftRevision:1,projectId:first.project!.id,projectRevision:1,snapshot:{...q.snapshot,data:{text:''},extra:{raw:'{ invalid JSON'}}});assert.equal(result.phase,'draft');assert.equal(createStore(db,validate).get(first.project!.id).data.text,'first');assert.equal(a.recent(first.project!.id)?.snapshot.extra.raw,'{ invalid JSON');assert.equal(a.recent(first.project!.id)?.receipt.phase,'draft');}finally{db.close();}
});
test('optimistic conflict saves a separate working draft and never overwrites another window',async()=>{
 const db=await fixture();try{const a=createAutosaveStore(db,validate),q=initial();const first=await a.commit(q);createStore(db,validate).update(first.project!.id,'changed elsewhere',{text:'remote'},1);const result=await a.commit({...q,mutationId:randomUUID(),draftRevision:1,projectId:first.project!.id,projectRevision:1,snapshot:{...q.snapshot,data:{text:'local'}}});assert.equal(result.phase,'conflict');assert.equal(createStore(db,validate).get(first.project!.id).data.text,'remote');assert.equal((a.get(q.documentId)?.snapshot.data as {text:string}).text,'local');}finally{db.close();}
});
test('draft revision and mutation reuse cannot falsely acknowledge changed content',async()=>{
 const db=await fixture();try{const a=createAutosaveStore(db,validate),q=initial();await a.commit(q);await assert.rejects(a.commit({...q,snapshot:{...q.snapshot,data:{text:'different'}}}),/不一致/);await assert.rejects(a.commit({...q,mutationId:randomUUID()}),/另一窗口/);assert.equal(db.prepare('SELECT revision FROM projects').get()?.revision,1);}finally{db.close();}
});
test('extra-only edits persist without changing model revision; deleted projects are not auto-resumed',async()=>{
 const db=await fixture();try{const a=createAutosaveStore(db,validate),q=initial();const first=await a.commit(q);const extra=await a.commit({...q,mutationId:randomUUID(),draftRevision:1,projectId:first.project!.id,projectRevision:1,snapshot:{...q.snapshot,extra:{raw:'unapplied change'}}});assert.equal(extra.project?.revision,1);createStore(db,validate).remove(first.project!.id,1);assert.equal(a.recent(),null);}finally{db.close();}
});
test('async source verification gates model updates but still stores invalid originals as drafts',async()=>{
 const db=await fixture();try{const a=createAutosaveStore(db,validate,undefined,{verify:async(data)=>{await Promise.resolve();if(data.text==='wrong-source')throw new Error('原件不一致')}});const result=await a.commit(initial('wrong-source'));assert.equal(result.phase,'draft');assert.match(result.message,/原件不一致/);assert.equal(db.prepare('SELECT count(*) AS n FROM projects').get()?.n,0);assert.ok(a.recent());}finally{db.close();}
});
