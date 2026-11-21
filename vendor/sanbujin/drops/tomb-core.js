/* Korean 60014 reconstruction: Diling ordinary outdoor-field encounters (not a tomb dungeon).
 * The 2026-11-21 1121.json empirical order reproduces equipment/color at hunts 8, 12, 21 and the side reward at 20.
 * This fitted order remains distinct from a proof of the game's native pairs() traversal.
 * NPC 35255 is the ordinary field trigger; only special NPC 35256 conditionally rolls level-90 equipment.
 * Read only, no game-save mutation. */
(function(root){
'use strict';
const source={encounterNpc:35255,specialNpc:35256,level:100,dropLevel:90,
 pool:[4009,4209,4409,4609,4809,5009,5409,5609],
 reward:[{kind:'equipment',weight:40},{kind:'other',weight:25},{kind:'none',weight:35}],
 color:[{color:1,weight:6490},{color:2,weight:3000},{color:3,weight:500},{color:4,weight:10}],
 other:[{itemId:'history',weight:6000},{itemId:8802,weight:2000},
        {itemId:3026,weight:900},{itemId:3036,weight:900},{itemId:8801,weight:200}]};
const draw=root.SBJWildDrop.draw,usable=root.SBJWildDrop.usable;
const number=value=>Number(value?.Value??value?.value??value?.V??value?.v??value?.Num??value?.num??value);
// 3007 is an optional story/progression condition, not a mandatory RNG key.
// Korean 2026-11-21 save has valid rollenemy_tomb/seed_35256 streams and
// eat_2659/rollenemy_tomb2 despite no globalVariable['3007'].
// Do not invent a value for absent 3007 or block the entire simulator.
const required=['eat_2659','rollenemy_tomb2'];
function open(archive){
 const save=Array.isArray(archive)?archive[0]:archive||{};
 const rnd=save.Rnds??save.rnds??save.m_tRands??save.RandData??{};
 const seeds=rnd.Sds??rnd.sds??rnd.Seeds??rnd.seeds??{};
 const eds=rnd.Eds??rnd.eds??{};
 const global=save.globalVariable??save.GlobalVariable??save.GlobalVariables??save.GlobalVars??{};
 const flags=new Map(Array.isArray(global)?
  global.map(x=>[String(x?.Key??x?.key??x?.Name??x?.name),number(x)]) :
  Object.entries(global).map(([key,value])=>[String(key),number(value)]));
 return {equipmentSeed:number(seeds.seed_35256),encounterSeed:number(seeds.rollenemy_tomb),eds,
  flags,gate3007Unknown:!flags.has('3007') || !Number.isFinite(flags.get('3007')),
  missingFlags:required.filter(key=>!flags.has(key)||!Number.isFinite(flags.get(key)))};
}
function ready(input){
 return !!input&&usable(input.equipmentSeed)&&usable(input.encounterSeed)&&input.missingFlags.length===0;
}
function simulate(input,options={}){
 if(!ready(input))throw Error('제릉의 등장/보상 시드 및 필수 세이브 변수가 필요합니다.');
 const pad=options.pad??0,count=options.count??30,order=options.order??'verified';
 if(!Number.isInteger(pad)||pad<0||pad>500||!Number.isInteger(count)||count<1||count>500)
  throw Error('선행 사냥 0~500회, 예측 1~500회로 입력하세요.');
 const orderNames=['verified','descending','ascending','candidateC','candidateD'];
 if(!orderNames.includes(order)&&!options.rewardOrder&&!options.colorOrder)
  throw Error('제릉 분기 순서가 올바르지 않습니다.');
 // Lua pairs() traversal is not necessarily a weight sort. The empirical
 // 2026-11-21 10th-hunt receipt (item 4009, white) rules out both pure sorts.
 // These candidates are examples, NOT proof of the correct LuaJIT hash order.
 const configured={
  verified:{reward:['other','equipment','none'],color:[2,1,4,3]},
  descending:{reward:['equipment','none','other'],color:[1,2,3,4]},
  ascending:{reward:['other','none','equipment'],color:[4,3,2,1]},
  candidateC:{reward:['none','equipment','other'],color:[2,1,3,4]},
  candidateD:{reward:['none','other','equipment'],color:[2,1,3,4]}
 };
 const plan=configured[order]||configured.verified;
 function validPermutation(values,reference){
  return Array.isArray(values)&&values.length===reference.length&&
    values.every(v=>reference.includes(v))&&new Set(values).size===reference.length;
 }
 const rewardOrder=options.rewardOrder||plan.reward,colorOrder=options.colorOrder||plan.color;
 if(!validPermutation(rewardOrder,source.reward.map(x=>x.kind))||
    !validPermutation(colorOrder,source.color.map(x=>x.color)))
  throw Error('보상·색상 분기 배열은 원본 가중치 항목을 중복 없이 포함해야 합니다.');
 const rewardEntries=rewardOrder.map(kind=>source.reward.find(x=>x.kind===kind));
 const colorEntries=colorOrder.map(color=>source.color.find(x=>x.color===color));
 const vars=new Map(input.flags);let encounterSeed=input.encounterSeed,equipmentSeed=input.equipmentSeed;
 const eds={...(input.eds||{})},sameIdCounts=new Map();
 const rows=[];
 function select(entries){
  const roll=draw(equipmentSeed,entries.reduce((sum,item)=>sum+item.weight,0));
  equipmentSeed=roll.seed;
  let value=roll.value;
  return entries.find(item=>(value-=item.weight)<=0);
 }
 for(let i=0;i<pad+count;i++){
  const row={serial:i+1,padding:i<pad,kind:'tomb',spawn:false,encounterNpc:source.encounterNpc,
   unit:'35255_event_call'};
  // Preserve the original level gate only when that flag is explicitly saved.
  // An absent flag must never be silently coerced into a made-up value.
  if(vars.has('3007') && vars.get('3007')<6){
   row.reason='제릉 조건 3007 미충족 · 일반 전투';rows.push(row);continue;
  }
  const encounter=draw(encounterSeed,1000);encounterSeed=encounter.seed;
  row.encounterRoll=encounter.value;
  row.rollenemyTomb2Before=vars.get('rollenemy_tomb2');
  row.eat2659Before=vars.get('eat_2659');
  row.effectiveRoll=encounter.value-row.eat2659Before*10;
  row.spawn=row.effectiveRoll<=row.rollenemyTomb2Before;
  vars.set('rollenemy_tomb2',row.rollenemyTomb2Before+(row.spawn?-200:100));
  row.rollenemyTomb2After=vars.get('rollenemy_tomb2');
  if(row.spawn){
   row.npcId=source.specialNpc;
   const reward=select(rewardEntries);row.rewardKind=reward.kind;
   if(reward.kind==='equipment'){
    const quality=select(colorEntries),id=draw(equipmentSeed,source.pool.length);
    equipmentSeed=id.seed;
    row.color=quality.color;
    row.itemId=source.pool[id.value-1];
    row.dropLevel=90;
    const cfg=options.equipment?.[String(row.itemId)];
    if(cfg)row.itemName=cfg.koName||cfg.name;
    // Shared 90-grade gear option stream, as in the verified Saibei/Shifang
    // special-monster branch. This is not timestamp seeded and has no
    // influence on this reward's item ID or color. No affix values claimed.
    const key=String(row.itemId),saved=number(eds[key]);
    row.sameItemOrder=(sameIdCounts.get(key)||0)+1;
    sameIdCounts.set(key,row.sameItemOrder);
    if(usable(saved)){
      const gearRoll=draw(saved,99999999);
      eds[key]=gearRoll.seed;
      row.sharedEdsTracked=true;
      if(cfg)row.affixes=root.SBJWildDrop.generateAffixes(cfg,row.color,gearRoll.value);
    }else{
      row.sharedEdsTracked=false;
    }
   }else if(reward.kind==='other'){
    const other=select(source.other);
    if(other.itemId==='history'){
     const value=vars.get('get_history');
     if(Number.isInteger(value)&&value>=0&&value<6){
      row.itemId=8903+value;vars.set('get_history',value+1);
     }else row.reason='기록 보상 · 진행 변수 미확인 또는 수집 완료';
    }else{
     row.itemId=other.itemId;
     if(other.itemId===8802)row.itemName='청선익';
     // Source v29: these flags are game progression, never additional RNG draws.
     if(other.itemId===3026 && Number.isFinite(vars.get('get3026_fdepot'))){
      vars.set('get3026_fdepot',vars.get('get3026_fdepot')+1);
      vars.set('fdepot3026',1);
     }else if(other.itemId===3036 && Number.isFinite(vars.get('get3036_fdepot'))){
      vars.set('get3036_fdepot',vars.get('get3036_fdepot')+1);
      vars.set('fdepot3036',1);
     }else if(other.itemId===8801 && Number.isFinite(vars.get('xlrawtomb')) &&
      Number.isFinite(vars.get('get_8801_num'))){
      vars.set('get_8801',1);
      vars.set('xlrawtomb',vars.get('xlrawtomb')+1);
      vars.set('get_8801_num',vars.get('get_8801_num')+1);
     }else if(other.itemId===3026||other.itemId===3036||other.itemId===8801){
      row.reason='일부 전리품 후속 상태를 계산할 필수 진행 변수 누락';
      row.partial=true;
     }
    }
   }
   if(vars.get('treasure_hunting_cbt')===5){
    vars.set('treasure_hunting_cbt',3);
    row.extraItemId=9415;
   }else if(!vars.has('treasure_hunting_cbt'))row.partial=true;
  }
  rows.push(row);
 }
 // A modelled final state is for comparing alternative hypotheses against two
 // real saves. It is not confirmation that Lua pairs() uses either ordering.
 rows.final={encounterSeed,equipmentSeed,eds,flags:Object.fromEntries(vars)};
 rows.order=order;
 rows.model='empirical-1121-20261121';
 rows.rewardOrder=[...rewardOrder];
 rows.colorOrder=[...colorOrder];
 return rows;
}
function permutations(values){
 if(values.length===1)return [[values[0]]];
 return values.flatMap((value,i)=>permutations(values.filter((_,j)=>j!==i)).map(rest=>[value,...rest]));
}
// Enumerate all 3! reward-class × 4! color-class traversal orders.
// This is exploratory model selection, not a guarantee that the original
// LuaJIT traversal falls within these 144 variants.
function fitObservations(input,observations,options={}){
 const list=Array.isArray(observations)?observations:[observations];
 if(!ready(input))throw Error('제릉 분기 후보를 탐색할 세이브 시드가 없습니다.');
 if(list.length>100)throw Error('관측 기록은 최대 100개까지 입력하세요.');
 const tests=list.map(row=>({
  serial:Number(row.serial),itemId:row.itemId==null?null:Number(row.itemId),
  color:row.color==null?null:Number(row.color),
  spawn:row.spawn==null?null:Boolean(row.spawn),
  noGearBefore:row.noGearBefore===true
 }));
 if(tests.some(x=>!Number.isInteger(x.serial)||x.serial<1||x.serial>500||
   x.itemId!=null&&!Number.isInteger(x.itemId)||
   x.color!=null&&![1,2,3,4].includes(x.color)))
  throw Error('관측 회차와 장비 ID·색상을 확인하세요.');
 const horizon=Math.max(Number(options.count)||0,...tests.map(x=>x.serial));
 if(!Number.isInteger(horizon)||horizon<1||horizon>500)
  throw Error('탐색 범위는 1~500회입니다.');
 const matches=[],all=[];
 for(const rewardOrder of permutations(source.reward.map(x=>x.kind))){
  for(const colorOrder of permutations(source.color.map(x=>x.color))){
   const rows=simulate(input,{count:horizon,rewardOrder,colorOrder});
   const passed=tests.every(t=>{
    const row=rows[t.serial-1];
    return (t.itemId==null||Number(row.itemId||0)===t.itemId)&&
      (t.color==null||Number(row.color||0)===t.color)&&
      (t.spawn==null||row.spawn===t.spawn)&&
      (!t.noGearBefore||rows.slice(0,t.serial-1).every(x=>!x.color));
   });
   const data={rewardOrder,colorOrder,rows};
   all.push(data);
   if(passed)matches.push(data);
  }
 }
 return {tested:all.length,matches,count:horizon,observations:tests};
}
// IMPORTANT: The source producer describes 35255 field encounter -> walk
// event -> conditional 35256 NPC. There is currently NO verified mapping
// from a user's N ordinary outdoor combats to N invocations of this event.
// This diagnostic reports event-call numbers, not guaranteed battle numbers.
// It does not alter seeds or infer an offset from observations.
function traceEncounterCalls(input,count=50){
 if(!ready(input))throw Error('제릉 조우 진단용 원본 시드와 변수 누락');
 if(!Number.isInteger(count)||count<1||count>500)
  throw Error('원본 제릉 조우 호출 진단은 1~500회까지 가능합니다.');
 // Event-gate only: no seed_35256, reward, color, equipment or unrelated
 // progression variables are read/advanced. Pure call sequence diagnostic.
 const flags=new Map(input.flags);
 let encounterSeed=input.encounterSeed;
 const encounters=[];
 for(let call=1;call<=count;call++){
  const row={
   call,spawn:false,encounterRoll:null,effectiveRoll:null,
   thresholdBefore:null,thresholdAfter:null,
   requiresProgressionCheck:input.gate3007Unknown,reason:null
  };
  if(flags.has('3007')&&flags.get('3007')<6){
   row.reason='진행 조건 3007 미충족: 이 35256 경로를 실행하지 않음';
   encounters.push(row);
   continue;
  }
  const hit=draw(encounterSeed,1000);
  encounterSeed=hit.seed;
  row.encounterRoll=hit.value;
  row.thresholdBefore=flags.get('rollenemy_tomb2');
  row.effectiveRoll=hit.value-flags.get('eat_2659')*10;
  row.spawn=row.effectiveRoll<=row.thresholdBefore;
  row.thresholdAfter=row.thresholdBefore+(row.spawn?-200:100);
  flags.set('rollenemy_tomb2',row.thresholdAfter);
  encounters.push(row);
 }
 return {
  units:'35255_event_calls_not_field_battles',
  count,gate3007Unknown:input.gate3007Unknown,encounters,
  finalEncounterSeed:encounterSeed
 };
}
function trace(input,options){
 const rows=simulate(input,options);
 return {rows,final:rows.final,order:rows.order};
}
root.SBJTombDrop={source,open,ready,predict:simulate,trace,fitObservations,traceEncounterCalls};
})(window);
