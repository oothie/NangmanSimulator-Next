// Same RNG key must advance across distinct dungeon bosses in actual planned order.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const ctx={window:{}};vm.createContext(ctx);
for(const file of ['wild-core.js','dungeon-core.js','dungeon-data.js'])
 vm.runInContext(fs.readFileSync(path.join(root,'vendor/sanbujin/drops',file),'utf8'),ctx);
const api=ctx.window.SBJDungeonDrop;
const sample=id=>({
 id,dungeon:'벽유교',boss:id,outer:[['equip',50],['none',50]],outerSeed:'seed_byj',
 color:[[1,50],[4,5],[3,15],[2,30]],colorSeed:'seed_byj',nested:false,
 equip:{ids:[4009,4209,4409],seed:'seed_byj',max:3,random:true},
 weapon:{ids:[],seed:'seed_byj',max:0,random:false}
});
const first=sample('A'),second=sample('B');
const state={seeds:{seed_byj:2}};
const before=JSON.stringify(state);
const run=api.predictSequence(state,[first,second]);
assert.equal(run.length,2);
assert.equal(run[0].item,4009);
assert.equal(run[1].item,0,'second boss must inherit RNG used by first boss');
assert.equal(run[1].eventId,'B');
const reset=api.predict(state,second,1);
assert.equal(reset[0].item,4009,'independent reset incorrectly predicts same first item');
assert.equal(JSON.stringify(state),before,'dungeon projection does not modify save');
assert.deepEqual(Array.from(api.predictSequence(state,[first]),x=>[x.item,x.color]),
 Array.from(api.predict(state,first,1),x=>[x.item,x.color]),
 'one-event sequence retains original independent behavior');
assert.throws(()=>api.predictSequence(state,[first,{...second,outerSeed:'missing'}]),/난수 시드/);
assert.throws(()=>api.predictSequence(state,[]),/1~500/);
const catalog=ctx.window.SBJDungeonCatalog;
const byj=catalog.filter(x=>x.outer&&x.outerSeed==='seed_byj');
assert(byj.length>=2,'original extracted BiYouJiao bosses actually share seed_byj');
const html=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/index.html'),'utf8');
const frontend=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/dungeon.js'),'utf8');
for(const id of ['dungeonSequencePlan','dungeonSequenceRun','dungeonSequenceExport','dungeonSequenceResults'])
 assert(html.includes(id),'new ordered dungeon controls include '+id);
assert(frontend.includes('engine.predictSequence(input,events)'));
assert(frontend.includes('Nangman_Dungeon_Shared_Boss_Sequence'));
console.log('PASS: shared dungeon RNG across ordered bosses, original one-boss parity, missing seeds and Korean CSV UI');
