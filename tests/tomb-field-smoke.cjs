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
const secondary=Array.from(tomb.predict(open,{count:8,order:'ascending'}));
assert.equal(secondary.length,8,'comparison hypothesis available');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const ui=fs.readFileSync(path.join(dir,'wild.js'),'utf8');
assert(html.includes('src="./tomb-core.js"')&&html.indexOf('tomb-core.js')<html.indexOf('src="./wild.js"'));
assert(html.includes('id="wildTombOrder"')&&ui.includes('tomb.predict(input,'));
console.log('PASS: Diling 100 encounter / NPC 35256 / original 90-equipment pool / guarded hypotheses / UI');
