/* v0.7.67 – local-only Diling before/after save delta inspector.
 * A changed RNG value proves consumption, NOT a specific gear drop.
 * Does not mutate source saves, depend on RNG ordering, or upload anything. */
(function(root){
'use strict';
const WATCH_SEEDS=['rollenemy_tomb','seed_35256'];
const WATCH_FLAGS=['3007','eat_2659','rollenemy_tomb2','treasure_hunting_cbt','get_history',
 'get3026_fdepot','fdepot3026','get3036_fdepot','fdepot3036','get_8801','xlrawtomb','get_8801_num'];
const GEAR_IDS=[4009,4209,4409,4609,4809,5009,5409,5609];
const SHARED_EQUIPMENT_ROLL_BOUND=99999999;
const usableSeed=seed=>Number.isSafeInteger(seed)&&seed>0;
function edsMap(save){
 const rnd=save.Rnds??save.rnds??save.m_tRands??save.RandData??{};
 return rnd.Eds??rnd.eds??{};
}
// The receipt stream is advanced once for each level-90 equipment creation,
// even if the equipment is white/green. Predictions are conditional on the
// unverified Diling reward/quality order and no other equipment events.
function modelEquipmentSeeds(before,gearRows){
 const source=edsMap(before);
 const projected=Object.fromEntries(GEAR_IDS.map(id=>[id,num(source[String(id)])]));
 const uses={};
 for(const row of gearRows){
  const id=Number(row.itemId);
  if(!GEAR_IDS.includes(id))continue;
  uses[id]=(uses[id]||0)+1;
  const seed=projected[id];
  if(usableSeed(seed))projected[id]=root.SBJWildDrop.draw(seed,SHARED_EQUIPMENT_ROLL_BOUND).seed;
 }
 return {projected,uses};
}
function preview(before,count){
 if(!Number.isInteger(count)||count<1||count>500)throw Error('사냥 횟수는 1~500회로 입력하세요.');
 const save=rootSave(before);
 const input=root.SBJTombDrop?.open(save);
 if(!input||!root.SBJTombDrop.ready(input)){
  const missing=[...input?.missingFlags||[]];
  if(!usableSeed(input?.encounterSeed))missing.unshift('rollenemy_tomb');
  if(!usableSeed(input?.equipmentSeed))missing.unshift('seed_35256');
  return {count,ready:false,missing,message:'제릉 예측에 필요한 값이 없습니다: '+missing.join(', ')};
 }
 const cases=['descending','ascending'].map(order=>{
  const trace=root.SBJTombDrop.trace(input,{count,order});
  const gear=trace.rows.filter(row=>row.color&&GEAR_IDS.includes(Number(row.itemId)));
  const eds=modelEquipmentSeeds(save,gear);
  return {order,rows:trace.rows,final:trace.final,gearCount:gear.length,
   spawnCount:trace.rows.filter(x=>x.spawn).length,eds};
 });
 return {count,ready:true,cases,gateUnknown:input.gate3007Unknown,
  baseline:{encounterSeed:input.encounterSeed,equipmentSeed:input.equipmentSeed,
   flag3007:input.flags.get('3007')??null,
   eat2659:input.flags.get('eat_2659')??null,
   rollenemyTomb2:input.flags.get('rollenemy_tomb2')??null}};
}
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
 const source=rootSave(before);
 if(!tomb?.trace)return {...observed,count,cases:[],message:'제릉 실험 엔진이 연결되지 않았습니다.'};
 const start=tomb.open(source);
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
  const gearRows=result.rows.filter(x=>x.color&&GEAR_IDS.includes(Number(x.itemId)));
  const predictedEds=modelEquipmentSeeds(source,gearRows);
  const actualEds=edsMap(end);
  const edsChecks=GEAR_IDS.map(id=>{
   const old=num(edsMap(source)[id]),expected=predictedEds.projected[id],
     actual=num(actualEds[id]),uses=predictedEds.uses[id]||0;
   return {id,uses,before:old,expected,actual,
    status:actual===null||expected===null?'누락':actual===expected?'일치':'불일치'};
  });
  const checks=Object.entries(forecast).map(([key,expected])=>{
   const actual=num(key==='rollenemy_tomb2'?endFlags[key]:endSeeds[key]);
   return {key,expected,actual,status:actual==null?'누락':actual===expected?'일치':'불일치'};
  });
  return {order,checks,edsChecks,
   edsUsed:edsChecks.filter(x=>x.uses>0),
   edsMatches:edsChecks.filter(x=>x.uses>0&&x.status==='일치').length,
   edsMismatches:edsChecks.filter(x=>x.uses>0&&x.status==='불일치').length,
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
  warnings:[...observed.warnings,
   '장비별 Eds 비교는 90레벨 일반 장비를 생성할 때마다 해당 ID 시드를 한 번 소비한다는 가정입니다. 사냥 사이에 다른 장비를 얻거나 제작·판매하면 결과 비교가 오염될 수 있습니다.',
   '가설 일치는 계산상 시드 재현일 뿐, 실제 장비 ID·색상·옵션의 적중 확정이 아닙니다.']};
}
root.SBJTombSaveCompare={diff,reconcile,preview,modelEquipmentSeeds,WATCH_SEEDS,WATCH_FLAGS,GEAR_IDS};
})(window);
