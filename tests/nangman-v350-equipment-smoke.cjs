// Native NangmanSimulator v3.50 source and integration regression.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const native=fs.readFileSync(path.join(root,'vendor/nangman-v350/equipment.html'),'utf8');
const bridge=fs.readFileSync(path.join(root,'vendor/nangman-v350/embedded-bridge.js'),'utf8');
const parent=fs.readFileSync(path.join(root,'index.html'),'utf8');
const meta=JSON.parse(fs.readFileSync(path.join(root,'vendor/nangman-v350/inventory.json'),'utf8'));
assert(native.includes('window.rk218Open=open'),'original v3.50 navigation exported');
assert(native.includes('function open(v){R.view=v;'),'original view selection retained');
for(const view of ['find','auto','region','owned'])assert(native.includes('data-v="'+view+'"'),'native equipment view: '+view);
assert(native.includes('function paintDetail('),'native shared detail present');
assert(native.includes('paintAutoEquip339('),'original automatic gear simulator present');
assert(native.includes('function showDetailTop233('),'native routed detail used');
assert(native.includes('window.nangman350FocusEquipment=function('),'external owner/detail bridge installed');
assert(native.includes('embedded-bridge.js'),'same-origin parent bridge loaded');
assert(bridge.includes('window.applySharedSaveJson(d.save)'),'the exact imported user save forwarded to native engine');
assert(bridge.includes('window.rk218Open(view)'),'native tabs selected rather than reimplemented locally');
assert(bridge.includes('window.nangman350FocusEquipment?.('),'verified inventory item opens shared native detail');
for(const view of ['find','auto','owned','region'])
 assert(parent.includes("'nangman350:"+view+"'"),'native tab configured: '+view);
assert(parent.includes("'nangman-v350'"),'single persistent native equipment frame');
assert(parent.includes("equipmentLastOriginalTab"),'finder/auto state retained during parent re-render');
assert(parent.includes("'equip-orange'"),'Sanbujin orange retained');
assert(parent.includes("'jianwang-auto'"),'Sanbujin Jianwang auto retained');
assert(parent.includes("'jianwang-manual'"),'Sanbujin Jianwang manual retained');
assert(parent.includes('sendEquipmentFocus();'),'external equipment detail selection forwarded');
assert(!parent.includes('2서버/4서버 자료는 테스트 전용으로 사용합니다'),'false market fixture warning removed');
assert(!parent.includes("['npc','NPC 위치']"),'NPC location tab remains removed');
assert(meta.source.endsWith('v3_50.html'),'source manifest names correct upstream');
assert(native.length>600000,'native engine vendored, not a mock');
assert(native.includes('id="dmjall"'),'full mangjing sequence checkbox included');
assert(native.includes('RK237.mjShowAll?rkMjSequence273('),'full mangjing shows every original native roll');
assert(native.includes('max="5000" value="'),'mangjing count supports 5000 rolls');
assert(native.includes("n:'전체 시퀀스'"),'quenching retains full sequence mode');
let parsed=0;
for(const [index,match] of [...native.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].entries()){
 const js=match[2];
 if(!js.trim()||/\btype\s*=\s*["']module["']/.test(match[1]))continue;
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'v350-inline-'+index+'.js'}),'native source script '+index+' must parse');
 parsed++;
}
assert(parsed>=5,'native engine includes substantive JavaScript');
console.log('PASS: original v3.50 finder, automatic simulation, inventory, regional crafting, shared detail and Sanbujin supplements');
