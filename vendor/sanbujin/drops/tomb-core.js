/* Korean 60014 source-lab v29 reconstruction: Diling ordinary outdoor-field encounters (not a tomb dungeon).
 * NOT real-server-verified: Lua pairs() reward ordering remains two hypotheses.
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
 const global=save.globalVariable??save.GlobalVariable??save.GlobalVariables??save.GlobalVars??{};
 const flags=new Map(Array.isArray(global)?
  global.map(x=>[String(x?.Key??x?.key??x?.Name??x?.name),number(x)]) :
  Object.entries(global).map(([key,value])=>[String(key),number(value)]));
 return {equipmentSeed:number(seeds.seed_35256),encounterSeed:number(seeds.rollenemy_tomb),
  flags,gate3007Unknown:!flags.has('3007') || !Number.isFinite(flags.get('3007')),
  missingFlags:required.filter(key=>!flags.has(key)||!Number.isFinite(flags.get(key)))};
}
function ready(input){
 return !!input&&usable(input.equipmentSeed)&&usable(input.encounterSeed)&&input.missingFlags.length===0;
}
function simulate(input,options={}){
 if(!ready(input))throw Error('제릉의 등장/보상 시드 및 필수 세이브 변수가 필요합니다.');
 const pad=options.pad??0,count=options.count??30,order=options.order??'descending';
 if(!Number.isInteger(pad)||pad<0||pad>500||!Number.isInteger(count)||count<1||count>500)
  throw Error('선행 사냥 0~500회, 예측 1~500회로 입력하세요.');
 if(!['descending','ascending'].includes(order))throw Error('제릉 분기 순서가 올바르지 않습니다.');
 const vars=new Map(input.flags);let encounterSeed=input.encounterSeed,equipmentSeed=input.equipmentSeed;
 const rows=[];
 function select(entries){
  const sorted=[...entries].sort((a,b)=>order==='descending'?b.weight-a.weight:a.weight-b.weight);
  const roll=draw(equipmentSeed,sorted.reduce((sum,item)=>sum+item.weight,0));
  equipmentSeed=roll.seed;
  let value=roll.value;
  return sorted.find(item=>(value-=item.weight)<=0);
 }
 for(let i=0;i<pad+count;i++){
  const row={serial:i+1,padding:i<pad,kind:'tomb',spawn:false,encounterNpc:source.encounterNpc};
  // Preserve the original level gate only when that flag is explicitly saved.
  // An absent flag must never be silently coerced into a made-up value.
  if(vars.has('3007') && vars.get('3007')<6){
   row.reason='제릉 조건 3007 미충족 · 일반 전투';rows.push(row);continue;
  }
  const encounter=draw(encounterSeed,1000);encounterSeed=encounter.seed;
  row.encounterRoll=encounter.value;
  row.spawn=encounter.value-vars.get('eat_2659')*10<=vars.get('rollenemy_tomb2');
  vars.set('rollenemy_tomb2',vars.get('rollenemy_tomb2')+(row.spawn?-200:100));
  if(row.spawn){
   row.npcId=source.specialNpc;
   const reward=select(source.reward);row.rewardKind=reward.kind;
   if(reward.kind==='equipment'){
    const quality=select(source.color),id=draw(equipmentSeed,source.pool.length);
    equipmentSeed=id.seed;
    row.color=quality.color;
    row.itemId=source.pool[id.value-1];
    row.dropLevel=90;
   }else if(reward.kind==='other'){
    const other=select(source.other);
    if(other.itemId==='history'){
     const value=vars.get('get_history');
     if(Number.isInteger(value)&&value>=0&&value<6){
      row.itemId=8903+value;vars.set('get_history',value+1);
     }else row.reason='기록 보상 · 진행 변수 미확인 또는 수집 완료';
    }else{
     row.itemId=other.itemId;
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
 rows.final={encounterSeed,equipmentSeed,flags:Object.fromEntries(vars)};
 rows.order=order;
 return rows;
}
function trace(input,options){
 const rows=simulate(input,options);
 return {rows,final:rows.final,order:rows.order};
}
root.SBJTombDrop={source,open,ready,predict:simulate,trace};
})(window);
