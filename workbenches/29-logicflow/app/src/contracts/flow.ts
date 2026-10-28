import { isRecord, boundedText } from './project.ts';
export interface Flow { graph: string; notes: string }
export interface Node { id:string;type:string;x:number;y:number;text?:string|{value:string;x?:number;y?:number};properties?:Record<string,unknown>;[key:string]:unknown }
export interface Edge {id:string;type:string;sourceNodeId:string;targetNodeId:string;text?:string|{value:string;x?:number;y?:number};properties?:Record<string,unknown>;[key:string]:unknown}
export interface Graph {nodes:Node[];edges:Edge[];[key:string]:unknown}
export const label=(v:Node|Edge)=>typeof v.text==='string'?v.text:v.text?.value??v.id;
export function graphValue(source:string):Graph {
  const value:unknown=JSON.parse(source);
  if(!isRecord(value)||!Array.isArray(value.nodes)||!Array.isArray(value.edges)||value.nodes.length>500||value.edges.length>1000)throw new Error('图纸需要 nodes / edges，最多 500 节点与 1000 连线。');
  const ids=new Set<string>();
  for(const n of value.nodes){if(!isRecord(n)||typeof n.id!=='string'||ids.has(n.id)||!['rect','circle','ellipse','diamond','polygon'].includes(String(n.type))||typeof n.x!=='number'||typeof n.y!=='number'||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw new Error('节点 ID、类型或坐标无效。支持 rect / circle / ellipse / diamond / polygon。');ids.add(n.id);}
  for(const e of value.edges){if(!isRecord(e)||typeof e.id!=='string'||ids.has(e.id)||!['line','polyline','bezier'].includes(String(e.type))||typeof e.sourceNodeId!=='string'||typeof e.targetNodeId!=='string')throw new Error('连线 ID 或类型无效。支持 line / polyline / bezier。');ids.add(e.id);}
  for(const item of [...value.nodes,...value.edges]){
    if(!isRecord(item))throw new Error('对象无效。');
    if(item.properties!==undefined&&!isRecord(item.properties))throw new Error('properties 必须为对象。');
    if(item.text!==undefined&&typeof item.text!=='string'&&(!isRecord(item.text)||typeof item.text.value!=='string'||typeof item.text.x!=='number'||typeof item.text.y!=='number'))throw new Error('text 必须为字符串或包含 value / x / y 的对象。');
    for(const key of ['startPoint','endPoint'])if(item[key]!==undefined&&(!isRecord(item[key])||typeof item[key].x!=='number'||typeof item[key].y!=='number'))throw new Error('连线端点无效。');
    if(item.pointsList!==undefined&&(!Array.isArray(item.pointsList)||item.pointsList.some(p=>!isRecord(p)||typeof p.x!=='number'||typeof p.y!=='number')))throw new Error('连线折点无效。');
  }
  return value as unknown as Graph;
}
export function restoreFlow(raw:unknown):Flow {if(!isRecord(raw))throw new Error('工作稿格式无效。');boundedText(raw.graph,550000);boundedText(raw.notes,40000);return raw as unknown as Flow;}
export function validateFlow(raw:unknown):Flow {const v=restoreFlow(raw);graphValue(v.graph);return v;}
export function review(g:Graph):string[]{
  const warnings:string[]=[],ids=new Set(g.nodes.map(n=>n.id));
  const starts=g.nodes.filter(n=>n.properties?.role==='start');const ends=g.nodes.filter(n=>n.properties?.role==='end');
  if(starts.length!==1)warnings.push(`入口标记为 ${starts.length} 个；SOP 审阅约定一个入口。`);
  if(!ends.length)warnings.push('尚未标记终点。');
  for(const e of g.edges)if(!ids.has(e.sourceNodeId)||!ids.has(e.targetNodeId))warnings.push(`悬空连线：${e.id}（原始对象保留）`);
  const outgoing=(id:string)=>g.edges.filter(e=>e.sourceNodeId===id&&ids.has(e.targetNodeId));
  const seen=new Set<string>(),stack=new Set<string>();let cycle=false;
  const visit=(id:string)=>{if(stack.has(id)){cycle=true;return;}if(seen.has(id))return;seen.add(id);stack.add(id);outgoing(id).forEach(e=>visit(e.targetNodeId));stack.delete(id);};
  starts.forEach(n=>visit(n.id));
  if(starts.length)g.nodes.filter(n=>!seen.has(n.id)).forEach(n=>warnings.push(`从入口不可达：${label(n)}`));
  g.nodes.forEach(n=>visit(n.id));if(cycle)warnings.push('检测到有向循环；请核对返回条件和退出路径。');
  for(const n of g.nodes){const edges=outgoing(n.id);if(!edges.length&&n.properties?.role!=='end')warnings.push(`无后续步骤且未标记终点：${label(n)}`);if(n.properties?.role==='decision'){if(edges.length<2)warnings.push(`判断节点分支不足：${label(n)}`);if(edges.some(e=>!e.properties?.condition))warnings.push(`判断分支缺少条件：${label(n)}`);}}
  return warnings;
}
export function paths(g:Graph):string[]{const out:string[]=[];const visit=(id:string,path:string[],visited:Set<string>)=>{if(out.length>=30)return;const node=g.nodes.find(n=>n.id===id);if(!node)return;const next=[...path,label(node)];if(visited.has(id)){out.push(next.join(' → ')+' [循环]');return;}const seen=new Set(visited);seen.add(id);const edges=g.edges.filter(e=>e.sourceNodeId===id);if(!edges.length||node.properties?.role==='end'){out.push(next.join(' → '));return;}for(const e of edges)visit(e.targetNodeId,[...next,e.properties?.condition?`[${e.properties.condition}]`:''].filter(Boolean),seen);};g.nodes.filter(n=>n.properties?.role==='start').forEach(n=>visit(n.id,[],new Set()));return out;}
export const seed:Flow={graph:JSON.stringify({nodes:[{id:'start',type:'circle',x:120,y:170,text:'申请提交',properties:{role:'start'}},{id:'review',type:'rect',x:320,y:170,text:'负责人初审',properties:{role:'task'}},{id:'decision',type:'diamond',x:540,y:170,text:'资料完整？',properties:{role:'decision'}},{id:'approve',type:'rect',x:760,y:100,text:'核准并归档',properties:{role:'task'}},{id:'amend',type:'rect',x:540,y:350,text:'补充材料',properties:{role:'task'}},{id:'end',type:'circle',x:950,y:100,text:'完成',properties:{role:'end'}}],edges:[{id:'e1',type:'polyline',sourceNodeId:'start',targetNodeId:'review'},{id:'e2',type:'polyline',sourceNodeId:'review',targetNodeId:'decision'},{id:'e3',type:'polyline',sourceNodeId:'decision',targetNodeId:'approve',text:'是',properties:{condition:'资料齐全'}},{id:'e4',type:'polyline',sourceNodeId:'decision',targetNodeId:'amend',text:'否',properties:{condition:'需要补充'}},{id:'e5',type:'polyline',sourceNodeId:'amend',targetNodeId:'review',text:'再次提交'},{id:'e6',type:'polyline',sourceNodeId:'approve',targetNodeId:'end'}]},null,2),notes:'审阅要点：补充材料返回初审，核准后进入终点。'};
export function importFlow(raw:unknown):{title:string;data:Flow;extra:Record<string,unknown>}{if(isRecord(raw)&&isRecord(raw.snapshot)){const s=raw.snapshot;if(typeof s.title!=='string'||!isRecord(s.extra))throw new Error('恢复稿无效。');return{title:s.title,data:restoreFlow(s.data),extra:s.extra};}if(isRecord(raw)&&raw.format==='logicflow-workbench'){return{title:typeof raw.title==='string'?raw.title:'导入图纸',data:restoreFlow(raw.data),extra:isRecord(raw.extra)?raw.extra:{}};}const graph=JSON.stringify(raw,null,2);graphValue(graph);return{title:'导入流程',data:{graph,notes:''},extra:{}};}

export function mergeNative(previous:Graph,native:Graph):Graph {const ids=new Set(previous.nodes.map(n=>n.id));return {...previous,...native,nodes:native.nodes.map(n=>({...previous.nodes.find(p=>p.id===n.id),...n})),edges:[...native.edges.map(e=>({...previous.edges.find(p=>p.id===e.id),...e})),...previous.edges.filter(e=>!ids.has(e.sourceNodeId)||!ids.has(e.targetNodeId))]};}
