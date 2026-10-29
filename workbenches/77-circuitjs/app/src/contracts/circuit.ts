import { isRecord, boundedText } from './project.ts';
export type CircuitData={source:string;original:string;notes:string;view:number[];viewport:number[]};
export const RC_SOURCE='$ 1 0.000005 10 50 5 50\nv 112 272 112 80 0 2 100 5 0 0 0.5\nr 112 80 336 80 0 1000\nc 336 80 336 272 0 0.000001 0\nw 336 272 112 272 0\no 2 4 0 4099 5 0.01 0 2 2 3\n';
export const DC_SOURCE='$ 1 0.000005 10 50 5 50\nv 112 272 112 80 0 0 40 5 0 0 0.5\nr 112 80 336 80 0 1000\nr 336 80 336 272 0 1000\nw 336 272 112 272 0\no 2 4 0 4099 5 0.01 0 2 2 3\n';
export const TIMER_SOURCE='$ 1 0.00002 31 50 5 50\nw 112 192 112 224 0\nw 112 224 176 224 0\nc 112 224 112 288 0 0.000001 0\ng 112 288 112 304 0\nr 112 192 112 64 0 1000000\nw 112 64 240 64 0\nR 112 64 80 64 0 0 40 9 0 0 0.5\nO 352 160 416 160 0\n165 176 96 192 96 6 0\nw 240 64 304 64 0\nw 304 64 304 128 0\nw 352 160 304 160 0\nw 352 160 352 32 0\nr 352 32 160 32 0 47000\nw 160 32 160 192 0\nw 112 192 160 192 0\nw 160 192 176 192 0\ng 272 256 272 272 0\nr 352 160 352 224 0 470\n162 352 224 352 288 2 default-led 1 0 0 0.01\ng 352 288 352 304 0\no 2 32 0 4099 10 0.1 0 2 2 3\no 7 32 0 4106 10 0.1 1 1\n38 13 0 4700 220000 Timing\\sResistor\n';
export const seed:CircuitData={source:TIMER_SOURCE,original:'',notes:'实验目的：观察 555 无稳态多谐振荡器驱动 LED 闪烁。\n\n9 V 电源；定时电容 1 μF，经 47 kΩ 从输出端充放电，周期约 1.4·R·C ≈ 66 ms。\n示波器上：电容电压在 1/3～2/3 电源之间锯齿往复，输出为方波。\n\n拖动下方「Timing Resistor」滑块改变频率；双击 555 或 LED 查看参数。',view:[],viewport:[]};
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
