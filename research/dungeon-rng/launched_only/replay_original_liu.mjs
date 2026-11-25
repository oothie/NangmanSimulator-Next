/* Read-only Korean Liu manor RNG replay.
 * Port of the recovered 35271_1 source-derived v85 model, without account data.
 * All weighted table orders are the original v85 typed-key source model.
 * This is a source-model forecast, not a guarantee of the game's native LuaJIT order.
 */
import {draw} from './original_gate_rng.mjs';

const A_ORDER = [[6,2606],[3,2603],[8,2618],[5,2605],[2,2602],[11,2627],[1,2601],[7,2617],[4,2604],[9,2619],[10,2620]];
const MATERIALS = [[2601,800,300],[2602,150,150],[2603,4,30],[2604,4,30],
 [2605,4,30],[2606,4,30],[2617,3,30],[2618,3,30],[2619,3,30],
 [2620,3,30],[2627,2,80]];
const B_ORDER = [[304,8805,2],[303,8804,2],[302,8803,2],[301,8802,3]];
const C_ORDER = [[200,3029,6],[200,3028,12],[201,3025,4],[200,3035,4],[200,3030,2]];
const Y_COLOR = [[40,2],[5,4],[40,1],[15,3]];
const OTHER_COLOR = [[30,2],[5,4],[50,1],[15,3]];
const NAMES = {4009:'수라장갑',4209:'지수검',4409:'천운도',4609:'흑살곤',
 4809:'옥형 허리띠',5009:'자미아대',5209:'오잠보갑',5409:'청운반지',5609:'청운추'};
const POOLS = {
 '윤무':[5609,5409,5009],
 '고리':[4809,5209,5609,5409],
 '이뢰운':[4609,4409,4209,4009]
};
const GRADES = {1:'백색',2:'녹색',3:'청색',4:'자색'};
const number = v => {const n=Number(v??0);return Number.isFinite(n)?n:0;};
const quantity = (save,id) => (Array.isArray(save?.Items)?save.Items:[])
 .reduce((sum,item)=>sum+(number(item?.ID??item?.id)===id?
  Math.max(0,number(item?.Num??item?.num??item?.Count??item?.count??1)):0),0);

export function replayLiuManor(save,clears=1,keyMode='auto'){
 if(!Number.isInteger(clears)||clears<1||clears>10)throw Error('유씨별원은 1~10회만 계산할 수 있습니다.');
 const sourceSeed=number(save?.Rnds?.Sds?.seed_lsby);
 if(!Number.isSafeInteger(sourceSeed)||sourceSeed<1)throw Error('유씨별원 실행 시드를 찾을 수 없습니다.');
 const gv={...(save.globalVariable||{})};
 let seed=sourceSeed;
 const initialQuantity=quantity(save,8915);
 if(!['auto','retain','owned','absent'].includes(keyMode))
  throw Error('고리의 열쇠 보유 조건이 올바르지 않습니다.');
 // The numeric GetP(8915) branch is supplied from inventory, never from get_8915.
 // Awarded keys enter a local replay inventory; no input save object is mutated.
 let keyQty=keyMode==='owned'?Math.max(1,initialQuantity):
  keyMode==='absent'?0:initialQuantity;
 const output=[],keyTimeline=[];
 for(let clear=1;clear<=clears;clear++){
  const keyHeld=keyMode==='owned'?true:keyMode==='absent'?false:keyQty>0;
  const keyQtyAtStart=keyQty;
  const specials={윤무:[],고리:[],이뢰운:[]};
  const rows=[],trace=[];
  const win=number(gv.win_lsby);
  const rng=(name,bound)=>{
   if(!Number.isSafeInteger(bound)||bound<1)throw Error('원본 관문 가중치에 오류가 있습니다: '+name);
   const value=draw(seed,bound);seed=value.seed;trace.push({name,bound,value:value.value});return value.value;
  };
  const choose=(name,pairs)=>{
   const total=pairs.reduce((s,x)=>s+number(x[0]),0);
   const val=rng(name,total);
   let remain=val;
   for(const pair of pairs){remain-=pair[0];if(remain<=0)return pair[1];}
   throw Error('관문 원본 가중치 순회 오류: '+name);
  };
  const flag=(boss,id,name,passed)=>{
   if(passed){gv[name]=1;specials[boss].push(id);}
   else delete gv[name];
  };
  const accumulated=(boss,id,flagName,counter,limit,onHit,onMiss)=>{
   const old=number(gv[counter]),r=rng(boss+' 특수 '+id,100);
   const hit=r-old<limit;
   gv[counter]=old+(hit?onHit:onMiss);
   flag(boss,id,flagName,hit);
   return hit;
  };
  const equipment=(boss,pool,colorTable)=>{
   const hit=choose(boss+' 장비 여부',[[50,true],[50,false]]);
   const slot=hit?rng(boss+' 장비 슬롯',pool.length):null;
   // The source consumes a grade draw even on an equipment miss.
   const color=choose(boss+' 장비 색상',colorTable);
   const id=slot===null?null:pool[slot-1];
   rows.push({boss,name:id===null?'미드랍':NAMES[id],grade:id===null?'':GRADES[color],
     itemId:id,slot,gradeCode:color,specialIds:specials[boss].slice()});
  };
  // 35271 source steps 1-8: 윤무
  if(win>6){
   const r=rng('윤무 한정보상 5020',1000);
   flag('윤무',5020,'drop_5020_35260',r-win<=50&&!gv.drop_5020_35260);
  }
  equipment('윤무',POOLS['윤무'],Y_COLOR);

  // Steps 9-11: 고리, including the separate *numeric* GetP(8915) ownership guard.
  if(win>12)accumulated('고리',8913,'drop_8913_35264','roll_8913_35264',40,-60,40);
  if(win>8){
   const r=rng('고리 한정보상 5628',1000);
   flag('고리',5628,'drop_5628_35264',r-win<=50&&!gv.drop_5628_35264);
  }
  let newKey=false;
  if(win>10&&!keyHeld){
   newKey=accumulated('고리',8915,'drop_8915_35264','roll_8915_35264',20,-80,20);
  }
  // Steps 12-25: source material caps and three typed-key weighted rewards.
  for(let i=0;i<MATERIALS.length;i++){
   const [id,cap,weight]=MATERIALS[i];
   gv['drop_lsby_'+(i+1)]=number(gv['num_'+id+'_lsby'])>=cap?0:weight;
  }
  const a=choose('유씨별원 재료 A',A_ORDER.map(([idx,id])=>[gv['drop_lsby_'+idx],id]));
  gv['num_'+a+'_lsby']=number(gv['num_'+a+'_lsby'])+1;
  gv.name_drop_a=a;
  const b=choose('유씨별원 재료 B',B_ORDER.map(([w,id,num])=>[w,{id,num}]));
  gv.name_drop_b=b.id;gv.name_drop_b_num=b.num;
  const c=choose('유씨별원 재료 C',C_ORDER.map(([w,id,num])=>[w,{id,num}]));
  gv.name_drop_c=c.id;gv.name_drop_c_num=c.num;
  gv.name_drop_mishiloc=rng('고리 재료 위치',3)+2000;
  equipment('고리',POOLS['고리'],OTHER_COLOR);

  // Steps 29-33: 이뢰운 special counters, no-key nested material RNG, equipment.
  if(win>20)accumulated('이뢰운',8914,'drop_8914_35268','roll_8914_35268',45,-55,45);
  if(win>12)accumulated('이뢰운',8917,'drop_8917_35268','roll_8917_35268',30,-70,30);
  const previousMaterial=number(gv.roll_35268);
  if(previousMaterial<0||previousMaterial>120)
   throw Error('이뢰운 재료 누적치가 원본 재생 범위를 벗어났습니다.');
  const materialWon=choose('이뢰운 재료 성공 여부',
   [[previousMaterial,true],[120-previousMaterial,false]]);
  if(materialWon){gv.roll_35268=0;gv.drop_35268_material=1;}
  else {gv.roll_35268=previousMaterial+40;delete gv.drop_35268_material;}
  // On success the nested material-kind table has no seed key; do not
  // consume an invented seed_lsby roll for that table.
  equipment('이뢰운',POOLS['이뢰운'],OTHER_COLOR);
  gv.win_lsby=win+1;
  // The restored award consumer grants one key only if this clear generated a
  // fresh success flag. Historical drop_8915_35264 or get_8915 are not receipts.
  // Unlike ordinary limited rewards, this consumer has no get_8915 purchase cap.
  const received=newKey?1:0;
  let consumedByAssumption=0;
  if(keyMode==='auto'||keyMode==='absent'){
   keyQty+=received;
   // Scenario rule, not a claim that game used the key automatically.
   consumedByAssumption=keyQty;
   keyQty=0;
  }else if(keyMode==='retain'){
   keyQty+=received;
  }else{
   keyQty=keyQtyAtStart;
  }
  const keyState={clear,heldAtStart:keyHeld,quantityAtStart:keyQtyAtStart,
   newKey,received,consumedByAssumption,quantityAfter:keyQty,
   heldAfter:keyMode==='owned'?true:keyQty>0,drawCount:trace.length};
  output.push({clear,results:rows,drawCount:trace.length,materials:{a,b:b.id,c:c.id},
   keyHit:newKey,keyAwarded:received===1,keyState});
  keyTimeline.push(keyState);
 }
 return {gate:'유씨별원',output,keys:keyTimeline,source:'35271_1-v85',initialKeyQty:initialQuantity,
  warning:'원본 재생 기반 조건부 예측입니다. 열쇠 획득 후 보유·사용은 선택한 시나리오로만 반영됩니다.'};
}
