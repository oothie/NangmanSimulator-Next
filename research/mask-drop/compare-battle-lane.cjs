#!/usr/bin/env node
'use strict';
/* Internal controlled before/after battle observer. NEVER reports input seed,
 * inventory, account identifiers, or any other private game-save fields.
 * A matched RNG transition proves numerical compatibility with a candidate
 * bound/draw count, NOT the identity of the battle's native drop consumer.
 */
const fs=require('node:fs');
const {draw,NPC}=require('../dungeon-lab/mask-7209-conditional.cjs');
const ALLOWED=new Set(Object.values(NPC));
function lane(save,key){
 const value=save?.Rnds?.Sds?.[key];
 return Number.isSafeInteger(value)&&value>0?value:null;
}
function compareBattleStates(before,after,{npc=NPC.mask,bounds=[100],maxCalls=3}={}){
 if(!ALLOWED.has(npc))throw RangeError('NPC is not a documented direct-drop level-70 candidate');
 if(!Array.isArray(bounds)||!bounds.length||bounds.length>20||
  bounds.some(n=>!Number.isSafeInteger(n)||n<1||n>1000000)||
  !Number.isInteger(maxCalls)||maxCalls<1||maxCalls>10)
  throw RangeError('Invalid conditional draw bounds');
 const a=lane(before,'aidrop70'),b=lane(after,'aidrop70');
 if(a==null||b==null)return {npc,usable:false,sharedLaneConfirmed:false,
  reason:'비교 전후 세이브에 해당 레벨 난수값이 모두 필요함'};
 const sourceA=before?.Rnds?.Sds||{},sourceB=after?.Rnds?.Sds||{};
 const changedOtherLanes=new Set([...Object.keys(sourceA),...Object.keys(sourceB)])
  .size ? [...new Set([...Object.keys(sourceA),...Object.keys(sourceB)])]
  .filter(key=>key!=='aidrop70'&&sourceA[key]!==sourceB[key]).length:0;
 const matches=[],changed=a!==b;
 if(!changed)matches.push({calls:0,bound:null});
 for(const bound of [...new Set(bounds)]){
  let seed=a;
  for(let calls=1;calls<=maxCalls;calls++){
   seed=draw(seed,bound).seed;
   if(seed===b)matches.push({calls,bound});
  }
 }
 return {
  npc,usable:true,changed,changedOtherLanes,
  matches,sharedLaneConfirmed:false,
  status:changed?
    '레벨 난수 변화 관찰 · 원본 호출 확인 필요':
    '레벨 난수 변화 없음 · 호출 조건 또는 다른 RNG 경로 확인 필요',
  warning:changedOtherLanes?
   '다른 RNG 경로도 변하여 단일 전투만으로 드랍 공유 확정 불가':
   '동일한 다른 난수 상태라도 다른 게임 상태 변화 배제 필요',
  privateInputsReported:false
 };
}
function readSave(file){
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 return Array.isArray(data)?data[0]:data;
}
if(require.main===module){
 const [, ,pre,post,npcArg]=process.argv;
 if(!pre||!post){
  console.error('Usage: node compare-battle-lane.cjs LOCAL_before.json LOCAL_after.json [30681|32950]');
  process.exitCode=2;
 }else{
  const npc=npcArg?Number(npcArg):NPC.mask;
  console.log(JSON.stringify(compareBattleStates(readSave(pre),readSave(post),{npc}),null,2));
 }
}
module.exports={compareBattleStates};
