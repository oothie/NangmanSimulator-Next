/* Korean Byeokyu source-model replay from the recovered 35227_1 entry.
 * Pure calculation rules; no account data, save samples or measured outcomes.
 * The original model consumes the colour roll even when equipment does not drop.
 */
/* Research-branch isolated copy for original special consumer integration. */
import {draw} from './dungeon.js';
const POOLS={35219:[4409,4209,4009,4609],35214:[4809,5009,5209,5409],
 35221:[4009,4209,4409,4609,4809,5009,5209,5409,5609]};
const NAMES={4009:'수라장갑',4209:'지수검',4409:'천운도',4609:'흑살곤',
 4809:'옥형 허리띠',5009:'자미아대',5209:'오잠보갑',5409:'청운반지',5609:'청운추'};
const GRADES={1:'백색',2:'녹색',3:'청색',4:'자색'};
const BOSS=[[35219,'독선생'],[35214,'미'],[35221,'불로선인']];
const COLOR=[[30,2],[5,4],[50,1],[15,3]];
const n=x=>{const v=Number(x?.Value??x?.value??x??0);return Number.isFinite(v)?v:0};
export function replayByeokyu(save,clears=1){
 if(!Number.isInteger(clears)||clears<1||clears>10)throw Error('벽유교는 1~10회 범위에서 계산합니다.');
 const initial=n(save?.Rnds?.Sds?.seed_byj);
 if(!Number.isSafeInteger(initial)||initial<1)throw Error('벽유교 실행 시드가 없습니다.');
 const branch=save?.Branch?.byj_bz;
 let seed=initial;
 const gv={...(save.globalVariable||{})};
 const output=[],sourceStep=branch&&typeof branch==='object'?Number(branch.step):NaN;
 for(let clear=1;clear<=clears;clear++){
  const win=n(gv.win_byj),specials={35219:[],35214:[],35221:[]},results=[];
  let calls=0;
  const rngTrace=[];
  const roll=bound=>{const result=draw(seed,bound);seed=result.seed;
   rngTrace.push({key:'seed_byj',bound,value:result.value});calls++;return result.value;};
  const choose=entries=>{
   let x=roll(entries.reduce((sum,e)=>sum+e[0],0));
   for(const [weight,value] of entries){x-=weight;if(x<=0)return value;}
   throw Error('벽유교 원본 가중치 계산 오류');
  };
  const special=(npc,id,flag,success)=>{
   if(success){gv[flag]=1;specials[npc].push(id);}else delete gv[flag];
  };
  const unique=(npc,id,threshold,gate=true)=>{
   if(!gate)return;
   const flag='drop_'+id+'_'+npc, x=roll(1000);
   special(npc,id,flag,x-win<=threshold&&!n(gv[flag]));
  };
  const accumulated=(npc,id,limit,onHit,onMiss)=>{
   const flag='drop_'+id+'_'+npc,counter='roll_'+id+'_'+npc,old=n(gv[counter]);
   const hit=roll(100)-old<limit;
   gv[counter]=old+(hit?onHit:onMiss);
   special(npc,id,flag,hit);
   return hit;
  };
  const equipment=(npc,boss)=>{
   const hit=choose([[50,true],[50,false]]);
   const slot=hit?roll(4):null;
   // Unlike Changok, Byeokyu always draws and stores a colour.
   const grade=choose(COLOR);
   if(slot===null)delete gv['drop_'+npc+'_equip'];
   else gv['drop_'+npc+'_equip']=slot;
   gv['drop_'+npc+'_color']=grade;
   const item=slot===null?null:POOLS[npc][slot-1];
   results.push({boss,name:item===null?'미드랍':NAMES[item],
    grade:item===null?'':GRADES[grade],itemId:item,gradeCode:grade,
    specialIds:specials[npc].slice()});
  };
  unique(35219,7264,70,win>2);
  unique(35219,7265,70);
  equipment(35219,'독선생');
  accumulated(35214,2922,45,-55,45);
  unique(35214,7262,50,win>10);
  unique(35214,7263,50,win>10);
  equipment(35214,'미');
  accumulated(35221,2923,45,-55,45);
  unique(35221,7267,50,win>5);
  unique(35221,7266,100);
  const precondition=win>=10&&!n(gv.glm_open);
  if(precondition&&!Number.isFinite(sourceStep))
   throw Error('귀용문 열쇠 조건을 계산하려면 벽유교 임무 단계가 포함된 세이브가 필요합니다.');
  const keyEnabled=precondition&&sourceStep<0;
  let keyHit=false;
  if(keyEnabled){
   const flag='drop_3970_35221',counter='roll_3970_35221',previous=n(gv[counter]);
   keyHit=roll(100)-previous<10;
   gv[counter]=previous+(keyHit?-50:10);
   special(35221,3970,flag,keyHit);
  }
  equipment(35221,'불로선인');
  gv.win_byj=win+1;
  output.push({clear,results,drawCount:calls,rngTrace,keyEnabled,keyHit,
   keyCondition:win<10?'벽유교 클리어 조건 미충족':
    n(gv.glm_open)?'귀용문 개방 완료':
    sourceStep>=0?'벽유교 임무 단계 조건 미충족':
    keyHit?'귀용문 열쇠 추첨 성공':'귀용문 열쇠 추첨 실패'});
 }
 return {gate:'벽유교',output,nextState:{...save,Rnds:{...(save.Rnds||{}),Sds:{...(save.Rnds?.Sds||{}),seed_byj:seed}},globalVariable:gv},source:'35227_1',warning:'귀용문 열쇠는 원본 추첨 조건 기반이며 실제 지급·퀘스트 진행 결과는 별개입니다.'};
}
