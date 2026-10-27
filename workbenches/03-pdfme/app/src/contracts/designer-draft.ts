import type { Template } from '@pdfme/common';
import { isRecord } from './project.ts';
import { validatePdf, type PdfProject } from './domain.ts';
export const designerProperties = {name:'字段名称',position_x:'水平位置',position_y:'垂直位置',width:'宽度',height:'高度',rotate:'旋转角度',opacity:'透明度',fontSize:'字号',characterSpacing:'字间距',lineHeight:'行高',content:'文本内容'} as const;
export type DesignerProperty = keyof typeof designerProperties;
export interface DesignerDraft {field:string;property:DesignerProperty;value:string}
export function isDesignerProperty(value:string):value is DesignerProperty{return Object.hasOwn(designerProperties,value);}
export function readDesignerDrafts(value:unknown):DesignerDraft[]{
 if(!Array.isArray(value)||value.length>960)return [];
 return value.filter((item):item is DesignerDraft=>isRecord(item)&&typeof item.field==='string'&&item.field.length<=80&&typeof item.property==='string'&&isDesignerProperty(item.property)&&typeof item.value==='string'&&item.value.length<=5000);
}
export function designerDraftApplied(template:Template,draft:DesignerDraft):boolean{
 const field=template.schemas.flat().find(field=>field.name===draft.field);
 if(!field)return draft.property==='name'&&template.schemas.flat().some(field=>field.name===draft.value);
 const value=draft.property==='position_x'?field.position.x:draft.property==='position_y'?field.position.y:field[draft.property];
 return String(value??'')===draft.value;
}
export function applyDesignerDrafts(project:PdfProject,drafts:DesignerDraft[]):PdfProject{
 const next=structuredClone(project);
 for(const draft of [...drafts].sort((a,b)=>Number(a.property==='name')-Number(b.property==='name'))){
  const field=next.template.schemas.flat().find(field=>field.name===draft.field);
  if(!field)throw new Error(`字段「${draft.field}」已不存在，请丢弃该属性草稿。`);
  if(draft.property==='name'){if(draft.value in Object.prototype)throw new Error('字段名称为保留名称。');if(Object.hasOwn(next.values,field.name)){next.values[draft.value]=next.values[field.name];delete next.values[field.name];}field.name=draft.value;}
  else if(draft.property==='content')field.content=draft.value;
  else{
   if(!draft.value.trim()||!Number.isFinite(Number(draft.value)))throw new Error(`${designerProperties[draft.property]}需要完整的数值。`);
   const number=Number(draft.value);
   if(draft.property==='position_x')field.position.x=number;
   else if(draft.property==='position_y')field.position.y=number;
   else {const ranges:Record<string,[number,number]>={rotate:[0,360],opacity:[0,1],fontSize:[1,1000],characterSpacing:[-100,100],lineHeight:[0.1,20]};const range=ranges[draft.property];if(range&&(number<range[0]||number>range[1]))throw new Error(`${designerProperties[draft.property]}超出允许范围。`);field[draft.property]=number;}
  }
 }
 return validatePdf(next);
}
