'use strict';
// Time-variable audit: from the actual Sanbujin wild-core paths.
// A timestamp is an option-seed input ONLY for non-persistent aidrop items.
// The 90-grade Saibei/Shifang special NPC path uses Rnds.Eds[itemId].
// Diling uses stored reward seeds plus the same Eds option stream assumption.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const p of ['vendor/sanbujin/shared/equip_data.js',
 'vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/wild-data.js',
 'vendor/sanbujin/drops/tomb-core.js']){
 vm.runInContext(fs.readFileSync(path.join(base,p),'utf8'),ctx,{filename:p});
}
const {SBJWildDrop:wild,SBJTombDrop:tomb,SBJWildCatalog:targets}=ctx.window;
const eq=ctx.EQUIP_DATA.equipment;
const ids=r=>[...r.map(x=>[x.itemId||0,x.color||0])];
const timeA=1795260046,timeB=1795280046;
const early={seed:123456789,sds:{},eds:{}},earlyTarget={kind:'aidrop',seedKey:'demo',
 drop:[{id:4001,weight:100,isEquip:true}]};
const ea=wild.predictWithState(early,earlyTarget,{pad:0,count:200,time:timeA,interval:30},eq).rows;
const eb=wild.predictWithState(early,earlyTarget,{pad:0,count:200,time:timeB,interval:30},eq).rows;
assert.deepEqual(ids(ea),ids(eb),'low-level aidrop item and color do not change with time');
assert(ea.some((x,i)=>JSON.stringify(x.affixes||[])!==JSON.stringify(eb[i].affixes||[])),
 'at least one timestamp-seeded early equipment affix should differ');
const story=targets.find(x=>x.npcId===32299);
assert(story&&story.kind==='story');
const equips=[4009,4209,4409,4609,4811,5015,5213,5420,5616];
const eds=Object.fromEntries(equips.map(id=>[String(id),245317680]));
const state={seed:1367952423,sds:{},eds};
const storyA=wild.predictWithState(state,story,{pad:0,count:80,time:timeA,interval:20},eq);
const storyB=wild.predictWithState(state,story,{pad:0,count:80,time:timeB,interval:20},eq);
assert.deepEqual(ids(storyA.rows),ids(storyB.rows),'high-level special monster rewards ignore time');
assert.deepEqual([...storyA.rows.map(x=>x.affixes||[])],[...storyB.rows.map(x=>x.affixes||[])],
 'high-level special monster affixes use Eds, not battle clock');
const tombSave={Rnds:{Sds:{rollenemy_tomb:1456365169,seed_35256:492075794},
 Eds:{4009:245317680}},globalVariable:{eat_2659:9,rollenemy_tomb2:200}};
const before=JSON.stringify(tombSave),tombInput=tomb.open(tombSave);
const tA=tomb.predict(tombInput,{count:30,order:'candidateD',time:timeA});
const tB=tomb.predict(tombInput,{count:30,order:'candidateD',time:timeB});
assert.deepEqual(ids(tA),ids(tB),'Diling reward order must not use clock');
assert.equal(tA[9].itemId,4009);
assert.equal(tA[9].color,1);
assert(tA[9].sharedEdsTracked,'Diling item 4009 option-stream should be tracked');
assert.equal(JSON.stringify(tombSave),before,'no save mutation');
console.log('PASS: low-level time alters some affixes only; Saibei reward+Eds and Diling ignore wall-clock time');
