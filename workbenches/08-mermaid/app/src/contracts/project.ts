export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export interface ProjectSummary { id:string; title:string; revision:number; updatedAt:string }
export interface Project<T> extends ProjectSummary { data:T }
export function isSummary(value:unknown):value is ProjectSummary { return isRecord(value)&&typeof value.id==='string'&&typeof value.title==='string'&&typeof value.revision==='number'&&typeof value.updatedAt==='string'; }
export function titleValue(value:unknown):string { if(typeof value!=='string'||!value.trim()||value.trim().length>120)throw new Error('名称需要 1–120 个字符。');return value.trim(); }
export function boundedText(value:unknown,max=100000):string { if(typeof value!=='string'||value.length>max)throw new Error(`文本长度不能超过 ${max} 个字符。`);return value; }
