import assert from "node:assert/strict";
import {test} from "node:test";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {seed, validatePdf, restorePdfDraft} from "../src/contracts/domain.ts";
import {createAutosaveStore} from "../src/server/autosave.ts";
import {createStore} from "../src/server/store.ts";

test("自动保存保留未完成草稿，原项目不被无效输入覆盖，重复请求不创建副本", async()=>{
 const db=new DatabaseSync(":memory:");
 try {
  for (const migration of ["0002_projects.sql","0003_autosave.sql"]) db.exec(readFileSync(new URL("../migrations/"+migration,import.meta.url),"utf8"));
  const drafts=createAutosaveStore(db,validatePdf);
  const command={documentId:crypto.randomUUID(),mutationId:crypto.randomUUID(),draftRevision:0,projectId:null,projectRevision:null,snapshot:{title:"工作草稿",data:seed,extra:{prompt:"尚未提交的输入"}}};
  const first=await drafts.commit(command);
  assert.equal(first.phase,"saved"); assert.ok(first.project);
  assert.deepEqual(await drafts.commit(command),first);
  const projects=createStore(db,validatePdf); assert.equal(projects.list().length,1);
  const unfinished = structuredClone(seed); unfinished.template.schemas[0][0].name = "";
  const request={...command,mutationId:crypto.randomUUID(),draftRevision:1,projectId:first.project.id,projectRevision:first.project.revision,snapshot:{...command.snapshot,data:unfinished}};
  const pending=await drafts.commit(request); assert.equal(pending.phase,"draft");
  const raw=drafts.get(command.documentId); assert.ok(raw);
  assert.deepEqual(raw.snapshot.data,unfinished); assert.deepEqual(raw.snapshot.extra,command.snapshot.extra);
  assert.deepEqual(projects.get(first.project.id).data,seed);
  assert.deepEqual(restorePdfDraft(raw.snapshot.data),unfinished);
  const complete=await drafts.commit({...request,mutationId:crypto.randomUUID(),draftRevision:2,snapshot:{...command.snapshot,data:seed}});
  assert.equal(complete.phase,"saved"); assert.equal(projects.list().length,1);
 } finally {db.close();}
});
