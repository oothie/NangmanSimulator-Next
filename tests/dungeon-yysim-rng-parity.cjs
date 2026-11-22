'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const home=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
const files=[
 'vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/dungeon-data.js',
 'vendor/sanbujin/drops/dungeon-orange.js',
 'vendor/yysim/daily_data.js',
 'vendor/sanbujin/drops/dungeon-yysim-adapter.js',
 'vendor/sanbujin/drops/dungeon-core.js',
 'vendor/sanbujin/drops/dungeon-names-ko.js',
 'vendor/sanbujin/drops/dungeon-rates.js'
];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(home,file),'utf8'),ctx,{filename:file});
const w=ctx.window,engine=w.SBJDungeonDrop,catalog=w.SBJDungeonYYAdapter.fullCatalog(w.SBJDungeonCatalog);
const byId=id=>catalog.find(x=>x.id===id);
assert.equal(catalog.filter(x=>x.supplement).length,7);
assert(byId('drop_35221_equip'),'yy-sim Biyou last boss must be included');
assert(byId('drop_50980_equip'),'yy-sim Martial Assembly bosses must be included');
assert.equal(w.NangmanDungeonKoreanNames[5422],'성화반지');
assert.equal(w.NangmanDungeonKoreanNames[4009],'수라장갑');
const yan=byId('drop_33650_equip');
assert.equal(yan.source,'yy-sim');
assert.deepEqual(Array.from(yan.outer,x=>x[0]),['equip','none'],
 'native RNG slot order must not be changed to yy-sim display order');
assert.deepEqual(Array.from(yan.color,x=>x[0]),[4,1,3,2]);
const rates=w.SBJDungeonRates.rate(yan);
assert.equal(rates.equip,0.5);
assert(Math.abs(rates.colors[3].prob-5/110)<1e-12);
assert.equal(rates.items.length,9);
const tyj=byId('drop_33858_equip');
assert.deepEqual(Array.from(tyj.outer,x=>x[0]),['equip','none','none'],
 'the yy-sim 10-weight middle branch is not shown as a weapon');
assert.equal(w.SBJDungeonRates.rate(tyj).none,0.6);
const seeds={};
for(const e of catalog.filter(x=>x.outer))if(e.outerSeed)seeds[e.outerSeed]=978587497;
const save={Rnds:{Sds:seeds,Eds:{}},globalVariable:{win_ywf:20,win_byj:9,win_byjzt:12}};
const saved=JSON.stringify(save),input=engine.open(save);
const prince=engine.predict(input,yan,3);
assert(prince.every(x=>x.nativeReplay));
assert.equal(prince.length,3);
assert.deepEqual(Array.from(prince,x=>[x.item,x.color]),[[0,0],[4209,2],[4209,1]]);
const special=w.DAILY_DATA.dungeons.find(d=>d.id==='ywf').ops.find(x=>x.flag==='drop_5422_33650');
const cond=w.SBJDungeonRates.probability(special,input);
assert(Math.abs(cond.base-0.04)<1e-12);
assert(Math.abs(cond.real-0.08)<1e-12,'20 boss counter increases current probability');
const gated=engine.open({Rnds:{Sds:seeds},globalVariable:{win_ywf:0}});
assert.equal(w.SBJDungeonRates.probability(special,gated).real,0);
const full=[35219,35214,35221].map(n=>byId('drop_'+n+'_equip'));
const seq=engine.predictSequence(input,full);
assert(seq.every(x=>x.nativeReplay),'complete boss sequence uses original scripted special RNG');
const uncertain=engine.open({Rnds:{Sds:seeds},globalVariable:{win_byj:12}});
const partial=engine.predictSequence(uncertain,full);
assert(partial.every(x=>!x.nativeReplay),'missing story branch must never be guessed');
assert.equal(JSON.stringify(save),saved,'read only; never write save');
console.log('PASS yy-sim boss rates + seven missing bosses + Korean names + native RNG + quest rollback');
