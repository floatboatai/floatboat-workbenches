/* SPDX-License-Identifier: GPL-2.0-or-later
 * Floatboat embedding adapter; original solver and renderer remain in upstream/ts. */
import { CirSim } from '../notices/upstream/ts/CirSim';
import { Menus } from '../notices/upstream/ts/Menus';
import { UndoManager } from '../notices/upstream/ts/UndoManager';
import { EditDialog } from '../notices/upstream/ts/EditDialog';
import { HookRegistry } from '../notices/upstream/ts/HookRegistry';
import { JSInterface } from '../notices/upstream/ts/JSInterface';
import { Scope } from '../notices/upstream/ts/Scope';
import LZString from 'lz-string';
import '../notices/upstream/ts/canvas2svg.js';
window.LZString = LZString;
HookRegistry.createJSInterface = app => new JSInterface(app);
// The outer working copy owns persistence and file selection; never load a hidden recovery.
Menus.prototype.getSetupList = function () {};
UndoManager.prototype.readRecovery = function () {};
UndoManager.prototype.writeRecoveryToStorage = function () {};
// Native drag completion also pushes the resulting state; skip an identical top item.
const stepHook=JSInterface.prototype.callTimeStepHook;
JSInterface.prototype.callTimeStepHook=function(){if(captureComputed){calculatedConfig=this.app.dumpCircuit(false);captureComputed=false;}stepHook.call(this);};
const undo=UndoManager.prototype.doUndo;
UndoManager.prototype.doUndo=function(){const current=UndoManager.withoutSliders(this.sim.dumpCircuit());while(this.undoStack.length&&UndoManager.withoutSliders(this.undoStack[this.undoStack.length-1].dump)===current)this.undoStack.pop();return undo.call(this);};
Scope.prototype.showProperties=function(){post({type:'error',message:'首版保留示波器波形与右键快捷设置；高级属性表单暂不开放。'});};
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
let app, key = '', lastConfig = '', lastView = '', activeDialog = null, dirtyDialog = false, disposed = false, frozen = false, calculatedConfig = '', captureComputed = true;
const allowed = new Set(['WireElm','ResistorElm','GroundElm','CapacitorElm','InductorElm','VoltageElm','DCVoltageElm','ACVoltageElm','RailElm','DCRailElm','ACRailElm','SwitchElm','Switch2Elm','DiodeElm','OpAmpElm','TextElm','OutputElm','ProbeElm','Select','DragAll','DragPost','DragSelected']);
function post(value) { parent.postMessage({bridge:'circuitjs-v08',key,...value},location.origin); }
function captureDraft() {
  const d = CirSim.editDialog; if (!d || !app) return null;
  const index = app.elmList.indexOf(d.elm); if (index < 0) return null;
  const fields = d.einfos.flatMap((ei,i) => ei?.textf ? [{index:i,name:ei.name,value:ei.textf.value}] : ei?.textArea?.element ? [{index:i,name:ei.name,value:ei.textArea.element.value}] : []);
  dirtyDialog = true;
  const draft={element:index,base:signature(d.elm),fields};post({type:'draft',draft});return draft;
}
function emit(force = false) {
  if (!app || disposed) return;
  const config = app.dumpCircuit(false), view = JSON.stringify(app.transform);
  if (force || config !== lastConfig || view !== lastView) {
    if(config!==calculatedConfig){calculatedConfig='';captureComputed=true;}lastConfig = config; lastView = view;
    post({type:'snapshot',source:app.dumpCircuit(true),view:[...app.transform],viewport:[innerWidth,innerHeight]});
  }
}
function signature(e) { const doc=document.implementation.createDocument(null,"cir",null);const element=doc.createElement(e.getXmlDumpType());e.dumpXml(doc,element);return new XMLSerializer().serializeToString(element); }
function readouts() {
  return app.elmList.map((e,index) => ({index,type:e.constructor.name.replace(/Elm$/,''),voltage:e.getVoltageDiff(),current:e.getCurrent(),dump:signature(e)}));
}
function validateSource(source) {
  if (typeof source !== 'string' || source.length > 650000 || /<!DOCTYPE|<!ENTITY/i.test(source)) throw Error('电路文本不受支持或超过容量。原文仍保留。');
  if (source.trim().startsWith('<')) {
    const doc = new DOMParser().parseFromString(source,'application/xml');
    if(doc.documentElement.children.length>256)throw Error('最多支持 256 个电路条目；原文已保留。');
    if (doc.querySelector('parsererror') || doc.documentElement.tagName !== 'cir') throw Error('CircuitJS XML 格式无效，原文仍保留。');
    const tags = new Set(['w','r','g','c','l','v','R','s','S','d','a','x','O','p','o','h','adj','dm']);
    for(const node of doc.documentElement.children) if (!tags.has(node.tagName)) throw Error(`首版未验证元件 ${node.tagName}；原文已保留，请使用基础 RLC / 电压源 / 开关电路。`);
  } else {
    if(source.split('\n').filter(x=>x.trim()).length>256)throw Error('最多支持 256 个电路条目；原文已保留。');
    const types = new Set(['$','w','r','g','c','l','v','R','s','S','d','a','x','O','p','o','h','&']);
    for(const line of source.split('\n').filter(x=>x.trim())) if(!types.has(line.trim().split(/\s/)[0])) throw Error('首版未验证此电路类型；原文已保留。');
  }
}
async function initialize(message) {
  key=message.key; validateSource(message.source); window.startCircuitText=message.source;
  app = new CirSim(); app.isModified = () => false;
  const needAnalyze=app.needAnalyze.bind(app);app.needAnalyze=()=>{calculatedConfig='';captureComputed=true;needAnalyze();};
  await app.init(); app.setSimRunning(false);
  for(const [code,tool] of app.shortcuts) if(!allowed.has(tool)&&!tool.startsWith('cmd:'))app.shortcuts.delete(code);
  // Hide broad source/service menus. Native right-click edit/scope and keyboard undo remain.
  const command = app.commands.menuPerformed.bind(app.commands);
  app.commands.menuPerformed = (menu,item) => {
    if (menu === 'main' && !allowed.has(item)) { post({type:'error',message:'首版仅启用基础电路元件。'});return; }
    if(['sliders','viewInFloatScope','createsubcircuit'].includes(item)){post({type:'error',message:'首版保留基础电路与下方示波器；此高级编辑入口暂不开放。'});return;}
    if (['paste','importfromtext','importfromfile','export','exporturl','newblankcircuit'].includes(item)) return;
    command(menu,item); setTimeout(()=>emit(true),0);
  };
  if (Array.isArray(message.view) && message.view.length === 6 && message.view.every(Number.isFinite) && Array.isArray(message.viewport) && Math.abs(message.viewport[0]-innerWidth)<10 && Math.abs(message.viewport[1]-innerHeight)<10) app.transform=[...message.view];else app.centerCircuit();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) app.menus.dotsCheckItem.setState(false);
  app.repaint(); emit(true); post({type:'loaded'});
}
window.addEventListener('message',async event=>{
  if (event.origin !== location.origin || event.source !== parent || event.data?.bridge !== 'circuitjs-v08') return;
  const m=event.data;
  try {
    if(m.type==='init' && !key) {await initialize(m);return;}
    if(m.key!==key || !app || disposed)return;
    if(m.type==='freeze'){app.setSimRunning(false);frozen=true;post({type:'frozen',source:app.dumpCircuit(true),view:[...app.transform],viewport:[innerWidth,innerHeight],draft:dirtyDialog?captureDraft():undefined});return;}
    if(m.type==='thaw'){frozen=false;return;}
    if(frozen)return;
    if(m.type==='run') app.setSimRunning(!app.simIsRunning());
    if(m.type==='stop') {app.setSimRunning(false);emit(true);}
    if(m.type==='reset') {calculatedConfig='';captureComputed=true;app.ui.resetAction();app.setSimRunning(false);emit(true);}
    if(m.type==='tool' && allowed.has(m.tool)) app.commands.menuPerformed('main',m.tool);
    if(m.type==='edit' && app.elmList[m.index]) app.commands.doEdit(app.elmList[m.index]);
    if(m.type==='scope' && app.elmList[m.index]) {app.mouse.menuElm=app.elmList[m.index];app.commands.menuPerformed('elm','viewInScope');emit(true);}
    if(m.type==='center') app.centerCircuit();
    if(m.type==='undo') {app.undoManager.doUndo();emit(true);}
    if(m.type==='redo') {app.undoManager.doRedo();emit(true);}
    if(m.type==='restore-draft') {
      const d=m.draft,e=app.elmList[d.element];
      if(!e || signature(e)!==d.base) throw Error('元件已变化，参数草稿已保留；请手动对照填写。');
      app.commands.doEdit(e); for(const f of d.fields) {const ei=CirSim.editDialog.einfos[f.index];if(ei?.textf)ei.textf.value=f.value;else if(ei?.textArea?.element)ei.textArea.element.value=f.value;} captureDraft();
    }
    if(m.type==='export') {app.setSimRunning(false);app.ui.updateCircuit();emit(true);post({type:'export',source:app.dumpCircuit(true),png:app.ui.cv.toDataURL('image/png'),readouts:readouts(),valid:calculatedConfig===app.dumpCircuit(false)&&!app.stopMessage,time:app.sim.t,request:m.request});}
  }catch(e){post({type:'error',message:e instanceof Error?e.message:String(e)});}
});
document.addEventListener('input',event=>{if(event.target.closest('dialog'))captureDraft();},true);
document.addEventListener('pointerup',()=>setTimeout(()=>emit(true),0));
document.addEventListener('keyup',()=>setTimeout(()=>emit(),0));
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&['s','o','n'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();}},true);
const poll=setInterval(()=>{
  if(!app||disposed||frozen)return;
  const d=CirSim.editDialog;
  if(d!==activeDialog){if(activeDialog&&dirtyDialog&&!d){post({type:'draft',draft:null});dirtyDialog=false;}activeDialog=d;}
  if(d) for(const ei of d.einfos) if(ei?.textf) ei.textf.setAttribute('aria-label',ei.name);
  emit();const config=app.dumpCircuit(false);post({type:'readouts',valid:calculatedConfig===config&&!app.stopMessage,running:app.simIsRunning(),time:app.sim.t,stop:app.stopMessage,items:readouts()});
},350);
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(poll);app?.setSimRunning(false);});
parent.postMessage({bridge:'circuitjs-v08',type:'ready'},location.origin);
