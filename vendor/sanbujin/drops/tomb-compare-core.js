/* v0.7.67 – local-only Diling before/after save delta inspector.
 * A changed RNG value proves consumption, NOT a specific gear drop.
 * Does not mutate source saves, depend on RNG ordering, or upload anything. */
(function(root){
'use strict';
const WATCH_SEEDS=['rollenemy_tomb','seed_35256'];
const WATCH_FLAGS=['3007','eat_2659','rollenemy_tomb2','treasure_hunting_cbt','get_history',
 'get3026_fdepot','fdepot3026','get3036_fdepot','fdepot3036','get_8801','xlrawtomb','get_8801_num'];
const GEAR_IDS=[4009,4209,4409,4609,4809,5009,5409,5609];
const num=value=>{
 const raw=value?.Value??value?.value??value?.V??value?.v??value?.Num??value?.num??value;
 const n=Number(raw);
 return raw==null||!Number.isFinite(n)?null:n;
};
function rootSave(value){
 const save=Array.isArray(value)?value[0]:value;
 if(!save||typeof save!=='object'||Array.isArray(save))throw Error('세이브 JSON 최상위 객체 형식을 확인하세요.');
 return save;
}
function seedMap(save){
 const rnd=save.Rnds??save.rnds??save.m_tRands??save.RandData??{};
 return rnd.Sds??rnd.sds??rnd.Seeds??rnd.seeds??{};
}
function flagMap(save){
 const raw=save.globalVariable??save.GlobalVariable??save.GlobalVariables??save.GlobalVars??{};
 if(Array.isArray(raw))return Object.fromEntries(raw.map(x=>[
  String(x?.Key??x?.key??x?.Name??x?.name??''),num(x?.Value??x?.value??x?.Num??x?.num??x?.V??x?.v)
 ]).filter(([key])=>key));
 return raw&&typeof raw==='object'?raw:{};
}
function diff(before,after){
 const a=rootSave(before),b=rootSave(after),s1=seedMap(a),s2=seedMap(b);
 const g1=flagMap(a),g2=flagMap(b);
 const change=(key,from,to)=>({key,before:from,after:to,
  status:from===null||to===null?'데이터 누락':from===to?'변화 없음':'변화 있음'});
 const seeds=WATCH_SEEDS.map(key=>change(key,num(s1[key]),num(s2[key])));
 const flags=WATCH_FLAGS.map(key=>change(key,num(g1[key]),num(g2[key])));
 const streamChanges=seeds.filter(x=>x.status==='변화 있음');
 const warnings=[];
 if(seeds.some(x=>x.status==='데이터 누락'))warnings.push('제릉 RNG 시드 누락: 해당 시드의 소비 여부를 판정할 수 없습니다.');
 if(streamChanges.length)warnings.push('시드 변화는 난수 소비를 뜻할 뿐, 장비 획득이나 특정 회차의 특수몹 출현을 입증하지 않습니다.');
 if(!streamChanges.length)warnings.push('두 세이브 사이 시드가 동일하거나 확인되지 않았습니다. 전투·드랍 여부를 단정할 수 없습니다.');
 warnings.push('다른 활동·시드 초기화·아이템 판매·장비 제작이 포함되었다면 제릉 사냥만의 효과를 분리할 수 없습니다.');
 return {seeds,flags,streamChanges,gearPool:GEAR_IDS,warnings};
}
function reconcile(before,after,count){
 if(!Number.isInteger(count)||count<1||count>500)throw Error('사냥 횟수는 1~500회로 입력하세요.');
 const observed=diff(before,after),tomb=root.SBJTombDrop;
 if(!tomb?.trace)return {...observed,count,cases:[],message:'제릉 실험 엔진이 연결되지 않았습니다.'};
 const start=tomb.open(rootSave(before));
 if(!tomb.ready(start))return {...observed,count,cases:[],
  message:'사냥 전 세이브의 제릉 난수 시드나 필수 조건 변수가 누락되어 예측 가설을 비교할 수 없습니다.'};
 const end=rootSave(after),endSeeds=seedMap(end),endFlags=flagMap(end);
 const cases=['descending','ascending'].map(order=>{
  const result=tomb.trace(start,{count,order});
  const forecast={
   rollenemy_tomb:result.final.encounterSeed,
   seed_35256:result.final.equipmentSeed,
   rollenemy_tomb2:result.final.flags.rollenemy_tomb2
  };
  const checks=Object.entries(forecast).map(([key,expected])=>{
   const actual=num(key==='rollenemy_tomb2'?endFlags[key]:endSeeds[key]);
   return {key,expected,actual,status:actual==null?'누락':actual===expected?'일치':'불일치'};
  });
  return {order,checks,
   matches:checks.filter(x=>x.status==='일치').length,
   mismatches:checks.filter(x=>x.status==='불일치').length,
   missing:checks.filter(x=>x.status==='누락').length,
   forecastEvents:result.rows.filter(x=>x.spawn).length,
   forecastGear:result.rows.filter(x=>x.color).map(x=>({serial:x.serial,id:x.itemId,color:x.color}))};
 });
 const matching=cases.filter(x=>x.mismatches===0&&x.missing===0);
 const conclusion=matching.length===1?'한 가지 계산 가설만 관측 시드와 일치합니다. 다른 활동이 없었는지 확인해야 합니다.':
  matching.length===2?'두 가설 모두 시드와 일치합니다. 이 자료만으로 분기 순서를 구분할 수 없습니다.':
  matching.length===0?'두 가설 모두 관측 시드를 설명하지 못하거나 필수 시드가 누락됐습니다.':
  '분기 순서를 판정할 수 없습니다.';
 return {...observed,count,cases,conclusion,
  warnings:[...observed.warnings,'가설 일치는 계산상 시드 재현일 뿐, 실제 장비 ID·색상·옵션의 적중 확정이 아닙니다.']};
}
root.SBJTombSaveCompare={diff,reconcile,WATCH_SEEDS,WATCH_FLAGS,GEAR_IDS};
})(window);
