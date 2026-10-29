/* SPDX-License-Identifier: GPL-2.0-or-later
 * Floatboat embedding adapter; original solver and renderer remain in upstream/ts. */
import { CirSim } from '../notices/upstream/ts/CirSim';
import { Menus } from '../notices/upstream/ts/Menus';
import { UndoManager } from '../notices/upstream/ts/UndoManager';
import { EditDialog } from '../notices/upstream/ts/EditDialog';
import { HookRegistry } from '../notices/upstream/ts/HookRegistry';
import { JSInterface } from '../notices/upstream/ts/JSInterface';
import { Scope } from '../notices/upstream/ts/Scope';
import { Adjustable } from '../notices/upstream/ts/Adjustable';
import { SubcircuitModel } from '../notices/upstream/ts/SubcircuitModel';
import { SRAMElm } from '../notices/upstream/ts/SRAMElm';
import { AudioOutputElm } from '../notices/upstream/ts/AudioOutputElm';
import LZString from 'lz-string';
import '../notices/upstream/ts/canvas2svg.js';
import { BLOCKED_ELEMENTS, MOUSE_MODES, MAX_SOURCE_CHARS, checkTextSource, checkXmlDocument, describeCheck } from './policy.js';
window.LZString = LZString;
HookRegistry.createJSInterface = app => new JSInterface(app);
// The outer working copy owns persistence and file selection; never load a hidden recovery.
Menus.prototype.getSetupList = function () {};
UndoManager.prototype.readRecovery = function () {};
UndoManager.prototype.writeRecoveryToStorage = function () {};
// Subcircuit models travel inside each circuit file; never merge browser-global models into a document.
SubcircuitModel.loadModelsFromStorage = function () {};
// SRAM contents stay editable as text; the engine never opens a local file picker.
SRAMElm.loadFileSupported = () => false;
// Audio output simulates as a probe; its only trigger is a sidebar button that is never rendered, and playback is disabled outright.
AudioOutputElm.playAudio = () => {};
// Upstream slider bars stop at position 99 of 0–100, so the configured maximum is unreachable; allow 100.
const createSliderWithValue=Adjustable.prototype.createSliderWithValue;
Adjustable.prototype.createSliderWithValue=function(sim,value){createSliderWithValue.call(this,sim,value);if(this.slider){this.slider.max=100;this.slider.val=Math.min(100,Math.max(0,this.valueToSliderPosition(value)));}};
// Native time-step hook: bind readouts to the computed configuration and finish single steps.
const stepHook=JSInterface.prototype.callTimeStepHook;
JSInterface.prototype.callTimeStepHook=function(){
  if(captureComputed){calculatedConfig=this.app.dumpCircuit(false);captureComputed=false;}
  stepHook.call(this);
  if(stepping){stepping=false;this.app.setSimRunning(false);}
};
// Native drag completion also pushes the resulting state; skip an identical top item.
const undo=UndoManager.prototype.doUndo;
UndoManager.prototype.doUndo=function(){const current=UndoManager.withoutSliders(this.sim.dumpCircuit());while(this.undoStack.length&&UndoManager.withoutSliders(this.undoStack[this.undoStack.length-1].dump)===current)this.undoStack.pop();return undo.call(this);};
Scope.prototype.showProperties=function(){post({type:'error',message:'示波器波形与右键快捷设置可用；高级属性表单暂不开放。'});};
const apply = EditDialog.prototype.apply;
EditDialog.prototype.apply = function () {
  // Upstream ignores parse errors; preserve an unfinished number instead of applying old values.
  for (const ei of this.einfos) if (ei?.textf && ei.text === null) {
    let n; try { n = this.parseUnitsEi(ei); } catch { n = NaN; }
    if (!Number.isFinite(n) || (ei.positive && n <= 0) || (ei.nonNegative && n < 0) || (ei.integer && !Number.isInteger(n))) {
      this.errorLabel.textContent = `${ei.name}: Enter a valid ${ei.positive ? 'positive ' : ''}number.`;
      this.errorLabel.style.display = ''; captureDraft(); return false;
    }
  }
  const ok = apply.call(this); if (ok) { dirtyDialog=false;post({type:'draft',draft:null}); emit(true); } return ok;
};
const closeDialog=EditDialog.prototype.closeDialog;
EditDialog.prototype.closeDialog=function(){dirtyDialog=false;activeDialog=null;post({type:'draft',draft:null});return closeDialog.call(this);};
let app, key = '', loaded = false, lastConfig = '', lastView = '', activeDialog = null, dirtyDialog = false, disposed = false, frozen = false, calculatedConfig = '', captureComputed = true, stepping = false, probeIndex = -1, probeCache = {key:'',params:[]};
const BLOCKED_MENU=['sliders','viewInFloatScope','createsubcircuit'];
const FILE_MENU=['paste','importfromtext','importfromfile','importfromlocalfile','export','exporturl','exportasurl','exportaslocalfile','exportastext','exportasimage','exportassvg','print','newblankcircuit'];
const strip=s=>String(s??'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim();
function placeable(tool){return typeof tool==='string'&&(MOUSE_MODES.includes(tool)||(!!app?.classToLabelMap?.has(tool)&&!BLOCKED_ELEMENTS[tool.split(':')[0]]));}
function post(value) { parent.postMessage({bridge:'circuitjs-v08',key,...value},location.origin); }
function captureDraft() {
  const d = CirSim.editDialog; if (!d || !app) return null;
  const index = app.elmList.indexOf(d.elm); if (index < 0) return null;
  const fields = d.einfos.flatMap((ei,i) => ei?.textf ? [{index:i,name:ei.name,value:ei.textf.value}] : ei?.textArea?.element ? [{index:i,name:ei.name,value:ei.textArea.element.value}] : []);
  dirtyDialog = true;
  const draft={element:index,base:signature(d.elm),fields};post({type:'draft',draft});return draft;
}
function emit(force = false) {
  if (!app || !loaded || disposed) return;
  const config = app.dumpCircuit(false), view = JSON.stringify(app.transform);
  if (force || config !== lastConfig || view !== lastView) {
    if(config!==calculatedConfig){calculatedConfig='';captureComputed=true;}lastConfig = config; lastView = view;
    post({type:'snapshot',source:app.dumpCircuit(true),view:[...app.transform],viewport:[innerWidth,innerHeight]});
  }
}
function signature(e) { const doc=document.implementation.createDocument(null,"cir",null);const element=doc.createElement(e.getXmlDumpType());e.dumpXml(doc,element);return new XMLSerializer().serializeToString(element); }
function readouts() {
  return app.elmList.map((e,index) => ({index,type:e.constructor.name.replace(/Elm$/,''),voltage:safe(()=>e.getVoltageDiff()),current:safe(()=>e.getCurrent()),dump:signature(e)}));
}
// Some elements (e.g. 3-terminal switches before their first stamp) cannot report yet; never let one break the poll.
function safe(read){try{const v=read();return Number.isFinite(v)?v:NaN;}catch{return NaN;}}
function liveItems() {
  return app.elmList.map((e,index) => ({index,type:e.constructor.name.replace(/Elm$/,''),cls:e.constructor.name,voltage:safe(()=>e.getVoltageDiff()),current:safe(()=>e.getCurrent())}));
}
function normalizeSource(source){const t=source.replace(/^﻿/,'');return t.trimStart().startsWith('<')?t.trimStart():t;}
function analyze(source){
  if (typeof source !== 'string') return {message:'电路文本格式无效。',entries:0,classes:{}};
  if (source.length > MAX_SOURCE_CHARS) return {message:`电路文本超过 ${MAX_SOURCE_CHARS} 字符的容量；原文仍保留。`,entries:0,classes:{}};
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) return {message:'电路 XML 不允许 DOCTYPE/ENTITY 声明；原文仍保留。',entries:0,classes:{}};
  const text=normalizeSource(source);
  const result=text.startsWith('<')?checkXmlDocument(new DOMParser().parseFromString(text,'application/xml'),CirSim.xmlDumpTypeMap):checkTextSource(text,CirSim.dumpTypeMap);
  return {...result,message:describeCheck(result)};
}
function adjustables(){
  return app.adjustables.flatMap((a,index)=>{
    if(a.sharedSlider||!a.slider)return [];
    let value=a.getSliderValue();try{const ei=a.elm?.getEditInfo(a.editItem);if(ei&&Number.isFinite(ei.value))value=ei.value;}catch{}
    return [{index,label:strip(a.sliderText),element:app.elmList.indexOf(a.elm),param:strip(a.getEditItemName()),value,position:a.slider.getValue(),positions:a.slider.max??99,min:a.minValue,max:a.maxValue,log:!!a.logarithmic,linked:app.adjustables.filter(x=>x.sharedSlider===a).length}];
  });
}
function probe(){
  const e=app.elmList[probeIndex]; if(!e) return null;
  const arr=new Array(20).fill(null); try{e.getInfo(arr);}catch{}
  const info=arr.filter(x=>typeof x==='string'&&x.trim()).map(strip).slice(0,12);
  const cacheKey=probeIndex+'|'+signature(e)+'|'+app.adjustables.length;
  if(probeCache.key!==cacheKey){
    const params=[];
    for(let i=0;i<40;i++){let ei;try{ei=e.getEditInfo(i);}catch{break;}if(ei==null)break;const name=strip(ei.name);if(!name||!ei.canCreateAdjustable?.()||!Number.isFinite(ei.value))continue;params.push({item:i,name,value:ei.value,min:ei.minVal,max:ei.maxVal,hasSlider:!!app.findAdjustable(e,i)});}
    probeCache={key:cacheKey,params};
  }
  return {index:probeIndex,cls:e.constructor.name,info,params:probeCache.params};
}
function status(){
  const config=app.dumpCircuit(false);
  return {type:'readouts',valid:calculatedConfig===config&&!app.stopMessage,running:app.simIsRunning(),time:app.sim.t,stop:app.stopMessage,items:liveItems(),
    speed:app.ui.speedBar.getValue(),currentSpeed:app.ui.currentBar.getValue(),timeStep:app.sim.maxTimeStep,tool:app.ui.mouseModeStr,adjustables:adjustables(),probe:probe()};
}
async function initialize(message) {
  key=message.key;
  if (typeof message.source !== 'string') throw Error('电路文本格式无效。');
  // Construct the engine on an empty circuit so its own dump-type maps are available for the check below.
  window.startCircuitText='';
  app = new CirSim(); app.isModified = () => false;
  const needAnalyze=app.needAnalyze.bind(app);app.needAnalyze=()=>{calculatedConfig='';captureComputed=true;needAnalyze();};
  await app.init(); app.setSimRunning(false);
  for(const [code,tool] of app.shortcuts) if(!placeable(tool)&&!tool.startsWith('cmd:'))app.shortcuts.delete(code);
  // Hide broad source/service menus. Native right-click edit/scope and keyboard undo remain.
  const command = app.commands.menuPerformed.bind(app.commands);
  app.commands.menuPerformed = (menu,item) => {
    if (menu === 'main' && !placeable(item)) { post({type:'error',message:BLOCKED_ELEMENTS[item]??'此元件入口不可用。'});return; }
    if(BLOCKED_MENU.includes(item)){post({type:'error',message:'滑块请在下方仪器台「滑块」中添加；浮动示波器与子电路创建暂不开放。'});return;}
    if (FILE_MENU.includes(item)) return;
    command(menu,item); setTimeout(()=>emit(true),0);
  };
  const check=analyze(message.source);
  if(check.message)throw Error(check.message);
  app.loader.readCircuit(normalizeSource(message.source)); app.unsavedChanges=false; app.setSimRunning(false);
  if (Array.isArray(message.view) && message.view.length === 6 && message.view.every(Number.isFinite) && Array.isArray(message.viewport) && Math.abs(message.viewport[0]-innerWidth)<10 && Math.abs(message.viewport[1]-innerHeight)<10) app.transform=[...message.view];else app.centerCircuit();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) app.menus.dotsCheckItem.setState(false);
  loaded=true; app.repaint(); emit(true); post({type:'loaded'});
  post({type:'catalog',placeable:[...app.classToLabelMap.keys()].filter(placeable),blocked:{...BLOCKED_ELEMENTS}});
}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}
function addSlider(m){
  const e=app.elmList[m.element];
  if(!e)throw Error('元件已不存在。');
  const ei=e.getEditInfo(m.item);
  if(!ei||!ei.canCreateAdjustable())throw Error('该参数不能用滑块调节。');
  if(app.findAdjustable(e,m.item))throw Error('该参数已有滑块。');
  if(!finite(m.min)||!finite(m.max)||m.min>=m.max)throw Error('滑块最小值必须小于最大值。');
  if(m.log&&m.min<=0)throw Error('对数滑块的最小值必须大于 0。');
  const label=String(m.label??'').trim().slice(0,60);if(!label)throw Error('请填写滑块名称。');
  app.undoManager.pushUndo();
  const a=new Adjustable(e,m.item);a.minValue=m.min;a.maxValue=m.max;a.sliderText=label;a.logarithmic=!!m.log;
  if(!a.createSlider(app))throw Error('无法为该参数创建滑块。');
  app.adjustables.push(a);probeCache.key='';emit(true);
}
function removeSlider(index){
  const a=app.adjustables[index];if(!a)return;
  app.undoManager.pushUndo();
  for(let i=app.adjustables.length-1;i>=0;i--){const x=app.adjustables[i];if(x===a||x.sharedSlider===a){x.deleteSlider(app);app.adjustables.splice(i,1);}}
  probeCache.key='';emit(true);
}
window.addEventListener('message',async event=>{
  if (event.origin !== location.origin || event.source !== parent || event.data?.bridge !== 'circuitjs-v08') return;
  const m=event.data;
  try {
    if(m.type==='init' && !key) {await initialize(m);return;}
    if(m.key!==key || !app || !loaded || disposed)return;
    if(m.type==='check-source'){const r=analyze(m.source);post({type:'source-check',request:m.request,ok:!r.message,message:r.message,entries:r.entries??0,classes:r.classes??{}});return;}
    if(m.type==='freeze'){stepping=false;app.setSimRunning(false);frozen=true;post({type:'frozen',source:app.dumpCircuit(true),view:[...app.transform],viewport:[innerWidth,innerHeight],draft:dirtyDialog?captureDraft():undefined});return;}
    if(m.type==='thaw'){frozen=false;return;}
    if(frozen)return;
    if(m.type==='run') {stepping=false;app.setSimRunning(!app.simIsRunning());}
    if(m.type==='stop') {stepping=false;app.setSimRunning(false);emit(true);}
    if(m.type==='step') {if(app.stopMessage)throw Error(app.stopMessage);app.setSimRunning(false);stepping=true;app.setSimRunning(true);}
    if(m.type==='reset') {const was=app.simIsRunning()&&!stepping;stepping=false;calculatedConfig='';captureComputed=true;app.ui.resetAction();app.setSimRunning(was);emit(true);}
    if(m.type==='speed'&&finite(m.value)) {app.ui.speedBar.setValue(Math.round(Math.min(259,Math.max(1,m.value))));emit();}
    if(m.type==='current-speed'&&finite(m.value)) {app.ui.currentBar.setValue(Math.round(Math.min(99,Math.max(1,m.value))));emit();}
    if(m.type==='tool') {if(!placeable(m.tool))throw Error(BLOCKED_ELEMENTS[m.tool]??'此元件入口不可用。');app.commands.menuPerformed('main',m.tool);}
    if(m.type==='probe'&&Number.isInteger(m.index)) {probeIndex=m.index;const e=app.elmList[m.index];if(e&&app.mouse?.setMouseElm){app.mouse.setMouseElm(e);app.repaint();}}
    if(m.type==='edit' && app.elmList[m.index]) app.commands.doEdit(app.elmList[m.index]);
    if(m.type==='scope' && app.elmList[m.index]) {app.mouse.menuElm=app.elmList[m.index];app.commands.menuPerformed('elm','viewInScope');emit(true);}
    if(m.type==='slider'&&finite(m.position)) {const a=app.adjustables[m.index];if(a&&!a.sharedSlider&&a.slider){a.slider.setValue(Math.round(m.position));emit();}}
    if(m.type==='add-slider') addSlider(m);
    if(m.type==='remove-slider'&&Number.isInteger(m.index)) removeSlider(m.index);
    if(m.type==='center') app.centerCircuit();
    if(m.type==='undo') {app.undoManager.doUndo();emit(true);}
    if(m.type==='redo') {app.undoManager.doRedo();emit(true);}
    if(m.type==='restore-draft') {
      const d=m.draft,e=app.elmList[d.element];
      if(!e || signature(e)!==d.base) throw Error('元件已变化，参数草稿已保留；请手动对照填写。');
      app.commands.doEdit(e); for(const f of d.fields) {const ei=CirSim.editDialog.einfos[f.index];if(ei?.textf)ei.textf.value=f.value;else if(ei?.textArea?.element)ei.textArea.element.value=f.value;} captureDraft();
    }
    // Exports read the current state; a running simulation keeps running.
    if(m.type==='export') {if(!app.simIsRunning())app.ui.updateCircuit();emit(true);post({type:'export',source:app.dumpCircuit(true),png:app.ui.cv.toDataURL('image/png'),readouts:readouts(),valid:calculatedConfig===app.dumpCircuit(false)&&!app.stopMessage,time:app.sim.t,request:m.request});}
  }catch(e){post({type:'error',message:e instanceof Error?e.message:String(e)});}
});
document.addEventListener('input',event=>{if(event.target.closest('dialog'))captureDraft();},true);
document.addEventListener('pointerup',()=>setTimeout(()=>{
  if(!app||!loaded||frozen)return;emit(true);
  // Clicking an element (or leaving exactly one selected) makes it the probed element.
  const hovered=app.mouse?.getMouseElm?.(),selected=app.elmList.filter(e=>e.isSelected());
  const target=hovered&&app.elmList.includes(hovered)?hovered:selected.length===1?selected[0]:null;
  if(target)post({type:'selection',index:app.elmList.indexOf(target)});
},0));
document.addEventListener('keyup',()=>setTimeout(()=>emit(),0));
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&['s','o','n'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();}},true);
const poll=setInterval(()=>{
  if(!app||!loaded||disposed||frozen)return;
  const d=CirSim.editDialog;
  if(d!==activeDialog){if(activeDialog&&dirtyDialog&&!d){post({type:'draft',draft:null});dirtyDialog=false;}activeDialog=d;}
  if(d) for(const ei of d.einfos) if(ei?.textf) ei.textf.setAttribute('aria-label',ei.name);
  emit();try{post(status());}catch(e){console.warn('CircuitJS readout skipped',e);}
},350);
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(poll);app?.setSimRunning(false);});
parent.postMessage({bridge:'circuitjs-v08',type:'ready'},location.origin);
