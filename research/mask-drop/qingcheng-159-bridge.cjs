#!/usr/bin/env node
'use strict';
/**
 * Strict internal experiment for "159 Qingcheng field fights + one Manhogang".
 * Korean 60014 source level is NPC-specific; ONLY level-70 candidate 32950
 * can advance the same named aidrop70 lane as target 30681 under the current
 * getDropByID / one-draw hypothesis. A field fight count is NOT itself a
 * number of RNG calls. No user save, raw seed or roll is returned.
 */
const {draw,NPC}=require('../dungeon-lab/mask-7209-conditional.cjs');
const QINGCHENG=Object.freeze({
  32950:Object.freeze({name:'산적',level:70,drop:3031,dropName:'헝겊 조각',lane:'aidrop70'}),
  32951:Object.freeze({name:'대도',level:71,lane:'aidrop71'}),
  32952:Object.freeze({name:'유적',level:72,lane:'aidrop72'}),
  32953:Object.freeze({name:'탈영병',level:73,lane:'aidrop73'}),
  32954:Object.freeze({name:'두목',level:75,lane:'aidrop75',otherStage:'seed_32954'})
});
const MASK_NPC=NPC.mask;
function sourceSeed(save){
 const top=Array.isArray(save)?save[0]:save;
 const n=top?.Rnds?.Sds?.aidrop70;
 if(!Number.isSafeInteger(n)||n<=0)throw new Error('Local save must contain a valid aidrop70');
 return n;
}
function checkFights(fights){
 if(!Array.isArray(fights)||!fights.length||fights.length>100000)
  throw new RangeError('Explicit ordered fights required');
 for(const fight of fights){
  if(!Array.isArray(fight)||fight.length===0||fight.length>20 ||
     fight.some(id=>!Number.isSafeInteger(id)||!Object.hasOwn(QINGCHENG,id)))
   throw new RangeError('Only Korean-60014 Qingcheng NPC IDs 32950-32954 are supported');
 }
}
function evaluate(save,{fights,maskNpc=MASK_NPC,maskPreDraws=0}={}){
 checkFights(fights);
 if(maskNpc!==MASK_NPC)throw new RangeError('Only source-confirmed Manhogang 30681 drops 7209');
 if(!Number.isSafeInteger(maskPreDraws)||maskPreDraws<0||maskPreDraws>5)
  throw new RangeError('Mask pre-draws must be an explicitly hypothetical 0..5');
 let seed=sourceSeed(save),laneCalls=0,banditKills=0,otherNpcKills=0;
 let banditFavorable=0;
 for(const fight of fights){
  for(const id of fight){
   if(id!==NPC.bandit){otherNpcKills++;continue}
   // 32950 is the ONLY candidate level-70 direct-drop NPC here.
   // Its native reward branch is not yet proven to call weightRand per kill.
   const result=draw(seed,100);seed=result.seed;laneCalls++;banditKills++;
   if(result.value===1)banditFavorable++;
  }
 }
 for(let i=0;i<maskPreDraws;i++)seed=draw(seed,100).seed;
 const last=draw(seed,100),favorable=last.value===1;
 return {
  plan:'청성산 사냥 후 만호강 1회',fieldFights:fights.length,
  countedLevel70BanditKills:banditKills,otherLevelNpcKills:otherNpcKills,
  countedAidrop70CallsBeforeMask:laneCalls+maskPreDraws,
  precedingBanditFavorableRolls:banditFavorable,
  maskFirstStageFavorable:favorable,maskFirstStageIndex:laneCalls+maskPreDraws+1,
  favoredPrior:'one 1/100 chance in each supported direct-drop level70 NPC combat',
  caveat:'Cannot infer one 32950 drop call per actual Qingcheng fight without native execution; no other event may advance aidrop70.',
  exactRewardProven:false,nativeBanditCallProven:false,sharedLaneProven:false,
  privateInputReported:false
 };
}
function assess159(save){
 const allBandit=Array.from({length:159},()=>[NPC.bandit]);
 return evaluate(save,{fights:allBandit});
}
module.exports={QINGCHENG,evaluate,assess159};
