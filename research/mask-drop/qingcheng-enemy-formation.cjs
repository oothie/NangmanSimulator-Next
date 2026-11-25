'use strict';
// Exact Korean 60014 qc_enemy.lua enemy slots; no private seed handling.
const SOURCE=require('./60014-qingcheng-enemy-formation-source.json');
const RNG_SOURCE=Object.freeze({aliasVerified:!!SOURCE.jhConfig&&SOURCE.jhConfig.nativeAliasRandom.assignment==='math.jhrandom=math.random',source:'original Lua math.random aliased as math.jhrandom, initialized by os.time()',nativeRngStateInSaveVerified:false});
const FIRST=Object.freeze([32950,32951,32952]);
const SECOND=Object.freeze([32951,32952,32953]);
const THIRD=Object.freeze([32951,32952,32953]);
const NPCS=Object.freeze({32950:'산적',32951:'대도',32952:'유적',32953:'탈영병',32954:'두목'});
function checkRoll(x){if(!Number.isInteger(x)||x<1||x>3)throw RangeError('A JHRandom(1,3) roll is required')}
function fromRolls({first,second,third=null,boss=false}={}){
 checkRoll(first);checkRoll(second);
 if(typeof boss!=='boolean')throw TypeError('Boss branch must be known');
 if(boss){if(third!==null)throw RangeError('Boss branch skips third JHRandom')}
 else checkRoll(third);
 const ids=[FIRST[first-1],SECOND[second-1],boss?32954:THIRD[third-1]];
 return {npcIds:ids,names:ids.map(id=>NPCS[id]),
  bandits:ids.filter(id=>id===32950).length,
  jhRandomCalls:boss?2:3,bossRollUsesIndependentSeed:true,
  exactFutureFormationKnown:false,rngSource:RNG_SOURCE.source};
}
function bossRoll({enabled,roll,food=0,bonus=0}={}){
 if(typeof enabled!=='boolean')throw TypeError('GetP(3007)>=6 must be supplied');
 if(!enabled)return false;
 if(!Number.isInteger(roll)||roll<1||roll>1000||!Number.isInteger(food)||food<0||!Number.isInteger(bonus))
  throw RangeError('Need native rollenemy_qc outcome, food count and bonus');
 return roll-food*10<=bonus;
}
function negBinomQuantile(k,q,p=1/3){
 if(!Number.isInteger(k)||k<1||k>500||!(q>0&&q<1))throw RangeError('Invalid k or percentile');
 const mode=Math.max(k,Math.floor((k-1)/p));
 let log=k*Math.log(p);
 for(let n=k;n<mode;n++)log+=Math.log(n/(n-k+1))+Math.log(1-p);
 let mass=Math.exp(log);const a=new Float64Array(Math.max(mode*4,k+1500));a[mode]=mass;
 for(let n=mode;n>k;n--)a[n-1]=a[n]*(n-k)/((n-1)*(1-p));
 for(let n=mode+1;n<a.length;n++)a[n]=a[n-1]*(n-1)/(n-k)*(1-p);
 let total=0;
 for(let n=k;n<a.length;n++){total+=a[n];if(total>=q)return n}
 throw Error('Distribution tail not resolved');
}
function forecastBanditHunts(k){
 if(!Number.isInteger(k)||k<1||k>500)throw RangeError('Target must be 1..500');
 return {requestedBanditKills:k,sourceChancePerBattle:1/3,
  expectedBattles:k*3,medianBattles:negBinomQuantile(k,0.5),
  percentile90:[negBinomQuantile(k,.05),negBinomQuantile(k,.95)],
  percentile95:[negBinomQuantile(k,.025),negBinomQuantile(k,.975)],
  assumesIndependentUniformJHRandom:true,actualFutureBanditSchedule:null,
  jhRandomRuntimeSeedVerified:false,sourceAliasVerified:RNG_SOURCE.aliasVerified,
  sourceRng:RNG_SOURCE.source,exact7209AwardConfirmed:false};
}
module.exports={FIRST,SECOND,THIRD,NPCS,RNG_SOURCE,fromRolls,bossRoll,negBinomQuantile,forecastBanditHunts};
