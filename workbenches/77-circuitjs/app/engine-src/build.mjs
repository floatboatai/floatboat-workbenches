// SPDX-License-Identifier: GPL-2.0-or-later
import { build } from 'esbuild';
import { cp, mkdir, writeFile,readFile,access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {dirname,join} from 'node:path';
let root=dirname(fileURLToPath(import.meta.url));
for(let i=0;i<6;i++){try{await access(join(root,'manifest.json'));break;}catch{root=dirname(root);}}
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const resource=id=>join(root,manifest.resources.find(r=>r.id===id).path);
const source=resource('engine-source'),target=resource('engine'),upstream=join(resource('notices'),'upstream/ts');
await mkdir(target,{recursive:true});
await build({absWorkingDir:root,entryPoints:[join(source,'bridge.js')],outfile:join(target,'circuit.js'),bundle:true,format:'esm',target:'es2022',keepNames:true,minify:false,legalComments:'eof',plugins:[{name:'declared-upstream-resource',setup(b){b.onResolve({filter:/^\.\.\/notices\/upstream\/ts\//},async args=>{let path=join(upstream,args.path.split('/ts/')[1]);if(!path.endsWith('.js'))path+='.ts';return{path};});}}]});
await cp(join(upstream,'style.css'),join(target,'style.css'));
await cp(join(upstream,'public/circuitjs/font'),join(target,'font'),{recursive:true});
await writeFile(join(target,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/api/engine/style.css"><link rel="stylesheet" href="/api/engine/font/fontello.css"><link rel="stylesheet" href="/api/engine/embed.css"><title>CircuitJS circuit editor</title></head><body><script type="module" src="/api/engine/circuit.js"></script></body></html>`);
await writeFile(join(target,'embed.css'),`html,body{margin:0;overflow:hidden;background:#080d12}button,input,select{font:inherit}dialog{max-width:calc(100vw - 28px);box-sizing:border-box}input:focus-visible,button:focus-visible{outline:2px solid #d9782f;outline-offset:2px}.mainToolbar{display:none!important}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`);
