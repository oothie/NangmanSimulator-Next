/* One-time dungeon reward ownership: save records + opt-in prior completion.
 * Never mutate the actual imported save. Only unique equipment is covered by
 * the through-Liu completion shortcut; repeatable fragments are NOT blocked. */
(function(root){
'use strict';
const throughLiu=['trm','tyj','kgm','ywf','dcy','byj','lsby'];
const list=()=>root.DAILY_DATA?.dungeons||[];
const equipment=()=>root.EQUIP_DATA?.equipment||{};
const isUniqueEquipment=op=>Number(op?.cap)===1&&!!equipment()[Number(op.item)];
const oneTimeOps=()=>list().flatMap(d=>(d.ops||[]).filter(op=>op.t==='uniq'&&
  isUniqueEquipment(op)).map(op=>({...op,dungeonId:d.id})));
const completedIds=()=>new Set(oneTimeOps().filter(op=>
  throughLiu.includes(op.dungeonId)).map(op=>Number(op.item)));
const flagNum=(flags,key)=>Number(flags?.get(key)||0);
function reason(input,op,options={}){
 if(!isUniqueEquipment(op))return '';
 const id=Number(op.item),flags=input?.flags;
 if(options.throughLiuCompleted&&completedIds().has(id))
   return '유씨별원까지 전용 주황 장비 획득 완료';
 if(input?.owned?.has(id))return '보유 중';
 if(flagNum(flags,op.gotKey)>0||flagNum(flags,'get_'+id)>0)
   return '과거 획득 기록';
 // Some client exports persist the one-time receipt in the drop flag.
 if(flagNum(flags,op.flag)>=2)return '전용 장비 획득 완료 기록';
 return '';
}
function blocked(input,id,options={}){
 const ops=oneTimeOps().filter(op=>Number(op.item)===Number(id));
 if(!ops.length)return '';
 return ops.map(op=>reason(input,op,options)).find(Boolean)||'';
}
function preventExisting(input,vars,options={}){
 for(const op of oneTimeOps()){
  if(reason(input,op,options)){
   // Native route checks flag==0 before allowing a one-time reward.
   // Use a local replay map only; the original save is never changed.
   vars.set(op.flag,2);
  }
 }
}
function filterRewards(input,items,options={}){
 const results=[];
 for(const id of items||[]){
  if(!blocked(input,id,options))results.push(Number(id));
 }
 return results;
}
root.SBJDungeonUniqueOwnership={
 oneTimeOps,completedIds,isUniqueEquipment,reason,blocked,preventExisting,filterRewards
};
})(window);
