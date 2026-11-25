#!/usr/bin/env node
'use strict';
/**
 * Qingcheng -> Manhogang(30681) drop candidate planner.
 *
 * SOURCE-GROUNDED: Korean 60014 NPC IDs and level-dependent aidrop{level}.
 * OBSERVED: 2 Qingcheng battles, bandit counts [0,1]; separate controlled
 * Manhogang kill made exactly one aidrop70 draw, no added equipment lane draw.
 * HYPOTHESIS: first drop selection is 1 of 100 from NPC-specific encrypted rows.
 * NOT YET KNOWN: deterministic ordinary enemy lineup generation from BattleRnd
 * (which changes on battles) and the exact 7209 award gate.
 *
 * Never log, serialize or commit input seed/save; returned summary only.
 */
const {draw,NPC}=require('../dungeon-lab/mask-7209-conditional.cjs');
const NPC_ID=Object.freeze({bandit:32950,mask:NPC.mask});
function getSeed(save) {
 const root=Array.isArray(save)?save[0]:save;
 const n=root?.Rnds?.Sds?.aidrop70;
 if(!Number.isSafeInteger(n)||n<=0)throw new Error('Invalid local aidrop70 lane');
 return n;
}
function validateBattle(b,i) {
 if(!b||!Number.isSafeInteger(b.bandits)||b.bandits<0||b.bandits>20)
  throw new RangeError('Each battle must declare 0..20 observed 70-level bandits (battle '+(i+1)+')');
 if(b.otherEnemies!==undefined&&(!Number.isSafeInteger(b.otherEnemies)||b.otherEnemies<0||b.otherEnemies>20))
  throw new RangeError('Invalid observed other enemy count');
 if(b.otherEnemies!==undefined&&b.bandits+b.otherEnemies>20)
  throw new RangeError('More than 20 enemies per battle');
}
function firstHits(seed,{maxDraws=2000,hitSlot=1}={}) {
 if(!Number.isSafeInteger(maxDraws)||maxDraws<1||maxDraws>100000||
  !Number.isSafeInteger(hitSlot)||hitSlot<1||hitSlot>100)
  throw new RangeError('Invalid 1% candidate scan bounds');
 const hits=[]; let state=seed;
 for(let index=1;index<=maxDraws;index++){
  const roll=draw(state,100);state=roll.seed;
  if(roll.value===hitSlot)hits.push(index);
 }
 return hits;
}
function plan(save,{observed=[],maxDraws=2000,hitSlot=1}={}){
 if(!Array.isArray(observed)||observed.length>10000)
  throw new RangeError('Observed field battle records must be an array (max 10000)');
 observed.forEach(validateBattle);
 const first=firstHits(getSeed(save),{maxDraws,hitSlot});
 const total=observed.reduce((n,b)=>n+b.bandits,0);
 let seed=getSeed(save);
 for(const b of observed)for(let k=0;k<b.bandits;k++)seed=draw(seed,100).seed;
 const future=firstHits(seed,{maxDraws,hitSlot});
 const next=future[0]??null;
 const ahead=next===null?null:next-1;
 const past=first.filter(n=>n<=total).length;
 return {
  item:'수라가면',sourceNpc:NPC.mask,banditNpc:NPC_ID.bandit,
  evidence:'source-level 70 lane + observed one-draw transitions',
  observedFights:observed.length,observedLevel70Bandits:total,
  observedFightsWithBandits:observed.filter(b=>b.bandits>0).length,
  observedBanditCounts:observed.map(b=>b.bandits),
  prior1PercentHitSlot:hitSlot,
  candidateSuccessesWithinObserved:ahead===null?null:past,
  nextCandidateAidrop70Index:next,
  level70DrawsBeforeNextCandidate:ahead,
  maskPlanWhenNoOtherConsumption: ahead===null?null:
   (ahead===0?'만호강 즉시 1회':('산적 등 70레벨 드랍 난수 '+ahead+'회 소비 후 만호강 1회')),
  firstFiveCandidateDraws:future.slice(0,5),
  futureBattleBanditCounts:null,
  futureBattleScheduleKnown:false,
  nativeFormationGeneratorVerified:false,
  stageTwoAwardVerified:false,
  exactMaskDropGuaranteed:false,
  privateInputsReported:false,
  limitations:[
   '청성산 일반 전투 번호별 산적 인원은 원본 적 편성 함수 없이는 자동 확정할 수 없음',
   'BattleRnd 상태 변화와 적 출현 인원 사이의 대응은 아직 복원되지 않음',
   '산적 1명당 aidrop70 추첨 1회라는 실측 지지 모델; 보상 분기 조건 미완전',
   '1/100 후보 당첨이 실제 수라가면 지급과 동일하다는 증거 없음'
  ]
 };
}
function verifyFutureFormationRows(rows){
 if(!Array.isArray(rows)||rows.length===0)throw new RangeError('No verified future composition rows');
 rows.forEach(validateBattle);
 return rows;
}
module.exports={getSeed,firstHits,plan,verifyFutureFormationRows};
