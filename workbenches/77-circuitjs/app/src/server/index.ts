import { readFile } from 'node:fs/promises';
import { createWorkbenchServer } from '../../sdk/runtime.mjs';
import { registerAppRoute } from './app-route';
import { registerRoutes } from './routes';
import { registerExampleRoutes } from './examples';
import { validateCircuit } from '../contracts/circuit';
const app=await createWorkbenchServer(import.meta.url);
registerAppRoute(app);registerRoutes(app,validateCircuit);registerExampleRoutes(app);
const types:Record<string,string>={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf',svg:'image/svg+xml',eot:'application/vnd.ms-fontobject'};
async function asset(file:string){try{if(!/^(index\.html|circuit\.js|style\.css|embed\.css|font\/fontello\.(css|woff2?|ttf|svg|eot))$/.test(file))return new Response('Not found',{status:404});const content=await readFile(await app.resources.path('engine',file));return new Response(content,{headers:{'content-type':types[file.split('.').pop()??'']??'application/octet-stream','cache-control':'no-store'}});}catch{return new Response('Resource unavailable',{status:404});}}
app.route('GET','/api/engine/:file',({params})=>asset(params.file));
app.route('GET','/api/engine/font/:file',({params})=>asset('font/'+params.file));
await app.listen();
