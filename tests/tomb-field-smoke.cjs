// Diling outer-zone 100-level encounter -> 90-level equipment (source-lab v29 hypotheses).
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'vendor/sanbujin/drops');
const host={window:{}};vm.createContext(host);
for(const file of ['wild-data.js','wild-core.js','tomb-core.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),host);
const {SBJTombDrop:tomb,SBJWildCatalog:catalog}=host.window;
const target=catalog.find(x=>x.npcId===35256);
assert(target&&target.kind==='tomb'&&target.lv===100&&target.dropLevel===90);
assert.equal(tomb.source.encounterNpc,35255);
assert.deepEqual(Array.from(tomb.source.pool),[4009,4209,4409,4609,4809,5009,5409,5609]);
const save={Rnds:{Sds:{rollenemy_tomb:417860,seed_35256:352560},Eds:{}},
 globalVariable:{3007:6,eat_2659:0,rollenemy_tomb2:1000,get_history:0}};
const before=JSON.stringify(save),open=tomb.open(save);
assert(tomb.ready(open),'requires saved 35256 reward RNG, encounter RNG and flags');
const rows=Array.from(tomb.predict(open,{pad:2,count:80,order:'descending'}));
assert.equal(rows.length,82);assert.equal(rows.filter(r=>r.padding).length,2);
assert(rows.some(r=>r.spawn),'special encounter occurs');
assert(rows.some(r=>r.color),'90-level equipment outcome occurs');
assert(rows.every(r=>!r.itemId||!r.color||tomb.source.pool.includes(r.itemId)),'equipment only from 90-level pool');
assert(rows.every(r=>!r.color||r.dropLevel===90),'no invented 100-level equipment');
assert(rows.every(r=>r.spawn||!r.itemId),'ordinary encounter never grants special reward');
assert.equal(JSON.stringify(save),before,'prediction does not modify save');
assert.deepEqual(Array.from(tomb.predict(open,{pad:2,count:80,order:'descending'}),r=>[r.itemId||0,r.spawn,r.color||0]),
 rows.map(r=>[r.itemId||0,r.spawn,r.color||0]),'same save same 90-level drop forecast');
const absent=tomb.open({...save,Rnds:{Sds:{seed_35256:100}}});
assert.equal(tomb.ready(absent),false,'missing appearance RNG blocks predictions');
const missingFlag=tomb.open({...save,globalVariable:{3007:6}});
assert.equal(tomb.ready(missingFlag),false,'missing threshold flag blocks predictions');
const locked=tomb.open({...save,globalVariable:{...save.globalVariable,3007:0}});
assert(Array.from(tomb.predict(locked,{count:8}),r=>r.spawn).every(v=>!v),'normal encounter without unlock never treated as 35256');
const clueSave={...save,globalVariable:{...save.globalVariable,treasure_hunting_cbt:5}};
const clueBefore=JSON.stringify(clueSave);
const clueTrace=tomb.trace(tomb.open(clueSave),{count:1,order:'descending'});
assert.equal(clueTrace.rows.length,1);
assert.equal(clueTrace.rows[0].spawn,true,'max threshold triggers special event');
assert.equal(clueTrace.rows[0].extraItemId,9415,'source treasure clue side effect');
assert.equal(clueTrace.final.flags.treasure_hunting_cbt,3,'source resets clue flag after reward');
assert.equal(JSON.stringify(clueSave),clueBefore,'source save never mutated by clue modelling');
assert(Number.isSafeInteger(clueTrace.final.encounterSeed)&&Number.isSafeInteger(clueTrace.final.equipmentSeed),
 'modeled end states retained for before/after comparisons');
const secondary=Array.from(tomb.predict(open,{count:8,order:'ascending'}));
assert.equal(secondary.length,8,'comparison hypothesis available');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const ui=fs.readFileSync(path.join(dir,'wild.js'),'utf8');
assert(html.includes('src="./tomb-core.js?rev=20261122-h109"')&&
 html.indexOf('tomb-core.js')<html.indexOf('src="./wild.js'));
assert(html.includes('id="wildTombOrder"')&&ui.includes('tomb.predict(input,'));
// Minimal, non-personal snapshot of RNG fields from the 2026-11-21 1121.json.
// Confirmed 2026-11-22 hunt #109: Qingyun Chu 5609 blue, DEF+220, HIT+68.
// Four color traversal permutations are observationally equivalent through #109.
// Do not treat this as proof of LuaJIT pairs() order in other saved games.
const actualSave={Rnds:{Sds:{rollenemy_tomb:1456365169,seed_35256:492075794},
 Eds:{5609:734963273}},globalVariable:{eat_2659:9,rollenemy_tomb2:200}};
const qingyun={base:{def:800,dodge:475},exts:{
 atk_add:[131,80],hit_add:[89,100],def_add:[214,100],hp_add:[420,100],
 speed_add:[83,100],dodge_add:[105,100],parry_add:[83,100],
 unarmed_add:[0.06,50],sword_add:[0.05,50],blade_add:[0.04,50],
 stick_add:[0.05,50],hp_back:[100,5],mp_f:[12,5],
 dmg_off:[0.01,5],dmg_ref:[0.03,5],renxing:[120,10]}};
const observed=tomb.predict(tomb.open(actualSave),{count:109,
 equipment:{5609:qingyun}});
assert.equal(observed.length,109);
assert.equal(observed[7].itemId,4009,'#8 original item preserved');
assert.equal(observed[7].color,1,'#8 white preserved');
assert.equal(observed[11].itemId,5409,'#12 original item preserved');
assert.equal(observed[11].color,2,'#12 green preserved');
assert.equal(observed[19].itemId,8802,'#20 side reward preserved');
assert.equal(observed[20].itemId,4009,'#21 original item preserved');
assert.equal(observed[20].color,1,'#21 white preserved');
assert.equal(observed[108].npcId,35256,'#109 special NPC');
assert.equal(observed[108].itemId,5609,'#109 Qingyun Chu');
assert.equal(observed[108].color,3,'#109 verified blue quality');
assert.equal(observed[108].affixes.length,2,'blue grade gets two affixes');
assert.equal(observed[108].affixes[0].prop,'def_add');
assert.equal(observed[108].affixes[0].value,220);
assert.equal(observed[108].affixes[1].prop,'hit_add');
assert.equal(observed[108].affixes[1].value,68);
assert.equal(JSON.stringify(actualSave.Rnds.Eds),JSON.stringify({5609:734963273}),
 'prediction must not mutate source Eds');
const legacy109=tomb.predict(tomb.open(actualSave),{count:109,
 colorOrder:[2,1,4,3],equipment:{5609:qingyun}});
for(let i=0;i<108;i++){
 assert.equal(observed[i].itemId,legacy109[i].itemId,'#'+(i+1)+' item must stay identical');
 assert.equal(observed[i].color,legacy109[i].color,'#'+(i+1)+' quality must stay identical');
}
assert.equal(legacy109[108].itemId,observed[108].itemId);
assert.equal(legacy109[108].color,2,'old #109 green prediction reproduced');
assert.equal(observed.final.equipmentSeed,legacy109.final.equipmentSeed,
 'color-order correction must not alter item/reward RNG stream');
assert.equal(observed.final.eds['5609'],legacy109.final.eds['5609'],
 'corrected color must not consume extra shared Eds rolls');
// All four still-compatible color orders agree through 500 calls on this save;
// no single unique native Lua traversal order can be claimed from this record.
const colorCandidates=[[3,2,1,4],[3,2,4,1],[3,4,2,1],[4,3,2,1]];
const common500=tomb.predict(tomb.open(actualSave),{count:500,colorOrder:colorCandidates[0]});
for(const candidate of colorCandidates.slice(1)){
 const check=tomb.predict(tomb.open(actualSave),{count:500,colorOrder:candidate});
 assert.deepEqual(Array.from(check,row=>[row.itemId||0,row.color||0]),
  Array.from(common500,row=>[row.itemId||0,row.color||0]),
  'remaining candidate orders must stay observationally equivalent through 500');
}

// Regression: UI allowed 2000 but the actual Diling engine previously
// rejected everything above 500. Validate full calculation, not merely
// changing the HTML max attribute.
const full2000=tomb.predict(open,{count:2000,order:'verified'});
assert.equal(full2000.length,2000,'all 2000 field calls must be computed');
assert.equal(full2000[1999].serial,2000);
assert.equal(tomb.predict(open,{pad:1000,count:1000}).length,2000,
 'combined padding and projected calls can reach 2000');
assert.equal(tomb.predict(open,{pad:1999,count:1}).length,2000);
assert.throws(()=>tomb.predict(open,{count:2001}),/2000/);
assert.throws(()=>tomb.predict(open,{pad:1,count:2000}),/2000/);
const traced2000=tomb.traceEncounterCalls(open,2000);
assert.equal(traced2000.encounters.length,2000);
assert.equal(traced2000.encounters.at(-1).call,2000);
assert.equal(JSON.stringify(save),before,'2000 field projections must preserve saved RNG state');

console.log('PASS: Diling 100 encounter / NPC 35256 / original 90-equipment pool / guarded hypotheses / UI');
