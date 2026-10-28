import { isRecord, boundedText } from './project.ts';
export type CircuitData={source:string;original:string;notes:string;view:number[];viewport:number[]};
export const RC_SOURCE='$ 1 0.000005 10 50 5 50\nv 112 272 112 80 0 2 100 5 0 0 0.5\nr 112 80 336 80 0 1000\nc 336 80 336 272 0 0.000001 0\nw 336 272 112 272 0\no 2 4 0 4099 5 0.01 0 2 2 3\n';
export const DC_SOURCE='$ 1 0.000005 10 50 5 50\nv 112 272 112 80 0 0 40 5 0 0 0.5\nr 112 80 336 80 0 1000\nr 336 80 336 272 0 1000\nw 336 272 112 272 0\no 2 4 0 4099 5 0.01 0 2 2 3\n';
export const seed:CircuitData={source:RC_SOURCE,original:'',notes:'实验目的：观察一阶 RC 低通电路的阶跃响应。\n\nR = 1 kΩ，C = 1 μF，时间常数 τ = 1 ms。\n输入：100 Hz 方波，幅度 ±5 V。\n\n运行后，比较电容电压的充放电曲线；双击电阻或电容调整参数。',view:[],viewport:[]};
export function restoreCircuit(value:unknown):CircuitData{
 if(!isRecord(value))throw Error('实验记录格式无效。');
 const source=boundedText(value.source,650000),original=boundedText(value.original,650000),notes=boundedText(value.notes,60000);
 if(!Array.isArray(value.view)||![0,6].includes(value.view.length)||!value.view.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e8))throw Error('视图坐标无效。');
 const viewport=value.viewport??[];if(!Array.isArray(viewport)||![0,2].includes(viewport.length)||!viewport.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<100000))throw Error('画布尺寸无效。');
 const result={source,original,notes,view:value.view as number[],viewport:viewport as number[]};
 if(new TextEncoder().encode(JSON.stringify(result)).length>2000000)throw Error('恢复内容超过 2 MB。');return result;
}
export function validateCircuit(value:unknown):CircuitData{const result=restoreCircuit(value);if(new TextEncoder().encode(JSON.stringify(result)).length>850000)throw Error('实验记录超过 850 KB，请导出并减少内容。');if(!result.source.trim())throw Error('请保留电路内容。');return result;}
export type ParameterDraft={element:number;base:string;fields:{index:number;name:string;value:string}[]};
export function parameterDraft(value:unknown):ParameterDraft|null{
 if(!isRecord(value)||!Number.isInteger(value.element)||typeof value.element!=='number'||value.element<0||typeof value.base!=='string'||value.base.length>20000||!Array.isArray(value.fields)||value.fields.length>50)return null;
 const fields=[];for(const f of value.fields){if(!isRecord(f)||typeof f.index!=='number'||!Number.isInteger(f.index)||f.index<0||typeof f.name!=='string'||typeof f.value!=='string'||f.value.length>60000)return null;fields.push({index:f.index,name:f.name,value:f.value});}return{element:value.element,base:value.base,fields};
}
export function decodeImport(value:unknown):{data:CircuitData;title:string;extra:Record<string,unknown>}{
 if(!isRecord(value))throw Error('恢复文件格式无效。');
 const candidate=isRecord(value.snapshot)?value.snapshot:value;
 const data=restoreCircuit(candidate.data);const extra=isRecord(candidate.extra)?candidate.extra:{};
 if(new TextEncoder().encode(JSON.stringify({data,extra,title:candidate.title})).length>1950000)throw Error('恢复快照超过 1.95 MB。');
 if(extra.parameter!==undefined&&extra.parameter!==null&&!parameterDraft(extra.parameter))throw Error('参数草稿格式无效。');
 return{data,title:typeof candidate.title==='string'&&candidate.title.trim()?candidate.title.slice(0,105)+' · 导入': '导入的电路实验',extra};
}
