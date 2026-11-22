'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../engine/yysim-save-state.js'),'utf8');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.window.YYWashSaveState;
const main={ID:10001,Name:'주인공',BornTalent:{S:13579,RC:10,ID:1001},
 LuckTalent:{S:2468},Talents:[{ID:271,Lock:true},{ID:184,Lock:false}],
 TalLucky:123,Level:100,ZiZhi:154,Sex:1,Str:100,Con:100,Dex:100,Int:100};
const ally={ID:10002,Name:'동료',BornTalent:{S:54321,RC:20,ID:1002},
 Talents:{"0":{ID:268,Lock:false},"1":{ID:202,Lock:true}},
 TalLucky:2,Level:90,ZiZhi:153,Sex:2};
const save=api.unwrap({data:{MainRole:main,Roles:{x:ally},Items:[{ID:2601,Num:200}],
 CenterID:278440,globalVariable:{saved:true}}});
const list=api.roles(save);
assert.equal(list.length,2);
assert.equal(list[0].id,10001);assert.equal(list[1].id,10002);
const initial={salt:100,other:'keep'};
const one=api.build(save,list[0],initial);
const two=api.build(save,list[1],initial);
assert.equal(one.seed,13579);assert.equal(two.seed,54321);
assert.equal(one.role_id,10001);assert.equal(two.role_id,10002);
assert.equal(one.luck_seed,2468);assert.equal(one.luck_seed_inited,true);
assert.equal(two.luck_seed_inited,false);
assert.deepEqual(Array.from(one.talents.map(x=>[x.id,x.locked])),[[271,true],[184,false]]);
assert.deepEqual(Array.from(two.talents.map(x=>[x.id,x.locked])),[[268,false],[202,true]]);
assert.equal(one.bag_pills,200);
assert.equal(two.other,'keep');
assert.equal(one.global_vars.saved,true);
assert.equal(save.MainRole.BornTalent.S,13579,'Cannot mutate source save');
assert.throws(()=>api.build(save,{raw:{ID:10003,BornTalent:{}}},initial),/BornTalent.S/);
assert.throws(()=>api.unwrap({notSave:true}),/MainRole/);
console.log('PASS: selected-character save-native RNG seeds, talents, lock status, and no mutation');
