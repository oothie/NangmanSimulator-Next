/* Korean Changok source-model from recovered 40389_1 entry.
 * Calculation mechanism only: no private save, seed, character or test fixture.
 */
/* Research-branch isolated copy for original special consumer integration. */
import {draw} from './original_gate_rng.mjs';
const POOLS={40372:[4609,4809,5009,5409,5609],
 40373:[4009,4809,5009,5409,5609],40374:[4009,4809,5009,5409,5609]};
const NAMES={4009:'수라장갑',4209:'지수검',4409:'천운도',4609:'흑살곤',
 4809:'옥형 허리띠',5009:'자미아대',5209:'오잠보갑',5409:'청운반지',5609:'청운추'};
const GRADES={1:'백색',2:'녹색',3:'청색',4:'자색'};
const COLOR=[[30,2],[5,4],[50,1],[15,3]];
const MATERIAL={
 40372:[[2601,1000,1000],[2603,6,25],[2604,6,25],[2605,6,25],
  [2606,6,25],[2607,1000,1000],[2641,100,80]],
 40373:[[3025,1500,1000],[3029,500,500],[3030,500,500],
  [2000,100,50],[2001,100,50],[2002,100,50]]
};
const MATERIAL_ORDER={
 40372:[0,5,2,7,4,1,6,3],
 40373:[6,4,0,1,5,2,3]
};
const BOSS=[[40372,'무준신'],[40373,'이장'],[40374,'장정']];
const n=x=>{const v=Number(x?.Value??x?.value??x??0);return Number.isFinite(v)?v:0};
export function replayChangok(save,clears=1){
 if(!Number.isInteger(clears)||clears<1||clears>10)throw Error('창옥은 1~10회 범위에서 계산합니다.');
 const seeds={...(save?.Rnds?.Sds||{})},gv={...(save?.globalVariable||{})},output=[];
 for(let clear=1;clear<=clears;clear++){
  const win=n(gv.win_dcy),specials={40372:[],40373:[],40374:[]},results=[];
  let calls=0;
  const roll=(npc,bound)=>{
   const key='seed_dcy_'+npc,seed=n(seeds[key]);
   if(!Number.isSafeInteger(seed)||seed<1||!Number.isSafeInteger(bound)||bound<1)
    throw Error('창옥 원본 시드·가중치를 확인할 수 없습니다.');
   const next=draw(seed,bound);seeds[key]=next.seed;calls++;return next.value;
  };
  const choose=(npc,entries)=>{
   const total=entries.reduce((sum,e)=>sum+e[0],0);
   let x=roll(npc,total);
   for(const [weight,value] of entries){x-=weight;if(x<=0)return value;}
   throw Error('창옥 원본 가중치 계산 오류');
  };
  const flag=(npc,id,yes)=>{
   const key='drop_'+id+'_'+npc;
   if(yes){gv[key]=1;specials[npc].push(id);}else delete gv[key];
  };
  const rare=(npc,id,offset,threshold)=>{
   const name='drop_'+id+'_'+npc,x=roll(npc,1000);
   flag(npc,id,x-offset<threshold&&!n(gv[name]));
  };
  const accum=(npc,id,limit,onHit,onMiss)=>{
   const key='roll_'+id+'_'+npc,old=n(gv[key]),hit=roll(npc,1000)-old<limit;
   gv[key]=old+(hit?onHit:onMiss);
   flag(npc,id,hit);
  };
  const material=(npc)=>{
   const choices=MATERIAL[npc];
   const weights=choices.map(([item,cap,weight])=>n(gv['num_'+item+'_'+npc])<cap?weight:0);
   const entries=MATERIAL_ORDER[npc].map(index=>index===0?[200,null]:
    [weights[index-1],choices[index-1][0]]);
   const item=choose(npc,entries);
   if(item===null)delete gv['name_drop_'+npc];
   else{
    gv['num_'+item+'_'+npc]=n(gv['num_'+item+'_'+npc])+1;
    gv['name_drop_'+npc]=item;
   }
  };
  const equipment=(npc,boss)=>{
   const hit=choose(npc,[[50,true],[50,false]]);
   const slot=hit?roll(npc,5):null;
   const grade=slot===null?0:choose(npc,COLOR);
   if(slot===null)delete gv['drop_'+npc+'_equip'];
   else{gv['drop_'+npc+'_equip']=slot;gv['drop_'+npc+'_color']=grade;}
   const item=slot===null?null:POOLS[npc][slot-1];
   results.push({boss,name:item===null?'미드랍':NAMES[item],
    grade:item===null?'':GRADES[grade],itemId:item,slot,gradeCode:grade,
    specialIds:specials[npc].slice()});
  };
  // Original source steps 6–18: 무준신
  rare(40372,4634,win*2,51);
  rare(40372,9072,win,41);
  rare(40372,3523,win,201);
  accum(40372,2924,400,-600,400);
  material(40372);equipment(40372,'무준신');
  // Original steps 19–29: 이장
  rare(40373,4820,win*2,51);
  rare(40373,9072,win,41);
  accum(40373,2926,300,-700,400);
  material(40373);equipment(40373,'이장');
  // Original steps 30–35: 장정
  rare(40374,5218,win*2,51);
  rare(40374,9072,win,41);
  rare(40374,8295,win,41);
  rare(40374,7165,win,21);
  accum(40374,2925,400,-600,400);
  equipment(40374,'장정');
  // Original consumer clears the awarded 몰우전 flag after production.
  if(n(gv.drop_3523_40372)===1)gv.drop_3523_40372=0;
  gv.win_dcy=win+1;
  output.push({clear,results,drawCount:calls});
 }
 return {gate:'창옥',output,source:'40389_1',
  warning:'원본 계산에 따른 조건부 결과이며 장비 및 특수 보상의 미래 적중을 보장하지 않습니다.'};
}
