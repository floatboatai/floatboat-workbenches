import type {SetStateAction} from "react";
import {isRecord} from '../contracts/project.ts';
import type {Model,Plot} from '../contracts/model.ts';
export type VertexRows=[string,string][];
export const rowsFor=(plot:Plot|undefined):VertexRows=>plot?plot.coordinates.slice(0,-1).map(point=>[String(point[0]),String(point[1])]):[];
export function readRows(extra:Record<string,unknown>,plot:Plot|undefined):VertexRows{
  if(!plot||!isRecord(extra.coordinateDrafts))return rowsFor(plot);
  const candidate=extra.coordinateDrafts[plot.id];
  if(!Array.isArray(candidate)||candidate.length<3||candidate.length>200||!candidate.every(row=>Array.isArray(row)&&row.length===2&&row.every(cell=>typeof cell==='string'&&cell.length<=128)))return rowsFor(plot);
  return candidate.map(row=>[String(row[0]),String(row[1])]);
}
export function withRows(extra:Record<string,unknown>,id:string,rows:VertexRows):Record<string,unknown>{return {...extra,coordinateDrafts:{...(isRecord(extra.coordinateDrafts)?extra.coordinateDrafts:{}),[id]:rows}};}
export function withoutRows(extra:Record<string,unknown>,id:string):Record<string,unknown>{const groups={...(isRecord(extra.coordinateDrafts)?extra.coordinateDrafts:{})};delete groups[id];return {...extra,coordinateDrafts:groups};}
export function pendingCoordinates(extra:Record<string,unknown>,model:Model):string[]{return model.plots.filter(plot=>JSON.stringify(readRows(extra,plot))!==JSON.stringify(rowsFor(plot))).map(plot=>plot.id);}

interface CoordinateProject {data:Model;draft:Record<string,unknown>;setDraft:(value:SetStateAction<Record<string,unknown>>)=>void}
export function coordinateEditor(project:CoordinateProject){
  const selected=typeof project.draft.selectedId==='string'&&project.data.plots.some(plot=>plot.id===project.draft.selectedId)?project.draft.selectedId:project.data.plots[0]?.id??'';
  const active=project.data.plots.find(plot=>plot.id===selected),vertices=readRows(project.draft,active),draftIds=pendingCoordinates(project.draft,project.data);
  const setSelected=(id:string)=>project.setDraft(old=>({...old,selectedId:id}));
  const setVertices=(value:SetStateAction<VertexRows>)=>{if(active)project.setDraft(old=>withRows(old,active.id,typeof value==='function'?value(readRows(old,active)):value));};
  const clearCoordinates=(id:string)=>project.setDraft(old=>withoutRows(old,id));
  return {selected,setSelected,active,vertices,draftIds,coordinateDirty:draftIds.includes(selected),setVertices,clearCoordinates};
}
