'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{}};vm.createContext(ctx);
for(const p of ['vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/dungeon-v3-inverse.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',p),'utf8'),ctx,{filename:p});
const {advance,reverseKey,inspect,measurement}=ctx.window.SBJDungeonInverse;
const initial=978587497,first=advance(initial,100),second=advance(first,3),last=advance(second,5);
const trace=[{key:'seed_byj',bound:100,context:'분기'},{key:'seed_byj',bound:5,context:'장비'}];
const normal=reverseKey(initial,advance(first,5),trace,{maxHidden:2});
assert.equal(normal.status,'candidates');
assert.equal(normal.solutions[0].hiddenCalls,0);
const hidden=reverseKey(initial,last,trace,{maxHidden:2,extraBounds:[3]});
assert.equal(hidden.status,'candidates');
assert(hidden.solutions.some(s=>s.hiddenCalls===1&&s.steps.some(x=>x.type==='unknown'&&x.bound===3)));
assert.equal(reverseKey(0,last,trace).status,'missing-seed');
const result=inspect({seeds:{seed_byj:initial}},
 {seeds:{seed_byj:last}},{trace},{extraBounds:[3],maxHidden:2});
assert.equal(result.unresolved.length,0);
const comp=measurement([{npcId:1,item:5009,color:1,supported:true},
 {npcId:2,item:4009,color:2,supported:true}],
 [{npc:1,item:5009,color:1},{npc:2,item:4009,color:3}]);
assert.equal(comp.matched,1);
assert.equal(comp.mismatches[0].npc,2);
assert.equal(comp.mismatches[0].expected.color,3);
// The fixture must never be used to overwrite actual predicted item/color.
assert.equal(comp.checks[1].predicted.color,2);
console.log('PASS reverse trace: unmodified results, shortest hidden-call path, end-seed check');
