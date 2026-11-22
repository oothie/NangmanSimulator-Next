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
// Quest UI intentionally excludes NPC coordinates; show only saved mission/commission state.
const quest=section('function questSaveModel(root){','function questView(){');
const {questSaveModel,questRecordDetails,questDelegatedDetails}=new Function('escape','marketDate',
 quest+';return {questSaveModel,questRecordDetails,questDelegatedDetails};')(
 v=>String(v),x=>String(x)
);
const fixture={Task:{id:9999999,trace:true,recv:1784781076},
 WeiTuoTask:{accept:[105,118,116],task:[105,107,110,116,118,117]},
 SoloNpc:{'34078':{y:16,m:'nl_wuduling',x:2}}};
const model=questSaveModel(fixture);
assert.equal(model.current.id,9999999);
assert.equal(model.delegated.accepted.length,3);
assert.equal(model.delegated.recorded.length,6);
assert(!Object.prototype.hasOwnProperty.call(model,'npcRecords'),'quest model has no NPC coordinates');
assert(questRecordDetails({step:3,trace:true}).includes('진행 단계'),'show saved mission step');
assert(questDelegatedDetails(model).includes('위탁 기록 · 6건'),'display saved commissions');
assert(!html.includes("['npc','NPC 위치']"),'NPC tab is removed');
assert(html.includes('id="dropWorkspace"'),'persistent drop iframe mount');
assert(html.includes('function updateDropVisibility()'),'persistent drop visibility');
assert(html.includes("version:dropSaveVersion,save:save||null"),'versioned parent payload');
assert(html.includes("event.data.version===dropSaveVersion"),'stale drop message guard');
assert(html.includes("if(event.data.status==='ready'){dropReady=true;dropModeSent=null;sendThemeToDrop();sendSaveToDrop(true);sendDropMode(true)}"),
 'send theme, save and selected drop mode after child ready');
assert(html.includes("kind:'nangman-drop-mode',mode:dropSelectedMode"),
 'parent forwards a distinct Sanbujin drop mode request');
assert(drop.includes("event.data?.kind!=='nangman-drop-mode'"),
 'Sanbujin iframe validates mode message origin');
assert(drop.includes("version=event.data.version"),'child echoes message version');
assert(drop.includes("status:'save-loaded',version"),'child acknowledge version');
const wash=section("import {washEngine,washSearchEngine} from './engine/local-engine-bridge.js?rev=0.10.47'",
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
console.log('PASS: saved quest detail without NPC directory, drop handshake and WASM rollback guards');
