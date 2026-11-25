/* Yanwangfu 33381_1 source-model replay, including original typed-key order,
 * conditional special draws, dynamic material table and nested equipment grade.
 * Independent future-game accuracy is not guaranteed. Contains no save data.
 */
import {draw} from './original_gate_rng.mjs';
const EQUIP={
 '이총관':[4209,4809,5009,5409,5609],
 '하상':[4409,4809,5009,5209,5609],
 '엽내관':[4009,4809,5009,5409,5609],
 '연왕':[4009,4209,4409,4609,4809,5009,5209,5409,5609]
};
const NAMES={4009:'수라장갑',4209:'지수검',4409:'천운도',4609:'흑살곤',
 4809:'옥형 허리띠',5009:'자미아대',5209:'오잠보갑',5409:'청운반지',5609:'청운추'};
const GRADES={1:'백색',2:'녹색',3:'청색',4:'자색'};
const MAT_IDS=[2601,2602,2603,2604,2605,2606,2628,3735,3736];
const CAPS=[1000,100,5,5,5,5,100,5,1];
const WEIGHTS=[300,150,25,25,25,25,100,120,30];
const MATERIAL_ORDER=[8,0,5,2,7,4,1,9,6,3]; // 0=unconditional weight 200
const GRADE_ORDER=[[30,2],[5,4],[50,1],[15,3]];
const KING_GRADE=[[5,4],[44,1],[16,3],[45,2]];
const n=x=>{const v=Number(x??0);return Number.isFinite(v)?v:0;};

export function replayYanwangfu(save,clears=1){
 if(!Number.isInteger(clears)||clears<1||clears>10)throw Error('연왕부는 1~10회만 계산할 수 있습니다.');
 const seeds={...(save?.Rnds?.Sds||{})},gv={...(save?.globalVariable||{})},output=[];
 const r=(npc,bound)=>{
  const key='seed_'+npc,seed=n(seeds[key]);
  if(!Number.isSafeInteger(seed)||seed<1||!Number.isSafeInteger(bound)||bound<1)
   throw Error('연왕부 원본 시드·가중치를 확인할 수 없습니다.');
  const next=draw(seed,bound);seeds[key]=next.seed;
  count++;return next.value;
 };
 let count=0;
 const weighted=(npc,entries)=>{
  let roll=r(npc,entries.reduce((s,a)=>s+a[0],0));
  for(const [w,v] of entries){roll-=w;if(roll<=0)return v;}
  throw Error('연왕부 원본 가중치 범위 초과');
 };
 for(let clear=1;clear<=clears;clear++){
  const before=count,win=n(gv.win_ywf),specials={이총관:[],하상:[],엽내관:[],연왕:[]};
  const results=[];
  const flag=(boss,id,yes,field)=>{
   if(yes){gv[field]=1;specials[boss].push(id);}
   else delete gv[field];
  };
  const rare=(boss,id,npc,bound,gate,condition)=>{
   if(!gate)return;
   const field='drop_'+id+'_'+npc,val=r(npc,bound);
   flag(boss,id,condition(val)&&!n(gv[field]),field);
  };
  const accum=(boss,id,npc,bound,limit,onYes,onNo)=>{
   const counter='roll_'+id+'_'+npc,flagName='drop_'+id+'_'+npc;
   const prior=n(gv[counter]),val=r(npc,bound),yes=val-prior<limit;
   gv[counter]=prior+(yes?onYes:onNo);flag(boss,id,yes,flagName);
  };
  const equipment=(boss,npc,king=false)=>{
   const pick=npc===33652?
    weighted(npc,[[50,'equipment'],[10,'special'],[40,'none']]):
    weighted(npc,[[50,'equipment'],[50,'none']]);
   const hit=pick==='equipment';
   if(npc===33652){
    if(pick==='special'){gv.drop_3505_33652=1;specials['엽내관'].push(3505);}
    else delete gv.drop_3505_33652;
   }
   const slot=hit?r(npc,EQUIP[boss].length):null;
   const color=slot===null?0:weighted(npc,king?KING_GRADE:GRADE_ORDER);
   const item=slot===null?null:EQUIP[boss][slot-1];
   results.push({boss,name:item===null?'미드랍':NAMES[item],
    grade:item===null?'':GRADES[color],itemId:item,slot,gradeCode:color,
    specialIds:specials[boss].slice()});
  };
  rare('이총관',2364,33654,1000,win>=3,val=>val-win<=50);
  for(let i=0;i<MAT_IDS.length;i++){
   const item=MAT_IDS[i];
   if(n(gv['num_'+item+'_33654'])>=CAPS[i])delete gv['drop_33654_'+(i+1)];
   else gv['drop_33654_'+(i+1)]=WEIGHTS[i];
  }
  const entries=MATERIAL_ORDER.map(i=>i===0?[200,null]:
   [n(gv['drop_33654_'+i]),MAT_IDS[i-1]]);
  const selected=weighted(33654,entries);
  if(selected!==null){gv['num_'+selected+'_33654']=n(gv['num_'+selected+'_33654'])+1;gv.name_drop_33654=selected;}
  else delete gv.name_drop_33654;
  equipment('이총관',33654);
  rare('하상',2364,33653,1000,win>=7,val=>val-win<=50);
  rare('하상',4422,33653,1000,win>=4,val=>val-win*2<=50);
  accum('하상',2921,33653,1000,400,-600,400);
  equipment('하상',33653);
  rare('엽내관',2364,33652,1000,win>=12,val=>val-win<=50);
  accum('엽내관',2918,33652,1000,400,-600,400);
  rare('엽내관',5618,33652,1000,win>=10,val=>val-win*2<=50);
  equipment('엽내관',33652);
  rare('연왕',2364,33650,1000,win>=16,val=>val-win<=50);
  rare('연왕',7081,33650,1000,win>=20,val=>val-win<=10);
  accum('연왕',2920,33650,100,50,-50,50);
  rare('연왕',5422,33650,1000,win>=12,val=>val-win*2<=40);
  equipment('연왕',33650,true);
  gv.win_ywf=win+1;
  output.push({clear,results,drawCount:count-before});
 }
 return {gate:'연왕부',output,nextState:{...save,Rnds:{...(save.Rnds||{}),Sds:seeds},globalVariable:gv},source:'33381_1-v29',warning:'기존 원본 재생 기반 예측이며 미래 관문 실측과 일치함을 보장하지 않습니다.'};
}
