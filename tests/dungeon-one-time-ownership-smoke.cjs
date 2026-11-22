'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx={window:{}};
vm.createContext(ctx);
const engine=ctx.window;
const scripts=[
 'vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/dungeon-data.js',
 'vendor/sanbujin/drops/dungeon-orange.js',
 'vendor/yysim/daily_data.js',
 'vendor/sanbujin/drops/dungeon-names-ko.js',
 'vendor/sanbujin/drops/dungeon-yysim-adapter.js'
];
for(const p of scripts)vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
const equipmentCtx={};vm.createContext(equipmentCtx);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/sanbujin/shared/equip_data.js'),'utf8'),equipmentCtx);
engine.EQUIP_DATA=equipmentCtx.EQUIP_DATA;
for(const p of [
 'vendor/sanbujin/drops/dungeon-unique-ownership.js',
 'vendor/sanbujin/drops/dungeon-core.js',
 'vendor/sanbujin/drops/dungeon-dual-core.js'
])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
const owned=engine.SBJDungeonUniqueOwnership;
const empty={flags:new Map(),owned:new Set()};
assert.equal(owned.completedIds().size,21);
assert(owned.completedIds().has(5422),'Yan Wang unique ring');
assert(owned.completedIds().has(5020),'Liu mansion unique equipment');
assert(!owned.completedIds().has(9438),'later dungeon rewards remain eligible');
assert(!owned.completedIds().has(2364),'regular one-time quest materials excluded from override');
assert.equal(owned.blocked(empty,5422,{throughLiuCompleted:true}),
 '유씨별원까지 전용 주황 장비 획득 완료');
assert.equal(owned.blocked(empty,5422,{}),'');
assert.equal(owned.blocked(empty,2364,{throughLiuCompleted:true}),'');
assert.equal(owned.blocked({flags:new Map([['get_5422',1]]),owned:new Set()},5422),
 '과거 획득 기록');
assert.equal(owned.blocked({flags:new Map(),owned:new Set([5422])},5422),
 '보유 중');
assert.equal(owned.blocked({flags:new Map([['drop_5422_33650',2]]),owned:new Set()},5422),
 '전용 장비 획득 완료 기록');
assert.equal(owned.blocked({flags:new Map([['get_2926',10]]),owned:new Set()},2926),
 '획득 상한 10개 충족','maximum collected fragments must no longer be forecast');
assert.equal(owned.blocked({flags:new Map([['get_9072_40372',1]]),owned:new Set()},9072),
 '과거 획득 기록','historical boss-specific drop receipts must suppress one-time rewards');
assert.equal(owned.blocked({flags:new Map([['get_2920',1]]),owned:new Set()},2920),'',
 'repeatable fragments must not be permanently blocked');
assert.equal(owned.blocked({flags:new Map([['get_2364',1]]),owned:new Set()},2364),
 '과거 획득 기록');
const flags=new Map(),preserved=JSON.stringify([...flags]);
owned.preventExisting(empty,flags,{throughLiuCompleted:true});
assert.equal(flags.get('drop_5422_33650'),2);
assert.equal(flags.has('drop_9438_44122'),false);
assert.equal(JSON.stringify([...empty.flags]),preserved);
assert.equal(owned.filterRewards(empty,[5422,9438,2364],{throughLiuCompleted:true}).join(','),
 '9438,2364');
const liuInput=engine.SBJDungeonDrop.open({Rnds:{Sds:{seed_lsby:978587497}},
 globalVariable:{win_lsby:15}});
const liuNpcs=[35260,35264,35268];
const liuCatalogue=engine.SBJDungeonYYAdapter.fullCatalog(engine.SBJDungeonCatalog);
const liuEvents=liuNpcs.map(id=>liuCatalogue.find(e=>e.id==='drop_'+id+'_equip'));
const liuReplay=engine.SBJDungeonDrop.predictSequence(liuInput,liuEvents);
assert(liuReplay.every(row=>row.nativeReplay),
 'original Liu manor 2001-2003 SeedRandom path must be executable');
const all=engine.SBJDungeonYYAdapter.fullCatalog(engine.SBJDungeonCatalog);
const seeds={};for(const e of all.filter(e=>e.outer))if(e.outerSeed)seeds[e.outerSeed]=978587497;
const save={Rnds:{Sds:seeds,Eds:{}},globalVariable:{win_ywf:20,win_byj:9}};
const sourceJSON=JSON.stringify(save),input=engine.SBJDungeonDrop.open(save);
const yan=engine.DAILY_DATA.dungeons.find(x=>x.id==='ywf');
for(const confirmed of [true,false]){
 const forecast=engine.SBJDungeonDual.compare(input,yan,all,engine.SBJDungeonCatalog,
  {throughLiuCompleted:confirmed});
 assert.equal(forecast.yy.rows.length,4);
 assert.equal(forecast.san.rows.length,4);
 if(confirmed)for(const row of forecast.san.rows)for(const id of row.specialDrops||[]){
  assert(!owned.completedIds().has(id),'completed one-time orange cannot drop again');
 }
}
assert.equal(JSON.stringify(save),sourceJSON,'imported save must remain untouched');
const html=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/index.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/dungeon-dual.js'),'utf8');
assert(html.includes('id="dungeonThroughLiuCompleted" checked'));
assert(html.includes('dungeon-unique-ownership.js'));
assert(ui.includes('throughLiuCompleted'));
console.log('PASS one-time orange ownership: inventory, prior get flag, 21 through-Liu items, repeatable fragment, separate engines, save immutable');
