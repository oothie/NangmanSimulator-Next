/* Run: node tests/yy-combat-smoke.cjs
 * Artificial fixture only. Never commit real save files to the public repository.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({console});
ctx.window=ctx;
function load(file){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:20000});
}
load('vendor/sanbujin/shared/equip_data.js');
load('vendor/yysim/life_hedao_data.js');
load('vendor/yysim/data.js');
load('vendor/yysim/extra_attr_data.js');
load('vendor/yysim/kongfu_data.js');
ctx.NANGMAN_YY_KONGFU_DATA=ctx.KONGFU_DATA;
ctx.KONGFU_DATA={nei:{legacyMarker:true}};
load('engine/yysim-combat-original.js');
assert.equal(ctx.NangmanYYCombat.hasSourceData(),true);
assert.ok(ctx.KONGFU_DATA.nei.legacyMarker,'sanbujin martial global must remain unchanged');
const role={
 ID:1,Level:90,Age:20,Str:200,Con:250,Dex:150,Int:140,
 BornStr:25,BornCon:35,BornDex:25,BornInt:20,
 StrGift:200,ConGift:200,DexGift:200,IntGift:200,
 GrowAttack:18,GrowHp:42,GrowDefence:8,GrowHit:4,GrowDodge:3,GrowSpeed:2,GrowRen:1.5,
 StrAtk:2,ConHp:5,DexDodge:3,DexSpeed:2,ConRen:1.5,IntMpFirst:0.2,
 Taolus:[],Neis:[],Qings:[],Talents:[],Equips:[],JingMais:[],
 LifeSkills:[],LifeProps:[],HeDaoSkill:[]
};
const values=ctx.NangmanYYCombat.compute(role,[role],{zhenPoParry:0});
const expected={hp:4676,atk:1959,def:732,hit:450,dodge:727,speed:578,parry:138,ren:252,mp_first:28};
for(const [key,value] of Object.entries(expected))assert.equal(values[key],value,key);
assert.ok(values.body&&values.equip&&values.xiuwei&&values.talent);
assert.equal(ctx.KONGFU_DATA.nei.legacyMarker,true);
console.log('yy-sim original combat engine smoke: PASS ('+Object.keys(expected).length+' stats)');
