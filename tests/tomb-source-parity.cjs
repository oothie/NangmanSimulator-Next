// Independent 60014-source v29 RNG sequence parity; does NOT prove live Korean drop accuracy.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'..','vendor','sanbujin','drops'),ctx={window:{}};
vm.createContext(ctx);
for(const file of ['wild-core.js','tomb-core.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),ctx);
const tomb=ctx.window.SBJTombDrop;
const POOL=[4009,4209,4409,4609,4809,5009,5409,5609];
const cats=[{id:'equipment',w:40},{id:'other',w:25},{id:'none',w:35}];
const colors=[{id:1,w:6490},{id:2,w:3000},{id:3,w:500},{id:4,w:10}];
const others=[{id:'history',w:6000},{id:8802,w:2000},{id:3026,w:900},{id:3036,w:900},{id:8801,w:200}];
function rand(seed,bound){
 const value=(BigInt(seed)+BigInt(bound))*245109059551232n+48083817484545n;
 const raw=(BigInt.asUintN(64,value)>>17n)&2147483647n;
 const next=Number(raw%2047483645n+1n);
 return {next,roll:next%bound+1};
}
function independent(save,count,order){
 let spawnSeed=save.Rnds.Sds.rollenemy_tomb,lootSeed=save.Rnds.Sds.seed_35256;
 let luck=save.globalVariable.rollenemy_tomb2,history=save.globalVariable.get_history;
 const values=[];
 const roll=(key,bound)=>{
  const result=rand(key==='spawn'?spawnSeed:lootSeed,bound);
  if(key==='spawn')spawnSeed=result.next;else lootSeed=result.next;
  return result.roll;
 };
 const choose=list=>{
  const items=[...list].sort((a,b)=>order==='descending'?b.w-a.w:a.w-b.w);
  let hit=roll('loot',items.reduce((a,x)=>a+x.w,0));
  return items.find(x=>(hit-=x.w)<=0).id;
 };
 for(let i=0;i<count;i++){
  const spawnRoll=roll('spawn',1000),spawn=spawnRoll<=luck;
  luck+=spawn?-200:100;
  const row={spawn,encounterRoll:spawnRoll,itemId:0,color:0,rewardKind:null};
  if(spawn){
   row.rewardKind=choose(cats);
   if(row.rewardKind==='equipment'){
    row.color=choose(colors);
    row.itemId=POOL[roll('loot',8)-1];
   }else if(row.rewardKind==='other'){
    const which=choose(others);
    if(which==='history'){
     row.itemId=history>=0&&history<6?8903+history++:0;
    }else row.itemId=which;
   }
  }
  values.push(row);
 }
 return {values,spawnSeed,lootSeed,luck};
}
for(const seed of [1,4721,1900002,2047483644]){
 for(const order of ['descending','ascending']){
  const saved={Rnds:{Sds:{rollenemy_tomb:seed,seed_35256:seed+50}},
    globalVariable:{3007:6,eat_2659:0,rollenemy_tomb2:450,get_history:0,treasure_hunting_cbt:0}};
  const original=JSON.stringify(saved);
  const expected=independent(saved,40,order);
  const actual=tomb.trace(tomb.open(saved),{count:40,order});
  const observed=Array.from(actual.rows,x=>({spawn:x.spawn,
   encounterRoll:x.encounterRoll,itemId:x.itemId||0,color:x.color||0,rewardKind:x.rewardKind||null}));
  assert.deepEqual(observed,expected.values,'source mathematical simulation parity: '+seed+' '+order);
  assert.equal(actual.final.encounterSeed,expected.spawnSeed);
  assert.equal(actual.final.equipmentSeed,expected.lootSeed);
  assert.equal(actual.final.flags.rollenemy_tomb2,expected.luck);
  assert.equal(JSON.stringify(saved),original);
 }
}
console.log('PASS: independent original-source v29 Diling RNG sequence parity for 8 cases × 40 battles');
