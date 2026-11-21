'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const drop=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/index.html'),'utf8');
const section=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert(a>=0&&b>a,'missing section: '+start+' / '+end);
 return html.slice(a,b);
};
// Quest data: no invented completed status or coordinates for missing x/y fields.
const quest=section('function questSaveModel(root){','function questView(){');
const {questSaveModel,questAreaSummary,questExportCsv}=new Function(
 quest+';return {questSaveModel,questAreaSummary,questExportCsv};')();
const fixture={Task:{id:9999999,trace:true,recv:1784781076},
 WeiTuoTask:{accept:[105,118,116],task:[105,107,110,116,118,117]},
 SoloNpc:{
  '34078':{y:16,m:'nl_wuduling',x:2},
  '37463':{y:2,x:4,m:'qc_shangu'},
  '37447':{y:28,x:16,r:2147480047,m:'yz'},
  '999':{m:'yz',x:0,y:0},
  '888':{m:'yz',x:3},
  '777':{m:'yz',y:4},
  '666':{m:'yz',x:null,y:2},
  '555':{r:-1}
 }};
const model=questSaveModel(fixture);
assert.equal(model.current.id,9999999);
assert.equal(model.delegated.accepted.length,3);
assert.equal(model.delegated.recorded.length,6);
assert.equal(model.npcRecords.length,8);
assert.equal(model.located.length,4,'only real x/y coordinate pairs');
const yz=questAreaSummary(model).find(x=>x.code==='yz');
assert.equal(yz.count,2,'map counts use only valid coordinates');
const csv=questExportCsv(model);
assert(csv.startsWith('\uFEFF'),'Excel BOM required');
assert(csv.includes('"현재 임무","9999999"'),'actual saved task');
assert(csv.includes('"위탁 수락","105"'),'delegated task');
assert(csv.includes('"NPC 위치","34078","nl_wuduling","2","16"'),'NPC x/y retained');
assert(csv.includes('"NPC 위치","666","yz","","","좌표 미확인"'),'missing coordinates never coerced to zero');
const yzCsv=questExportCsv(model,'yz');
assert(!yzCsv.includes('nl_wuduling'),'area export filter excludes unrelated NPCs');
assert(yzCsv.includes('"NPC 위치","999","yz","0","0"'),'valid 0,0 retained');
assert(html.includes('id="dropWorkspace"'),'persistent drop iframe mount');
assert(html.includes('function updateDropVisibility()'),'persistent drop visibility');
assert(html.includes("version:dropSaveVersion,save:save||null"),'versioned parent payload');
assert(html.includes("event.data.version===dropSaveVersion"),'stale drop message guard');
assert(html.includes("if(event.data.status==='ready'){dropReady=true;dropModeSent=null;sendSaveToDrop(true);sendDropMode(true)}"),
 'send save and selected drop mode only after child ready');
assert(html.includes("kind:'nangman-drop-mode',mode:dropSelectedMode"),
 'parent forwards a distinct Sanbujin drop mode request');
assert(drop.includes("event.data?.kind!=='nangman-drop-mode'"),
 'Sanbujin iframe validates mode message origin');
assert(drop.includes("version=event.data.version"),'child echoes message version');
assert(drop.includes("status:'save-loaded',version"),'child acknowledge version');
const wash=section("import {washEngine} from './engine/local-engine-bridge.js';",
 'window.addEventListener(\'nangman-embedded-status\'');
assert(wash.includes("if(!result?.state)throw Error"),'WASM response checked before undo snapshot');
assert(wash.indexOf("state.undoStates.pop()")>wash.indexOf("const restored=await washEngine.call('set-state',snapshot)"),
 'undo snapshot popped only after successful WASM restore');
assert(wash.includes("Number(restored?.seed)!==Number(snapshot.seed)"),
 'undo restores correct seed');
assert(wash.includes("parsed>100"),'do not silently clamp invalid multi-count');
assert(wash.includes('ensureSession();'),'discard stale async WASM results after role switch');
assert(html.includes('state.generation=(state.generation||0)+1'),'invalidate old WASM generation');
assert(wash.includes("washEngine.call('until-gold',{count:1000})"),'native purple-until bounded call');

assert(html.includes("function yyRolePanel(role){"),'character panel remains connected');
console.log('PASS: saved quest/NPC validity, CSV, versioned drop handshake and WASM rollback guards');
