// Read-only Korean before/after wash save checker and optional native WASM parity.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'engine/wash-save-compare.js'),'utf8'),ctx);
const compare=ctx.window.NangmanWashCompare;
const before={MainRole:{ID:1,Level:100,BornTalent:{S:100},LuckTalent:{S:300},
 TalLucky:8,RXiSui:18,Talents:[{ID:261,Lock:true},{ID:250,Lock:true},{ID:271,Lock:false}]}};
const after={MainRole:{ID:1,Level:100,BornTalent:{S:101},LuckTalent:{S:301},
 TalLucky:12,RXiSui:19,Talents:[{ID:261,Lock:true},{ID:250,Lock:true},{ID:272,Lock:false}]}};
const bs=JSON.stringify(before),as=JSON.stringify(after);
const result=compare.delta(before,after,1,{role_id:1,seed:101,
 talents:[{id:261,locked:true},{id:250,locked:true},{id:272,locked:false}]});
assert.equal(result.id,1);
assert.equal(result.cells.find(x=>x.field==='bornSeed').status,'변화 있음');
assert.equal(result.cells.find(x=>x.field==='slot3').before,271);
assert.equal(result.cells.find(x=>x.field==='slot3').after,272);
assert.equal(result.predicted.seedMatch,true);
assert.equal(result.predicted.slots[2].matches,true);
assert.equal(compare.delta(before,after,1,{role_id:2,seed:101}).predicted,null,
 'wrong selected role cannot be treated as predicted');
assert.equal(compare.delta(before,{...after,MainRole:{...after.MainRole,BornTalent:{}}},1).predicted,null);
assert.equal(JSON.stringify(before),bs);assert.equal(JSON.stringify(after),as);
assert.throws(()=>compare.delta(before,{MainRole:{ID:2}},1),/동일 캐릭터 ID/);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('./engine/wash-save-compare.js'));
assert(html.includes("['verify','실게임 검증']"));
assert(html.includes('id="washVerifyAfter"')&&html.includes('id="washVerifyRun"'));
assert(html.includes('NangmanWashCompare.delta(reference,actual,role.id,virtual)'));
assert(html.includes('state.lastState=restored'));
assert(html.includes('state.verifyReport=null'),'new save must invalidate old comparison');
console.log('PASS: real Korean wash save delta, per-slot locks and optional WASM result equality');
