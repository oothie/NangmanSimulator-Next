// Equipment detail uses the native predictor and must never select a duplicate item arbitrarily.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),main=fs.readFileSync(path.join(root,'index.html'),'utf8');
const bridge=fs.readFileSync(path.join(root,'engine','equipment-detail-bridge.js'),'utf8');
const host=fs.readFileSync(path.join(root,'vendor','sanbujin','equip','index.html'),'utf8');
const items=[
 {id:4009,only_id:401,CZSeed:9001,MJSeed:9501,S:42,color:4,typ:1,need_lv:100,exts:[{prop:'atk_add',value:20}]},
 {id:4009,only_id:402,CZSeed:9002,MJSeed:9502,S:43,color:4,typ:1,need_lv:100,exts:[{prop:'atk_add',value:30}]},
 {id:5009,only_id:501,CZSeed:9003,MJSeed:9503,S:44,color:5,typ:8,need_lv:100,exts:[]}
];
function harness(){
 const sent=[],clicks=[],handlers={},elements={};
 const parent={postMessage:msg=>sent.push(msg)};
 for(const id of ['xilianEquipSelect','strongEquipSelect','specialAttachEquipSelect','shenglianEquipSelect']){
  elements[id]={value:'',options:items.map(e=>({value:String(e.only_id)})),dispatchEvent(){}};
 }
 for(const id of ['xilianCount','strongCount','specialAttachCount','btnXilianPreview','btnStrongPreview','btnSpecialAttachPreview','tabBar','specialAttachMaterialSelect']){
  elements[id]={value:'',min:1,options:[],click(){clicks.push(id)},scrollIntoView(){}};
 }
 const listeners={};
 const win={parent,addEventListener:(name,callback)=>{handlers[name]=callback}};
 const context={
  window:win,parent,location:{origin:'https://example.test'},document:{getElementById:id=>elements[id]||null},
  Event:class Event{},saveEquips:items,saveLoaded:true,
  runtimeKey:e=>String(e.only_id),fillEquipSelects:()=>{},
  switchTab:t=>clicks.push('tab:'+t),canPredictSpecialAttach:()=>true,
  canShengLian:()=>false,fillSpecialAttachMaterialSelect:()=>{}
 };
 vm.runInNewContext(bridge,context,{filename:'equipment-detail-bridge.js'});
 const send=(equipment,mode,count,version)=>handlers.message({source:parent,origin:context.location.origin,
  data:{kind:'nangman-equip-focus',equipment,mode,count,version}});
 return {send,clicks,sent,elements};
}
const h=harness();
h.send({ID:4009},'refine',25,1);
assert.equal(h.sent.at(-1).status,'unavailable','two identical equipment IDs must not be guessed');
assert.equal(h.clicks.length,0,'no native RNG call for ambiguous inventory');
h.send({ID:4009,OnlyID:402},'refine',33,2);
assert.equal(h.elements.xilianEquipSelect.value,'402');
assert.equal(h.elements.xilianCount.value,'33');
assert.equal(h.sent.at(-1).status,'preview');
assert(h.clicks.includes('btnXilianPreview'));
h.send({ID:4009,OnlyID:401},'mangjing',150,3);
assert.equal(h.elements.specialAttachEquipSelect.value,'401');
assert.equal(h.elements.specialAttachCount.value,'150');
assert(h.clicks.includes('btnSpecialAttachPreview'));
h.send({ID:4009,CZSeed:9002,MJSeed:9502},'strong',2000,4);
assert.equal(h.elements.strongEquipSelect.value,'402');
assert.equal(h.elements.strongCount.value,'2000');
assert(h.clicks.includes('btnStrongPreview'));
h.send({ID:5009,OnlyID:501},'refine',10,5);
assert.equal(h.sent.at(-1).status,'unavailable','orange equipment cannot refine');
h.send({ID:5009,OnlyID:501},'strong',10,6);
assert.equal(h.sent.at(-1).status,'unavailable','nonweapon cannot quench');
assert(host.includes('engine/equipment-detail-bridge.js'),'native host loads the focus bridge');
assert(main.includes("kind:'nangman-equip-focus'"),'integrated host requests seed-based sequences');
assert(main.includes("event.data?.kind!=='nangman-equip-detail-status'"),'native status relayed to user');
assert(!main.includes("['npc','NPC 위치']"),'NPC location remains removed');
console.log('PASS: equipment full-page detail bridge selects exact save item, runs all three native sequence modes, rejects invalid gear');
