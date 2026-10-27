import {readFile,readdir,copyFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await readFile(join(root,'catalog.json'),'utf8'));
for(const slug of process.argv.slice(2)){
 const entry=catalog.find(p=>p.slug===slug);if(!entry)throw new Error('Unknown project: '+slug);
 const app=join(root,entry.directory,'app');
 const files={'autosave-contracts.ts':'src/contracts/autosave.ts','autosave-server.ts':'src/server/autosave.ts','autosave-cache.ts':'src/ui/autosave-cache.ts','autosave-client.ts':'src/ui/autosave-client.ts','requests.ts':'src/ui/requests.ts','workspace.tsx':'src/ui/workspace.tsx'};
 for(const [source,target] of Object.entries(files)){await mkdir(dirname(join(app,target)),{recursive:true});await copyFile(join(root,'scripts/blueprints',source),join(app,target));}
 const migrations=await readdir(join(app,'migrations'));
 if(!migrations.some(p=>/_autosave\.sql$/.test(p))){const number=Math.max(0,...migrations.map(p=>parseInt(p,10)||0))+1;await copyFile(join(root,'scripts/blueprints/autosave-migration.sql'),join(app,'migrations',String(number).padStart(4,'0')+'_autosave.sql'));}
 console.log('Copied autosave modules for '+slug+'. Register routes, wire status, draft restoration and import-as-new before validation.');
}
