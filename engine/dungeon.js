// Read-only Sanbujin reference dungeon predictor.
// Pure JS port of supplied APK drops/wild-core.js draw/choose and drops/dungeon-core.js.
// Never mutates a save; not a validated Korean field/drop-affix predictor.
const MOD=2047483645n;
function value(v){return Number(v?.Value??v?.value??v?.V??v?.v??v?.Num??v?.num??v)}
function usable(x){return Number.isSafeInteger(x)&&x>0}
export function draw(seed,bound){
 if(!usable(seed)||!usable(bound))throw Error('세이브 드랍 시드 또는 가중치가 유효하지 않습니다.');
 const state=BigInt.asUintN(64,(BigInt(seed)+BigInt(bound))*245109059551232n+48083817484545n);
 const next=Number((state>>17n)&2147483647n)%2047483645+1;
 return {seed:next,value:next%bound+1};
}
export function choose(seed,weights){
 const values=weights.map(Number),total=values.reduce((a,b)=>a+b,0);
 if(!usable(total))throw Error('잘못된 드랍 가중치');
 const result=draw(seed,total);
 let left=result.value,index=0;
 for(;index<values.length;index++){left-=values[index];if(left<=0)break}
 return {seed:result.seed,index:Math.min(index,values.length-1)};
}
export function readDropState(save){
 const root=Array.isArray(save)?save[0]:save;
 const r=root?.Rnds??root?.rnds??root?.m_tRands??root?.RandData??root?.randData??{};
 const s=r.Sds??r.sds??r.Seeds??r.seeds??{};
 return {seeds:s,root,source:Object.keys(r).length?'Rnds':'not-found'};
}
export function missingSeeds(state,event){
 const keys=new Set([event.outerSeed,event.colorSeed,event.equip?.seed,event.weapon?.seed]);
 return [...keys].filter(k=>k&&!usable(value(state.seeds?.[k])));
}
export function predictDungeon(input,event,count=8){
 if(!event)throw Error('관문/보스를 선택하세요.');
 count=Number(count);
 if(!Number.isInteger(count)||count<1||count>100)throw Error('횟수는 1–100회 범위여야 합니다.');
 const bad=missingSeeds(input,event);if(bad.length)throw Error('세이브에 필요한 시드가 없습니다: '+bad.join(', '));
 const advanced=new Map();
 function next(key,weights,bound){
  const seed=advanced.get(key)??value(input.seeds[key]);
  const rolled=weights?choose(seed,weights):draw(seed,bound);
  advanced.set(key,rolled.seed);
  return weights?rolled.index:rolled.value;
 }
 const outer=event.outer.map(x=>x[1]),color=event.color.map(x=>x[1]),result=[];
 for(let index=1;index<=count;index++){
  const kind=event.outer[next(event.outerSeed,outer)][0];
  const pool=event[kind];
  const item=pool?.ids?.[pool.random?next(pool.seed,null,pool.max)-1:pool.max-1]||0;
  const rollColor=!event.nested||kind==='equip'||kind==='weapon'&&event.colorSeed;
  const colorNum=rollColor?event.color[next(event.colorSeed,color)][0]:0;
  result.push({index,kind,item,color:item?colorNum:0});
 }
 return result;
}
// This engine is a reference model. In the Korean game, global drop streams
// shared across field/90+ dungeon events may require additional advancement.
export const colorLabels={0:'미드랍',1:'백색',2:'녹색',3:'청색',4:'자색',5:'주황색'};
